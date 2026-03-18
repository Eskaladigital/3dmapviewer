import React, { useState, useRef, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/types'

export default function ManualTraceModal() {
  const store = useStore()
  const theme = useStore((s) => s.theme)
  const open = useStore((s) => s.manualTraceModalOpen)
  const setManualTraceModalOpen = useStore((s) => s.setManualTraceModalOpen)
  const applyManualTrace = useStore((s) => s.applyManualTrace)

  const [points, setPoints] = useState<{ x: number; y: number }[]>([])
  const [step, setStep] = useState<'trace' | 'scale'>('trace')
  const [widthCm, setWidthCm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Pan & Zoom refs
  const panState = useRef({ isPanning: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0, hasDragged: false })
  const lastZoom = useRef(zoom)
  const zoomPivot = useRef<{ x: number; y: number } | null>(null)

  const c = THEMES[theme]
  const bg = store.floorPlanBackground

  // Adjust scroll after zoom to keep cursor focused
  React.useLayoutEffect(() => {
    if (containerRef.current && zoomPivot.current && lastZoom.current !== zoom) {
      const { x, y } = zoomPivot.current
      const container = containerRef.current
      const oldZoom = lastZoom.current
      const scale = zoom / oldZoom
      container.scrollLeft = (container.scrollLeft + x) * scale - x
      container.scrollTop = (container.scrollTop + y) * scale - y
    }
    lastZoom.current = zoom
  }, [zoom])

  const handleClose = () => {
    setManualTraceModalOpen(false)
    setPoints([])
    setStep('trace')
    setWidthCm('')
    setError(null)
    setImgSize(null)
    setZoom(1)
    lastZoom.current = 1
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const container = containerRef.current
    if (!container) return
    e.preventDefault()
    e.stopPropagation()

    const rect = container.getBoundingClientRect()
    zoomPivot.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }

    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom((z) => Math.min(Math.max(z * delta, 0.2), 10))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Permitir clic en botones sin iniciar pan
    if ((e.target as HTMLElement).closest('button')) return

    const container = containerRef.current
    if (!container) return
    
    panState.current = {
      isPanning: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      hasDragged: false
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panState.current.isPanning) return
    const container = containerRef.current
    if (!container) return

    const dx = e.clientX - panState.current.startX
    const dy = e.clientY - panState.current.startY

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      panState.current.hasDragged = true
    }

    if (panState.current.hasDragged) {
      container.scrollLeft = panState.current.scrollLeft - dx
      container.scrollTop = panState.current.scrollTop - dy
    }
  }, [])

  const handleMouseUp = useCallback(() => {
    panState.current.isPanning = false
  }, [])

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (panState.current.hasDragged) return
    
    const img = imgRef.current
    if (!img || !img.complete) return
    const rect = img.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const scaleX = img.naturalWidth / rect.width
    const scaleY = img.naturalHeight / rect.height
    const px = Math.round(x * scaleX)
    const py = Math.round(y * scaleY)
    setPoints((p) => [...p, { x: px, y: py }])
  }, [])

  const handleUndo = () => setPoints((p) => p.slice(0, -1))
  const handleReset = () => setPoints([])

  const handleFinishTrace = () => {
    if (points.length < 3) {
      setError('Necesitas al menos 3 puntos')
      return
    }
    setStep('scale')
    setError(null)
  }

  const handleApply = () => {
    const w = parseFloat(widthCm)
    if (!w || w <= 0) {
      setError('Indica el ancho total en cm (ej: 1200 para 12 m)')
      return
    }
    applyManualTrace(points, w)
    handleClose()
  }

  if (!open || !bg?.dataUrl) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        style={{
          background: theme === 'dark' ? '#181a24' : '#ffffff',
          borderRadius: 16,
          maxWidth: '90vw',
          width: 1200,
          maxHeight: '90vh',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          border: theme === 'dark' ? '1px solid #2a2d42' : '1px solid #e0e4ec',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: c.text }}>
            {step === 'trace' ? '✏️ Calcar manualmente' : '📐 Escala'}
          </h2>
        </div>

        <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {step === 'trace' ? (
            <>
              <div style={{ fontSize: 13, color: c.textMuted, marginBottom: 16, flexShrink: 0 }}>
                Haz clic en las esquinas del plano, en orden, siguiendo el contorno. Cada clic marca un punto. Conecta las esquinas de cada habitación.
              </div>

              <div
                ref={containerRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  flex: 1,
                  overflow: 'hidden', // Ocultamos scrollbars nativos para que sea full "drag to pan" style
                  borderRadius: 12,
                  border: `1px solid ${c.border}`,
                  background: theme === 'dark' ? '#0d0e14' : '#f5f5f5',
                  position: 'relative',
                  cursor: 'grab',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    zIndex: 10,
                  }}
                >
                  <button
                    onClick={() => setZoom((z) => Math.min(z + 0.5, 5))}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: c.bgCard,
                      border: `1px solid ${c.border}`,
                      color: c.text,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    +
                  </button>
                  <button
                    onClick={() => setZoom((z) => Math.max(z - 0.5, 0.5))}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: c.bgCard,
                      border: `1px solid ${c.border}`,
                      color: c.text,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    }}
                  >
                    −
                  </button>
                </div>

                <div
                  style={{
                    position: 'relative',
                    width: imgSize ? imgSize.w * zoom : '100%',
                    height: imgSize ? imgSize.h * zoom : 'auto',
                    cursor: 'crosshair',
                    transformOrigin: 'top left',
                    pointerEvents: panState.current.isPanning ? 'none' : 'auto', // Optimización
                  }}
                  onClick={handleImageClick}
                >
                  <img
                  ref={imgRef}
                  src={bg.dataUrl}
                  alt="Plano"
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onLoad={() => {
                    const img = imgRef.current
                    if (img) setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
                  }}
                  />
                  {imgSize && points.length > 0 && (
                    <svg
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none',
                      }}
                      viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
                      preserveAspectRatio="none"
                    >
                      {points.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={8} fill="#5B8DEF" stroke="#fff" strokeWidth={2} />
                    ))}
                    {points.length > 1 && (
                      <polyline
                        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#5B8DEF"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}
                  </svg>
                )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 13, color: c.textMuted }}>{points.length} puntos</span>
                <button
                  onClick={handleUndo}
                  disabled={points.length === 0}
                  style={{
                    padding: '8px 16px',
                    background: c.bgCard,
                    color: c.text,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: points.length ? 'pointer' : 'not-allowed',
                    opacity: points.length ? 1 : 0.5,
                  }}
                >
                  ↩ Deshacer último
                </button>
                <button
                  onClick={handleReset}
                  disabled={points.length === 0}
                  style={{
                    padding: '8px 16px',
                    background: c.bgCard,
                    color: '#ef5b5b',
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: points.length ? 'pointer' : 'not-allowed',
                    opacity: points.length ? 1 : 0.5,
                  }}
                >
                  🗑️ Borrar todo
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={handleFinishTrace}
                  disabled={points.length < 3}
                  style={{
                    padding: '8px 20px',
                    background: c.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: points.length >= 3 ? 'pointer' : 'not-allowed',
                    opacity: points.length >= 3 ? 1 : 0.5,
                  }}
                >
                  Continuar →
                </button>
                <button
                  onClick={handleClose}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    color: c.textMuted,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
              </div>
              {error && <div style={{ marginTop: 12, fontSize: 13, color: '#ef5b5b' }}>{error}</div>}
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: c.textMuted, marginBottom: 16 }}>
                Indica el ancho total de la vivienda en cm para escalar el plano (ej: 1200 para 12 metros).
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
                <input
                  type="number"
                  value={widthCm}
                  onChange={(e) => setWidthCm(e.target.value)}
                  placeholder="Ej: 1200"
                  min={100}
                  max={5000}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 14,
                    background: c.bgInput,
                    border: `1px solid ${c.borderLight}`,
                    borderRadius: 8,
                    color: c.text,
                  }}
                />
                <span style={{ fontSize: 13, color: c.textMuted }}>cm</span>
              </div>
              {error && <div style={{ marginBottom: 12, fontSize: 13, color: '#ef5b5b' }}>{error}</div>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setStep('trace')}
                  style={{
                    padding: '10px 18px',
                    background: 'transparent',
                    color: c.textMuted,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  ← Atrás
                </button>
                <button
                  onClick={handleApply}
                  style={{
                    padding: '10px 20px',
                    background: c.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Generar paredes
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
