import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Project, Floor, Wall, WallOpening, FurnitureItem, Room,
  EditorState, EditorTool, CameraMode, Point,
  DoorSubtype, WindowSubtype, OpeningCatalogItem,
  SceneMaterials, MaterialSlot, FurnitureCatalogItem,
  FloorPlanBackground, FloorPlanCalibration, FloorPlanAIAnalysis,
  CameraPathWaypoint,
} from '@/types'
import { DEFAULT_SCENE_MATERIALS, FURNITURE_CATALOG, OPENING_CATALOG } from '@/types'
import { FLOOR_TEMPLATES } from '@/data/floorTemplates'
import { validateFloor, type ValidationIssue } from '@/utils/floorValidation'
import type { Room } from '@/types'

function createDefaultFloor(level: number): Floor {
  return {
    id: uuidv4(),
    name: level === 0 ? 'Planta Baja' : `Planta ${level}`,
    level,
    walls: [],
    openings: [],
    furniture: [],
    rooms: [],
    height: 2.7,
  }
}

interface SavedProjectMeta {
  id: string
  name: string
  savedAt: string
}

interface UndoableState {
  project: Project
  theme?: 'dark' | 'light'
  globalWallColor: string
  globalFloorMaterial: string
  globalFloorColor: string
  sceneMaterials: SceneMaterials
}

const MAX_UNDO = 80
let undoStack: UndoableState[] = []
let redoStack: UndoableState[] = []
let skipSnapshot = false

type ClipboardItem = { type: 'wall'; data: Wall } | { type: 'furniture'; data: FurnitureItem } | { type: 'opening'; data: WallOpening }
let clipboard: ClipboardItem[] = []

function takeSnapshot(s: AppStore): UndoableState {
  return JSON.parse(JSON.stringify({
    project: s.project,
    theme: s.theme,
    globalWallColor: s.globalWallColor,
    globalFloorMaterial: s.globalFloorMaterial,
    globalFloorColor: s.globalFloorColor,
    sceneMaterials: s.sceneMaterials,
  }))
}

interface AppStore {
  // Project
  project: Project
  dirty: boolean
  setProjectName: (name: string) => void

  // Cambios sin guardar
  hasUnsavedChanges: () => boolean

  // Undo / Redo
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  _pushUndo: () => void

  // Project management
  newProject: () => void
  applyFloorTemplate: (templateId: string) => void
  saveProject: () => void
  loadProject: (id: string) => Promise<boolean>
  loadProjectFromFile: (data: Record<string, unknown>) => boolean
  deleteProject: (id: string) => Promise<void>
  getSavedProjects: () => Promise<SavedProjectMeta[]>

  // Floors
  addFloor: () => void
  removeFloor: (id: string) => void
  setActiveFloor: (id: string) => void
  getActiveFloor: () => Floor

  // Walls
  addWall: (start: Point, end: Point) => void
  removeWall: (id: string) => void
  updateWall: (id: string, updates: Partial<Wall>) => void

  // Openings
  addOpening: (wallId: string, type: 'door' | 'window', position: number, catalog?: OpeningCatalogItem) => void
  updateOpening: (id: string, updates: Partial<WallOpening>) => void
  removeOpening: (id: string) => void

  // Furniture
  addFurniture: (item: Omit<FurnitureItem, 'id'>) => void
  removeFurniture: (id: string) => void
  updateFurniture: (id: string, updates: Partial<FurnitureItem>) => void
  updateFurnitureBatch: (ids: string[], updates: Partial<FurnitureItem>) => void
  alignFurnitureHorizontal: (ids: string[]) => void
  alignFurnitureVertical: (ids: string[]) => void
  distributeFurnitureHorizontal: (ids: string[]) => void
  distributeFurnitureVertical: (ids: string[]) => void

  // Copy / Paste
  copySelectedItem: () => boolean
  pasteItem: () => boolean

  // Editor state
  editor: EditorState
  setTool: (tool: EditorTool) => void
  setZoom: (zoom: number) => void
  setPan: (offset: Point) => void
  setViewRotation: (deg: number) => void
  setSelected: (id: string | null, type: EditorState['selectedItemType']) => void
  setSelectedFurnitureMultiple: (ids: string[]) => void
  setDrawingWall: (drawing: boolean, start?: Point | null) => void
  setCameraMode: (mode: CameraMode) => void
  setOrbitTarget: (x: number, z: number) => void
  setFirstPersonCamera: (x: number, z: number, yaw: number) => void
  setTimeOfDay: (time: number) => void
  setShowCeiling: (show: boolean) => void
  setExposure: (v: number) => void
  setBloomIntensity: (v: number) => void
  setRenderResolution: (v: 1 | 2 | 4) => void
  requestCapture: () => void
  setCameraFov: (v: number) => void
  setOrbitZoom: (v: number) => void
  setFocusDistance: (v: number) => void
  setFocusBlur: (v: number) => void
  clearCaptureRequest: () => void
  setShowShadows: (v: boolean) => void
  setShowFloorGrid: (v: boolean) => void
  setWireframeMode: (v: boolean) => void
  setContrast: (v: number) => void
  setSaturation: (v: number) => void
  setCameraPresetRequest: (v: 'front' | 'side' | 'top' | 'isometric' | null) => void
  setTourMode: (v: boolean) => void
  setShowRoomLabels: (v: boolean) => void
  setIsCapturing: (v: boolean) => void
  saveCameraPosition: () => void
  restoreCameraPosition: (index: number) => void
  clearSaveCameraRequest: () => void
  clearRestoreCameraIndex: () => void
  setSelectedOpeningCatalog: (item: OpeningCatalogItem | null) => void
  setSelectedFurnitureCatalog: (item: FurnitureCatalogItem | null) => void

  // Global style
  theme: 'dark' | 'light'
  toggleTheme: () => void

  globalWallColor: string
  globalFloorMaterial: string
  globalFloorColor: string
  setGlobalWallColor: (color: string) => void
  setGlobalFloorMaterial: (mat: string) => void
  setGlobalFloorColor: (color: string) => void

  sceneMaterials: SceneMaterials
  setSceneMaterials: (mats: SceneMaterials) => void
  updateMaterialSlot: (key: keyof SceneMaterials, partial: Partial<MaterialSlot & { height?: number }>) => void

  // Plano de fondo importado (imagen, PDF, DXF)
  floorPlanBackground: FloorPlanBackground | null
  setFloorPlanBackground: (bg: FloorPlanBackground | null) => void
  floorPlanCalibration: FloorPlanCalibration | null
  setFloorPlanCalibration: (c: FloorPlanCalibration | null) => void
  addCalibrationPoint: (p: Point) => void
  applyCalibration: (meters: number) => void

