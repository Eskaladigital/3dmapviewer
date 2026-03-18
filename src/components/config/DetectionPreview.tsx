import React, { useState, useRef, useEffect } from 'react'
import type { FloorPlanAIAnalysis } from '@/types'

const ANIM_MS_PER_WALL = 80

type Props = {
  imageUrl: string
  analysis: FloorPlanAIAnalysis
  onContinue: () => void
  onRetry: () => void
  onCancel?: () => void
  theme: 'dark' | 'light'
  c: { text: string; textMuted: string; accent: string; border: string }
}

export default function DetectionPreview({ imageUrl, analysis, onContinue, onRetry, onCancel, theme, c }: Props) {
  const [playing, setPlaying] = useState(false)
  const [visibleWalls, setVisibleWalls] = useState(0)
  const [visiblePoints, setVisiblePoints] = useState(false)
  const [visibleFurniture, setVisibleFurniture] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const walls = analysis.walls || []
  const furniture = analysis.furniture || []

  // Extraer puntos únicos de las paredes (esquinas)
  const corners = React.useMemo(() => {
    const seen = new Set<string>()
    const pts: { x: number; y: number }[] = []
    walls.forEach((w) => {
      const key = (p: { x: number; y: number }) => `${Math.round(p.x)}_${Math.round(p.y)}`
      if (!seen.has(key(w.start))) {
        seen.add(key(w.start))
        pts.push(w.start)
      }
      if (!seen.has(key(w.end))) {
        seen.add(key(w.end))
        pts.push(w.end)
      }
    })
    return pts
  }, [walls])

  const handlePlay = () => {
    setVisibleWalls(0)
    setVisiblePoints(false)
    setVisibleFurniture(false)
    setPlaying(true)
  }

  useEffect(() => {
    if (!playing) return
    // Fase 1: mostrar puntos (esquinas)
    const t1 = setTimeout(() => setVisiblePoints(true), 100)
    // Fase 2: dibujar paredes una a una (o todo si no hay paredes)
    if (walls.length === 0) {
      const t2 = setTimeout(() => {
        setVisibleFurniture(true)
        setPlaying(false)
      }, 400)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
    const wallInterval = setInterval(() => {
      setVisibleWalls((n) => {
        if (n >= walls.length) {
          clearInterval(wallInterval)
          setTimeout(() => setVisibleFurniture(true), 200)
          setTimeout(() => setPlaying(false), 300)
          return n
        }
        return n + 1
      })
    }, ANIM_MS_PER_WALL)
    return () => {
      clearTimeout(t1)
      clearInterval(wallInterval)
    }
  }, [playing, walls.length])

  const imgW = analysis.imageWidth || 800
  const imgH = analysis.imageHeight || 600
  const scale = Math.min(1, 380 / Math.max(imgW, imgH))
  const w = imgW * scale
  const h = imgH * scale

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, color: c.textMuted }}>
        Vista previa de la detección. Pulsa Play para ver cómo el robot marca paredes y puntos.
        {walls.length < 12 && walls.length > 0 && (
          <span style={{ display: 'block', marginTop: 6, color: '#f59e0b' }}>
            ⚠️ Pocas paredes detectadas ({walls.length}). Si no coinciden con el plano, usa Reanalizar o añade paredes manualmente.
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: w,
          height: h,
          margin: '0 auto',
          borderRadius: 12,
          overflow: 'hidden',
          border: `1px solid ${c.border}`,
          background: theme === 'dark' ? '#0d0e14' : '#f0f0f0',
        }}
      >
        <img
          src={imageUrl}
          alt="Plano"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
          viewBox={`0 0 ${imgW} ${imgH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Puntos (esquinas) */}
          {visiblePoints &&
            corners.map((p, i) => (
              <circle
                key={`pt-${i}`}
                cx={p.x}
                cy={p.y}
                r={6}
                fill="#5B8DEF"
                stroke="#fff"
                strokeWidth={2}
                style={{ animation: 'pulse 1.5s ease-in-out infinite' }}
              />
            ))}

          {/* Paredes */}
          {walls.slice(0, visibleWalls).map((wall, i) => (
            <line
              key={i}
              x1={wall.start.x}
              y1={wall.start.y}
              x2={wall.end.x}
              y2={wall.end.y}
              stroke="#5B8DEF"
              strokeWidth={4}
              strokeLinecap="round"
            />
          ))}

          {/* Muebles como círculos */}
          {visibleFurniture &&
            furniture.map((f, i) => (
              <circle
                key={`f-${i}`}
                cx={f.x}
                cy={f.y}
                r={Math.max(8, Math.min(f.widthPx || 20, f.heightPx || 20) / 2)}
                fill="rgba(123, 79, 239, 0.4)"
                stroke="#7B4FEF"
                strokeWidth={2}
              />
            ))}
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={handlePlay}
          disabled={playing}
          style={{
            padding: '10px 20px',
            background: c.accent,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: playing ? 'wait' : 'pointer',
            opacity: playing ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {playing ? (
            <>⏳ Marcando {visibleWalls}/{walls.length} paredes...</>
          ) : (
            <>▶ Play — Ver detección</>
          )}
        </button>
        <button
          onClick={onRetry}
          disabled={playing}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            color: c.textMuted,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            fontSize: 14,
            cursor: playing ? 'not-allowed' : 'pointer',
          }}
        >
          🔄 Reanalizar
        </button>
        <button
          onClick={onContinue}
          style={{
            padding: '10px 20px',
            background: theme === 'dark' ? '#2a2d42' : '#e8ecf4',
            color: c.text,
            border: `1px solid ${c.border}`,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Continuar →
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            style={{
              padding: '10px 16px',
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
        )}
      </div>
    </div>
  )
}
