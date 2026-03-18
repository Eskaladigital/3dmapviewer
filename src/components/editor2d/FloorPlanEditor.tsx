import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '@/store/useStore'
import type { Point, FurnitureItem, Wall } from '@/types'
import { THEMES } from '@/types'

const SCALE = 80 // pixels per meter
const ROTATION_HANDLE_RADIUS_PX = 35

/** Siluetas en planta (vista AutoCAD): rect {x,y,w,h} normalizado 0-1, circle {x,y,r} */
type PlanPart = { type: 'rect'; x: number; y: number; w: number; h: number } | { type: 'circle'; x: number; y: number; r: number }
function getFurniturePlanShape(type: string, item?: { type: string; flipL?: boolean }): PlanPart[] | null {
  const shapes: Record<string, PlanPart[]> = {
    // Sofás: base + brazos + cojines asiento + respaldo
    sofa_3: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.06, y: 0.5, w: 0.11, h: 1 },
      { type: 'rect', x: 0.94, y: 0.5, w: 0.11, h: 1 },
      { type: 'rect', x: 0.5, y: 0.09, w: 0.8, h: 0.18 },
      { type: 'rect', x: 0.2, y: 0.38, w: 0.26, h: 0.5 },
      { type: 'rect', x: 0.5, y: 0.38, w: 0.26, h: 0.5 },
      { type: 'rect', x: 0.8, y: 0.38, w: 0.26, h: 0.5 },
    ],
    sofa_2: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.07, y: 0.5, w: 0.14, h: 1 },
      { type: 'rect', x: 0.93, y: 0.5, w: 0.14, h: 1 },
      { type: 'rect', x: 0.5, y: 0.1, w: 0.75, h: 0.18 },
      { type: 'rect', x: 0.3, y: 0.4, w: 0.35, h: 0.55 },
      { type: 'rect', x: 0.7, y: 0.4, w: 0.35, h: 0.55 },
    ],
    sofa_L: [
      { type: 'rect', x: 0.5, y: 0.22, w: 1, h: 0.45 },
      { type: 'rect', x: 0.82, y: 0.55, w: 0.45, h: 0.55 },
      { type: 'rect', x: 0.5, y: 0.08, w: 0.88, h: 0.16 },
      { type: 'rect', x: 0.2, y: 0.35, w: 0.55, h: 0.35 },
      { type: 'rect', x: 0.82, y: 0.35, w: 0.35, h: 0.35 },
    ],
    armchair: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.08, y: 0.5, w: 0.12, h: 1 },
      { type: 'rect', x: 0.92, y: 0.5, w: 0.12, h: 1 },
      { type: 'rect', x: 0.5, y: 0.12, w: 0.78, h: 0.16 },
      { type: 'rect', x: 0.5, y: 0.45, w: 0.78, h: 0.55 },
    ],
    recliner: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.08, y: 0.5, w: 0.14, h: 1 },
      { type: 'rect', x: 0.92, y: 0.5, w: 0.14, h: 1 },
      { type: 'rect', x: 0.5, y: 0.13, w: 0.82, h: 0.2 },
      { type: 'rect', x: 0.5, y: 0.48, w: 0.82, h: 0.55 },
    ],
    pouf: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.48 }],
    // Camas: colchón + cabecero
    bed_double: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.5, y: 0.92, w: 0.95, h: 0.16 },
      { type: 'rect', x: 0.25, y: 0.5, w: 0.38, h: 0.88 },
      { type: 'rect', x: 0.75, y: 0.5, w: 0.38, h: 0.88 },
    ],
    bunk_bed: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.5, y: 0.25, w: 0.9, h: 0.15 },
      { type: 'rect', x: 0.5, y: 0.75, w: 0.9, h: 0.15 },
    ],
    crib: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.5, y: 0.5, w: 0.85, h: 0.8 },
    ],
    // Mesas rectangulares
    coffee_table: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    dining_table: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    dining_table_6: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Mesas redondas
    coffee_table_round: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.48 }],
    dining_table_round: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.48 }],
    side_table: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.48 }],
    // Escritorio L (L a la derecha por defecto; flipL=true invierte)
    desk_L_right: [
      { type: 'rect', x: 0.5, y: 0.2, w: 1, h: 0.5 },
      { type: 'rect', x: 0.75, y: 0.65, w: 0.5, h: 0.55 },
    ],
    desk_L_left: [
      { type: 'rect', x: 0.5, y: 0.2, w: 1, h: 0.5 },
      { type: 'rect', x: 0.25, y: 0.65, w: 0.5, h: 0.55 },
    ],
    // Chimeneas
    fireplace: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    fireplace_modern: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    fireplace_bioethanol: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    fireplace_insert: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    pellet_stove: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Plantas y decoración
    plant: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.4 }],
    side_table_plant: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.4 }],
    plant_tree: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.45 }],
    // Sillas y taburetes
    dining_chair: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    bar_stool: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.35 }],
    desk_chair: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Alfombras
    rug_round: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.48 }],
    rug: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Muebles TV y estanterías
    tv_stand: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    tv_stand_55: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    tv_stand_75: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    bookshelf: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    bookshelf_wide: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    console_table: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Lámparas y mesitas
    floor_lamp: [{ type: 'circle', x: 0.5, y: 0.5, r: 0.35 }],
    side_table_lamp: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    nightstand: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Escritorios
    desk: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Armarios: puertas
    wardrobe: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.33, y: 0.5, w: 0.02, h: 1 },
      { type: 'rect', x: 0.67, y: 0.5, w: 0.02, h: 1 },
    ],
    // Inodoro: depósito + taza
    toilet: [
      { type: 'rect', x: 0.5, y: 0.2, w: 0.5, h: 0.35 },
      { type: 'rect', x: 0.5, y: 0.65, w: 0.7, h: 0.6 },
    ],
    // Ducha
    shower: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    shower_rect: [{ type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 }],
    // Bañera
    bathtub: [
      { type: 'rect', x: 0.5, y: 0.5, w: 1, h: 1 },
      { type: 'rect', x: 0.5, y: 0.5, w: 0.85, h: 0.85 },
    ],
  }
  if (type === 'desk_L') return shapes[item?.flipL ? 'desk_L_left' : 'desk_L_right'] ?? null
  if (shapes[type]) return shapes[type]
  const aliases: Record<string, string> = {
    bed_single: 'bed_double', bed_king: 'bed_double',
    toilet_wall: 'toilet', bidet: 'toilet',
    bathtub_freestanding: 'bathtub',
    wardrobe_large: 'wardrobe', wardrobe_sliding: 'wardrobe', wardrobe_small: 'wardrobe',
    kitchen_counter: 'coffee_table', kitchen_counter_short: 'coffee_table', kitchen_counter_microwave: 'coffee_table',
    kitchen_counter_upper: 'coffee_table', kitchen_island: 'coffee_table',
    fridge: 'coffee_table', fridge_double: 'coffee_table', stove: 'coffee_table',
    induction_cooktop: 'coffee_table', induction_cooktop_90: 'coffee_table',
    gas_cooktop: 'coffee_table', gas_cooktop_90: 'coffee_table',
    oven_builtin: 'coffee_table', range_hood: 'coffee_table', range_hood_90: 'coffee_table',
    dishwasher: 'coffee_table', sink: 'coffee_table', sink_double: 'coffee_table',
    sink_pedestal: 'coffee_table', dresser: 'coffee_table', vanity: 'coffee_table',
    bathroom_cabinet: 'coffee_table', bathroom_vanity: 'coffee_table', washing_machine: 'coffee_table',
    dryer: 'coffee_table', washer_dryer_stack: 'coffee_table', water_heater: 'coffee_table',
    towel_rack: 'coffee_table', radiator: 'coffee_table', air_conditioner: 'coffee_table',
    ceiling_lamp: 'floor_lamp', pendant_lamp: 'floor_lamp', ceiling_fan: 'floor_lamp',
    spotlight_ceiling: 'floor_lamp', wall_art: 'coffee_table', wall_art_small: 'coffee_table',
    mirror_wall: 'coffee_table', mirror_standing: 'coffee_table',
    shoe_rack: 'coffee_table', coat_rack: 'floor_lamp', coat_rack_floor: 'floor_lamp', storage_box: 'coffee_table',
    umbrella_stand: 'floor_lamp',
    sofa_bed: 'sofa_2', chaise_longue: 'sofa_2', bookshelf_modular: 'bookshelf',
    breakfast_bar: 'coffee_table', kitchen_trolley: 'coffee_table', storage_unit: 'bookshelf',
    murphy_bed: 'wardrobe', shower_walkin: 'shower',
    safe: 'coffee_table', tv_wall: 'coffee_table', file_cabinet: 'coffee_table', whiteboard: 'coffee_table',
  }
  return aliases[type] ? shapes[aliases[type]]! : null
}

const ROOM_FILL_COLORS = [
  'rgba(180, 160, 120, 0.12)', 'rgba(160, 180, 140, 0.12)',
  'rgba(140, 160, 190, 0.12)', 'rgba(190, 160, 140, 0.12)',
  'rgba(160, 140, 180, 0.12)', 'rgba(180, 180, 140, 0.12)',
  'rgba(140, 180, 170, 0.12)', 'rgba(190, 150, 160, 0.12)',
]

