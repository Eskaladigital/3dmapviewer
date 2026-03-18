import React, { useCallback, useMemo } from 'react'
import type { FloorPlanAIAnalysis } from '@/types'

export type ReferenceOption =
  | { type: 'mueble'; label: string; room: string; widthPx: number; heightPx: number; index: number }
  | { type: 'pared'; label: string; lengthPx: number; index: number; wallIndex: number }
  | { type: 'plano'; label: string; widthPx: number; heightPx: number }

type Props = {
  imageUrl: string
  analysis: FloorPlanAIAnalysis
  selected: ReferenceOption | null
  onSelect: (ref: ReferenceOption) => void
  theme: 'dark' | 'light'
  c: { text: string; textMuted: string; accent: string; border: string }
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

export default function ReferenceSelector({ imageUrl, analysis, selected, onSelect, theme, c }: Props) {
  const imgW = analysis.imageWidth || 800
  const imgH = analysis.imageHeight || 600
  const scale = Math.min(1, 320 / Math.max(imgW, imgH))
  const w = imgW * scale
  const h = imgH * scale

  const furniture = analysis.furniture || []
  const walls = analysis.walls || []

  const options = useMemo((): ReferenceOption[] => {
    const list: ReferenceOption[] = []
    furniture.forEach((f, i) => {
      list.push({
        type: 'mueble',
        label: f.label || 'Mueble',
        room: f.room || '',
        widthPx: f.widthPx || 40,
        heightPx: f.heightPx || 40,
        index: i,
      })
    })
    walls.forEach((wall, i) => {
      const len = Math.sqrt(
        (wall.end.x - wall.start.x) ** 2 + (wall.end.y - wall.start.y) ** 2
      )
      if (len > 20) {
        list.push({
          type: 'pared',
          label: `Pared ${i + 1}`,
          lengthPx: len,
          index: i,
          wallIndex: i,
        })
      }
    })
    const minX = Math.min(...walls.flatMap((w) => [w.start.x, w.end.x]), 0)
    const maxX = Math.max(...walls.flatMap((w) => [w.start.x, w.end.x]), imgW)
    const minY = Math.min(...walls.flatMap((w) => [w.start.y, w.end.y]), 0)
    const maxY = Math.max(...walls.flatMap((w) => [w.start.y, w.end.y]), imgH)
    const planW = maxX - minX || imgW
    const planH = maxY - minY || imgH
    list.push({
      type: 'plano',
      label: 'Ancho total del plano',
      widthPx: planW,
      heightPx: planH,
    })
    return list
  }, [furniture, walls, imgW, imgH])

  const hitTest = useCallback(
    (clientX: number, clientY: number, rect: DOMRect): ReferenceOption | null => {
      const scaleX = imgW / rect.width
      const scaleY = imgH / rect.height
      const px = (clientX - rect.left) * scaleX
      const py = (clientY - rect.top) * scaleY

      const HIT_PADDING = 15

      for (const opt of options) {
        if (opt.type === 'mueble') {
          const f = furniture[opt.index]
          if (!f) continue
          const hw = (f.widthPx || 40) / 2
          const hh = (f.heightPx || 40) / 2
          const x1 = f.x - hw - HIT_PADDING
          const y1 = f.y - hh - HIT_PADDING
          const x2 = f.x + hw + HIT_PADDING
          const y2 = f.y + hh + HIT_PADDING
          if (px >= x1 && px <= x2 && py >= y1 && py <= y2) return opt
        } else if (opt.type === 'pared') {
          const wall = walls[opt.wallIndex]
          if (!wall) continue
          const d = distToSegment(px, py, wall.start.x, wall.start.y, wall.end.x, wall.end.y)
          if (d <= HIT_PADDING) return opt
        }
      }

      const planoOpt = options.find((o) => o.type === 'plano')
      if (planoOpt) return planoOpt
      return null
    },
    [options, furniture, walls, imgW, imgH]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const found = hitTest(e.clientX, e.clientY, rect)
      if (found) onSelect(found)
    },
    [hitTest, onSelect]
  )

  const isSelected = (opt: ReferenceOption): boolean => {
    if (!selected || opt.type !== selected.type) return false
    if (opt.type === 'plano') return true
    if (opt.type === 'mueble') return opt.index === selected.index
    if (opt.type === 'pared') return opt.wallIndex === selected.wallIndex
    return false
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: c.textMuted }}>
        Haz clic sobre un mueble, pared o en zona vacía (ancho total) para elegir la referencia. Luego indica sus medidas reales.
      </div>

      <div
        onClick={handleClick}
        style={{
          position: 'relative',
          width: w,
          height: h,
          margin: '0 auto',
          borderRadius: 12,
          overflow: 'hidden',
          border: `2px solid ${c.border}`,
          background: theme === 'dark' ? '#0d0e14' : '#f0f0f0',
          cursor: 'pointer',
        }}
      >
        <img
          src={imageUrl}
          alt="Plano"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
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
          {furniture.map((f, i) => {
            const opt = options.find((o) => o.type === 'mueble' && (o as { index: number }).index === i) as
              | (ReferenceOption & { index: number })
              | undefined
            const sel = opt && isSelected(opt)
            const hw = (f.widthPx || 40) / 2
            const hh = (f.heightPx || 40) / 2
            return (
              <rect
                key={`f-${i}`}
                x={f.x - hw}
                y={f.y - hh}
                width={f.widthPx || 40}
                height={f.heightPx || 40}
                fill={sel ? 'rgba(91,141,239,0.5)' : 'rgba(123,79,239,0.25)'}
                stroke={sel ? '#5B8DEF' : '#7B4FEF'}
                strokeWidth={sel ? 4 : 2}
                rx={4}
              />
            )
          })}
          {walls.map((wall, i) => {
            const opt = options.find((o) => o.type === 'pared' && (o as { wallIndex: number }).wallIndex === i) as
              | (ReferenceOption & { wallIndex: number })
              | undefined
            const sel = opt && isSelected(opt)
            return (
              <line
                key={`w-${i}`}
                x1={wall.start.x}
                y1={wall.start.y}
                x2={wall.end.x}
                y2={wall.end.y}
                stroke={sel ? '#5B8DEF' : '#7B4FEF'}
                strokeWidth={sel ? 8 : 6}
                strokeLinecap="round"
              />
            )
          })}
        </svg>
      </div>

      {selected && (
        <div
          style={{
            padding: 12,
            background: 'rgba(91,141,239,0.15)',
            borderRadius: 10,
            border: `1px solid ${c.accent}`,
            fontSize: 14,
            color: c.text,
          }}
        >
          <strong>Seleccionado:</strong> {selected.label}
          {selected.type === 'mueble' && selected.room && ` en ${selected.room}`}
          {selected.type === 'pared' && ' — indica la longitud en cm'}
          {selected.type === 'plano' && ' — indica el ancho total en cm'}
        </div>
      )}
    </div>
  )
}
