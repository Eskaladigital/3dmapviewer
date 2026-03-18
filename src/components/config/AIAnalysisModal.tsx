import React, { useState } from 'react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/types'
import DetectionPreview from './DetectionPreview'
import ReferenceSelector, { type ReferenceOption } from './ReferenceSelector'

export default function AIAnalysisModal() {
  const store = useStore()
  const theme = useStore((s) => s.theme)
  const open = useStore((s) => s.aiAnalysisModalOpen)
  const analysis = useStore((s) => s.aiAnalysisResult)
  const apiError = useStore((s) => s.aiAnalysisError)
  const applying = useStore((s) => s.aiAnalysisApplying)
  const setAiAnalysisModalOpen = useStore((s) => s.setAiAnalysisModalOpen)
  const setAiAnalysisError = useStore((s) => s.setAiAnalysisError)
  const applyAiAnalysisWithReference = useStore((s) => s.applyAiAnalysisWithReference)

  const [step, setStep] = useState<'preview' | 'measure'>('preview')
  const [selectedRef, setSelectedRef] = useState<ReferenceOption | null>(null)
  const [widthCm, setWidthCm] = useState('')
  const [depthCm, setDepthCm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const c = THEMES[theme]


  const handleClose = () => {
    store.setAiAnalysisModalOpen(false)
    store.setAiAnalysisResult(null)
    store.setAiAnalysisError(null)
    setStep('preview')
    setSelectedRef(null)
    setWidthCm('')
    setDepthCm('')
    setError(null)
  }

  const handleRetry = async () => {
    const bg = store.floorPlanBackground
    if (!bg?.dataUrl) return
    store.setAiAnalysisError(null)
    store.setAiAnalysisResult(null)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Error cargando imagen'))
        img.src = bg.dataUrl
      })
      const res = await fetch('/api/analyze-floor-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: bg.dataUrl,
          imageWidth: img.width,
          imageHeight: img.height,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      store.setAiAnalysisResult(data)
      setStep('preview')
    } catch (e) {
      store.setAiAnalysisError(String(e))
    }
  }

  const handleApply = () => {
    const w = parseFloat(widthCm)
    const d = parseFloat(depthCm)
    const ref = selectedRef ?? analysis?.referenceSuggestion
    const isTotalWidth = ref?.type === 'plano'
    const isPared = ref?.type === 'pared'
    if (!selectedRef) {
      setError('Haz clic en un elemento del plano para seleccionarlo')
      return
    }
    if (!w || w <= 0) {
      setError(isTotalWidth ? 'Indica el ancho total en cm (ej: 1200 para 12 m)' : isPared ? 'Indica la longitud de la pared en cm' : 'Indica ancho y fondo en cm (ej: 220 y 90)')
      return
    }
    if (!isTotalWidth && !isPared && (!d || d <= 0)) {
      setError('Indica ancho y fondo en cm (ej: 220 y 90)')
      return
    }
    const refOverride = selectedRef
      ? {
          type: selectedRef.type,
          label: selectedRef.label,
          room: selectedRef.type === 'mueble' ? selectedRef.room : '',
          widthPx: selectedRef.type === 'pared' ? selectedRef.lengthPx : selectedRef.widthPx,
          heightPx: selectedRef.type === 'pared' ? 0 : selectedRef.heightPx,
          lengthPx: selectedRef.type === 'pared' ? selectedRef.lengthPx : undefined,
        }
      : undefined
    applyAiAnalysisWithReference(w, isTotalWidth || isPared ? 0 : d, refOverride)
  }

  if (!open) return null

  const isLoading = open && !analysis && !apiError
  const hasRef = analysis && (analysis.walls?.length > 0 || analysis.furniture?.length > 0)
  const hasError = !!apiError

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && !isLoading && handleClose()}
    >
      <div
        style={{
          background: theme === 'dark' ? '#181a24' : '#ffffff',
          borderRadius: 16,
          maxWidth: step === 'preview' ? 520 : 560,
          width: '100%',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          border: theme === 'dark' ? '1px solid #2a2d42' : '1px solid #e0e4ec',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${c.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: 18, color: c.text }}>
            {isLoading ? '🔍 Analizando plano con IA...' : hasError ? '❌ Error' : step === 'preview' ? '🤖 Vista previa de detección' : '📐 Medida de referencia'}
          </h2>
        </div>

        <div style={{ padding: 24 }}>
          {isLoading && (
            <div style={{ textAlign: 'center', padding: 40, color: c.textMuted }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>Análisis de plano nivel CAD profesional</div>
              <div style={{ fontSize: 12 }}>Extrayendo paredes, muebles, aberturas y habitaciones con precisión...</div>
            </div>
          )}

          {hasError && (
            <div style={{ padding: 20 }}>
              <div style={{
                padding: 16,
                background: 'rgba(239,91,91,0.15)',
                borderRadius: 12,
                color: '#ef5b5b',
                fontSize: 14,
                marginBottom: 16,
              }}>
                {apiError}
              </div>
              <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16 }}>
                Comprueba que OPENAI_API_KEY esté en .env.local y que tengas acceso a GPT-4o.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={async () => {
                    const bg = store.floorPlanBackground
                    if (!bg?.dataUrl) return
                    store.setAiAnalysisError(null)
                    store.setAiAnalysisResult(null)
                    try {
                      const img = new Image()
                      await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve()
                        img.onerror = () => reject(new Error('Error cargando imagen'))
                        img.src = bg.dataUrl
                      })
                      const res = await fetch('/api/analyze-floor-plan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          image: bg.dataUrl,
                          imageWidth: img.width,
                          imageHeight: img.height,
                        }),
                      })
                      const data = await res.json()
                      if (!res.ok) throw new Error(data.error || 'Error')
                      store.setAiAnalysisResult(data)
                    } catch (e) {
                      store.setAiAnalysisError(String(e))
                    }
                  }}
                  style={{
                    padding: '10px 18px',
                    background: c.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  🔄 Reintentar
                </button>
                <button
                  onClick={handleClose}
                  style={{
                    padding: '10px 18px',
                    background: c.bgCard,
                    color: c.text,
                    border: `1px solid ${c.border}`,
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}

          {(hasRef || (analysis && (analysis.walls?.length > 0 || analysis.furniture?.length > 0))) && (
            <>
              {step === 'preview' && store.floorPlanBackground?.dataUrl && analysis && (
                <DetectionPreview
                  imageUrl={store.floorPlanBackground.dataUrl}
                  analysis={analysis}
                  onContinue={() => setStep('measure')}
                  onRetry={handleRetry}
                  onCancel={handleClose}
                  theme={theme}
                  c={c}
                />
              )}

              {step === 'measure' && store.floorPlanBackground?.dataUrl && analysis && (
                <>
              {applying && (
                <div style={{
                  padding: 16, background: 'rgba(91,141,239,0.1)', borderRadius: 12,
                  marginBottom: 16, fontSize: 14, color: c.text, textAlign: 'center',
                }}>
                  ⏳ Importando plano... Puede tardar unos segundos.
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <ReferenceSelector
                  imageUrl={store.floorPlanBackground.dataUrl}
                  analysis={analysis}
                  selected={selectedRef}
                  onSelect={setSelectedRef}
                  theme={theme}
                  c={c}
                />
              </div>

              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 6 }}>
                    {selectedRef?.type === 'plano' ? 'Ancho total (cm)' : selectedRef?.type === 'pared' ? 'Longitud (cm)' : 'Ancho (cm)'}
                  </label>
                  <input
                    type="number"
                    value={widthCm}
                    onChange={(e) => setWidthCm(e.target.value)}
                    placeholder={selectedRef?.type === 'plano' ? 'Ej: 1200 (12 m)' : selectedRef?.type === 'pared' ? 'Ej: 350 (3.5 m)' : 'Ej: 220'}
                    min={10}
                    max={selectedRef?.type === 'plano' ? 5000 : 500}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 14,
                      background: c.bgInput,
                      border: `1px solid ${c.borderLight}`,
                      borderRadius: 8,
                      color: c.text,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
                <div style={{ flex: 1, display: (selectedRef?.type === 'plano' || selectedRef?.type === 'pared') ? 'none' : undefined }}>
                  <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 6 }}>
                    Fondo (cm)
                  </label>
                  <input
                    type="number"
                    value={depthCm}
                    onChange={(e) => setDepthCm(e.target.value)}
                    placeholder="Ej: 90"
                    min={10}
                    max={500}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 14,
                      background: c.bgInput,
                      border: `1px solid ${c.borderLight}`,
                      borderRadius: 8,
                      color: c.text,
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>

              {(selectedRef?.type === 'mueble' || !selectedRef) && (
                <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 16 }}>
                  Ejemplos: Sofá 3 plazas 220×90 · Cama 160×210 · Bañera 75×170 · Mesa 140×90
                </div>
              )}

              {error && (
                <div style={{
                  marginBottom: 16,
                  padding: 10,
                  background: 'rgba(239,91,91,0.15)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#ef5b5b',
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between' }}>
                <button
                  onClick={() => setStep('preview')}
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
                <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleClose}
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
                  Cancelar
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  style={{
                    padding: '10px 18px',
                    background: c.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: applying ? 'wait' : 'pointer',
                    opacity: applying ? 0.7 : 1,
                  }}
                >
                  {applying ? 'Importando...' : 'Generar plano 2D'}
                </button>
                </div>
              </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