function findRooms2D(walls: Wall[]): Point[][] {
  const eps = 0.02
  const k = (x: number, y: number) =>
    `${(Math.round(x / eps) * eps).toFixed(3)},${(Math.round(y / eps) * eps).toFixed(3)}`

  const adj = new Map<string, { x: number; y: number; neighbors: string[] }>()

  for (const w of walls) {
    const ks = k(w.start.x, w.start.y)
    const ke = k(w.end.x, w.end.y)
    if (ks === ke) continue
    if (!adj.has(ks)) adj.set(ks, { x: w.start.x, y: w.start.y, neighbors: [] })
    if (!adj.has(ke)) adj.set(ke, { x: w.end.x, y: w.end.y, neighbors: [] })
    const sn = adj.get(ks)!
    const en = adj.get(ke)!
    if (!sn.neighbors.includes(ke)) sn.neighbors.push(ke)
    if (!en.neighbors.includes(ks)) en.neighbors.push(ks)
  }

  for (const [, node] of adj) {
    node.neighbors.sort((a, b) => {
      const na = adj.get(a)!
      const nb = adj.get(b)!
      return Math.atan2(na.y - node.y, na.x - node.x) - Math.atan2(nb.y - node.y, nb.x - node.x)
    })
  }

  const used = new Set<string>()
  const rooms: Point[][] = []
  const ek = (a: string, b: string) => `${a}>${b}`

  for (const [startK] of adj) {
    const startNode = adj.get(startK)!
    for (const firstN of startNode.neighbors) {
      const e = ek(startK, firstN)
      if (used.has(e)) continue

      const chain: string[] = [startK]
      let prevK = startK
      let currK = firstN
      let valid = true

      for (let step = 0; step < 50; step++) {
        chain.push(currK)
        used.add(ek(prevK, currK))
        if (currK === startK) break

        const curr = adj.get(currK)
        if (!curr || curr.neighbors.length < 2) { valid = false; break }

        const inAngle = Math.atan2(adj.get(prevK)!.y - curr.y, adj.get(prevK)!.x - curr.x)
        let bestK = ''
        let bestA = Infinity

        for (const nk of curr.neighbors) {
          if (nk === prevK && curr.neighbors.length > 1) continue
          const nn = adj.get(nk)!
          let a = Math.atan2(nn.y - curr.y, nn.x - curr.x) - inAngle
          if (a <= 0) a += Math.PI * 2
          if (a < bestA) { bestA = a; bestK = nk }
        }

        if (!bestK) { valid = false; break }
        prevK = currK
        currK = bestK
      }

      if (!valid || chain.length < 4 || chain[chain.length - 1] !== startK) continue

      const poly = chain.slice(0, -1).map(kk => adj.get(kk)!)
      let area = 0
      for (let i = 0; i < poly.length; i++) {
        const j = (i + 1) % poly.length
        area += poly[i].x * poly[j].y - poly[j].x * poly[i].y
      }
      if (area <= 0.05 || Math.abs(area / 2) > 200) continue

      rooms.push(poly.map(p => ({ x: p.x, y: p.y })))
    }
  }

  const sigs = new Set<string>()
  return rooms.filter(room => {
    const sig = room.map(p => k(p.x, p.y)).sort().join('|')
    if (sigs.has(sig)) return false
    sigs.add(sig)
    return true
  })
}

function snapToGrid(val: number, gridMeters: number): number {
  const gridPx = gridMeters * SCALE
  return Math.round(val / gridPx) * gridPx
}

function snapToExistingPoints(worldPt: Point, walls: Wall[], threshold: number = 12): Point | null {
  let closest: Point | null = null
  let minDist = threshold
  for (const w of walls) {
    for (const pt of [w.start, w.end]) {
      const px = pt.x * SCALE
      const py = pt.y * SCALE
      const dist = Math.sqrt((worldPt.x - px) ** 2 + (worldPt.y - py) ** 2)
      if (dist < minDist) {
        minDist = dist
        closest = { x: px, y: py }
      }
    }
  }
  return closest
}

function screenToWorld(sx: number, sy: number, pan: Point, zoom: number): Point {
  return {
    x: (sx - pan.x) / zoom,
    y: (sy - pan.y) / zoom,
  }
}

/** Deshace la rotación de la vista para obtener coords de pantalla en el espacio pan/zoom */
function unrotateScreen(sx: number, sy: number, viewRotationDeg: number, canvasW: number, canvasH: number): Point {
  if (viewRotationDeg === 0) return { x: sx, y: sy }
  const cx = canvasW / 2
  const cy = canvasH / 2
  const relX = sx - cx
  const relY = sy - cy
  const R = (-viewRotationDeg * Math.PI) / 180
  const cos = Math.cos(R)
  const sin = Math.sin(R)
  return {
    x: relX * cos - relY * sin + cx,
    y: relX * sin + relY * cos + cy,
  }
}

function worldToMeters(p: Point): Point {
  return { x: p.x / SCALE, y: p.y / SCALE }
}

function metersToWorld(p: Point): Point {
  return { x: p.x * SCALE, y: p.y * SCALE }
}

/** Normal que apunta desde la pared hacia el punto dado (lado de la pared donde está el punto) */
function getWallNormalToward(wall: Wall, point: Point): Point {
  const dx = wall.end.x - wall.start.x
  const dy = wall.end.y - wall.start.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { x: 0, y: 0 }
  const nx = -dy / len
  const ny = dx / len
  const wallMid = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 }
  const toPoint = { x: point.x - wallMid.x, y: point.y - wallMid.y }
  const dot = nx * toPoint.x + ny * toPoint.y
  return dot > 0 ? { x: nx, y: ny } : { x: -nx, y: -ny }
}

/** Snap mueble a pared: usa el lado desde donde se acerca (target) para pegar a esa cara y girar bien */
function snapFurnitureToWall(
  item: { x: number; y: number; rotation: number; width: number; depth: number; type?: string },
  newX: number,
  newY: number,
  walls: Wall[]
): { x: number; y: number; rotation: number } {
  const snapThreshold = item.depth * 0.6 + 0.15
  let best: { x: number; y: number; rotation: number; dist: number } | null = null

  for (const wall of walls) {
    const ws = wall.start
    const we = wall.end
    const wdx = we.x - ws.x
    const wdy = we.y - ws.y
    const wLen2 = wdx * wdx + wdy * wdy
    if (wLen2 === 0) continue

    const t = Math.max(0, Math.min(1, ((newX - ws.x) * wdx + (newY - ws.y) * wdy) / wLen2))
    const projX = ws.x + t * wdx
    const projY = ws.y + t * wdy
    const dist = Math.sqrt((newX - projX) ** 2 + (newY - projY) ** 2)
    if (dist > snapThreshold) continue

    const toward = getWallNormalToward(wall, { x: newX, y: newY })
    let rotDeg = (Math.atan2(toward.x, toward.y) * 180) / Math.PI
    const isHorizontalWall = Math.abs(wdx) > Math.abs(wdy)
    const isSofaLike = ['sofa_2', 'sofa_3', 'sofa_L', 'armchair', 'recliner'].includes(item.type ?? '')
    // Sofás: el modelo 3D tiene el respaldo en -Z; en pared horizontal hay que girar 180°
    if (isHorizontalWall && isSofaLike) rotDeg += 180
    // Paredes verticales (izq/der): el mueble sale al revés sin este ajuste
    if (!isHorizontalWall) rotDeg += 180
    const snapRot = ((Math.round(rotDeg / 15) * 15) % 360 + 360) % 360
    const snapX = projX + toward.x * (item.depth / 2 + wall.thickness / 2)
    const snapY = projY + toward.y * (item.depth / 2 + wall.thickness / 2)

    if (!best || dist < best.dist) best = { x: snapX, y: snapY, rotation: snapRot, dist }
  }

  if (best) return { x: best.x, y: best.y, rotation: best.rotation }
  return { x: newX, y: newY, rotation: item.rotation }
}

type FloorPlanEditorProps = { canvasRef?: React.RefObject<HTMLCanvasElement | null> }

