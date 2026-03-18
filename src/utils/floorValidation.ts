import type { Floor, Wall, WallOpening, Room } from '@/types'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  message: string
  elementType: 'wall' | 'opening' | 'room'
  elementId?: string
}

export function validateFloor(floor: Floor): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const wallIds = new Set(floor.walls.map((w) => w.id))

  for (const op of floor.openings) {
    if (!wallIds.has(op.wallId)) {
      issues.push({
        id: `opening-${op.id}`,
        severity: 'error',
        message: `Puerta/ventana sin pared válida (pared eliminada)`,
        elementType: 'opening',
        elementId: op.id,
      })
    }
  }

  for (const room of floor.rooms) {
    const invalidWallIds = room.wallIds.filter((id) => !wallIds.has(id))
    if (invalidWallIds.length > 0) {
      issues.push({
        id: `room-${room.id}`,
        severity: 'error',
        message: `Habitación "${room.name}" referencia ${invalidWallIds.length} pared(es) inexistente(s)`,
        elementType: 'room',
        elementId: room.id,
      })
    }
    if (room.wallIds.length === 0) {
      issues.push({
        id: `room-empty-${room.id}`,
        severity: 'warning',
        message: `Habitación "${room.name}" sin paredes asignadas`,
        elementType: 'room',
        elementId: room.id,
      })
    }
  }

  const wallsInRooms = new Set<string>()
  for (const room of floor.rooms) {
    for (const wid of room.wallIds) {
      wallsInRooms.add(wid)
    }
  }

  for (const wall of floor.walls) {
    if (!wallsInRooms.has(wall.id)) {
      issues.push({
        id: `wall-${wall.id}`,
        severity: 'warning',
        message: `Pared no asignada a ninguna habitación`,
        elementType: 'wall',
        elementId: wall.id,
      })
    }
  }

  return issues
}
