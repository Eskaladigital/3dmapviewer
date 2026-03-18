import type { FloorPlanBackground } from '@/types'
import type { Point } from '@/types'

/** Convierte archivo (imagen, PDF, DXF) a FloorPlanBackground */
export async function loadFloorPlanFile(file: File): Promise<FloorPlanBackground | null> {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
    return loadImageFile(file)
  }
  if (ext === 'pdf') {
    return loadPdfFile(file)
  }
  if (ext === 'dxf') {
    return loadDxfFile(file)
  }
  return null
}

function loadImageFile(file: File): Promise<FloorPlanBackground | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve({ dataUrl })
    }
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

async function loadPdfFile(file: File): Promise<FloorPlanBackground | null> {
  try {
    const pdfjsLib = await import('pdfjs-dist')
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const page = await pdf.getPage(1)
    const scale = 2
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    await page.render({ canvasContext: ctx, viewport }).promise
    const dataUrl = canvas.toDataURL('image/png')
    return { dataUrl }
  } catch {
    return null
  }
}

interface DxfLine {
  start: { x: number; y: number }
  end: { x: number; y: number }
}

async function loadDxfFile(file: File): Promise<FloorPlanBackground | null> {
  try {
    const text = await file.text()
    const DxfParser = (await import('dxf-parser')).default
    const parser = new DxfParser()
    const dxf = parser.parseSync(text)
    if (!dxf || !dxf.entities) return null

    const lines: DxfLine[] = []
    const entities = dxf.entities as Array<{ type: string; vertices?: Array<{ x: number; y: number }> }>
    for (const e of entities) {
      if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
        lines.push({ start: e.vertices[0], end: e.vertices[1] })
      } else if (e.type === 'LWPOLYLINE' && e.vertices && e.vertices.length >= 2) {
        for (let i = 0; i < e.vertices.length - 1; i++) {
          lines.push({ start: e.vertices[i], end: e.vertices[i + 1] })
        }
      } else if (e.type === 'POLYLINE' && e.vertices && e.vertices.length >= 2) {
        for (let i = 0; i < e.vertices.length - 1; i++) {
          lines.push({ start: e.vertices[i], end: e.vertices[i + 1] })
        }
      }
    }

    if (lines.length === 0) return null

    // Calcular bounds y escala para dibujar en canvas
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const l of lines) {
      minX = Math.min(minX, l.start.x, l.end.x)
      maxX = Math.max(maxX, l.start.x, l.end.x)
      minY = Math.min(minY, l.start.y, l.end.y)
      maxY = Math.max(maxY, l.start.y, l.end.y)
    }
    const w = maxX - minX || 100
    const h = maxY - minY || 100
    const pad = Math.max(w, h) * 0.1
    const cw = 800
    const ch = 600
    const scale = Math.min((cw - pad * 2) / (w + pad * 2), (ch - pad * 2) / (h + pad * 2), 1)

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#1a1c28'
    ctx.fillRect(0, 0, cw, ch)
    ctx.strokeStyle = '#5B8DEF'
    ctx.lineWidth = 2
    ctx.beginPath()

    const toX = (x: number) => (x - minX) * scale + pad
    const toY = (y: number) => ch - ((y - minY) * scale + pad)

    for (const l of lines) {
      ctx.moveTo(toX(l.start.x), toY(l.start.y))
      ctx.lineTo(toX(l.end.x), toY(l.end.y))
    }
    ctx.stroke()

    const dataUrl = canvas.toDataURL('image/png')
    return { dataUrl }
  } catch {
    return null
  }
}

/** Extrae paredes desde DXF para importar al proyecto */
export async function extractWallsFromDxf(file: File): Promise<Array<{ start: Point; end: Point }>> {
  try {
    const text = await file.text()
    const DxfParser = (await import('dxf-parser')).default
    const parser = new DxfParser()
    const dxf = parser.parseSync(text)
    if (!dxf || !dxf.entities) return []

    const walls: Array<{ start: Point; end: Point }> = []
    const entities = dxf.entities as Array<{ type: string; vertices?: Array<{ x: number; y: number }> }>

    for (const e of entities) {
      if (e.type === 'LINE' && e.vertices && e.vertices.length >= 2) {
        walls.push({ start: { x: e.vertices[0].x, y: e.vertices[0].y }, end: { x: e.vertices[1].x, y: e.vertices[1].y } })
      } else if ((e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') && e.vertices && e.vertices.length >= 2) {
        for (let i = 0; i < e.vertices.length - 1; i++) {
          walls.push({
            start: { x: e.vertices[i].x, y: e.vertices[i].y },
            end: { x: e.vertices[i + 1].x, y: e.vertices[i + 1].y },
          })
        }
      }
    }
    return walls
  } catch {
    return []
  }
}