  // Análisis IA del plano (super agente)
  aiAnalysisResult: FloorPlanAIAnalysis | null
  setAiAnalysisResult: (r: FloorPlanAIAnalysis | null) => void
  aiAnalysisError: string | null
  setAiAnalysisError: (e: string | null) => void
  aiAnalysisModalOpen: boolean
  setAiAnalysisModalOpen: (v: boolean) => void
  aiAnalysisApplying: boolean
  setAiAnalysisApplying: (v: boolean) => void
  applyAiAnalysisWithReference: (widthCm: number, depthCm: number, refOverride?: { type: string; label: string; room: string; widthPx: number; heightPx: number; lengthPx?: number }) => void
  pendingToast: { message: string; type: 'success' | 'info' } | null
  setPendingToast: (t: { message: string; type: 'success' | 'info' } | null) => void

  // Calcar manualmente (importar plano)
  manualTraceModalOpen: boolean
  setManualTraceModalOpen: (v: boolean) => void
  applyManualTrace: (points: { x: number; y: number }[], widthCm: number) => void

  // Generación de renders con IA
  lastCapturedImage: string | null
  setLastCapturedImage: (url: string | null) => void
  lastCapturedViewType: 'topDown' | 'perspective'
  setLastCapturedViewType: (v: 'topDown' | 'perspective') => void
  lastCapturedCameraMode: 'orbit' | 'firstPerson'
  setLastCapturedCameraMode: (v: 'orbit' | 'firstPerson') => void
  renderGenerationModalOpen: boolean
  setRenderGenerationModalOpen: (v: boolean) => void
  requestRenderGeneration: () => void

  // Validación de planos
  validationIssues: ValidationIssue[]
  runValidation: () => void

  // Camera path (ruta de cámara para video)
  addCameraWaypoint: (wp: CameraPathWaypoint) => void
  removeCameraWaypoint: (id: string) => void
  reorderWaypoints: (fromIndex: number, toIndex: number) => void
  importSavedCamerasAsWaypoints: () => void
  clearAllWaypoints: () => void
  setPathDuration: (v: number) => void
  setPathFps: (v: number) => void
  setShowPathLine: (v: boolean) => void
  toggleClickToAddWaypoint: () => void
  requestAddWaypoint: () => void
  startPathPreview: () => void
  stopPathPreview: () => void
  startWebGLRecording: () => void
  stopWebGLRecording: () => void
  setRecordingProgress: (v: number) => void
  startSoraGeneration: () => void
  stopSoraGeneration: () => void
  setSoraProgress: (v: number) => void

  // Video Sora modal
  soraVideoModalOpen: boolean
  setSoraVideoModalOpen: (v: boolean) => void
  soraKeyframes: string[]
  setSoraKeyframes: (frames: string[]) => void

  // Vista 3D: cámaras guardadas
  savedCameraPositions: Array<{ position: [number, number, number]; target: [number, number, number]; zoom: number }>
}

const defaultFloor = createDefaultFloor(0)