export default function FloorPlanEditor({ canvasRef: externalCanvasRef }: FloorPlanEditorProps = {}) {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null)
  const canvasRef = externalCanvasRef ?? internalCanvasRef
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 600 })
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 })
  const [previewEnd, setPreviewEnd] = useState<Point | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 })
  const [draggingFurniture, setDraggingFurniture] = useState<string | null>(null)
  const [draggingFurnitureIds, setDraggingFurnitureIds] = useState<string[]>([])
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 })
  const [isRotating, setIsRotating] = useState(false)
  const [rotatingItemId, setRotatingItemId] = useState<string | null>(null)
  const [lengthInput, setLengthInput] = useState('')
  const [lengthInputActive, setLengthInputActive] = useState(false)
  const lengthInputRef = useRef<HTMLInputElement>(null)
  const [draggingEndpoint, setDraggingEndpoint] = useState<{ wallId: string; end: 'start' | 'end' } | null>(null)
  const [hoveredEraseId, setHoveredEraseId] = useState<string | null>(null)
  const [draggingOpening, setDraggingOpening] = useState<string | null>(null)
  const [hoveredDraggable, setHoveredDraggable] = useState(false)
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false)
  const [marqueeStart, setMarqueeStart] = useState<Point | null>(null)
  const [marqueeCurrent, setMarqueeCurrent] = useState<Point | null>(null)
  const [openingPrompt, setOpeningPrompt] = useState<{
    wallId: string; position: number; widthCm: string; screenX: number; screenY: number
  } | null>(null)
  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null)
  const [touchPanMid, setTouchPanMid] = useState<Point | null>(null)

  const store = useStore()
  const floor = store.getActiveFloor()
  const { editor, theme } = store
  const tc = THEMES[theme]

  // Resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setCanvasSize({ w: width, h: height })
    })
    obs.observe(container)
    return () => obs.disconnect()
  }, [])

  const floorPlanBackground = useStore((s) => s.floorPlanBackground)
  const floorPlanCalibration = useStore((s) => s.floorPlanCalibration)
  const addCalibrationPoint = useStore((s) => s.addCalibrationPoint)
  const [floorPlanImgLoaded, setFloorPlanImgLoaded] = useState(0)

  // Precargar imagen del plano de fondo
  const floorPlanImgRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!floorPlanBackground?.dataUrl) {
      floorPlanImgRef.current = null
      return
    }
    const img = new Image()
    img.onload = () => {
      floorPlanImgRef.current = img
      setFloorPlanImgLoaded((v) => v + 1)
    }
    img.src = floorPlanBackground.dataUrl
    return () => { floorPlanImgRef.current = null }
  }, [floorPlanBackground?.dataUrl])

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { zoom, panOffset, viewRotationDeg = 0 } = editor
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.save()
    // Rotar vista top (0, 90, 180, 270)
    const cw = canvas.width
    const ch = canvas.height
    ctx.translate(cw / 2, ch / 2)
    ctx.rotate((viewRotationDeg * Math.PI) / 180)
    ctx.translate(-cw / 2, -ch / 2)
    ctx.translate(panOffset.x, panOffset.y)
    ctx.scale(zoom, zoom)

    // Puntos de calibración (línea entre los 2 puntos)
    if (floorPlanCalibration?.points && floorPlanCalibration.points.length >= 1) {
      ctx.strokeStyle = '#5B8DEF'
      ctx.lineWidth = 3
      ctx.setLineDash([8, 4])
      ctx.beginPath()
      ctx.moveTo(floorPlanCalibration.points[0].x, floorPlanCalibration.points[0].y)
      if (floorPlanCalibration.points.length >= 2) {
        ctx.lineTo(floorPlanCalibration.points[1].x, floorPlanCalibration.points[1].y)
      }
      ctx.stroke()
      ctx.setLineDash([])
      floorPlanCalibration.points.forEach((p, i) => {
        ctx.fillStyle = '#5B8DEF'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }

    // Plano de fondo importado (imagen, PDF, DXF)
    const fpImg = floorPlanImgRef.current
    if (floorPlanBackground?.dataUrl && fpImg && fpImg.complete) {
      const ppm = floorPlanBackground.pixelsPerMeter ?? SCALE
      const scale = SCALE / ppm
      const ox = floorPlanBackground.offsetX ?? 0
      const oy = floorPlanBackground.offsetY ?? 0
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.translate(ox, oy)
      ctx.scale(scale, scale)
      ctx.drawImage(fpImg, -fpImg.width / 2, -fpImg.height / 2, fpImg.width, fpImg.height)
      ctx.restore()
    }

    // Grid (Dotted or dashed for more architectural blueprint look)
    const gridPx = editor.gridSizeMeters * SCALE
    const startX = Math.floor(-panOffset.x / zoom / gridPx) * gridPx - gridPx
    const startY = Math.floor(-panOffset.y / zoom / gridPx) * gridPx - gridPx
    const endX = startX + (canvas.width / zoom) + gridPx * 2
    const endY = startY + (canvas.height / zoom) + gridPx * 2

    ctx.strokeStyle = tc.canvasGrid
    ctx.lineWidth = 1
    ctx.setLineDash([2, 6]) // blueprint style
    for (let x = startX; x <= endX; x += gridPx) {
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
      ctx.stroke()
    }
    for (let y = startY; y <= endY; y += gridPx) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Major grid lines (1m)
    const majorPx = SCALE
    ctx.strokeStyle = tc.canvasGridMajor
    ctx.lineWidth = 1
    const majorStartX = Math.floor(startX / majorPx) * majorPx
    const majorStartY = Math.floor(startY / majorPx) * majorPx
    for (let x = majorStartX; x <= endX; x += majorPx) {
      ctx.beginPath()
      ctx.moveTo(x, startY)
      ctx.lineTo(x, endY)
      ctx.stroke()
    }
    for (let y = majorStartY; y <= endY; y += majorPx) {
      ctx.beginPath()
      ctx.moveTo(startX, y)
      ctx.lineTo(endX, y)
      ctx.stroke()
    }

    // Origin cross
    ctx.strokeStyle = tc.canvasAxis
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-20, 0); ctx.lineTo(20, 0)
    ctx.moveTo(0, -20); ctx.lineTo(0, 20)
    ctx.stroke()

    // Detected rooms — filled polygons
    const detectedRooms = findRooms2D(floor.walls)
    detectedRooms.forEach((room, idx) => {
      ctx.save()
      ctx.fillStyle = ROOM_FILL_COLORS[idx % ROOM_FILL_COLORS.length]
      ctx.beginPath()
      for (let i = 0; i < room.length; i++) {
        const sx = room[i].x * SCALE
        const sy = room[i].y * SCALE
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      ctx.closePath()
      ctx.fill()

      // Room area label
      let area = 0
      for (let i = 0; i < room.length; i++) {
        const j = (i + 1) % room.length
        area += room[i].x * room[j].y - room[j].x * room[i].y
      }
      area = Math.abs(area / 2)

      const rcx = room.reduce((s, p) => s + p.x, 0) / room.length
      const rcy = room.reduce((s, p) => s + p.y, 0) / room.length

      const fontSize = Math.max(11, Math.min(16, 14 / editor.zoom))
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const label = `${area.toFixed(1)} m²`
      const metrics = ctx.measureText(label)
      const px = rcx * SCALE
      const py = rcy * SCALE

      // Background pill
      const pw = metrics.width + 12
      const ph = fontSize + 8
      ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.92)'
      ctx.beginPath()
      const r = ph / 2
      ctx.moveTo(px - pw / 2 + r, py - ph / 2)
      ctx.lineTo(px + pw / 2 - r, py - ph / 2)
      ctx.arc(px + pw / 2 - r, py, r, -Math.PI / 2, Math.PI / 2)
      ctx.lineTo(px - pw / 2 + r, py + ph / 2)
      ctx.arc(px - pw / 2 + r, py, r, Math.PI / 2, -Math.PI / 2)
      ctx.closePath()
      ctx.fill()

      ctx.fillStyle = tc.canvasText
      ctx.fillText(label, px, py)
      ctx.restore()
    })

    // ─── Walls: polygon-based with clean corner patches ───
    const wallsToRender = [
      ...floor.walls.filter(w => editor.selectedItemId !== w.id),
      ...floor.walls.filter(w => editor.selectedItemId === w.id),
    ]

    const junctionEps = 0.01
    const jKey2 = (x: number, y: number) =>
      `${(Math.round(x / junctionEps) * junctionEps).toFixed(3)},${(Math.round(y / junctionEps) * junctionEps).toFixed(3)}`
    const endpointWalls = new Map<string, Wall[]>()
    for (const w of floor.walls) {
      for (const pt of [w.start, w.end]) {
        const kk = jKey2(pt.x, pt.y)
        if (!endpointWalls.has(kk)) endpointWalls.set(kk, [])
        endpointWalls.get(kk)!.push(w)
      }
    }

    wallsToRender.forEach((wall) => {
      const s = metersToWorld(wall.start)
      const e = metersToWorld(wall.end)
      const dx = e.x - s.x
      const dy = e.y - s.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len === 0) return

      const isSelected = editor.selectedItemId === wall.id
      const isEraseHover = hoveredEraseId === wall.id
      const halfT = (wall.thickness * SCALE) / 2
      const wallColor = isEraseHover ? '#EF5B5B' : isSelected ? '#5B8DEF' : wall.color || '#e0e0e0'
      const nx = -dy / len
      const ny = dx / len

      const sortedOpenings = floor.openings
        .filter((o) => o.wallId === wall.id)
        .sort((a, b) => a.position - b.position)

      const parts: { s: number; e: number }[] = []
      let currentT = 0
      sortedOpenings.forEach((op) => {
        const opW = (op.width * SCALE) / len
        const startT = Math.max(currentT, op.position - opW / 2)
        const endT = Math.min(1, op.position + opW / 2)
        if (startT > currentT) parts.push({ s: currentT, e: startT })
        currentT = Math.max(currentT, endT)
      })
      if (currentT < 1) parts.push({ s: currentT, e: 1 })

      parts.forEach((p) => {
        const x0 = s.x + dx * p.s
        const y0 = s.y + dy * p.s
        const x1 = s.x + dx * p.e
        const y1 = s.y + dy * p.e

        ctx.fillStyle = wallColor
        ctx.beginPath()
        ctx.moveTo(x0 + nx * halfT, y0 + ny * halfT)
        ctx.lineTo(x1 + nx * halfT, y1 + ny * halfT)
        ctx.lineTo(x1 - nx * halfT, y1 - ny * halfT)
        ctx.lineTo(x0 - nx * halfT, y0 - ny * halfT)
        ctx.closePath()
        ctx.fill()

        ctx.strokeStyle = isSelected ? '#5B8DEF' : '#666'
        ctx.lineWidth = 0.8
        ctx.stroke()
      })

      const meters = len / SCALE
      ctx.fillStyle = '#aab'
      ctx.font = '11px "DM Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        `${meters.toFixed(2)}m`,
        (s.x + e.x) / 2,
        (s.y + e.y) / 2 - halfT - 8
      )
    })

    // Junction patches: fill convex area at corners where walls meet
    const drawnJunctions = new Set<string>()
    endpointWalls.forEach((connected, kk) => {
      if (connected.length < 2 || drawnJunctions.has(kk)) return
      drawnJunctions.add(kk)

      const refPt = connected[0]
      const endPt = [refPt.start, refPt.end].find(p => jKey2(p.x, p.y) === kk) || refPt.start
      const center = metersToWorld(endPt)
      const corners: { x: number; y: number }[] = []

      for (const cw of connected) {
        const cs = metersToWorld(cw.start)
        const ce = metersToWorld(cw.end)
        const cdx = ce.x - cs.x
        const cdy = ce.y - cs.y
        const clen = Math.sqrt(cdx * cdx + cdy * cdy)
        if (clen === 0) continue
        const cnx = -cdy / clen
        const cny = cdx / clen
        const ht = (cw.thickness * SCALE) / 2
        corners.push({ x: center.x + cnx * ht, y: center.y + cny * ht })
        corners.push({ x: center.x - cnx * ht, y: center.y - cny * ht })
      }

      if (corners.length < 3) return

      corners.sort((a, b) =>
        Math.atan2(a.y - center.y, a.x - center.x) -
        Math.atan2(b.y - center.y, b.x - center.x)
      )

      const anySelected = connected.some(w => w.id === editor.selectedItemId)
      ctx.fillStyle = anySelected ? '#5B8DEF' : (connected[0].color || '#e0e0e0')
      ctx.beginPath()
      ctx.moveTo(corners[0].x, corners[0].y)
      for (let ci = 1; ci < corners.length; ci++) ctx.lineTo(corners[ci].x, corners[ci].y)
      ctx.closePath()
      ctx.fill()
    })

    // Endpoint grab handles
    if (editor.activeTool === 'select' || editor.activeTool === 'wall') {
      const drawnPts = new Set<string>()
      floor.walls.forEach((wall) => {
        for (const pt of [wall.start, wall.end]) {
          const kk = jKey2(pt.x, pt.y)
          if (drawnPts.has(kk)) continue
          drawnPts.add(kk)
          const wp = metersToWorld(pt)
          const isJunc = (endpointWalls.get(kk)?.length || 0) >= 2
          ctx.fillStyle = isJunc ? '#5B8DEF66' : '#5B8DEF33'
          ctx.beginPath()
          ctx.arc(wp.x, wp.y, isJunc ? 5 : 3, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }

      // Openings on walls
      floor.openings.forEach((opening) => {
        const wall = floor.walls.find((w) => w.id === opening.wallId)
        if (!wall) return
        const s = metersToWorld(wall.start)
        const e = metersToWorld(wall.end)
        const pos = opening.position
        const px = s.x + (e.x - s.x) * pos
        const py = s.y + (e.y - s.y) * pos
        const halfW = (opening.width * SCALE) / 2
        
        const isSelected = editor.selectedItemId === opening.id
        const isEraseHoverOp = hoveredEraseId === opening.id

        const dx = e.x - s.x
        const dy = e.y - s.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const dirX = dx / len
        const dirY = dy / len

        if (opening.type === 'door') {
          ctx.strokeStyle = isEraseHoverOp ? '#EF5B5B' : isSelected ? '#5B8DEF' : '#5BE0A0'
          ctx.lineWidth = isSelected ? 4 : 3
          ctx.beginPath()
          ctx.moveTo(px - dirX * halfW, py - dirY * halfW)
          ctx.lineTo(px + dirX * halfW, py + dirY * halfW)
          ctx.stroke()
          // Arc
          ctx.strokeStyle = isSelected ? '#5B8DEF88' : '#5BE0A044'
          ctx.lineWidth = 1
          let angle = Math.atan2(dirY, dirX)
          if (opening.flip) angle += Math.PI
          
          const openPct = 0.3
          const arcAngle = (Math.PI / 2) * openPct
          const dir = opening.openDirection === 'right' ? -1 : 1
          if (opening.subtype === 'double' || opening.subtype === 'french') {
            ctx.beginPath()
            ctx.arc(px - dirX * halfW, py - dirY * halfW, opening.width * SCALE / 2, angle, angle - arcAngle, true)
            ctx.stroke()
            ctx.beginPath()
            ctx.arc(px + dirX * halfW, py + dirY * halfW, opening.width * SCALE / 2, angle - Math.PI, angle - Math.PI + arcAngle, false)
            ctx.stroke()
          } else if (opening.subtype === 'sliding' || opening.subtype === 'pocket' || opening.subtype === 'pocket_pladur') {
             ctx.beginPath()
             ctx.moveTo(px - dirX * halfW - dirY * 4, py - dirY * halfW + dirX * 4)
             ctx.lineTo(px + dirX * halfW - dirY * 4, py + dirY * halfW + dirX * 4)
             ctx.stroke()
          } else {
             const hingeX = dir > 0 ? px - dirX * halfW : px + dirX * halfW
             const hingeY = dir > 0 ? py - dirY * halfW : py + dirY * halfW
             ctx.beginPath()
             ctx.arc(hingeX, hingeY, opening.width * SCALE, angle, angle - dir * arcAngle, dir < 0)
             ctx.stroke()
          }
        } else {
          ctx.strokeStyle = isEraseHoverOp ? '#EF5B5B' : isSelected ? '#5B8DEF' : '#5BA0EF'
          ctx.lineWidth = isSelected ? 5 : 4
          ctx.beginPath()
          ctx.moveTo(px - dirX * halfW, py - dirY * halfW)
          ctx.lineTo(px + dirX * halfW, py + dirY * halfW)
          ctx.stroke()
          // Double line for window
          const normX = -dirY * 4
          const normY = dirX * 4
          ctx.strokeStyle = isSelected ? '#5B8DEF' : '#5BA0EF88'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(px - dirX * halfW + normX, py - dirY * halfW + normY)
          ctx.lineTo(px + dirX * halfW + normX, py + dirY * halfW + normY)
          ctx.stroke()
        }
      })

    // Furniture — siluetas en planta (estilo AutoCAD)
    floor.furniture.forEach((item) => {
      const cx = item.x * SCALE
      const cy = item.y * SCALE
      const w = item.width * SCALE
      const d = item.depth * SCALE
      const isSelected = editor.selectedFurnitureIds?.includes(item.id) ?? editor.selectedItemId === item.id
      const isEraseHoverF = hoveredEraseId === item.id

      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate((item.rotation * Math.PI) / 180)

      const planShape = getFurniturePlanShape(item.type, item)

      // Añadir sombra sutil para dar sensación de profundidad
      if (!isEraseHoverF) {
        ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.15)'
        ctx.shadowBlur = 12
        ctx.shadowOffsetY = 4
      }

      ctx.fillStyle = isEraseHoverF ? '#EF5B5B33' : isSelected ? '#5B8DEF33' : item.color + '44'
      
      if (planShape && planShape.length > 0) {
        // Dibujamos primero todos los rellenos con sombra
        planShape.forEach((part) => {
          if (part.type === 'rect') {
            const l = (part.x - 0.5 - part.w / 2) * w
            const t = (part.y - 0.5 - part.h / 2) * d
            ctx.fillRect(l, t, part.w * w, part.h * d)
          } else {
            const r = part.r * Math.min(w, d)
            ctx.beginPath()
            ctx.arc((part.x - 0.5) * w, (part.y - 0.5) * d, r, 0, Math.PI * 2)
            ctx.fill()
          }
        })
        // Desactivamos sombra para los bordes
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = isEraseHoverF ? '#EF5B5B' : isSelected ? '#5B8DEF' : item.color || '#888'
        ctx.lineWidth = isSelected ? 2 : 1
        
        planShape.forEach((part) => {
          if (part.type === 'rect') {
            const l = (part.x - 0.5 - part.w / 2) * w
            const t = (part.y - 0.5 - part.h / 2) * d
            ctx.strokeRect(l, t, part.w * w, part.h * d)
          } else {
            const r = part.r * Math.min(w, d)
            ctx.beginPath()
            ctx.arc((part.x - 0.5) * w, (part.y - 0.5) * d, r, 0, Math.PI * 2)
            ctx.stroke()
          }
        })
      } else {
        ctx.fillRect(-w / 2, -d / 2, w, d)
        ctx.shadowColor = 'transparent'
        ctx.strokeStyle = isEraseHoverF ? '#EF5B5B' : isSelected ? '#5B8DEF' : item.color || '#888'
        ctx.lineWidth = isSelected ? 2 : 1
        ctx.strokeRect(-w / 2, -d / 2, w, d)
      }

      // Label solo para muebles sin silueta detallada
      if (!planShape || planShape.length === 0) {
        ctx.fillStyle = isSelected ? tc.accent : tc.canvasText
        ctx.font = '10px "DM Sans", sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const label = item.label.length > 12 ? item.label.slice(0, 12) + '…' : item.label
        ctx.fillText(label, 0, 0)
      }

      // Indicador de orientación (apunta hacia la pared, donde está el respaldo)
      ctx.fillStyle = isSelected ? tc.accent : tc.textSecondary
      ctx.beginPath()
      ctx.moveTo(0, d / 2 + 8)
      ctx.lineTo(-4, d / 2)
      ctx.lineTo(4, d / 2)
      ctx.closePath()
      ctx.fill()

      if (isSelected) {
        const handleR = ROTATION_HANDLE_RADIUS_PX + Math.max(w, d) / 2
        ctx.strokeStyle = '#5B8DEF55'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        ctx.beginPath()
        ctx.arc(0, 0, handleR, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])

        const hx = 0
        const hy = -handleR
        ctx.fillStyle = '#5B8DEF'
        ctx.beginPath()
        ctx.arc(hx, hy, 7, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(hx, hy, 7, 0, Math.PI * 2)
        ctx.stroke()

        ctx.save()
        ctx.translate(hx, hy)
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(0, 0, 3.5, -Math.PI * 0.7, Math.PI * 0.5)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(3.5 * Math.cos(Math.PI * 0.5), 3.5 * Math.sin(Math.PI * 0.5))
        ctx.lineTo(3.5 * Math.cos(Math.PI * 0.5) + 2, 3.5 * Math.sin(Math.PI * 0.5) - 3)
        ctx.stroke()
        ctx.restore()
      }

      ctx.restore()
    })

    // Wall drawing preview
    if (editor.isDrawingWall && editor.wallStartPoint && previewEnd) {
      const s = metersToWorld(editor.wallStartPoint)
      ctx.strokeStyle = '#5B8DEF'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(previewEnd.x, previewEnd.y)
      ctx.stroke()
      ctx.setLineDash([])

      // Snap dot at start point
      ctx.fillStyle = '#5B8DEF'
      ctx.beginPath()
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2)
      ctx.fill()

      // Snap dot at end point
      ctx.fillStyle = '#5B8DEF'
      ctx.beginPath()
      ctx.arc(previewEnd.x, previewEnd.y, 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#5B8DEF55'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(previewEnd.x, previewEnd.y, 10, 0, Math.PI * 2)
      ctx.stroke()

      // Angle guide lines (horizontal/vertical alignment hints)
      const dx = previewEnd.x - s.x
      const dy = previewEnd.y - s.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      if (absDy < 3) {
        ctx.strokeStyle = '#5BE0A033'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(s.x - 100, s.y)
        ctx.lineTo(s.x + 100, s.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
      if (absDx < 3) {
        ctx.strokeStyle = '#5BE0A033'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(s.x, s.y - 100)
        ctx.lineTo(s.x, s.y + 100)
        ctx.stroke()
        ctx.setLineDash([])
      }

      const meters = Math.sqrt(dx * dx + dy * dy) / SCALE
      ctx.fillStyle = '#5B8DEF'
      ctx.font = 'bold 12px "DM Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(
        `${meters.toFixed(2)}m`,
        (s.x + previewEnd.x) / 2,
        (s.y + previewEnd.y) / 2 - 14
      )
    }

    ctx.restore()

    // Mouse coords label (screen space)
    const unrotated = unrotateScreen(mousePos.x, mousePos.y, editor.viewRotationDeg ?? 0, canvas.width, canvas.height)
    const worldP = screenToWorld(unrotated.x, unrotated.y, panOffset, zoom)
    const metersP = worldToMeters(worldP)
    ctx.fillStyle = theme === 'dark' ? '#8890a0' : '#667'
    ctx.font = '13px "JetBrains Mono", monospace'
    ctx.textAlign = 'left'
    ctx.fillText(`${metersP.x.toFixed(2)}, ${metersP.y.toFixed(2)} m`, 12, canvas.height - 12)

    // Marquee selection rect
    if (isMarqueeSelecting && marqueeStart && marqueeCurrent) {
      const minSx = Math.min(marqueeStart.x, marqueeCurrent.x)
      const maxSx = Math.max(marqueeStart.x, marqueeCurrent.x)
      const minSy = Math.min(marqueeStart.y, marqueeCurrent.y)
      const maxSy = Math.max(marqueeStart.y, marqueeCurrent.y)
      
      const w = maxSx - minSx
      const h = maxSy - minSy

      ctx.fillStyle = 'rgba(91, 141, 239, 0.15)'
      ctx.strokeStyle = '#5B8DEF'
      ctx.lineWidth = 1.5
      ctx.fillRect(minSx, minSy, w, h)
      ctx.strokeRect(minSx, minSy, w, h)
    }

  }, [floor, editor, mousePos, previewEnd, canvasSize, theme, tc, hoveredEraseId, isMarqueeSelecting, marqueeStart, marqueeCurrent, floorPlanBackground, floorPlanImgLoaded, floorPlanCalibration])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const unrotated = unrotateScreen(sx, sy, editor.viewRotationDeg ?? 0, canvasSize.w, canvasSize.h)
    const world = screenToWorld(unrotated.x, unrotated.y, editor.panOffset, editor.zoom)
    const meters = worldToMeters(world)

    // Modo calibración: clic izquierdo para marcar 2 puntos
    if (e.button === 0 && floorPlanCalibration && !floorPlanCalibration.waitingForMeters) {
      addCalibrationPoint({ x: world.x, y: world.y })
      return
    }

    // Middle button or space: pan
    if (e.button === 1) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - editor.panOffset.x, y: e.clientY - editor.panOffset.y })
      return
    }

    // Siempre permitir seleccionar con un clic en objeto (cualquier herramienta)
    const canSelect = !editor.isDrawingWall && !openingPrompt
    if (canSelect) {
      // Check rotation handle hit first (solo si ya hay mueble seleccionado)
      const selFurnitureId = (editor.selectedFurnitureIds?.length === 1 ? editor.selectedFurnitureIds[0] : editor.selectedFurnitureIds?.length ? null : editor.selectedItemId) ?? null
      if (selFurnitureId && editor.selectedItemType === 'furniture') {
        const selItem = floor.furniture.find(f => f.id === selFurnitureId)
        if (selItem) {
          const cx = selItem.x * SCALE
          const cy = selItem.y * SCALE
          const w = selItem.width * SCALE
          const d = selItem.depth * SCALE
          const handleR = ROTATION_HANDLE_RADIUS_PX + Math.max(w, d) / 2
          const rotRad = (selItem.rotation * Math.PI) / 180
          const hxW = cx + Math.sin(rotRad) * (-handleR)
          const hyW = cy + Math.cos(rotRad) * (handleR)
          const hxWneg = cx - Math.sin(rotRad) * handleR
          const hyWneg = cy + Math.cos(rotRad) * (-handleR)
          const handleWorldX = cx + (-handleR) * Math.sin(rotRad)
          const handleWorldY = cy + (-handleR) * Math.cos(rotRad)
          const distToHandle = Math.sqrt((world.x - handleWorldX) ** 2 + (world.y - handleWorldY) ** 2)
          if (distToHandle < 12) {
            setIsRotating(true)
            setRotatingItemId(selItem.id)
            return
          }
        }
      }

      // Check wall endpoint hit (for dragging corners) — no con puerta/ventana, pared ni muebles (queremos colocar/empezar a pintar)
      if (editor.activeTool !== 'door' && editor.activeTool !== 'window' && editor.activeTool !== 'wall' && !(editor.activeTool === 'furniture' && editor.selectedFurnitureCatalog)) {
        const endpointHitThreshold = 0.15
        for (const wall of floor.walls) {
          for (const which of ['start', 'end'] as const) {
            const pt = wall[which]
            const dist = Math.sqrt((meters.x - pt.x) ** 2 + (meters.y - pt.y) ** 2)
            if (dist < endpointHitThreshold) {
              setDraggingEndpoint({ wallId: wall.id, end: which })
              store.setSelected(wall.id, 'wall')
              return
            }
          }
        }
      }

      // Check furniture hit
      const hit = [...floor.furniture].reverse().find((item) => {
        const dx = meters.x - item.x
        const dy = meters.y - item.y
        const cos = Math.cos((-item.rotation * Math.PI) / 180)
        const sin = Math.sin((-item.rotation * Math.PI) / 180)
        const lx = Math.abs(dx * cos - dy * sin)
        const ly = Math.abs(dx * sin + dy * cos)
        return lx <= item.width / 2 && ly <= item.depth / 2
      })
      if (hit) {
        const currentIds = editor.selectedFurnitureIds ?? []
        const isInSelection = currentIds.includes(hit.id)

        if (e.ctrlKey) {
          // Ctrl+clic: añadir a selección o deseleccionar
          const newIds = isInSelection
            ? currentIds.filter(id => id !== hit.id)
            : [...currentIds, hit.id]
          store.setSelectedFurnitureMultiple(newIds)
          if (isInSelection) return // Deseleccionar: no arrastrar
          // Añadido: arrastrar con la nueva selección
          setDraggingFurniture(hit.id)
          setDraggingFurnitureIds(newIds)
          setDragOffset({ x: meters.x - hit.x, y: meters.y - hit.y })
          return
        }

        const idsToDrag = currentIds.includes(hit.id) ? currentIds : [hit.id]
        if (idsToDrag.length === 1) store.setSelected(hit.id, 'furniture')
        else store.setSelectedFurnitureMultiple(idsToDrag)
        setDraggingFurniture(hit.id)
        setDraggingFurnitureIds(idsToDrag)
        setDragOffset({ x: meters.x - hit.x, y: meters.y - hit.y })
        return
      }

      // Check opening hit
      const openingHit = floor.openings.find((op) => {
        const wall = floor.walls.find(w => w.id === op.wallId)
        if (!wall) return false
        const s = wall.start
        const en = wall.end
        const dx = en.x - s.x
        const dy = en.y - s.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const dirX = dx / len
        const dirY = dy / len
        
        const px = s.x + dx * op.position
        const py = s.y + dy * op.position
        const halfW = op.width / 2

        // Check if point is within the opening bounding box on the wall
        const distToCenter = Math.sqrt((meters.x - px) ** 2 + (meters.y - py) ** 2)
        return distToCenter < halfW + 0.15
      })

      if (openingHit) {
        store.setSelected(openingHit.id, 'opening')
        setDraggingOpening(openingHit.id)
        return
      }

      // Check wall hit (no seleccionar pared si estamos en puerta/ventana, pared o muebles — con muebles queremos colocar, no seleccionar)
      const wallHit = floor.walls.find((wall) => {
        const s = wall.start
        const en = wall.end
        const dx = en.x - s.x
        const dy = en.y - s.y
        const len2 = dx * dx + dy * dy
        if (len2 === 0) return false
        let t = ((meters.x - s.x) * dx + (meters.y - s.y) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const px = s.x + t * dx
        const py = s.y + t * dy
        const dist = Math.sqrt((meters.x - px) ** 2 + (meters.y - py) ** 2)
        return dist < wall.thickness + 0.1
      })
      const placingFurniture = editor.activeTool === 'furniture' && editor.selectedFurnitureCatalog
      if (wallHit && editor.activeTool !== 'door' && editor.activeTool !== 'window' && editor.activeTool !== 'wall' && !placingFurniture) {
        store.setSelected(wallHit.id, 'wall')
        return
      }

      // Click en vacío: iniciar marquee solo con herramienta Seleccionar
      if (editor.activeTool === 'select' && !draggingFurniture && !draggingOpening && !draggingEndpoint) {
        setIsMarqueeSelecting(true)
        setMarqueeStart({ x: sx, y: sy })
        setMarqueeCurrent({ x: sx, y: sy })
        return
      }
    }

    if (editor.activeTool === 'wall') {
      let snappedWorld = {
        x: snapToGrid(world.x, editor.gridSizeMeters),
        y: snapToGrid(world.y, editor.gridSizeMeters),
      }

      // Snap to existing wall endpoints with higher priority than grid
      const epSnap = snapToExistingPoints(snappedWorld, floor.walls, 15)
      if (epSnap) snappedWorld = epSnap

      const snappedMeters = worldToMeters(snappedWorld)

      if (!editor.isDrawingWall) {
        store.setDrawingWall(true, snappedMeters)
        setLengthInput('')
        setLengthInputActive(false)
      } else if (editor.wallStartPoint) {
        if (lengthInputActive && lengthInput) {
          commitWallWithLength(lengthInput)
        } else {
          store.addWall(editor.wallStartPoint, snappedMeters)
          store.setDrawingWall(true, snappedMeters)
        }
        setLengthInput('')
        setLengthInputActive(false)
      }
    }

    if (editor.activeTool === 'furniture' && editor.selectedFurnitureCatalog) {
      const catalog = editor.selectedFurnitureCatalog
      const rawMeters = worldToMeters({
        x: snapToGrid(world.x, editor.gridSizeMeters),
        y: snapToGrid(world.y, editor.gridSizeMeters),
      })
      const virtualItem = { x: rawMeters.x, y: rawMeters.y, rotation: 0, width: catalog.width, depth: catalog.depth, type: catalog.type }
      const snapped = snapFurnitureToWall(virtualItem, rawMeters.x, rawMeters.y, floor.walls)
      store.addFurniture({
        type: catalog.type,
        category: catalog.category,
        label: catalog.label,
        x: snapped.x,
        y: snapped.y,
        rotation: snapped.rotation,
        width: catalog.width,
        depth: catalog.depth,
        height: catalog.height,
        elevation: catalog.defaultElevation ?? 0,
        color: catalog.defaultColor,
        material: catalog.defaultMaterial,
      })
      return
    }

    if (editor.activeTool === 'door' || editor.activeTool === 'window') {
      const wallHit = floor.walls.find((wall) => {
        const s = wall.start
        const en = wall.end
        const dx = en.x - s.x
        const dy = en.y - s.y
        const len2 = dx * dx + dy * dy
        if (len2 === 0) return false
        let t = ((meters.x - s.x) * dx + (meters.y - s.y) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const px = s.x + t * dx
        const py = s.y + t * dy
        const dist = Math.sqrt((meters.x - px) ** 2 + (meters.y - py) ** 2)
        return dist < wall.thickness + 0.2
      })
      if (wallHit) {
        const s = wallHit.start
        const en = wallHit.end
        const dx = en.x - s.x
        const dy = en.y - s.y
        const len2 = dx * dx + dy * dy
        let t = ((meters.x - s.x) * dx + (meters.y - s.y) * dy) / len2
        t = Math.max(0.15, Math.min(0.85, t))
        const catalog = editor.selectedOpeningCatalog
        const defaultW = catalog?.defaultWidth || (editor.activeTool === 'door' ? 0.82 : 1.2)
        setOpeningPrompt({
          wallId: wallHit.id,
          position: t,
          widthCm: (defaultW * 100).toFixed(0),
          screenX: e.clientX,
          screenY: e.clientY,
        })
      }
    }

    if (editor.activeTool === 'erase') {
      // Try furniture first
      const fHit = [...floor.furniture].reverse().find((item) => {
        const dx = meters.x - item.x
        const dy = meters.y - item.y
        // Rotated check
        const cos = Math.cos((-item.rotation * Math.PI) / 180)
        const sin = Math.sin((-item.rotation * Math.PI) / 180)
        const lx = Math.abs(dx * cos - dy * sin)
        const ly = Math.abs(dx * sin + dy * cos)
        return lx <= item.width / 2 && ly <= item.depth / 2
      })
      if (fHit) {
        store.removeFurniture(fHit.id)
        return
      }
      // Try opening
      const oHit = floor.openings.find((op) => {
        const wall = floor.walls.find(w => w.id === op.wallId)
        if (!wall) return false
        const s = wall.start
        const en = wall.end
        const dx = en.x - s.x
        const dy = en.y - s.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const px = s.x + dx * op.position
        const py = s.y + dy * op.position
        const halfW = op.width / 2
        const distToCenter = Math.sqrt((meters.x - px) ** 2 + (meters.y - py) ** 2)
        return distToCenter < halfW + 0.15
      })
      if (oHit) {
        store.removeOpening(oHit.id)
        return
      }

      // Try wall
      const wHit = floor.walls.find((wall) => {
        const s = wall.start
        const en = wall.end
        const dx = en.x - s.x
        const dy = en.y - s.y
        const len2 = dx * dx + dy * dy
        if (len2 === 0) return false
        let t = ((meters.x - s.x) * dx + (meters.y - s.y) * dy) / len2
        t = Math.max(0, Math.min(1, t))
        const px = s.x + t * dx
        const py = s.y + t * dy
        const dist = Math.sqrt((meters.x - px) ** 2 + (meters.y - py) ** 2)
        return dist < wall.thickness + 0.15
      })
      if (wHit) {
        store.removeWall(wHit.id)
      }
    }
  }, [editor, floor, store])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    setMousePos({ x: sx, y: sy })

    if (isPanning) {
      store.setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
      return
    }

    if (isMarqueeSelecting && marqueeStart) {
      setMarqueeCurrent({ x: sx, y: sy })
      return
    }

    const unrotated = unrotateScreen(sx, sy, editor.viewRotationDeg ?? 0, canvasSize.w, canvasSize.h)
    const world = screenToWorld(unrotated.x, unrotated.y, editor.panOffset, editor.zoom)
    const meters = worldToMeters(world)

    // Dragging a wall endpoint — precisión por píxeles; solo snap a otros extremos de pared
    if (draggingEndpoint) {
      let snapped = { x: world.x, y: world.y }
      const epSnap = snapToExistingPoints(snapped, floor.walls, 15)
      if (epSnap) snapped = epSnap
      const newMeters = worldToMeters(snapped)

      const wall = floor.walls.find(w => w.id === draggingEndpoint.wallId)
      if (wall) {
        // Also move all walls that share this endpoint
        const oldPt = wall[draggingEndpoint.end]
        const movedWallIds = new Set<string>()
        floor.walls.forEach(w => {
          if (movedWallIds.has(w.id)) return
          const eps = 0.02
          if (Math.abs(w.start.x - oldPt.x) < eps && Math.abs(w.start.y - oldPt.y) < eps) {
            store.updateWall(w.id, { start: newMeters })
            movedWallIds.add(w.id)
          }
          if (Math.abs(w.end.x - oldPt.x) < eps && Math.abs(w.end.y - oldPt.y) < eps) {
            store.updateWall(w.id, { end: newMeters })
            movedWallIds.add(w.id)
          }
        })
      }
      return
    }

    // Erase tool hover highlight
    if (editor.activeTool === 'erase') {
      const meters = worldToMeters(world)
      let foundId: string | null = null
      const fHit = [...floor.furniture].reverse().find((item) => {
        const ddx = meters.x - item.x
        const ddy = meters.y - item.y
        const cos = Math.cos((-item.rotation * Math.PI) / 180)
        const sin = Math.sin((-item.rotation * Math.PI) / 180)
        return Math.abs(ddx * cos - ddy * sin) <= item.width / 2 && Math.abs(ddx * sin + ddy * cos) <= item.depth / 2
      })
      if (fHit) foundId = fHit.id
      if (!foundId) {
        const oHit = floor.openings.find((op) => {
          const ow = floor.walls.find(ww => ww.id === op.wallId)
          if (!ow) return false
          const opx = ow.start.x + (ow.end.x - ow.start.x) * op.position
          const opy = ow.start.y + (ow.end.y - ow.start.y) * op.position
          return Math.sqrt((meters.x - opx) ** 2 + (meters.y - opy) ** 2) < op.width / 2 + 0.15
        })
        if (oHit) foundId = oHit.id
      }
      if (!foundId) {
        const wHit = floor.walls.find((wall) => {
          const ws = wall.start, we = wall.end
          const wdx = we.x - ws.x, wdy = we.y - ws.y, wl2 = wdx * wdx + wdy * wdy
          if (wl2 === 0) return false
          let t = ((meters.x - ws.x) * wdx + (meters.y - ws.y) * wdy) / wl2
          t = Math.max(0, Math.min(1, t))
          return Math.sqrt((meters.x - (ws.x + t * wdx)) ** 2 + (meters.y - (ws.y + t * wdy)) ** 2) < wall.thickness + 0.15
        })
        if (wHit) foundId = wHit.id
      }
      setHoveredEraseId(foundId)
    } else if (hoveredEraseId) {
      setHoveredEraseId(null)
    }

    // Cursor grab when hovering draggable (siempre, para selección rápida)
    if (!draggingFurniture && !draggingOpening && !draggingEndpoint) {
      const meters = worldToMeters(world)
      let over = false
      const fHit = [...floor.furniture].reverse().find((item) => {
        const ddx = meters.x - item.x
        const ddy = meters.y - item.y
        const cos = Math.cos((-item.rotation * Math.PI) / 180)
        const sin = Math.sin((-item.rotation * Math.PI) / 180)
        return Math.abs(ddx * cos - ddy * sin) <= item.width / 2 && Math.abs(ddx * sin + ddy * cos) <= item.depth / 2
      })
      if (fHit) over = true
      if (!over) {
        const oHit = floor.openings.find((op) => {
          const ow = floor.walls.find(ww => ww.id === op.wallId)
          if (!ow) return false
          const opx = ow.start.x + (ow.end.x - ow.start.x) * op.position
          const opy = ow.start.y + (ow.end.y - ow.start.y) * op.position
          return Math.sqrt((meters.x - opx) ** 2 + (meters.y - opy) ** 2) < op.width / 2 + 0.15
        })
        if (oHit) over = true
      }
      if (!over) {
        for (const wall of floor.walls) {
          const wpS = metersToWorld(wall.start)
          const wpE = metersToWorld(wall.end)
          if (Math.hypot(world.x - wpS.x, world.y - wpS.y) < 8 || Math.hypot(world.x - wpE.x, world.y - wpE.y) < 8) {
            over = true
            break
          }
        }
      }
      setHoveredDraggable(over)
    } else {
      setHoveredDraggable(false)
    }

    if (editor.isDrawingWall) {
      let snapped = {
        x: snapToGrid(world.x, editor.gridSizeMeters),
        y: snapToGrid(world.y, editor.gridSizeMeters),
      }

      if (e.shiftKey && editor.wallStartPoint) {
        const s = metersToWorld(editor.wallStartPoint)
        const dx = snapped.x - s.x
        const dy = snapped.y - s.y
        const angle = Math.atan2(dy, dx)
        const snapAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
        const dist = Math.sqrt(dx * dx + dy * dy)
        snapped = {
          x: s.x + Math.cos(snapAngle) * dist,
          y: s.y + Math.sin(snapAngle) * dist,
        }
      }

      const endpointSnap = snapToExistingPoints(snapped, floor.walls)
      setPreviewEnd(endpointSnap || snapped)
    }

    if (isRotating && rotatingItemId) {
      const item = floor.furniture.find(f => f.id === rotatingItemId)
      if (item) {
        const cx = item.x * SCALE
        const cy = item.y * SCALE
        const angle = Math.atan2(world.x - cx, -(world.y - cy))
        let deg = (angle * 180) / Math.PI
        deg = Math.round(deg / 15) * 15
        deg = ((deg % 360) + 360) % 360
        store.updateFurniture(rotatingItemId, { rotation: deg })
      }
      return
    }

    if (draggingOpening) {
      const op = floor.openings.find(o => o.id === draggingOpening)
      if (op) {
        const meters = worldToMeters(world)
        const OPENING_SNAP_DIST = 0.5
        let best: { wallId: string; position: number; dist: number } | null = null

        for (const wall of floor.walls) {
          const wdx = wall.end.x - wall.start.x
          const wdy = wall.end.y - wall.start.y
          const wLen2 = wdx * wdx + wdy * wdy
          if (wLen2 === 0) continue

          const t = Math.max(0, Math.min(1, ((meters.x - wall.start.x) * wdx + (meters.y - wall.start.y) * wdy) / wLen2))
          const projX = wall.start.x + t * wdx
          const projY = wall.start.y + t * wdy
          const dist = Math.sqrt((meters.x - projX) ** 2 + (meters.y - projY) ** 2)
          if (dist > wall.thickness + OPENING_SNAP_DIST) continue

          const wallLen = Math.sqrt(wLen2)
          const halfW = op.width / wallLen
          const tClamped = Math.max(halfW / 2 + 0.02, Math.min(1 - halfW / 2 - 0.02, t))

          if (!best || dist < best.dist) best = { wallId: wall.id, position: tClamped, dist }
        }

        if (best) {
          store.updateOpening(draggingOpening, { wallId: best.wallId, position: best.position })
        }
      }
      return
    }

    if (draggingFurniture && draggingFurnitureIds.length > 0) {
      const meters = worldToMeters(world)
      // Precisión por píxeles: sin redondeo a cuadrícula, movimiento continuo
      const targetX = meters.x - dragOffset.x
      const targetY = meters.y - dragOffset.y
      const primary = floor.furniture.find(f => f.id === draggingFurniture)
      if (primary) {
        const snapped = snapFurnitureToWall(primary, targetX, targetY, floor.walls)
        const dx = snapped.x - primary.x
        const dy = snapped.y - primary.y
        draggingFurnitureIds.forEach((id) => {
          const item = floor.furniture.find(f => f.id === id)
          if (item) {
            if (id === draggingFurniture) {
              store.updateFurniture(id, { x: snapped.x, y: snapped.y, rotation: snapped.rotation })
            } else {
              const itemSnap = snapFurnitureToWall(item, item.x + dx, item.y + dy, floor.walls)
              store.updateFurniture(id, { x: itemSnap.x, y: itemSnap.y, rotation: itemSnap.rotation })
            }
          }
        })
      }
    }
  }, [editor, isPanning, panStart, draggingFurniture, draggingFurnitureIds, dragOffset, store, isRotating, rotatingItemId, floor.furniture, floor.walls, floor.openings, draggingEndpoint, hoveredEraseId, isMarqueeSelecting, marqueeStart, draggingOpening, canvasSize.w, canvasSize.h, floorPlanCalibration, addCalibrationPoint])

  const handleMouseUp = useCallback(() => {
    if (isMarqueeSelecting && marqueeStart && marqueeCurrent) {
      const minSx = Math.min(marqueeStart.x, marqueeCurrent.x)
      const maxSx = Math.max(marqueeStart.x, marqueeCurrent.x)
      const minSy = Math.min(marqueeStart.y, marqueeCurrent.y)
      const maxSy = Math.max(marqueeStart.y, marqueeCurrent.y)
      const threshold = 5
      if (maxSx - minSx > threshold || maxSy - minSy > threshold) {
        const uMin = unrotateScreen(minSx, minSy, editor.viewRotationDeg ?? 0, canvasSize.w, canvasSize.h)
        const uMax = unrotateScreen(maxSx, maxSy, editor.viewRotationDeg ?? 0, canvasSize.w, canvasSize.h)
        const wMin = screenToWorld(Math.min(uMin.x, uMax.x), Math.min(uMin.y, uMax.y), editor.panOffset, editor.zoom)
        const wMax = screenToWorld(Math.max(uMin.x, uMax.x), Math.max(uMin.y, uMax.y), editor.panOffset, editor.zoom)
        const mMin = worldToMeters(wMin)
        const mMax = worldToMeters(wMax)
        const minMx = Math.min(mMin.x, mMax.x)
        const maxMx = Math.max(mMin.x, mMax.x)
        const minMy = Math.min(mMin.y, mMax.y)
        const maxMy = Math.max(mMin.y, mMax.y)
        const ids = floor.furniture
          .filter((item) => item.x >= minMx && item.x <= maxMx && item.y >= minMy && item.y <= maxMy)
          .map((item) => item.id)
        store.setSelectedFurnitureMultiple(ids)
      } else {
        store.setSelected(null, null)
      }
      setIsMarqueeSelecting(false)
      setMarqueeStart(null)
      setMarqueeCurrent(null)
    }
    setIsPanning(false)
    setDraggingFurniture(null)
    setDraggingFurnitureIds([])
    setIsRotating(false)
    setRotatingItemId(null)
    setDraggingEndpoint(null)
    setDraggingOpening(null)
    setHoveredDraggable(false)
  }, [isMarqueeSelecting, marqueeStart, marqueeCurrent, editor.panOffset, editor.zoom, editor.viewRotationDeg, canvasSize.w, canvasSize.h, floor.furniture, store])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Prevent default browser gestures like pull-to-refresh if possible
    if (e.cancelable) e.preventDefault()
    
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      setTouchPinchDist(Math.sqrt(dx * dx + dy * dy))
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      setTouchPanMid({ x: midX, y: midY })
      setIsPanning(true)
      setPanStart({ x: midX - editor.panOffset.x, y: midY - editor.panOffset.y })
      return
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const syntheticEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        ctrlKey: false,
        shiftKey: false,
        preventDefault: () => {},
      } as unknown as React.MouseEvent
      handleMouseDown(syntheticEvent)
    }
  }, [handleMouseDown, editor.panOffset])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && isPanning) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2

      if (touchPinchDist) {
        const delta = dist / touchPinchDist
        const newZoom = Math.max(0.2, Math.min(5, editor.zoom * delta))
        if (Math.abs(newZoom - editor.zoom) > 0.01) {
          store.setZoom(newZoom)
          setTouchPinchDist(dist)
        }
      }

      if (touchPanMid) {
        store.setPan({
          x: midX - panStart.x,
          y: midY - panStart.y,
        })
      }
      return
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const syntheticEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        shiftKey: false,
        preventDefault: () => {},
      } as unknown as React.MouseEvent
      handleMouseMove(syntheticEvent)
    }
  }, [isPanning, touchPinchDist, touchPanMid, editor.zoom, store, panStart, handleMouseMove])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setTouchPinchDist(null)
      setTouchPanMid(null)
      setIsPanning(false)
    }
    if (e.touches.length === 0) {
      handleMouseUp()
    }
  }, [handleMouseUp])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    const newZoom = Math.max(0.2, Math.min(5, editor.zoom * delta))
    store.setZoom(newZoom)
  }, [editor.zoom, store])

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    if (editor.isDrawingWall) {
      store.setDrawingWall(false)
      setPreviewEnd(null)
      setLengthInput('')
      setLengthInputActive(false)
    }
  }, [editor.isDrawingWall, store])

  const commitWallWithLength = useCallback((cmText: string) => {
    if (!editor.isDrawingWall || !editor.wallStartPoint || !previewEnd) return
    const cm = parseFloat(cmText)
    if (isNaN(cm) || cm <= 0) return

    const meters = cm / 100
    const s = metersToWorld(editor.wallStartPoint)
    const dx = previewEnd.x - s.x
    const dy = previewEnd.y - s.y
    const currentLen = Math.sqrt(dx * dx + dy * dy)
    if (currentLen === 0) return

    const dirX = dx / currentLen
    const dirY = dy / currentLen
    const endWorld = { x: s.x + dirX * meters * SCALE, y: s.y + dirY * meters * SCALE }
    const endMeters = worldToMeters(endWorld)

    store.addWall(editor.wallStartPoint, endMeters)
    store.setDrawingWall(true, endMeters)
    setLengthInput('')
    setLengthInputActive(false)
    setPreviewEnd(null)
  }, [editor, previewEnd, store])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (lengthInputActive) {
        setLengthInput('')
        setLengthInputActive(false)
        return
      }
      store.setDrawingWall(false)
      setPreviewEnd(null)
      store.setSelected(null, null)
    }

    if (editor.isDrawingWall && editor.wallStartPoint && previewEnd) {
      if ((e.key >= '0' && e.key <= '9') || e.key === '.' || e.key === ',') {
        e.preventDefault()
        const char = e.key === ',' ? '.' : e.key
        setLengthInputActive(true)
        setLengthInput(prev => prev + char)
        return
      }
      if (e.key === 'Backspace' && lengthInputActive) {
        e.preventDefault()
        setLengthInput(prev => prev.slice(0, -1))
        if (lengthInput.length <= 1) setLengthInputActive(false)
        return
      }
      if (e.key === 'Enter' && lengthInputActive && lengthInput) {
        e.preventDefault()
        commitWallWithLength(lengthInput)
        return
      }
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      const ids = editor.selectedFurnitureIds?.length ? editor.selectedFurnitureIds : (editor.selectedItemType === 'furniture' && editor.selectedItemId ? [editor.selectedItemId] : [])
      if (ids.length > 0 && editor.selectedItemType === 'furniture') {
        ids.forEach(id => store.removeFurniture(id))
        store.setSelected(null, null)
      } else if (editor.selectedItemId) {
        if (editor.selectedItemType === 'wall') {
          store.removeWall(editor.selectedItemId)
        } else if (editor.selectedItemType === 'opening') {
          store.removeOpening(editor.selectedItemId)
        }
        store.setSelected(null, null)
      }
    }
    if (e.key === 'r' || e.key === 'R') {
      const fid = (editor.selectedFurnitureIds?.length === 1 ? editor.selectedFurnitureIds[0] : editor.selectedItemId) ?? null
      if (fid) {
        if (editor.selectedItemType === 'furniture') {
          const item = floor.furniture.find(f => f.id === fid)
          if (item) {
            store.updateFurniture(item.id, { rotation: (item.rotation + 45) % 360 })
          }
        } else if (editor.selectedItemType === 'opening') {
          const item = floor.openings.find(o => o.id === fid)
          if (item && item.type === 'door') {
            store.updateOpening(item.id, { flip: !item.flip })
          }
        }
      }
    }

    if (e.key === 'z' || e.key === 'Z') {
      if (!e.ctrlKey && !e.metaKey) {
        const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
        if (!inInput) {
          let wx = 0, wy = 0
          if (editor.selectedItemType === 'furniture') {
            const ids = editor.selectedFurnitureIds?.length ? editor.selectedFurnitureIds : (editor.selectedItemId ? [editor.selectedItemId] : [])
            const items = ids.map(id => floor.furniture.find(f => f.id === id)).filter(Boolean) as FurnitureItem[]
            if (items.length > 0) {
              wx = items.reduce((s, i) => s + i.x, 0) / items.length
              wy = items.reduce((s, i) => s + i.y, 0) / items.length
            } else return
          } else if (editor.selectedItemType === 'wall' && editor.selectedItemId) {
            const wall = floor.walls.find(w => w.id === editor.selectedItemId)
            if (wall) {
              wx = (wall.start.x + wall.end.x) / 2
              wy = (wall.start.y + wall.end.y) / 2
            } else return
          } else if (editor.selectedItemType === 'opening' && editor.selectedItemId) {
            const op = floor.openings.find(o => o.id === editor.selectedItemId)
            if (op) {
              const wall = floor.walls.find(w => w.id === op.wallId)
              if (wall) {
                const dx = wall.end.x - wall.start.x, dy = wall.end.y - wall.start.y
                const len = Math.sqrt(dx * dx + dy * dy)
                const angle = Math.atan2(dy, dx)
                const ox = (op.position - 0.5) * len
                wx = (wall.start.x + wall.end.x) / 2 + ox * Math.cos(angle)
                wy = (wall.start.y + wall.end.y) / 2 - ox * Math.sin(angle)
              } else return
            } else return
          } else return
          const zoom = 2
          store.setZoom(zoom)
          store.setPan({
            x: canvasSize.w / 2 - wx * SCALE * zoom,
            y: canvasSize.h / 2 - wy * SCALE * zoom,
          })
        }
      }
    }

    if (e.key === 'Home') {
      store.setPan({ x: canvasSize.w / 2, y: canvasSize.h / 2 })
      store.setZoom(1)
    }

    // Flechas: desplazar vista en unidades (solo cuando el canvas 2D tiene foco)
    const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
    if (!inInput && containerRef.current?.contains(document.activeElement)) {
      const PAN_STEP = 25
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        store.setPan({ ...editor.panOffset, y: editor.panOffset.y - PAN_STEP })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        store.setPan({ ...editor.panOffset, y: editor.panOffset.y + PAN_STEP })
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        store.setPan({ ...editor.panOffset, x: editor.panOffset.x - PAN_STEP })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        store.setPan({ ...editor.panOffset, x: editor.panOffset.x + PAN_STEP })
      }
    }
  }, [editor, floor, store, lengthInputActive, lengthInput, previewEnd, commitWallWithLength, canvasSize])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const initialCentered = useRef(false)
  useEffect(() => {
    if (!initialCentered.current && canvasSize.w > 0 && canvasSize.h > 0) {
      store.setPan({ x: canvasSize.w / 2, y: canvasSize.h / 2 })
      initialCentered.current = true
    }
  }, [canvasSize.w, canvasSize.h])

  const confirmOpeningPlacement = useCallback(() => {
    if (!openingPrompt) return
    const widthM = Math.max(0.3, Math.min(5, Number(openingPrompt.widthCm) / 100))
    const catalog = editor.selectedOpeningCatalog
    const customCatalog = catalog ? { ...catalog, defaultWidth: widthM } : undefined
    store.addOpening(openingPrompt.wallId, editor.activeTool as 'door' | 'window', openingPrompt.position, customCatalog)
    setOpeningPrompt(null)
  }, [openingPrompt, editor.selectedOpeningCatalog, editor.activeTool, store])

  const cancelOpeningPlacement = useCallback(() => {
    setOpeningPrompt(null)
  }, [])

  return (
    <div ref={containerRef} tabIndex={0} onMouseDown={() => containerRef.current?.focus()} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: tc.canvasBg, transition: 'background 0.3s', cursor: draggingFurniture || draggingOpening || draggingEndpoint ? 'grabbing' : hoveredDraggable ? 'grab' : 'default', outline: 'none' }}>
      <canvas
        ref={canvasRef}
        width={canvasSize.w}
        height={canvasSize.h}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleRightClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          cursor: draggingEndpoint ? 'grabbing'
            : editor.activeTool === 'wall' ? 'crosshair'
            : editor.activeTool === 'erase' ? (hoveredEraseId ? 'pointer' : 'crosshair')
            : editor.activeTool === 'select' ? (isMarqueeSelecting ? 'crosshair' : isRotating ? 'grabbing' : draggingFurniture ? 'grabbing' : 'default')
            : 'crosshair',
          display: 'block',
          touchAction: 'none',
        }}
      />
      {/* Botón rotar vista top — abajo a la izquierda */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <button
          onClick={() => store.setViewRotation((editor.viewRotationDeg ?? 0) + 90)}
          title="Rotar vista top 90°"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: theme === 'dark' ? '1px solid #3a3d55' : '1px solid #c0c4d0',
            background: theme === 'dark' ? '#1a1c28' : '#ffffff',
            color: theme === 'dark' ? '#a0a8c0' : '#555',
            fontSize: 18,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'inherit',
            boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          ↻
        </button>
      </div>
      {/* Length input box — appears while drawing a wall */}
      {editor.isDrawingWall && editor.wallStartPoint && previewEnd && (() => {
        const s = metersToWorld(editor.wallStartPoint!)
        const midScreenX = (s.x * editor.zoom + editor.panOffset.x + previewEnd.x * editor.zoom + editor.panOffset.x) / 2
        const midScreenY = (s.y * editor.zoom + editor.panOffset.y + previewEnd.y * editor.zoom + editor.panOffset.y) / 2
        const dx = previewEnd.x - s.x
        const dy = previewEnd.y - s.y
        const currentCm = (Math.sqrt(dx * dx + dy * dy) / SCALE * 100).toFixed(0)

        return (
          <div style={{
            position: 'absolute',
            left: midScreenX,
            top: midScreenY + 22,
            transform: 'translateX(-50%)',
            zIndex: 30,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: lengthInputActive ? '#1a2a4a' : '#181a22ee',
              border: lengthInputActive ? '1.5px solid #5B8DEF' : '1px solid #333650',
              borderRadius: 6,
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: lengthInputActive ? '0 0 12px rgba(91,141,239,0.3)' : '0 2px 8px rgba(0,0,0,0.4)',
              minWidth: 72,
              justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 13,
                fontWeight: 600,
                color: lengthInputActive ? '#5B8DEF' : '#ccd',
                letterSpacing: 0.5,
              }}>
                {lengthInputActive ? lengthInput : currentCm}
              </span>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 12,
                color: '#8890a0',
              }}>cm</span>
            </div>
            {!lengthInputActive && (
              <div style={{
                textAlign: 'center',
                fontSize: 11,
                color: '#8890a0',
                marginTop: 2,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                Teclea para fijar
              </div>
            )}
            {lengthInputActive && (
              <div style={{
                textAlign: 'center',
                fontSize: 11,
                color: '#5B8DEFaa',
                marginTop: 2,
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                Enter para confirmar
              </div>
            )}
          </div>
        )
      })()}

      {/* Tool hints overlay */}
      <div style={{
        position: 'absolute', top: 10, left: 10,
        background: theme === 'dark' ? '#181a22dd' : '#ffffffdd', padding: '8px 14px', borderRadius: 8,
        fontSize: 13, color: theme === 'dark' ? '#a0a8c0' : '#555', fontFamily: '"JetBrains Mono", monospace',
        border: theme === 'dark' ? '1px solid #2a2d42' : '1px solid #d0d4de',
      }}>
        {floorPlanCalibration && !floorPlanCalibration.waitingForMeters && `📐 Calibración: haz clic en 2 puntos de una pared de referencia (${floorPlanCalibration.points.length}/2)`}
        {editor.activeTool === 'wall' && !floorPlanCalibration && (editor.isDrawingWall ? 'Click para añadir punto · Shift = ángulo fijo · Teclea cm · Clic derecho = terminar' : 'Click para empezar pared')}
        {editor.activeTool === 'select' && !floorPlanCalibration && 'Click para seleccionar · Ctrl+clic añadir/quitar · Arrastrar para marcar varios · Arrastrar mueble · R rotar · Del borrar'}
        {editor.activeTool === 'door' && !floorPlanCalibration && 'Click sobre una pared para añadir puerta'}
        {editor.activeTool === 'window' && !floorPlanCalibration && 'Click sobre una pared para añadir ventana'}
        {editor.activeTool === 'erase' && !floorPlanCalibration && 'Click para borrar elemento'}
        {editor.activeTool === 'furniture' && !floorPlanCalibration && (editor.selectedFurnitureCatalog ? `Clic en el mapa para colocar ${editor.selectedFurnitureCatalog.label}` : 'Selecciona un mueble del panel central')}
      </div>

      {/* Opening dimension prompt — portal en body para evitar desalineación por transforms */}
      {openingPrompt && createPortal(
        <div style={{
          position: 'fixed',
          left: Math.min(openingPrompt.screenX + 10, window.innerWidth - 220),
          top: Math.max(10, Math.min(openingPrompt.screenY - 50, window.innerHeight - 180)),
          zIndex: 1000,
          background: theme === 'dark' ? '#1a1c28' : '#ffffff',
          border: theme === 'dark' ? '1px solid #3a3d55' : '1px solid #c0c4d0',
          borderRadius: 10,
          padding: '14px 16px',
          boxShadow: theme === 'dark' ? '0 8px 30px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.15)',
          fontFamily: '"DM Sans", sans-serif',
          minWidth: 200,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme === 'dark' ? '#d0d2de' : '#333', marginBottom: 10 }}>
            {editor.activeTool === 'door' ? '🚪 Dimensiones puerta' : '🪟 Dimensiones ventana'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: theme === 'dark' ? '#a0a8c0' : '#555', minWidth: 50 }}>Ancho</label>
            <input
              type="number"
              autoFocus
              value={openingPrompt.widthCm}
              onChange={(e) => setOpeningPrompt(p => p ? { ...p, widthCm: e.target.value } : null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmOpeningPlacement()
                if (e.key === 'Escape') cancelOpeningPlacement()
              }}
              style={{
                width: 70, padding: '6px 8px',
                background: theme === 'dark' ? '#13141c' : '#f0f2f5',
                border: theme === 'dark' ? '1px solid #3a3d55' : '1px solid #c0c4d0',
                borderRadius: 6, color: theme === 'dark' ? '#d0d2de' : '#333',
                fontSize: 14, fontFamily: '"JetBrains Mono", monospace',
                textAlign: 'right',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: 12, color: theme === 'dark' ? '#8088a0' : '#777' }}>cm</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={confirmOpeningPlacement}
              style={{
                flex: 1, padding: '7px 12px', borderRadius: 6, border: 'none',
                background: '#5B8DEF', color: '#fff', fontSize: 13, cursor: 'pointer',
                fontFamily: 'inherit', fontWeight: 600,
              }}
            >Colocar</button>
            <button
              onClick={cancelOpeningPlacement}
              style={{
                padding: '7px 12px', borderRadius: 6,
                border: theme === 'dark' ? '1px solid #3a3d55' : '1px solid #c0c4d0',
                background: 'transparent',
                color: theme === 'dark' ? '#a0a8c0' : '#555',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >Cancelar</button>
          </div>
          <div style={{ fontSize: 11, color: theme === 'dark' ? '#667088' : '#999', marginTop: 6 }}>
            Enter para confirmar · Esc para cancelar
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
