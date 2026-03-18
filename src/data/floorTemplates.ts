import { v4 as uuidv4 } from 'uuid'
import type { Floor, Wall, WallOpening, Room, FurnitureItem } from '@/types'

export interface FloorTemplate {
  id: string
  name: string
  description: string
  buildFloor: () => Floor
}

type TemplateData = {
  walls: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>
  openings: Array<{ wallIndex: number; type: 'door' | 'window'; subtype: string; position: number; width: number; height: number }>
  rooms: Array<{ name: string; type: Room['type']; wallIndices: number[] }>
  furniture?: Array<{ type: string; category: string; label: string; x: number; y: number; rotation: number; width: number; depth: number; height: number; color: string; material: string }>
}

function createTemplate(
  id: string,
  name: string,
  description: string,
  getData: () => TemplateData
): FloorTemplate {
  return {
    id,
    name,
    description,
    buildFloor: () => {
      const data = getData()
      const wallIds: string[] = []
      const walls: Wall[] = data.walls.map((w) => {
        const wid = uuidv4()
        wallIds.push(wid)
        return {
          id: wid,
          start: w.start,
          end: w.end,
          thickness: 0.2,
          height: 2.7,
          material: 'concrete',
          color: '#FFFFFF',
        }
      })

      const openings: WallOpening[] = data.openings.map((o) => {
        const wallId = wallIds[o.wallIndex]
        if (!wallId) return null
        return {
          id: uuidv4(),
          wallId,
          type: o.type,
          subtype: o.subtype as WallOpening['subtype'],
          position: o.position,
          width: o.width,
          height: o.height,
          elevation: 0,
          color: '#8B6914',
        }
      }).filter((o): o is WallOpening => o !== null)

      const rooms: Room[] = data.rooms.map((r) => ({
        id: uuidv4(),
        name: r.name,
        type: r.type,
        wallIds: r.wallIndices.map((i) => wallIds[i]).filter(Boolean),
        floorMaterial: 'wood',
        floorColor: '#C4A882',
        ceilingColor: '#F5F5F5',
      }))

      const furniture: FurnitureItem[] = (data.furniture || []).map((f) => ({
        id: uuidv4(),
        type: f.type,
        category: f.category,
        label: f.label,
        x: f.x,
        y: f.y,
        rotation: f.rotation,
        width: f.width,
        depth: f.depth,
        height: f.height,
        color: f.color,
        material: f.material,
      }))

      return {
        id: uuidv4(),
        name: 'Planta Baja',
        level: 0,
        walls,
        openings,
        furniture,
        rooms,
        height: 2.7,
      }
    },
  }
}

export const FLOOR_TEMPLATES: FloorTemplate[] = [
  createTemplate('estudio', 'Estudio', 'Una habitación ~25 m²', () => {
    const s = 5
    return {
      walls: [
        { start: { x: 0, y: 0 }, end: { x: s, y: 0 } },
        { start: { x: s, y: 0 }, end: { x: s, y: s } },
        { start: { x: s, y: s }, end: { x: 0, y: s } },
        { start: { x: 0, y: s }, end: { x: 0, y: 0 } },
      ],
      openings: [
        { wallIndex: 0, type: 'door', subtype: 'single', position: 0.5, width: 0.9, height: 2.1 },
        { wallIndex: 1, type: 'window', subtype: 'fixed', position: 0.5, width: 1.5, height: 1.2 },
      ],
      rooms: [{ name: 'Estudio', type: 'living', wallIndices: [0, 1, 2, 3] }],
      furniture: [
        { type: 'sofa_2', category: 'living', label: 'Sofá', x: 2.5, y: 1.5, rotation: 0, width: 1.6, depth: 0.9, height: 0.85, color: '#8B7355', material: 'fabric' },
        { type: 'coffee_table', category: 'living', label: 'Mesa centro', x: 2.5, y: 2.8, rotation: 0, width: 1.1, depth: 0.6, height: 0.45, color: '#D2B48C', material: 'wood' },
        { type: 'kitchen_counter', category: 'kitchen', label: 'Cocina', x: 1, y: 4.2, rotation: 0, width: 2.4, depth: 0.6, height: 0.9, color: '#F5F5F5', material: 'marble' },
        { type: 'bed_single', category: 'bedroom', label: 'Cama', x: 4, y: 4, rotation: 90, width: 0.9, depth: 2, height: 0.55, color: '#F5F5DC', material: 'fabric' },
      ],
    }
  }),

  createTemplate('piso_2dorm', 'Piso 2 dormitorios', '~70 m² con salón, cocina, 2 dormitorios y baño', () => {
    const walls: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = []
    const addRect = (ox: number, oy: number, w: number, h: number) => {
      walls.push({ start: { x: ox, y: oy }, end: { x: ox + w, y: oy } })
      walls.push({ start: { x: ox + w, y: oy }, end: { x: ox + w, y: oy + h } })
      walls.push({ start: { x: ox + w, y: oy + h }, end: { x: ox, y: oy + h } })
      walls.push({ start: { x: ox, y: oy + h }, end: { x: ox, y: oy } })
    }
    addRect(0, 0, 10, 7)
    const doorIdx = 0
    const winIdx1 = 1
    const winIdx2 = 2
    return {
      walls,
      openings: [
        { wallIndex: doorIdx, type: 'door', subtype: 'entry', position: 0.5, width: 0.92, height: 2.1 },
        { wallIndex: winIdx1, type: 'window', subtype: 'fixed', position: 0.5, width: 2, height: 1.2 },
        { wallIndex: winIdx2, type: 'window', subtype: 'fixed', position: 0.5, width: 1.5, height: 1.2 },
      ],
      rooms: [
        { name: 'Salón', type: 'living', wallIndices: [0, 1, 2, 3] },
      ],
      furniture: [],
    }
  }),

  createTemplate('piso_3dorm', 'Piso 3 dormitorios', '~90 m² con salón, cocina, 3 dormitorios y 2 baños', () => {
    const s = 9
    return {
      walls: [
        { start: { x: 0, y: 0 }, end: { x: s, y: 0 } },
        { start: { x: s, y: 0 }, end: { x: s, y: s } },
        { start: { x: s, y: s }, end: { x: 0, y: s } },
        { start: { x: 0, y: s }, end: { x: 0, y: 0 } },
      ],
      openings: [
        { wallIndex: 0, type: 'door', subtype: 'entry', position: 0.3, width: 0.92, height: 2.1 },
        { wallIndex: 1, type: 'window', subtype: 'sliding', position: 0.5, width: 2.4, height: 1.4 },
      ],
      rooms: [{ name: 'Salón', type: 'living', wallIndices: [0, 1, 2, 3] }],
      furniture: [],
    }
  }),

  createTemplate('vacio', 'Plano vacío', 'Solo perímetro rectangular para empezar desde cero', () => {
    const w = 8
    const h = 6
    return {
      walls: [
        { start: { x: 0, y: 0 }, end: { x: w, y: 0 } },
        { start: { x: w, y: 0 }, end: { x: w, y: h } },
        { start: { x: w, y: h }, end: { x: 0, y: h } },
        { start: { x: 0, y: h }, end: { x: 0, y: 0 } },
      ],
      openings: [
        { wallIndex: 0, type: 'door', subtype: 'single', position: 0.5, width: 0.9, height: 2.1 },
      ],
      rooms: [{ name: 'Habitación', type: 'other', wallIndices: [0, 1, 2, 3] }],
    }
  }),
]