export const useStore = create<AppStore>((set, get) => ({
  project: {
    id: uuidv4(),
    name: 'Mi Vivienda',
    floors: [defaultFloor],
    activeFloorId: defaultFloor.id,
  },
  dirty: false,

  setProjectName: (name) => set((state) => ({ project: { ...state.project, name }, dirty: true })),

  hasUnsavedChanges: () => get().dirty,

  _pushUndo: () => {
    const s = get()
    undoStack.push(takeSnapshot(s))
    if (undoStack.length > MAX_UNDO) undoStack.shift()
    redoStack = []
    set({ dirty: true })
  },

  undo: () => {
    if (undoStack.length === 0) return
    const s = get()
    redoStack.push(takeSnapshot(s))
    const prev = undoStack.pop()!
    skipSnapshot = true
    set({
      project: prev.project,
      theme: prev.theme || 'dark',
      globalWallColor: prev.globalWallColor,
      globalFloorMaterial: prev.globalFloorMaterial,
      globalFloorColor: prev.globalFloorColor,
      sceneMaterials: prev.sceneMaterials || DEFAULT_SCENE_MATERIALS,
    })
    skipSnapshot = false
  },

  redo: () => {
    if (redoStack.length === 0) return
    const s = get()
    undoStack.push(takeSnapshot(s))
    const next = redoStack.pop()!
    skipSnapshot = true
    set({
      project: next.project,
      theme: next.theme || 'dark',
      globalWallColor: next.globalWallColor,
      globalFloorMaterial: next.globalFloorMaterial,
      globalFloorColor: next.globalFloorColor,
      sceneMaterials: next.sceneMaterials || DEFAULT_SCENE_MATERIALS,
    })
    skipSnapshot = false
  },

  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,

  newProject: () => set(() => {
    undoStack = []
    redoStack = []
    const floor = createDefaultFloor(0)
    return {
      project: {
        id: uuidv4(),
        name: 'Mi Vivienda',
        floors: [floor],
        activeFloorId: floor.id,
      },
      dirty: false,
      theme: 'dark' as const,
      globalWallColor: '#FFFFFF',
      globalFloorMaterial: 'wood',
      globalFloorColor: '#C4A882',
      sceneMaterials: JSON.parse(JSON.stringify(DEFAULT_SCENE_MATERIALS)),
      editor: {
        activeTool: 'wall' as EditorTool,
        selectedOpeningCatalog: null,
        selectedFurnitureCatalog: null,
        gridSize: 20,
        gridSizeMeters: 0.25,
        zoom: 1,
        panOffset: { x: 0, y: 0 },
        selectedItemId: null,
        selectedItemType: null,
        selectedFurnitureIds: [],
        isDrawingWall: false,
        wallStartPoint: null,
        cameraMode: 'orbit' as CameraMode,
        firstPersonCamera: null,
        orbitTarget: null,
        viewRotationDeg: 0,
        timeOfDay: 14,
        showCeiling: false,
        exposure: 1.1,
        bloomIntensity: 0.15,
        renderResolution: 2,
        captureRequest: 0,
        cameraFov: 55,
        orbitZoom: 8,
        focusDistance: 5,
        focusBlur: 0,
        showShadows: true,
        showFloorGrid: false,
        wireframeMode: false,
        contrast: 0,
        saturation: 0,
        cameraPresetRequest: null,
        tourMode: false,
        showRoomLabels: true,
        isCapturing: false,
        saveCameraRequest: 0,
        restoreCameraIndex: null,
        cameraPath: {
          waypoints: [],
          showPathLine: true,
          isPreviewing: false,
          isRecordingWebGL: false,
          isGeneratingSora: false,
          recordingProgress: 0,
          soraProgress: 0,
          pathDuration: 10,
          pathFps: 30,
          clickToAddWaypoint: false,
          addWaypointRequest: 0,
        },
      },
    }
  }),

  applyFloorTemplate: (templateId) => {
    const template = FLOOR_TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    get()._pushUndo()
    const newFloor = template.buildFloor()
    set((state) => {
      const isActive = (f: Floor) => f.id === state.project.activeFloorId
      const newFloors = state.project.floors.map((f) => (isActive(f) ? newFloor : f))
      return {
        project: {
          ...state.project,
          floors: newFloors,
          activeFloorId: state.project.floors.some(isActive) ? newFloor.id : state.project.activeFloorId,
        },
        dirty: true,
      }
    })
  },

  saveProject: () => {
    const s = get()
    const indexKey = 'floorcraft_projects_index'
    let index: SavedProjectMeta[] = JSON.parse(localStorage.getItem(indexKey) || '[]')
    const byName = index.find((p) => p.name === s.project.name)
    let targetId = s.project.id
    if (byName) {
      targetId = byName.id
      index = index.filter((p) => p.name !== s.project.name)
    } else {
      index = index.filter((p) => p.id !== s.project.id)
    }
    const projectToSave = targetId !== s.project.id ? { ...s.project, id: targetId } : s.project
    const data = {
      project: projectToSave,
      theme: s.theme,
      globalWallColor: s.globalWallColor,
      globalFloorMaterial: s.globalFloorMaterial,
      globalFloorColor: s.globalFloorColor,
      sceneMaterials: s.sceneMaterials,
    }
    const meta: SavedProjectMeta = { id: targetId, name: s.project.name, savedAt: new Date().toISOString() }
    index.push(meta)
    localStorage.setItem(`floorcraft_project_${targetId}`, JSON.stringify(data))
    localStorage.setItem(indexKey, JSON.stringify(index))
    if (targetId !== s.project.id) {
      localStorage.removeItem(`floorcraft_project_${s.project.id}`)
      set({ project: { ...s.project, id: targetId }, dirty: false })
    } else {
      set({ dirty: false })
    }
    fetch('/api/projects/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {})
  },

  loadProject: async (id) => {
    const applyData = (data: any) => {
      set({
        project: data.project,
        theme: data.theme || 'dark',
        globalWallColor: data.globalWallColor || '#FFFFFF',
        globalFloorMaterial: data.globalFloorMaterial || 'wood',
        globalFloorColor: data.globalFloorColor || '#C4A882',
        sceneMaterials: data.sceneMaterials || JSON.parse(JSON.stringify(DEFAULT_SCENE_MATERIALS)),
        dirty: false,
      })
      return true
    }
    try {
      const r = await fetch(`/api/projects/${id}`)
      if (r.ok) {
        const data = await r.json()
        applyData(data)
        return true
      }
    } catch {}
    const raw = localStorage.getItem(`floorcraft_project_${id}`)
    if (!raw) return false
    try {
      applyData(JSON.parse(raw))
      return true
    } catch {
      return false
    }
  },

  loadProjectFromFile: (data) => {
    if (!data?.project) return false
    try {
      set({
        project: data.project,
        theme: data.theme || 'dark',
        globalWallColor: data.globalWallColor || '#FFFFFF',
        globalFloorMaterial: data.globalFloorMaterial || 'wood',
        globalFloorColor: data.globalFloorColor || '#C4A882',
        sceneMaterials: data.sceneMaterials || JSON.parse(JSON.stringify(DEFAULT_SCENE_MATERIALS)),
        dirty: false,
      })
      return true
    } catch {
      return false
    }
  },

  deleteProject: async (id) => {
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    } catch {}
    localStorage.removeItem(`floorcraft_project_${id}`)
    const indexKey = 'floorcraft_projects_index'
    const index: SavedProjectMeta[] = JSON.parse(localStorage.getItem(indexKey) || '[]')
    localStorage.setItem(indexKey, JSON.stringify(index.filter((p) => p.id !== id)))
  },

  getSavedProjects: async () => {
    try {
      const r = await fetch('/api/projects')
      if (r.ok) {
        const list = await r.json()
        if (Array.isArray(list)) return list
      }
    } catch {}
    return JSON.parse(localStorage.getItem('floorcraft_projects_index') || '[]')
  },

  addFloor: () => {
    get()._pushUndo()
    set((state) => {
      const level = state.project.floors.length
      const floor = createDefaultFloor(level)
      return {
        project: {
          ...state.project,
          floors: [...state.project.floors, floor],
          activeFloorId: floor.id,
        },
      }
    })
  },

  removeFloor: (id) => {
    get()._pushUndo()
    set((state) => {
      if (state.project.floors.length <= 1) return state
      const floors = state.project.floors.filter((f) => f.id !== id)
      return {
        project: {
          ...state.project,
          floors,
          activeFloorId: state.project.activeFloorId === id ? floors[0].id : state.project.activeFloorId,
        },
      }
    })
  },

  setActiveFloor: (id) => set((state) => ({
    project: { ...state.project, activeFloorId: id },
  })),

  getActiveFloor: () => {
    const s = get()
    return s.project.floors.find((f) => f.id === s.project.activeFloorId) || s.project.floors[0]
  },

  addWall: (start, end) => {
    get()._pushUndo()
    set((state) => {
      const wall: Wall = {
        id: uuidv4(),
        start,
        end,
        thickness: 0.15,
        height: 2.7,
        material: 'paint',
        color: state.globalWallColor,
      }
      return {
        project: {
          ...state.project,
          floors: state.project.floors.map((f) =>
            f.id === state.project.activeFloorId
              ? { ...f, walls: [...f.walls, wall] }
              : f
          ),
        },
      }
    })
  },

  removeWall: (id) => {
    get()._pushUndo()
    set((state) => ({
      project: {
        ...state.project,
        floors: state.project.floors.map((f) =>
          f.id === state.project.activeFloorId
            ? {
              ...f,
              walls: f.walls.filter((w) => w.id !== id),
              openings: f.openings.filter((o) => o.wallId !== id),
            }
            : f
        ),
      },
    }))
  },

  updateWall: (id, updates) => {
    get()._pushUndo()
    set((state) => ({
      project: {
        ...state.project,
        floors: state.project.floors.map((f) =>
          f.id === state.project.activeFloorId
            ? { ...f, walls: f.walls.map((w) => w.id === id ? { ...w, ...updates } : w) }
            : f
        ),
      },
    }))
  },

  addOpening: (wallId, type, position, catalog?) => {
    get()._pushUndo()
    set((state) => {
      const opening: WallOpening = {
        id: uuidv4(),
        wallId,
        type,
        subtype: catalog?.subtype || (type === 'door' ? 'single' : 'fixed'),
        position,
        width: catalog?.defaultWidth || (type === 'door' ? 0.82 : 1.2),
        height: catalog?.defaultHeight || (type === 'door' ? 2.03 : 1.2),
        elevation: catalog?.defaultElevation ?? (type === 'door' ? 0 : 0.9),
        color: catalog?.defaultColor || (type === 'door' ? '#8B6914' : '#F5F5F5'),
        ...(type === 'door' && !['sliding', 'pocket', 'pocket_pladur'].includes(catalog?.subtype || 'single') ? { openDirection: 'left' as const } : {}),
      }
      return {
        project: {
          ...state.project,
          floors: state.project.floors.map((f) =>
            f.id === state.project.activeFloorId
              ? { ...f, openings: [...f.openings, opening] }
              : f
          ),
        },
      }
    })
  },

  updateOpening: (id, updates) => {
    get()._pushUndo()
    set((state) => ({
      project: {
        ...state.project,
        floors: state.project.floors.map((f) =>
          f.id === state.project.activeFloorId
            ? { ...f, openings: f.openings.map((o) => o.id === id ? { ...o, ...updates } : o) }
            : f
        ),
      },
    }))
  },

  removeOpening: (id) => {
    get()._pushUndo()
    set((state) => ({
      project: {
        ...state.project,
        floors: state.project.floors.map((f) =>
          f.id === state.project.activeFloorId
            ? { ...f, openings: f.openings.filter((o) => o.id !== id) }
            : f
        ),
      },
    }))
  },

  addFurniture: (item) => {
    get()._pushUndo()
    set((state) => {
      const furniture: FurnitureItem = { ...item, id: uuidv4() }
      return {
        project: {
          ...state.project,
          floors: state.project.floors.map((f) =>
            f.id === state.project.activeFloorId
              ? { ...f, furniture: [...f.furniture, furniture] }
              : f
          ),
        },
      }
    })
  },

  removeFurniture: (id) => {
    get()._pushUndo()
    set((state) => ({
      project: {
        ...state.project,
        floors: state.project.floors.map((f) =>
          f.id === state.project.activeFloorId
            ? { ...f, furniture: f.furniture.filter((fi) => fi.id !== id) }
            : f
        ),
      },
    }))
  },

  updateFurniture: (id, updates) => {
    get()._pushUndo()
    set((state) => ({
      project: {
        ...state.project,
        floors: state.project.floors.map((f) =>
          f.id === state.project.activeFloorId
            ? { ...f, furniture: f.furniture.map((fi) => fi.id === id ? { ...fi, ...updates } : fi) }
            : f
        ),
      },
    }))
  },

  updateFurnitureBatch: (ids, updates) => {
    if (ids.length === 0) return
    get()._pushUndo()
    const idSet = new Set(ids)
    set((state) => ({
      project: {
        ...state.project,
        floors: state.project.floors.map((f) =>
          f.id === state.project.activeFloorId
            ? { ...f, furniture: f.furniture.map((fi) => idSet.has(fi.id) ? { ...fi, ...updates } : fi) }
            : f
        ),
      },
    }))
  },

  alignFurnitureHorizontal: (ids) => {
    const s = get()
    const floor = s.project.floors.find((f) => f.id === s.project.activeFloorId)
    if (!floor || ids.length < 2) return
    const items = ids.map((id) => floor.furniture.find((f) => f.id === id)).filter(Boolean) as FurnitureItem[]
    if (items.length < 2) return
    get()._pushUndo()
    const avgX = items.reduce((sum, i) => sum + i.x, 0) / items.length
    set((prev) => ({
      project: {
        ...prev.project,
        floors: prev.project.floors.map((f) =>
          f.id === prev.project.activeFloorId
            ? { ...f, furniture: f.furniture.map((fi) => (ids.includes(fi.id) ? { ...fi, x: avgX } : fi)) }
            : f
        ),
      },
    }))
  },

  alignFurnitureVertical: (ids) => {
    const s = get()
    const floor = s.project.floors.find((f) => f.id === s.project.activeFloorId)
    if (!floor || ids.length < 2) return
    const items = ids.map((id) => floor.furniture.find((f) => f.id === id)).filter(Boolean) as FurnitureItem[]
    if (items.length < 2) return
    get()._pushUndo()
    const avgY = items.reduce((sum, i) => sum + i.y, 0) / items.length
    set((prev) => ({
      project: {
        ...prev.project,
        floors: prev.project.floors.map((f) =>
          f.id === prev.project.activeFloorId
            ? { ...f, furniture: f.furniture.map((fi) => (ids.includes(fi.id) ? { ...fi, y: avgY } : fi)) }
            : f
        ),
      },
    }))
  },

  distributeFurnitureHorizontal: (ids) => {
    const s = get()
    const floor = s.project.floors.find((f) => f.id === s.project.activeFloorId)
    if (!floor || ids.length < 3) return
    const items = ids.map((id) => floor.furniture.find((f) => f.id === id)).filter(Boolean) as FurnitureItem[]
    if (items.length < 3) return
    get()._pushUndo()
    const sorted = [...items].sort((a, b) => a.x - b.x)
    const minX = sorted[0].x
    const maxX = sorted[sorted.length - 1].x
    const span = maxX - minX
    if (span <= 0) return
    const step = span / (sorted.length - 1)
    const newXById = Object.fromEntries(sorted.map((item, i) => [item.id, minX + i * step]))
    set((prev) => ({
      project: {
        ...prev.project,
        floors: prev.project.floors.map((f) =>
          f.id === prev.project.activeFloorId
            ? { ...f, furniture: f.furniture.map((fi) => (fi.id in newXById ? { ...fi, x: newXById[fi.id] } : fi)) }
            : f
        ),
      },
    }))
  },

  distributeFurnitureVertical: (ids) => {
    const s = get()
    const floor = s.project.floors.find((f) => f.id === s.project.activeFloorId)
    if (!floor || ids.length < 3) return
    const items = ids.map((id) => floor.furniture.find((f) => f.id === id)).filter(Boolean) as FurnitureItem[]
    if (items.length < 3) return
    get()._pushUndo()
    const sorted = [...items].sort((a, b) => a.y - b.y)
    const minY = sorted[0].y
    const maxY = sorted[sorted.length - 1].y
    const span = maxY - minY
    if (span <= 0) return
    const step = span / (sorted.length - 1)
    const newYById = Object.fromEntries(sorted.map((item, i) => [item.id, minY + i * step]))
    set((prev) => ({
      project: {
        ...prev.project,
        floors: prev.project.floors.map((f) =>
          f.id === prev.project.activeFloorId
            ? { ...f, furniture: f.furniture.map((fi) => (fi.id in newYById ? { ...fi, y: newYById[fi.id] } : fi)) }
            : f
        ),
      },
    }))
  },

  copySelectedItem: () => {
    const s = get()
    const floor = s.project.floors.find((f) => f.id === s.project.activeFloorId)
    if (!floor) return false
    const { selectedItemId, selectedItemType, selectedFurnitureIds } = s.editor

    if (selectedItemType === 'furniture') {
      const ids = selectedFurnitureIds?.length ? selectedFurnitureIds : (selectedItemId ? [selectedItemId] : [])
      const items = ids.map((id) => floor.furniture.find((f) => f.id === id)).filter(Boolean) as FurnitureItem[]
      if (items.length === 0) return false
      clipboard = items.map((fi) => ({ type: 'furniture' as const, data: { ...fi } }))
      return true
    }
    if (selectedItemType === 'wall' && selectedItemId) {
      const wall = floor.walls.find((w) => w.id === selectedItemId)
      if (!wall) return false
      clipboard = [{ type: 'wall', data: { ...wall } }]
      return true
    }
    if (selectedItemType === 'opening' && selectedItemId) {
      const opening = floor.openings.find((o) => o.id === selectedItemId)
      if (!opening) return false
      clipboard = [{ type: 'opening', data: { ...opening } }]
      return true
    }
    return false
  },

  pasteItem: () => {
    if (clipboard.length === 0) return false
    const s = get()
    const floor = s.project.floors.find((f) => f.id === s.project.activeFloorId)
    if (!floor) return false

    get()._pushUndo()
    const PASTE_OFFSET = 0.3

    set((state) => {
      let newFloor = { ...floor }
      const newSelectedIds: string[] = []

      for (const item of clipboard) {
        if (item.type === 'wall') {
          const wall: Wall = {
            ...item.data,
            id: uuidv4(),
            start: { x: item.data.start.x + PASTE_OFFSET, y: item.data.start.y + PASTE_OFFSET },
            end: { x: item.data.end.x + PASTE_OFFSET, y: item.data.end.y + PASTE_OFFSET },
          }
          newFloor = { ...newFloor, walls: [...newFloor.walls, wall] }
          newSelectedIds.push(wall.id)
        } else if (item.type === 'furniture') {
          const furniture: FurnitureItem = {
            ...item.data,
            id: uuidv4(),
            x: item.data.x + PASTE_OFFSET,
            y: item.data.y + PASTE_OFFSET,
          }
          newFloor = { ...newFloor, furniture: [...newFloor.furniture, furniture] }
          newSelectedIds.push(furniture.id)
        } else if (item.type === 'opening') {
          const newPos = Math.max(0.05, Math.min(0.95, item.data.position + 0.1))
          const opening: WallOpening = {
            ...item.data,
            id: uuidv4(),
            position: newPos,
          }
          newFloor = { ...newFloor, openings: [...newFloor.openings, opening] }
          newSelectedIds.push(opening.id)
        }
      }

      return {
        project: {
          ...state.project,
          floors: state.project.floors.map((f) =>
            f.id === state.project.activeFloorId ? newFloor : f
          ),
        },
        editor: {
          ...state.editor,
          selectedItemId: newSelectedIds.length === 1 ? newSelectedIds[0] : null,
          selectedItemType: clipboard[0].type,
          selectedFurnitureIds: clipboard[0].type === 'furniture' ? newSelectedIds : [],
        },
      }
    })
    return true
  },

  // Editor
  editor: {
    activeTool: 'wall',
    selectedOpeningCatalog: null,
    selectedFurnitureCatalog: null,
    gridSize: 20,
    gridSizeMeters: 0.25,
    zoom: 1,
    panOffset: { x: 0, y: 0 },
    selectedItemId: null,
    selectedItemType: null,
    selectedFurnitureIds: [],
    isDrawingWall: false,
    wallStartPoint: null,
    cameraMode: 'orbit',
    firstPersonCamera: null,
    orbitTarget: null,
    viewRotationDeg: 0,
    timeOfDay: 14,
    showCeiling: false,
    exposure: 1.1,
    bloomIntensity: 0.15,
    renderResolution: 2,
    captureRequest: 0,
    captureMode: 'download',
    cameraFov: 55,
    orbitZoom: 8,
    focusDistance: 5,
    focusBlur: 0,
  },

  setTool: (tool) => set((state) => ({
    editor: {
      ...state.editor,
      activeTool: tool,
      selectedItemId: null,
      selectedItemType: null,
      selectedFurnitureIds: [],
      selectedFurnitureCatalog: tool === 'furniture' ? state.editor.selectedFurnitureCatalog : null,
    },
  })),
  setZoom: (zoom) => set((state) => ({ editor: { ...state.editor, zoom } })),
  setPan: (offset) => set((state) => ({ editor: { ...state.editor, panOffset: offset } })),
  setViewRotation: (deg) => set((state) => ({ editor: { ...state.editor, viewRotationDeg: ((deg % 360) + 360) % 360 } })),
  setSelected: (id, type) => set((state) => ({
    editor: {
      ...state.editor,
      selectedItemId: id,
      selectedItemType: type,
      selectedFurnitureIds: type === 'furniture' && id ? [id] : [],
    },
  })),
  setSelectedFurnitureMultiple: (ids) => set((state) => ({
    editor: {
      ...state.editor,
      selectedItemId: ids.length === 1 ? ids[0] : null,
      selectedItemType: ids.length > 0 ? 'furniture' : null,
      selectedFurnitureIds: ids,
    },
  })),
  setDrawingWall: (drawing, start) => set((state) => ({
    editor: { ...state.editor, isDrawingWall: drawing, wallStartPoint: start ?? null },
  })),
  setCameraMode: (mode) => set((state) => {
    if (mode !== 'firstPerson') {
      return { editor: { ...state.editor, cameraMode: mode, firstPersonCamera: state.editor.firstPersonCamera } }
    }
    // Al cambiar de Orbital a Caminar: spawn donde estabas mirando (orbit target)
    // Si orbitTarget está en (0,0) (valor por defecto) usar centro del plano
    const comingFromOrbit = state.editor.cameraMode === 'orbit'
    const orbitTarget = state.editor.orbitTarget
    const atOrigin = orbitTarget && Math.abs(orbitTarget.x) < 0.01 && Math.abs(orbitTarget.z) < 0.01
    if (comingFromOrbit && orbitTarget && !atOrigin) {
      return {
        editor: {
          ...state.editor,
          cameraMode: mode,
          firstPersonCamera: { x: orbitTarget.x, z: orbitTarget.z, yaw: -Math.PI / 4 },
        },
      }
    }
    const fp = state.editor.firstPersonCamera
    if (fp) {
      return { editor: { ...state.editor, cameraMode: mode, firstPersonCamera: fp } }
    }
    // Fallback: centro de muebles o del plano
    const floor = get().getActiveFloor()
    let cx = 4, cz = 4
    if (floor.furniture.length > 0) {
      cx = floor.furniture.reduce((s, f) => s + f.x, 0) / floor.furniture.length
      cz = floor.furniture.reduce((s, f) => s + f.y, 0) / floor.furniture.length
    } else if (floor.walls.length > 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
      for (const w of floor.walls) {
        minX = Math.min(minX, w.start.x, w.end.x)
        maxX = Math.max(maxX, w.start.x, w.end.x)
        minZ = Math.min(minZ, w.start.y, w.end.y)
        maxZ = Math.max(maxZ, w.start.y, w.end.y)
      }
      cx = (minX + maxX) / 2
      cz = (minZ + maxZ) / 2
    }
    return {
      editor: {
        ...state.editor,
        cameraMode: mode,
        firstPersonCamera: { x: cx, z: cz, yaw: -Math.PI / 4 },
      },
    }
  }),
  setOrbitTarget: (x, z) => set((state) => ({
    editor: { ...state.editor, orbitTarget: { x, z } },
  })),
  setFirstPersonCamera: (x, z, yaw) => set((state) => ({
    editor: { ...state.editor, firstPersonCamera: { x, z, yaw } },
  })),
  setTimeOfDay: (time) => set((state) => ({ editor: { ...state.editor, timeOfDay: time } })),
  setShowCeiling: (show) => set((state) => ({ editor: { ...state.editor, showCeiling: show } })),
  setExposure: (v) => set((state) => ({ editor: { ...state.editor, exposure: v } })),
  setBloomIntensity: (v) => set((state) => ({ editor: { ...state.editor, bloomIntensity: v } })),
  setRenderResolution: (v) => set((state) => ({ editor: { ...state.editor, renderResolution: v } })),
  requestCapture: () => set((state) => ({ editor: { ...state.editor, captureRequest: Date.now() } })),
  clearCaptureRequest: () => set((state) => ({ editor: { ...state.editor, captureRequest: 0, captureMode: 'download' } })),
  setCameraFov: (v) => set((state) => ({ editor: { ...state.editor, cameraFov: v } })),
  setOrbitZoom: (v) => set((state) => ({ editor: { ...state.editor, orbitZoom: v } })),
  setFocusDistance: (v) => set((state) => ({ editor: { ...state.editor, focusDistance: v } })),
  setFocusBlur: (v) => set((state) => ({ editor: { ...state.editor, focusBlur: v } })),
  setShowShadows: (v) => set((state) => ({ editor: { ...state.editor, showShadows: v } })),
  setShowFloorGrid: (v) => set((state) => ({ editor: { ...state.editor, showFloorGrid: v } })),
  setWireframeMode: (v) => set((state) => ({ editor: { ...state.editor, wireframeMode: v } })),
  setContrast: (v) => set((state) => ({ editor: { ...state.editor, contrast: v } })),
  setSaturation: (v) => set((state) => ({ editor: { ...state.editor, saturation: v } })),
  setCameraPresetRequest: (v) => set((state) => ({ editor: { ...state.editor, cameraPresetRequest: v } })),
  setTourMode: (v) => set((state) => ({ editor: { ...state.editor, tourMode: v } })),
  setShowRoomLabels: (v) => set((state) => ({ editor: { ...state.editor, showRoomLabels: v } })),
  setIsCapturing: (v) => set((state) => ({ editor: { ...state.editor, isCapturing: v } })),
  saveCameraPosition: () => set((state) => ({ editor: { ...state.editor, saveCameraRequest: Date.now() } })),
  restoreCameraPosition: (index) => set((state) => ({ editor: { ...state.editor, restoreCameraIndex: index } })),
  clearSaveCameraRequest: () => set((state) => ({ editor: { ...state.editor, saveCameraRequest: 0 } })),
  clearRestoreCameraIndex: () => set((state) => ({ editor: { ...state.editor, restoreCameraIndex: null } })),
  setSelectedOpeningCatalog: (item) => set((state) => ({ editor: { ...state.editor, selectedOpeningCatalog: item } })),
  setSelectedFurnitureCatalog: (item: FurnitureCatalogItem | null) => set((state) => ({
    editor: { ...state.editor, selectedFurnitureCatalog: item, activeTool: item ? 'furniture' : state.editor.activeTool },
  })),

  // Global style
  theme: 'dark',
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  globalWallColor: '#FFFFFF',
  globalFloorMaterial: 'wood',
  globalFloorColor: '#C4A882',
  setGlobalWallColor: (color) => { get()._pushUndo(); set({ globalWallColor: color }) },
  setGlobalFloorMaterial: (mat) => { get()._pushUndo(); set({ globalFloorMaterial: mat }) },
  setGlobalFloorColor: (color) => { get()._pushUndo(); set({ globalFloorColor: color }) },

  sceneMaterials: JSON.parse(JSON.stringify(DEFAULT_SCENE_MATERIALS)),
  setSceneMaterials: (mats) => {
    get()._pushUndo()
    set({ sceneMaterials: mats, globalWallColor: mats.walls.color, globalFloorColor: mats.floor.color, globalFloorMaterial: mats.floor.material })
  },
  updateMaterialSlot: (key, partial) => {
    get()._pushUndo()
    set((state) => {
      const updated = { ...state.sceneMaterials, [key]: { ...state.sceneMaterials[key], ...partial } }
      const extra: any = {}
      if (key === 'walls') { extra.globalWallColor = updated.walls.color }
      if (key === 'floor') { extra.globalFloorColor = updated.floor.color; extra.globalFloorMaterial = updated.floor.material }
      return { sceneMaterials: updated, ...extra }
    })
  },

  // Plano de fondo importado
  floorPlanBackground: null as FloorPlanBackground | null,
  setFloorPlanBackground: (bg) => set({ floorPlanBackground: bg, floorPlanCalibration: null }),
  floorPlanCalibration: null as FloorPlanCalibration | null,
  setFloorPlanCalibration: (c) => set({ floorPlanCalibration: c }),
  addCalibrationPoint: (p) => set((state) => {
    const cal = state.floorPlanCalibration
    if (!cal || cal.waitingForMeters) return state
    const pts = [...cal.points, p] as Point[]
    if (pts.length === 1) return { floorPlanCalibration: { ...cal, points: pts } }
    const [a, b] = pts as [Point, Point]
    const px = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
    return { floorPlanCalibration: { points: [], waitingForMeters: true, measuredPixels: px } }
  }),
  applyCalibration: (meters) => set((state) => {
    const cal = state.floorPlanCalibration
    if (!cal || !cal.waitingForMeters || meters <= 0) return state
    const ppm = cal.measuredPixels / meters
    const bg = state.floorPlanBackground
    if (!bg) return { floorPlanCalibration: null }
    return {
      floorPlanBackground: { ...bg, pixelsPerMeter: ppm },
      floorPlanCalibration: null,
    }
  }),

  // Análisis IA
  aiAnalysisResult: null as FloorPlanAIAnalysis | null,
  setAiAnalysisResult: (r) => set({ aiAnalysisResult: r, aiAnalysisError: null }),
  aiAnalysisError: null as string | null,
  setAiAnalysisError: (e) => set({ aiAnalysisError: e }),
  aiAnalysisModalOpen: false,
  setAiAnalysisModalOpen: (v) => set({ aiAnalysisModalOpen: v, aiAnalysisError: v ? null : null }),
  aiAnalysisApplying: false,
  setAiAnalysisApplying: (v) => set({ aiAnalysisApplying: v }),
  pendingToast: null as { message: string; type: 'success' | 'info' } | null,
  setPendingToast: (t) => set({ pendingToast: t }),
  manualTraceModalOpen: false,
  setManualTraceModalOpen: (v) => set({ manualTraceModalOpen: v }),
  applyManualTrace: (points, widthCm) => {
    if (points.length < 3 || widthCm <= 0) return
    const minX = Math.min(...points.map((p) => p.x))
    const maxX = Math.max(...points.map((p) => p.x))
    const minY = Math.min(...points.map((p) => p.y))
    const maxY = Math.max(...points.map((p) => p.y))
    const widthPx = maxX - minX || 1
    const widthM = widthCm / 100
    const pixelsPerMeter = widthPx / widthM
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const toMeters = (px: number, py: number) => ({
      x: (px - cx) / pixelsPerMeter,
      y: (py - cy) / pixelsPerMeter,
    })
    get()._pushUndo()
    for (let i = 0; i < points.length; i++) {
      const start = points[i]
      const end = points[(i + 1) % points.length]
      get().addWall(toMeters(start.x, start.y), toMeters(end.x, end.y))
    }
    get().setPendingToast({ message: `${points.length} paredes creadas`, type: 'success' })
  },
  applyAiAnalysisWithReference: (widthCm, depthCm, refOverride) => {
    const s = get()
    set({ aiAnalysisApplying: true })
    setTimeout(() => {
      try {
        const analysis = get().aiAnalysisResult
        const baseRef = analysis?.referenceSuggestion
        const ref = refOverride ?? baseRef
        if (!ref) {
          set({ aiAnalysisApplying: false })
          return
        }
        const walls = analysis?.walls || []
        const furniture = analysis?.furniture || []
        const openings = analysis?.openings || []
        const rooms = analysis?.rooms || []
        if (!analysis) {
          set({ aiAnalysisApplying: false })
          return
        }
        const isTotalWidth = ref.type === 'plano'
        const isPared = ref.type === 'pared'
        const widthM = widthCm / 100
        const depthM = (depthCm || widthCm) / 100
        const refSizePx = isPared
          ? (ref.lengthPx ?? ref.widthPx ?? 0)
          : isTotalWidth
            ? ref.widthPx
            : Math.max(ref.widthPx || 0, ref.heightPx || 0)
        const refSizeM = isTotalWidth || isPared ? widthM : Math.max(widthM, depthM)
        if (!refSizePx || !refSizeM) {
          set({ aiAnalysisApplying: false })
          return
        }
        const pixelsPerMeter = refSizePx / refSizeM
        const cx = analysis.imageWidth / 2
        const cy = analysis.imageHeight / 2
        const toMeters = (px: number, py: number) => ({
          x: (px - cx) / pixelsPerMeter,
          y: (py - cy) / pixelsPerMeter,
        })
        const wallIds: string[] = []
        walls.forEach((w) => {
          get().addWall(toMeters(w.start.x, w.start.y), toMeters(w.end.x, w.end.y))
          const floor = get().getActiveFloor()
          const lastWall = floor.walls[floor.walls.length - 1]
          if (lastWall) wallIds.push(lastWall.id)
        })
        openings.forEach((op) => {
          const wallId = wallIds[op.wallIndex]
          if (!wallId) return
          const opWidthM = Math.max(0.5, Math.min(3, op.widthPx / pixelsPerMeter))
          const heightM = Math.max(0.5, Math.min(2.5, op.heightPx / pixelsPerMeter))
          const baseCatalog = OPENING_CATALOG.find((c) => c.type === op.type)
          const catalog = baseCatalog ? {
            ...baseCatalog,
            defaultWidth: opWidthM,
            defaultHeight: heightM,
          } : undefined
          get().addOpening(wallId, op.type, Math.max(0.05, Math.min(0.95, op.position)), catalog)
        })
        const FURNITURE_TYPE_MAP: Record<string, string> = {
          sofa: 'sofa_3', sofa_3: 'sofa_3', sofa_2: 'sofa_2', sofa_L: 'sofa_L',
          armchair: 'armchair', recliner: 'recliner', pouf: 'pouf',
          bed: 'bed_double', bed_double: 'bed_double', bed_single: 'bed_single', bed_king: 'bed_king', bunk_bed: 'bunk_bed', crib: 'crib',
          dining_table: 'dining_table', dining_table_6: 'dining_table_6', dining_table_round: 'dining_table_round',
          coffee_table: 'coffee_table', coffee_table_round: 'coffee_table_round', side_table: 'side_table',
          bathtub: 'bathtub', shower: 'shower', shower_rect: 'shower_rect', toilet: 'toilet', sink: 'sink', sink_double: 'sink_double',
          fridge: 'fridge', fridge_double: 'fridge_double', stove: 'stove', dishwasher: 'dishwasher',
          wardrobe: 'wardrobe', wardrobe_large: 'wardrobe', desk: 'desk', desk_L: 'desk_L',
          tv_stand: 'tv_stand', bookshelf: 'bookshelf', nightstand: 'nightstand', dresser: 'dresser',
          washing_machine: 'washing_machine', dryer: 'dryer', plant: 'plant', rug: 'rug',
        }
        furniture.forEach((f) => {
          const type = FURNITURE_TYPE_MAP[f.type] || 'coffee_table'
          const wM = f.widthPx / pixelsPerMeter
          const dM = f.heightPx / pixelsPerMeter
          const pos = toMeters(f.x, f.y)
          const catItem = FURNITURE_CATALOG.find((c) => c.type === type)
          get().addFurniture({
        type,
        category: catItem?.category || 'general',
        label: catItem?.label || f.label,
        x: pos.x,
        y: pos.y,
        rotation: f.rotation || 0,
        width: Math.max(0.3, wM),
        depth: Math.max(0.3, dM),
        height: catItem?.height || 0.8,
        color: catItem?.defaultColor || '#888888',
            material: catItem?.defaultMaterial || 'wood',
          })
        })
            if (rooms.length > 0) {
          const floor = get().getActiveFloor()
          const newRooms: Room[] = rooms.map((r) => ({
            id: uuidv4(),
            name: r.name,
            type: r.type,
            wallIds: (r.wallIndices || [])
              .map((i) => wallIds[i])
              .filter(Boolean),
            floorMaterial: 'wood',
            floorColor: '#D2B48C',
            ceilingColor: '#F5F5F5',
          }))
          set((state) => ({
            project: {
              ...state.project,
              floors: state.project.floors.map((f) =>
                f.id === state.project.activeFloorId
                  ? { ...f, rooms: [...f.rooms, ...newRooms] }
                  : f
              ),
            },
          }))
        }
        const wallsCount = walls.length
        const furnitureCount = furniture.length
        const openingsCount = openings.length
        const roomsCount = rooms.length
        const parts: string[] = []
        if (wallsCount) parts.push(`${wallsCount} paredes`)
        if (furnitureCount) parts.push(`${furnitureCount} muebles`)
        if (openingsCount) parts.push(`${openingsCount} puertas/ventanas`)
        if (roomsCount) parts.push(`${roomsCount} habitaciones`)
        get().setPendingToast({ message: `Plano importado: ${parts.join(', ')}`, type: 'success' })

        const bg = get().floorPlanBackground
        const updates: Record<string, unknown> = {
          aiAnalysisResult: null,
          aiAnalysisModalOpen: false,
          aiAnalysisApplying: false,
        }
        if (bg) {
          updates.floorPlanBackground = { ...bg, pixelsPerMeter }
        }
        set(updates)
      } catch (e) {
        set({ aiAnalysisApplying: false })
      }
    }, 50)
  },

  // Generación de renders con IA
  lastCapturedImage: null as string | null,
  setLastCapturedImage: (url) => set({ lastCapturedImage: url }),
  lastCapturedViewType: 'perspective' as 'topDown' | 'perspective',
  setLastCapturedViewType: (v) => set({ lastCapturedViewType: v }),
  lastCapturedCameraMode: 'orbit' as 'orbit' | 'firstPerson',
  setLastCapturedCameraMode: (v) => set({ lastCapturedCameraMode: v }),
  renderGenerationModalOpen: false,
  setRenderGenerationModalOpen: (v) => set({ renderGenerationModalOpen: v }),
  requestRenderGeneration: () => set((state) => ({
    editor: { ...state.editor, captureRequest: Date.now(), captureMode: 'render' },
  })),

  // Validación de planos
  validationIssues: [] as ValidationIssue[],
  runValidation: () => set((state) => ({
    validationIssues: validateFloor(get().getActiveFloor()),
  })),

  // Camera path actions
  addCameraWaypoint: (wp) => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, waypoints: [...state.editor.cameraPath.waypoints, wp] } },
  })),
  removeCameraWaypoint: (id) => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, waypoints: state.editor.cameraPath.waypoints.filter((w) => w.id !== id) } },
  })),
  reorderWaypoints: (fromIndex, toIndex) => set((state) => {
    const wps = [...state.editor.cameraPath.waypoints]
    const [item] = wps.splice(fromIndex, 1)
    wps.splice(toIndex, 0, item)
    return { editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, waypoints: wps } } }
  }),
  importSavedCamerasAsWaypoints: () => set((state) => {
    const newWps: CameraPathWaypoint[] = state.savedCameraPositions.map((c) => ({
      id: uuidv4(), position: c.position, target: c.target,
    }))
    return { editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, waypoints: [...state.editor.cameraPath.waypoints, ...newWps] } } }
  }),
  clearAllWaypoints: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, waypoints: [] } },
  })),
  setPathDuration: (v) => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, pathDuration: v } },
  })),
  setPathFps: (v) => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, pathFps: v } },
  })),
  setShowPathLine: (v) => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, showPathLine: v } },
  })),
  toggleClickToAddWaypoint: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, clickToAddWaypoint: !state.editor.cameraPath.clickToAddWaypoint } },
  })),
  requestAddWaypoint: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, addWaypointRequest: Date.now() } },
  })),
  startPathPreview: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, isPreviewing: true } },
  })),
  stopPathPreview: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, isPreviewing: false } },
  })),
  startWebGLRecording: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, isRecordingWebGL: true, recordingProgress: 0 } },
  })),
  stopWebGLRecording: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, isRecordingWebGL: false, recordingProgress: 0 } },
  })),
  setRecordingProgress: (v) => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, recordingProgress: v } },
  })),
  startSoraGeneration: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, isGeneratingSora: true, soraProgress: 0 } },
  })),
  stopSoraGeneration: () => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, isGeneratingSora: false, soraProgress: 0 } },
  })),
  setSoraProgress: (v) => set((state) => ({
    editor: { ...state.editor, cameraPath: { ...state.editor.cameraPath, soraProgress: v } },
  })),

  // Video Sora modal
  soraVideoModalOpen: false,
  setSoraVideoModalOpen: (v) => set({ soraVideoModalOpen: v }),
  soraKeyframes: [] as string[],
  setSoraKeyframes: (frames) => set({ soraKeyframes: frames }),

  // Vista 3D: cámaras guardadas
  savedCameraPositions: [] as Array<{ position: [number, number, number]; target: [number, number, number]; zoom: number }>,
}))
