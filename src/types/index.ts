export interface Point {
  x: number
  y: number
}

export interface Wall {
  id: string
  start: Point
  end: Point
  thickness: number // in meters
  height: number // in meters
  material: string
  color: string
}

export type DoorSubtype = 'single' | 'double' | 'sliding' | 'pocket' | 'pocket_pladur' | 'french' | 'entry' | 'bifold' | 'glass' | 'arch'
export type WindowSubtype = 'fixed' | 'single_hung' | 'double_hung' | 'sliding' | 'casement' | 'bay'

export type DoorOpenDirection = 'left' | 'right'

export interface WallOpening {
  id: string
  wallId: string
  type: 'door' | 'window'
  subtype: DoorSubtype | WindowSubtype
  position: number // 0-1 along wall
  width: number
  height: number
  elevation: number // from floor
  color: string
  openDirection?: DoorOpenDirection // puertas: 'left' = bisagras izq, 'right' = bisagras der
  flip?: boolean // invierte apertura (hacia dentro/fuera)
}

export interface OpeningCatalogItem {
  type: 'door' | 'window'
  subtype: DoorSubtype | WindowSubtype
  label: string
  icon: string
  defaultWidth: number
  defaultHeight: number
  defaultElevation: number
  defaultColor: string
}

export const OPENING_CATALOG: OpeningCatalogItem[] = [
  // Puertas
  { type: 'door', subtype: 'single', label: 'Puerta simple', icon: '🚪', defaultWidth: 0.82, defaultHeight: 2.03, defaultElevation: 0, defaultColor: '#8B6914' },
  { type: 'door', subtype: 'entry', label: 'Puerta de entrada', icon: '🏠', defaultWidth: 0.92, defaultHeight: 2.10, defaultElevation: 0, defaultColor: '#5C3A1E' },
  { type: 'door', subtype: 'double', label: 'Puerta doble', icon: '🚪🚪', defaultWidth: 1.52, defaultHeight: 2.03, defaultElevation: 0, defaultColor: '#8B6914' },
  { type: 'door', subtype: 'sliding', label: 'Corredera', icon: '↔️', defaultWidth: 1.6, defaultHeight: 2.10, defaultElevation: 0, defaultColor: '#A0A0A0' },
  { type: 'door', subtype: 'pocket', label: 'Empotrada', icon: '🔲', defaultWidth: 0.82, defaultHeight: 2.03, defaultElevation: 0, defaultColor: '#D2B48C' },
  { type: 'door', subtype: 'pocket_pladur', label: 'Empotrada pladur', icon: '📐', defaultWidth: 0.85, defaultHeight: 2.10, defaultElevation: 0, defaultColor: '#E8E0D0' },
  { type: 'door', subtype: 'french', label: 'Francesa (cristal)', icon: '🪟', defaultWidth: 1.4, defaultHeight: 2.10, defaultElevation: 0, defaultColor: '#F5F5F5' },
  { type: 'door', subtype: 'glass', label: 'Puerta de cristal', icon: '🪟', defaultWidth: 0.90, defaultHeight: 2.10, defaultElevation: 0, defaultColor: '#E8F4F8' },
  { type: 'door', subtype: 'bifold', label: 'Plegable / Abordable', icon: '📂', defaultWidth: 1.2, defaultHeight: 2.03, defaultElevation: 0, defaultColor: '#D2B48C' },
  { type: 'door', subtype: 'arch', label: 'Arco (Paso libre)', icon: '🌈', defaultWidth: 1.2, defaultHeight: 2.20, defaultElevation: 0, defaultColor: '#FFFFFF' },
  // Ventanas
  { type: 'window', subtype: 'fixed', label: 'Fija', icon: '▪️', defaultWidth: 1.2, defaultHeight: 1.2, defaultElevation: 0.9, defaultColor: '#F5F5F5' },
  { type: 'window', subtype: 'single_hung', label: 'Guillotina simple', icon: '⬆️', defaultWidth: 0.9, defaultHeight: 1.2, defaultElevation: 0.9, defaultColor: '#F5F5F5' },
  { type: 'window', subtype: 'double_hung', label: 'Guillotina doble', icon: '↕️', defaultWidth: 0.9, defaultHeight: 1.4, defaultElevation: 0.8, defaultColor: '#F5F5F5' },
  { type: 'window', subtype: 'sliding', label: 'Corredera', icon: '↔️', defaultWidth: 1.8, defaultHeight: 1.2, defaultElevation: 0.9, defaultColor: '#F5F5F5' },
  { type: 'window', subtype: 'casement', label: 'Abatible', icon: '🔳', defaultWidth: 0.7, defaultHeight: 1.2, defaultElevation: 0.9, defaultColor: '#F5F5F5' },
  { type: 'window', subtype: 'bay', label: 'Ventanal / Bay', icon: '🏠', defaultWidth: 2.4, defaultHeight: 1.6, defaultElevation: 0.6, defaultColor: '#F5F5F5' },
]

export interface FurnitureItem {
  id: string
  type: string
  category: string
  label: string
  x: number
  y: number
  rotation: number // degrees
  width: number
  depth: number
  height: number
  elevation?: number // altura sobre el suelo (0 = suelo, 0.9 = encimera)
  color: string
  material: string
  /** Solo escritorio L: true = L a la izquierda, false/undefined = L a la derecha */
  flipL?: boolean
}

export interface Room {
  id: string
  name: string
  type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'hallway' | 'other'
  wallIds: string[]
  floorMaterial: string
  floorColor: string
  ceilingColor: string
}

export interface Floor {
  id: string
  name: string
  level: number
  walls: Wall[]
  openings: WallOpening[]
  furniture: FurnitureItem[]
  rooms: Room[]
  height: number // floor to ceiling
}

export interface Project {
  id: string
  name: string
  floors: Floor[]
  activeFloorId: string
}

export type EditorTool = 'select' | 'wall' | 'door' | 'window' | 'furniture' | 'room' | 'erase'

export type CameraMode = 'orbit' | 'firstPerson'

export interface EditorState {
  activeTool: EditorTool
  selectedOpeningCatalog: OpeningCatalogItem | null
  selectedFurnitureCatalog: FurnitureCatalogItem | null
  gridSize: number // snap grid in pixels
  gridSizeMeters: number
  zoom: number
  panOffset: Point
  selectedItemId: string | null
  selectedItemType: 'wall' | 'furniture' | 'opening' | null
  selectedFurnitureIds: string[] // multi-selección de muebles (marquee)
  isDrawingWall: boolean
  wallStartPoint: Point | null
  cameraMode: CameraMode
  timeOfDay: number // 0-24
  showCeiling: boolean
  exposure: number
  bloomIntensity: number
  renderResolution: 1 | 2 | 4
  captureRequest: number
  /** 'download' = descargar PNG; 'render' = capturar para modal de generación IA */
  captureMode: 'download' | 'render'
  cameraFov: number // ángulo / objetivo (35–90°)
  orbitZoom: number // zoom / distancia en orbital (2–20)
  focusDistance: number // enfoque: distancia al plano nítido (m)
  focusBlur: number // desenfoque / bokeh (0=ninguno, 2=intenso)
  firstPersonCamera: { x: number; z: number; yaw: number } | null // posición en modo Caminar (para 2D)
  orbitTarget: { x: number; z: number } | null // punto al que mira la cámara orbital (para spawn en Caminar)
  viewRotationDeg: number // rotación de la vista 2D top (0, 90, 180, 270)
  // Vista 3D adicional
  showShadows: boolean
  showFloorGrid: boolean
  wireframeMode: boolean
  contrast: number
  saturation: number
  cameraPresetRequest: 'front' | 'side' | 'top' | 'isometric' | null
  tourMode: boolean
  showRoomLabels: boolean
  isCapturing: boolean
  saveCameraRequest: number
  restoreCameraIndex: number | null
}

/** Plano de fondo importado (imagen, PDF, DXF) para calcar en el editor 2D */
export interface FloorPlanBackground {
  dataUrl: string
  /** Píxeles por metro en la imagen (calibración). Si no se define, se usa SCALE por defecto */
  pixelsPerMeter?: number
  /** Offset en píxeles del canvas para alinear el plano */
  offsetX?: number
  offsetY?: number
}

/** Modo de calibración: recoger 2 puntos para medir distancia de referencia */
export interface FloorPlanCalibration {
  points: Point[]
  waitingForMeters: boolean
  measuredPixels: number
}

/** Resultado del análisis IA de un plano (GPT-4 Vision) */
export interface FloorPlanAIAnalysis {
  imageWidth: number
  imageHeight: number
  walls: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>
  furniture: Array<{
    type: string
    label: string
    room: string
    x: number
    y: number
    widthPx: number
    heightPx: number
    rotation: number
  }>
  /** Puertas y ventanas: wallIndex = índice en walls[], position = 0-1 a lo largo de la pared */
  openings: Array<{
    type: 'door' | 'window'
    subtype?: string
    wallIndex: number
    position: number
    widthPx: number
    heightPx: number
  }>
  /** Habitaciones: wallIndices = índices de paredes que forman el perímetro */
  rooms: Array<{
    name: string
    type: 'living' | 'bedroom' | 'kitchen' | 'bathroom' | 'hallway' | 'other'
    wallIndices: number[]
  }>
  /** Elemento sugerido para pedir medida de referencia */
  referenceSuggestion: {
    type: string
    label: string
    room: string
    widthPx: number
    heightPx: number
  }
}


export interface FurnitureCatalogItem {
  type: string
  category: string
  label: string
  icon: string
  width: number
  depth: number
  height: number
  defaultElevation?: number // altura por defecto (0.9 = encimera)
  defaultColor: string
  defaultMaterial: string
}

export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
  // ─── Salón ───
  { type: 'sofa_3', category: 'living', label: 'Sofá 3 plazas', icon: '🛋️', width: 2.2, depth: 0.9, height: 0.85, defaultColor: '#8B7355', defaultMaterial: 'fabric' },
  { type: 'sofa_2', category: 'living', label: 'Sofá 2 plazas', icon: '🛋️', width: 1.6, depth: 0.9, height: 0.85, defaultColor: '#8B7355', defaultMaterial: 'fabric' },
  { type: 'sofa_L', category: 'living', label: 'Sofá esquinero L', icon: '🛋️', width: 2.6, depth: 1.8, height: 0.85, defaultColor: '#7A6B5A', defaultMaterial: 'fabric' },
  { type: 'armchair', category: 'living', label: 'Sillón', icon: '🪑', width: 0.85, depth: 0.85, height: 0.9, defaultColor: '#696969', defaultMaterial: 'fabric' },
  { type: 'recliner', category: 'living', label: 'Reclinable', icon: '🪑', width: 0.9, depth: 0.95, height: 1.0, defaultColor: '#5C4033', defaultMaterial: 'fabric' },
  { type: 'pouf', category: 'living', label: 'Puf', icon: '⚫', width: 0.55, depth: 0.55, height: 0.40, defaultColor: '#A0856C', defaultMaterial: 'fabric' },
  { type: 'coffee_table', category: 'living', label: 'Mesa centro', icon: '🔲', width: 1.1, depth: 0.6, height: 0.45, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'coffee_table_round', category: 'living', label: 'Mesa centro redonda', icon: '⭕', width: 0.8, depth: 0.8, height: 0.42, defaultColor: '#F5F5F5', defaultMaterial: 'marble' },
  { type: 'side_table', category: 'living', label: 'Mesa auxiliar', icon: '🔲', width: 0.45, depth: 0.45, height: 0.55, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'tv_stand', category: 'living', label: 'Mueble TV', icon: '📺', width: 1.8, depth: 0.45, height: 0.55, defaultColor: '#3A3028', defaultMaterial: 'wood' },
  { type: 'tv_stand_55', category: 'living', label: 'Mueble TV con TV 55"', icon: '📺', width: 1.8, depth: 0.45, height: 1.3, defaultColor: '#3A3028', defaultMaterial: 'wood' },
  { type: 'tv_stand_75', category: 'living', label: 'Mueble TV con TV 75"', icon: '📺', width: 1.8, depth: 0.45, height: 1.55, defaultColor: '#3A3028', defaultMaterial: 'wood' },
  { type: 'bookshelf', category: 'living', label: 'Estantería', icon: '📚', width: 0.8, depth: 0.35, height: 2.0, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'bookshelf_wide', category: 'living', label: 'Librería ancha', icon: '📚', width: 1.6, depth: 0.35, height: 2.0, defaultColor: '#4A3728', defaultMaterial: 'wood' },
  { type: 'console_table', category: 'living', label: 'Consola', icon: '🔲', width: 1.2, depth: 0.35, height: 0.80, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'piano_grand', category: 'living', label: 'Piano de cola', icon: '🎹', width: 1.5, depth: 1.8, height: 1.0, defaultColor: '#1a1a1a', defaultMaterial: 'wood' },
  { type: 'piano_upright', category: 'living', label: 'Piano de pared', icon: '🎹', width: 1.5, depth: 0.6, height: 1.3, defaultColor: '#3a2a1a', defaultMaterial: 'wood' },
  { type: 'floor_lamp', category: 'living', label: 'Lámpara de pie', icon: '💡', width: 0.4, depth: 0.4, height: 1.7, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'side_table_lamp', category: 'living', label: 'Mesita con lámpara', icon: '💡', width: 0.45, depth: 0.45, height: 1.05, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'rug', category: 'living', label: 'Alfombra rect.', icon: '🟫', width: 2.0, depth: 1.4, height: 0.02, defaultColor: '#B8860B', defaultMaterial: 'fabric' },
  { type: 'rug_round', category: 'living', label: 'Alfombra redonda', icon: '🟤', width: 1.8, depth: 1.8, height: 0.02, defaultColor: '#A0856C', defaultMaterial: 'fabric' },
  { type: 'fireplace', category: 'living', label: 'Chimenea clásica', icon: '🔥', width: 1.2, depth: 0.45, height: 1.1, defaultColor: '#8B8B8B', defaultMaterial: 'concrete' },
  { type: 'fireplace_modern', category: 'living', label: 'Chimenea moderna', icon: '🔥', width: 1.4, depth: 0.35, height: 0.9, defaultColor: '#2a2a2a', defaultMaterial: 'metal' },
  { type: 'fireplace_bioethanol', category: 'living', label: 'Chimenea bioetanol', icon: '🔥', width: 1.0, depth: 0.25, height: 0.7, defaultColor: '#1a1a1a', defaultMaterial: 'metal' },
  { type: 'fireplace_insert', category: 'living', label: 'Chimenea empotrada', icon: '🔥', width: 1.0, depth: 0.5, height: 0.85, defaultColor: '#3a3a3a', defaultMaterial: 'metal' },
  { type: 'pellet_stove', category: 'living', label: 'Estufa de pellet', icon: '🔥', width: 0.5, depth: 0.45, height: 0.75, defaultColor: '#4a4a4a', defaultMaterial: 'metal' },
  { type: 'sofa_bed', category: 'living', label: 'Sofá cama', icon: '🛋️', width: 2.0, depth: 0.95, height: 0.88, defaultColor: '#7A6B5A', defaultMaterial: 'fabric' },
  { type: 'chaise_longue', category: 'living', label: 'Chaise longue', icon: '🛋️', width: 1.8, depth: 0.85, height: 0.75, defaultColor: '#8B7355', defaultMaterial: 'fabric' },
  { type: 'bookshelf_modular', category: 'living', label: 'Estantería modular', icon: '📚', width: 1.0, depth: 0.35, height: 1.8, defaultColor: '#D2B48C', defaultMaterial: 'wood' },

  // ─── Cocina ───
  { type: 'kitchen_counter', category: 'kitchen', label: 'Encimera base', icon: '🍳', width: 2.4, depth: 0.6, height: 0.9, defaultColor: '#F5F5F5', defaultMaterial: 'marble' },
  { type: 'kitchen_counter_short', category: 'kitchen', label: 'Encimera 1.2m', icon: '🍳', width: 1.2, depth: 0.6, height: 0.9, defaultColor: '#F5F5F5', defaultMaterial: 'marble' },
  { type: 'kitchen_island', category: 'kitchen', label: 'Isla cocina', icon: '🍳', width: 1.8, depth: 0.9, height: 0.9, defaultColor: '#F5F5F5', defaultMaterial: 'marble' },
  { type: 'kitchen_counter_microwave', category: 'kitchen', label: 'Encimera con microondas', icon: '📦', width: 1.2, depth: 0.6, height: 1.2, defaultColor: '#F5F5F5', defaultMaterial: 'marble' },
  { type: 'kitchen_counter_upper', category: 'kitchen', label: 'Encimera con mueble alto', icon: '🗄️', width: 1.2, depth: 0.6, height: 1.65, defaultColor: '#E8E0D0', defaultMaterial: 'wood' },
  { type: 'fridge', category: 'kitchen', label: 'Nevera', icon: '🧊', width: 0.7, depth: 0.7, height: 1.8, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'fridge_double', category: 'kitchen', label: 'Nevera americana', icon: '🧊', width: 0.9, depth: 0.7, height: 1.8, defaultColor: '#888888', defaultMaterial: 'metal' },
  { type: 'stove', category: 'kitchen', label: 'Placa/Horno', icon: '🔥', width: 0.6, depth: 0.6, height: 0.9, defaultColor: '#2F2F2F', defaultMaterial: 'metal' },
  { type: 'induction_cooktop', category: 'kitchen', label: 'Placa inducción', icon: '⚡', width: 0.6, depth: 0.52, height: 0.05, defaultColor: '#1a1a1a', defaultMaterial: 'metal' },
  { type: 'induction_cooktop_90', category: 'kitchen', label: 'Placa inducción 90cm', icon: '⚡', width: 0.9, depth: 0.52, height: 0.05, defaultColor: '#1a1a1a', defaultMaterial: 'metal' },
  { type: 'gas_cooktop', category: 'kitchen', label: 'Placa gas / fuegos', icon: '🔥', width: 0.6, depth: 0.55, height: 0.08, defaultColor: '#2F2F2F', defaultMaterial: 'metal' },
  { type: 'gas_cooktop_90', category: 'kitchen', label: 'Placa gas 90cm', icon: '🔥', width: 0.9, depth: 0.55, height: 0.08, defaultColor: '#2F2F2F', defaultMaterial: 'metal' },
  { type: 'oven_builtin', category: 'kitchen', label: 'Horno empotrado', icon: '🔥', width: 0.6, depth: 0.6, height: 0.6, defaultColor: '#2F2F2F', defaultMaterial: 'metal' },
  { type: 'range_hood', category: 'kitchen', label: 'Campana extractora', icon: '💨', width: 0.6, depth: 0.5, height: 0.35, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'range_hood_90', category: 'kitchen', label: 'Campana 90cm', icon: '💨', width: 0.9, depth: 0.5, height: 0.35, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'dishwasher', category: 'kitchen', label: 'Lavavajillas', icon: '🫧', width: 0.6, depth: 0.6, height: 0.85, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'dining_table', category: 'kitchen', label: 'Mesa comedor 4p', icon: '🍽️', width: 1.4, depth: 0.9, height: 0.75, defaultColor: '#C4A574', defaultMaterial: 'furnitureWood' },
  { type: 'dining_table_6', category: 'kitchen', label: 'Mesa comedor 6p', icon: '🍽️', width: 1.8, depth: 1.0, height: 0.75, defaultColor: '#C4A574', defaultMaterial: 'furnitureWood' },
  { type: 'dining_table_round', category: 'kitchen', label: 'Mesa redonda', icon: '⭕', width: 1.1, depth: 1.1, height: 0.75, defaultColor: '#F5F5F5', defaultMaterial: 'marble' },
  { type: 'dining_chair', category: 'kitchen', label: 'Silla comedor', icon: '🪑', width: 0.45, depth: 0.5, height: 0.9, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'bar_stool', category: 'kitchen', label: 'Taburete alto', icon: '🪑', width: 0.40, depth: 0.40, height: 0.75, defaultColor: '#333333', defaultMaterial: 'metal' },
  { type: 'breakfast_bar', category: 'kitchen', label: 'Barra desayunadora', icon: '🍽️', width: 1.5, depth: 0.5, height: 1.1, defaultColor: '#F5F5F5', defaultMaterial: 'marble' },
  { type: 'kitchen_trolley', category: 'kitchen', label: 'Carro auxiliar', icon: '🛒', width: 0.5, depth: 0.4, height: 0.85, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'storage_unit', category: 'kitchen', label: 'Trastero / Alacena', icon: '🗄️', width: 1.0, depth: 0.5, height: 2.0, defaultColor: '#E8E0D0', defaultMaterial: 'wood' },

  // ─── Dormitorio ───
  { type: 'bed_double', category: 'bedroom', label: 'Cama 150cm', icon: '🛏️', width: 1.6, depth: 2.1, height: 0.55, defaultColor: '#F5F5DC', defaultMaterial: 'fabric' },
  { type: 'bed_king', category: 'bedroom', label: 'Cama 180cm', icon: '🛏️', width: 1.9, depth: 2.1, height: 0.55, defaultColor: '#E8DCC8', defaultMaterial: 'fabric' },
  { type: 'bed_canopy', category: 'bedroom', label: 'Cama con dosel', icon: '🛏️', width: 1.9, depth: 2.1, height: 2.2, defaultColor: '#F5F5DC', defaultMaterial: 'wood' },
  { type: 'bed_single', category: 'bedroom', label: 'Cama 90cm', icon: '🛏️', width: 0.9, depth: 2.0, height: 0.55, defaultColor: '#F5F5DC', defaultMaterial: 'fabric' },
  { type: 'bunk_bed', category: 'bedroom', label: 'Litera', icon: '🛏️', width: 1.0, depth: 2.0, height: 1.7, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'crib', category: 'bedroom', label: 'Cuna', icon: '🛏️', width: 0.7, depth: 1.3, height: 0.9, defaultColor: '#F5F5F5', defaultMaterial: 'wood' },
  { type: 'nightstand', category: 'bedroom', label: 'Mesita noche', icon: '🔲', width: 0.5, depth: 0.4, height: 0.55, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'wardrobe', category: 'bedroom', label: 'Armario 180cm', icon: '🚪', width: 1.8, depth: 0.6, height: 2.2, defaultColor: '#F5F5DC', defaultMaterial: 'wood' },
  { type: 'wardrobe_large', category: 'bedroom', label: 'Armario 240cm', icon: '🚪', width: 2.4, depth: 0.6, height: 2.4, defaultColor: '#E8DCC8', defaultMaterial: 'wood' },
  { type: 'wardrobe_sliding', category: 'bedroom', label: 'Armario corredero', icon: '🚪', width: 2.0, depth: 0.65, height: 2.4, defaultColor: '#D0C8B8', defaultMaterial: 'wood' },
  { type: 'dresser', category: 'bedroom', label: 'Cómoda', icon: '🗄️', width: 1.2, depth: 0.5, height: 0.85, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'vanity', category: 'bedroom', label: 'Tocador', icon: '🪞', width: 1.0, depth: 0.45, height: 0.78, defaultColor: '#F5F0E8', defaultMaterial: 'wood' },
  { type: 'desk', category: 'bedroom', label: 'Escritorio', icon: '🖥️', width: 1.4, depth: 0.7, height: 0.75, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'desk_L', category: 'bedroom', label: 'Escritorio en L', icon: '🖥️', width: 1.6, depth: 1.4, height: 0.75, defaultColor: '#888888', defaultMaterial: 'metal' },
  { type: 'desk_chair', category: 'bedroom', label: 'Silla escritorio', icon: '🪑', width: 0.6, depth: 0.6, height: 1.1, defaultColor: '#2F2F2F', defaultMaterial: 'fabric' },
  { type: 'gaming_desk', category: 'bedroom', label: 'Setup Gaming RGB', icon: '🖥️', width: 1.6, depth: 0.8, height: 1.4, defaultColor: '#111111', defaultMaterial: 'metal' },
  { type: 'mirror_standing', category: 'bedroom', label: 'Espejo de pie', icon: '🪞', width: 0.5, depth: 0.05, height: 1.7, defaultColor: '#C0C0C0', defaultMaterial: 'glass' },
  { type: 'murphy_bed', category: 'bedroom', label: 'Cama nido', icon: '🛏️', width: 1.0, depth: 0.2, height: 2.0, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'wardrobe_small', category: 'bedroom', label: 'Armario pequeño', icon: '🚪', width: 1.0, depth: 0.5, height: 2.0, defaultColor: '#F5F5DC', defaultMaterial: 'wood' },
  { type: 'coat_rack_floor', category: 'bedroom', label: 'Perchero de pie', icon: '🧥', width: 0.4, depth: 0.4, height: 1.6, defaultColor: '#3A3028', defaultMaterial: 'wood' },

  // ─── Baño ───
  { type: 'toilet', category: 'bathroom', label: 'Inodoro', icon: '🚽', width: 0.4, depth: 0.65, height: 0.45, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'toilet_wall', category: 'bathroom', label: 'Inodoro suspendido', icon: '🚽', width: 0.38, depth: 0.55, height: 0.40, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'bidet', category: 'bathroom', label: 'Bidé', icon: '🚿', width: 0.38, depth: 0.58, height: 0.40, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'sink', category: 'bathroom', label: 'Lavabo con mueble', icon: '🚰', width: 0.6, depth: 0.5, height: 0.85, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'sink_double', category: 'bathroom', label: 'Lavabo doble', icon: '🚰', width: 1.2, depth: 0.5, height: 0.85, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'sink_pedestal', category: 'bathroom', label: 'Lavabo pedestal', icon: '🚰', width: 0.55, depth: 0.45, height: 0.82, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'bathtub', category: 'bathroom', label: 'Bañera', icon: '🛁', width: 0.75, depth: 1.7, height: 0.58, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'bathtub_freestanding', category: 'bathroom', label: 'Bañera exenta', icon: '🛁', width: 0.80, depth: 1.7, height: 0.60, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },
  { type: 'shower', category: 'bathroom', label: 'Ducha cuadrada', icon: '🚿', width: 0.9, depth: 0.9, height: 2.1, defaultColor: '#E0E0E0', defaultMaterial: 'glass' },
  { type: 'shower_rect', category: 'bathroom', label: 'Ducha rectangular', icon: '🚿', width: 1.2, depth: 0.8, height: 2.1, defaultColor: '#E0E0E0', defaultMaterial: 'glass' },
  { type: 'towel_rack', category: 'bathroom', label: 'Toallero', icon: '🧺', width: 0.6, depth: 0.10, height: 0.8, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'bathroom_cabinet', category: 'bathroom', label: 'Mueble baño alto', icon: '🗄️', width: 0.4, depth: 0.3, height: 1.6, defaultColor: '#F5F5F5', defaultMaterial: 'wood' },
  { type: 'washing_machine', category: 'bathroom', label: 'Lavadora', icon: '🫧', width: 0.6, depth: 0.6, height: 0.85, defaultColor: '#E8E8E8', defaultMaterial: 'metal' },
  { type: 'dryer', category: 'bathroom', label: 'Secadora', icon: '🫧', width: 0.6, depth: 0.6, height: 0.85, defaultColor: '#E8E8E8', defaultMaterial: 'metal' },
  { type: 'washer_dryer_stack', category: 'bathroom', label: 'Columna lavadora+secadora', icon: '🫧', width: 0.6, depth: 0.6, height: 1.7, defaultColor: '#E8E8E8', defaultMaterial: 'metal' },
  { type: 'water_heater', category: 'bathroom', label: 'Calentador agua', icon: '🔥', width: 0.45, depth: 0.35, height: 0.6, defaultColor: '#E8E8E8', defaultMaterial: 'metal' },
  { type: 'shower_walkin', category: 'bathroom', label: 'Ducha walk-in', icon: '🚿', width: 1.0, depth: 1.0, height: 2.1, defaultColor: '#E0E0E0', defaultMaterial: 'glass' },
  { type: 'bathroom_vanity', category: 'bathroom', label: 'Mueble bajo lavabo', icon: '🚰', width: 0.8, depth: 0.5, height: 0.85, defaultColor: '#F5F5F5', defaultMaterial: 'wood' },

  // ─── General / Decoración ───
  { type: 'plant', category: 'general', label: 'Planta grande', icon: '🪴', width: 0.5, depth: 0.5, height: 1.4, defaultColor: '#7A4E2D', defaultMaterial: 'organic' },
  { type: 'side_table_plant', category: 'general', label: 'Mesita con planta', icon: '🌱', width: 0.45, depth: 0.45, height: 0.9, defaultColor: '#C4A882', defaultMaterial: 'wood' },
  { type: 'plant_tree', category: 'general', label: 'Árbol interior', icon: '🌳', width: 0.7, depth: 0.7, height: 1.8, defaultColor: '#7A4E2D', defaultMaterial: 'organic' },
  { type: 'ceiling_lamp', category: 'lighting', label: 'Lámpara techo', icon: '💡', width: 0.5, depth: 0.5, height: 0.30, defaultColor: '#F5E6C8', defaultMaterial: 'metal' },
  { type: 'pendant_lamp', category: 'lighting', label: 'Lámpara colgante', icon: '💡', width: 0.35, depth: 0.35, height: 0.40, defaultColor: '#333333', defaultMaterial: 'metal' },
  { type: 'ceiling_fan', category: 'lighting', label: 'Ventilador techo', icon: '🌀', width: 1.2, depth: 1.2, height: 0.35, defaultColor: '#E8E8E8', defaultMaterial: 'metal' },
  { type: 'spotlight_ceiling', category: 'lighting', label: 'Foco empotrado', icon: '💡', width: 0.15, depth: 0.15, height: 0.08, defaultColor: '#2a2a2a', defaultMaterial: 'metal' },
  { type: 'wall_art', category: 'general', label: 'Cuadro grande', icon: '🖼️', width: 1.0, depth: 0.04, height: 0.7, defaultColor: '#8B6914', defaultMaterial: 'wood' },
  { type: 'wall_art_small', category: 'general', label: 'Cuadro pequeño', icon: '🖼️', width: 0.5, depth: 0.04, height: 0.4, defaultColor: '#8B6914', defaultMaterial: 'wood' },
  { type: 'mirror_wall', category: 'general', label: 'Espejo pared', icon: '🪞', width: 0.8, depth: 0.04, height: 1.0, defaultColor: '#C8D8E8', defaultMaterial: 'glass' },
  { type: 'radiator', category: 'general', label: 'Radiador', icon: '🔥', width: 1.0, depth: 0.10, height: 0.6, defaultColor: '#E8E8E8', defaultMaterial: 'metal' },
  { type: 'air_conditioner', category: 'general', label: 'Aire acondicionado', icon: '❄️', width: 0.8, depth: 0.22, height: 0.28, defaultColor: '#F0F0F0', defaultMaterial: 'metal' },
  { type: 'shoe_rack', category: 'general', label: 'Zapatero', icon: '👟', width: 0.8, depth: 0.35, height: 1.0, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'coat_rack', category: 'general', label: 'Perchero', icon: '🧥', width: 0.45, depth: 0.45, height: 1.8, defaultColor: '#3A3028', defaultMaterial: 'wood' },
  { type: 'storage_box', category: 'general', label: 'Caja almacenaje', icon: '📦', width: 0.5, depth: 0.4, height: 0.35, defaultColor: '#D2B48C', defaultMaterial: 'fabric' },
  { type: 'umbrella_stand', category: 'general', label: 'Paragüero', icon: '☂️', width: 0.25, depth: 0.25, height: 0.6, defaultColor: '#2F2F2F', defaultMaterial: 'metal' },
  { type: 'safe', category: 'general', label: 'Caja fuerte', icon: '🔒', width: 0.4, depth: 0.35, height: 0.5, defaultColor: '#4a4a4a', defaultMaterial: 'metal' },
  { type: 'tv_wall', category: 'general', label: 'Televisor mural', icon: '📺', width: 1.2, depth: 0.08, height: 0.7, defaultColor: '#1a1a1a', defaultMaterial: 'metal' },
  { type: 'file_cabinet', category: 'office', label: 'Archivador', icon: '📁', width: 0.45, depth: 0.5, height: 0.7, defaultColor: '#2F2F2F', defaultMaterial: 'metal' },
  { type: 'whiteboard', category: 'office', label: 'Pizarra', icon: '📋', width: 1.2, depth: 0.04, height: 0.9, defaultColor: '#F5F5F5', defaultMaterial: 'metal' },
  { type: 'gym_treadmill', category: 'gym', label: 'Cinta de correr', icon: '🏃', width: 0.8, depth: 1.8, height: 1.4, defaultColor: '#1a1a1a', defaultMaterial: 'metal' },
  { type: 'gym_bike', category: 'gym', label: 'Bicicleta estática', icon: '🚴', width: 0.6, depth: 1.2, height: 1.2, defaultColor: '#2a2a2a', defaultMaterial: 'metal' },
  { type: 'hot_tub', category: 'bathroom', label: 'Jacuzzi / Spa', icon: '🛁', width: 2.0, depth: 2.0, height: 0.8, defaultColor: '#FFFFFF', defaultMaterial: 'ceramic' },

  // ─── Oficina ───
  { type: 'office_desk', category: 'office', label: 'Mesa de oficina', icon: '🖥️', width: 1.6, depth: 0.8, height: 0.75, defaultColor: '#F5F5F5', defaultMaterial: 'wood' },
  { type: 'office_chair', category: 'office', label: 'Silla ergonómica', icon: '🪑', width: 0.65, depth: 0.65, height: 1.1, defaultColor: '#1A1A1A', defaultMaterial: 'fabric' },
  { type: 'reception_desk', category: 'office', label: 'Mostrador de recepción', icon: '🛎️', width: 2.4, depth: 0.8, height: 1.1, defaultColor: '#D2B48C', defaultMaterial: 'wood' },
  { type: 'meeting_table', category: 'office', label: 'Mesa de reuniones', icon: '🔲', width: 2.4, depth: 1.2, height: 0.75, defaultColor: '#C4A574', defaultMaterial: 'wood' },

  // ─── Gimnasio (Adicionales) ───
  { type: 'elliptical', category: 'gym', label: 'Elíptica', icon: '🏃', width: 0.7, depth: 1.6, height: 1.6, defaultColor: '#1a1a1a', defaultMaterial: 'metal' },
  { type: 'weight_bench', category: 'gym', label: 'Banco de pesas', icon: '🏋️', width: 1.2, depth: 1.4, height: 1.2, defaultColor: '#111111', defaultMaterial: 'metal' },
  { type: 'dumbbell_rack', category: 'gym', label: 'Mancuernero', icon: '🏋️', width: 1.5, depth: 0.5, height: 0.8, defaultColor: '#2a2a2a', defaultMaterial: 'metal' },
  { type: 'pilates_reformer', category: 'gym', label: 'Pilates Reformer', icon: '🧘', width: 0.7, depth: 2.4, height: 0.4, defaultColor: '#E8DCC8', defaultMaterial: 'wood' },

  // ─── Comercio (Retail) ───
  { type: 'display_shelf', category: 'retail', label: 'Estantería comercial', icon: '🛒', width: 1.2, depth: 0.5, height: 2.0, defaultColor: '#F5F5F5', defaultMaterial: 'metal' },
  { type: 'clothing_rack', category: 'retail', label: 'Perchero comercial', icon: '👕', width: 1.5, depth: 0.5, height: 1.6, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
  { type: 'cash_register_counter', category: 'retail', label: 'Mostrador de caja', icon: '💰', width: 1.8, depth: 0.6, height: 0.9, defaultColor: '#E8E8E8', defaultMaterial: 'wood' },
  { type: 'mannequin', category: 'retail', label: 'Maniquí', icon: '🧍', width: 0.5, depth: 0.5, height: 1.8, defaultColor: '#FFFFFF', defaultMaterial: 'organic' },

  // ─── Clínica / Hospital ───
  { type: 'exam_table', category: 'health', label: 'Camilla de exploración', icon: '🛏️', width: 0.7, depth: 1.9, height: 0.8, defaultColor: '#D4E8F0', defaultMaterial: 'fabric' },
  { type: 'medical_screen', category: 'health', label: 'Biombo médico', icon: '🪟', width: 1.8, depth: 0.4, height: 1.8, defaultColor: '#F0F8FF', defaultMaterial: 'fabric' },
  { type: 'iv_pole', category: 'health', label: 'Palo de suero (Gotero)', icon: '⚕️', width: 0.5, depth: 0.5, height: 2.1, defaultColor: '#C0C0C0', defaultMaterial: 'metal' },
]

export const ROOM_TYPES = [
  { type: 'living', label: 'Salón', defaultFloor: 'wood', defaultFloorColor: '#C4A882' },
  { type: 'bedroom', label: 'Dormitorio', defaultFloor: 'wood', defaultFloorColor: '#D2B48C' },
  { type: 'kitchen', label: 'Cocina', defaultFloor: 'tile', defaultFloorColor: '#E8E8E8' },
  { type: 'bathroom', label: 'Baño', defaultFloor: 'tile', defaultFloorColor: '#D3D3D3' },
  { type: 'hallway', label: 'Pasillo', defaultFloor: 'wood', defaultFloorColor: '#C4A882' },
  { type: 'other', label: 'Otro', defaultFloor: 'concrete', defaultFloorColor: '#BEBEBE' },
] as const

export const MATERIALS = [
  { id: 'wood', label: 'Madera', colors: ['#C4A882', '#D2B48C', '#8B6914', '#4A3728', '#E8D4B8'] },
  { id: 'parquet', label: 'Parquet', colors: ['#8B6914', '#6B4E0E', '#A07820', '#4A3728', '#C4A882'] },
  { id: 'tile', label: 'Azulejo', colors: ['#E8E8E8', '#D3D3D3', '#B0C4DE', '#F0E68C', '#FFFFFF'] },
  { id: 'tile_arabic', label: 'Azulejo árabe', colors: ['#1E90FF', '#228B22', '#8B4513', '#2F4F4F', '#F5DEB3'] },
  { id: 'tile_metro', label: 'Azulejo metro', colors: ['#FFFFFF', '#F5F5F5', '#E8E8E8', '#DCDCDC', '#B0C4DE'] },
  { id: 'marble', label: 'Mármol', colors: ['#F5F5F5', '#E8E0D8', '#D4C5B9', '#C0B0A0', '#FAFAFA'] },
  { id: 'concrete', label: 'Hormigón', colors: ['#BEBEBE', '#A9A9A9', '#808080', '#C8C8C8', '#D3D3D3'] },
  { id: 'fabric', label: 'Tela', colors: ['#8B7355', '#696969', '#B0C4DE', '#CD853F', '#2F4F4F'] },
  { id: 'metal', label: 'Metal', colors: ['#C0C0C0', '#2F2F2F', '#B8860B', '#CD7F32', '#708090'] },
  { id: 'iron', label: 'Hierro / Acero', colors: ['#4A4A4A', '#2F2F2F', '#5C5C5C', '#3A3A3A', '#6B6B6B'] },
  { id: 'ceramic', label: 'Cerámica', colors: ['#FFFFFF', '#FFF8DC', '#F0F0F0', '#E0E0E0', '#FAEBD7'] },
  { id: 'glass', label: 'Cristal', colors: ['#E0E0E0', '#B0E0E6', '#87CEEB', '#ADD8E6', '#F0F8FF'] },
  { id: 'paint', label: 'Pintura', colors: ['#FFFFFF', '#F5F5DC', '#DCDCDC', '#B0C4DE', '#E6E6FA'] },
]

/* ─── Material slot: each scene element has one ─── */
export interface MaterialSlot {
  material: string   // id from MATERIALS
  color: string
  roughness: number  // 0-1
  metalness: number  // 0-1
  opacity: number    // 0-1
}

export interface SceneMaterials {
  floor: MaterialSlot
  walls: MaterialSlot
  ceiling: MaterialSlot
  baseboard: MaterialSlot & { height: number }
  doorFrame: MaterialSlot
  doorPanel: MaterialSlot
  windowFrame: MaterialSlot
  windowGlass: MaterialSlot
  countertop: MaterialSlot
}

export const DEFAULT_SCENE_MATERIALS: SceneMaterials = {
  floor:       { material: 'wood',     color: '#C4A882', roughness: 0.7, metalness: 0.0, opacity: 1.0 },
  walls:       { material: 'paint',    color: '#FFFFFF', roughness: 0.9, metalness: 0.0, opacity: 1.0 },
  ceiling:     { material: 'paint',    color: '#FAFAFA', roughness: 0.95, metalness: 0.0, opacity: 1.0 },
  baseboard:   { material: 'wood',     color: '#F5F5F0', roughness: 0.5, metalness: 0.0, opacity: 1.0, height: 0.08 },
  doorFrame:   { material: 'wood',     color: '#F0EBE0', roughness: 0.4, metalness: 0.0, opacity: 1.0 },
  doorPanel:   { material: 'wood',     color: '#8B6914', roughness: 0.5, metalness: 0.0, opacity: 1.0 },
  windowFrame: { material: 'metal',    color: '#E0E0E0', roughness: 0.3, metalness: 0.5, opacity: 1.0 },
  windowGlass: { material: 'glass',    color: '#D4E8F0', roughness: 0.05, metalness: 0.1, opacity: 0.3 },
  countertop:  { material: 'marble',   color: '#F5F5F5', roughness: 0.2, metalness: 0.05, opacity: 1.0 },
}

export const MATERIAL_SECTION_LABELS: Record<keyof SceneMaterials, { label: string; icon: string }> = {
  floor:       { label: 'Suelo',             icon: '⬛' },
  walls:       { label: 'Paredes',           icon: '🧱' },
  ceiling:     { label: 'Techo',             icon: '⬜' },
  baseboard:   { label: 'Zócalo / Rodapié',  icon: '📏' },
  doorFrame:   { label: 'Marco de puerta',   icon: '🚪' },
  doorPanel:   { label: 'Panel de puerta',   icon: '🪵' },
  windowFrame: { label: 'Perfil ventana',    icon: '🔲' },
  windowGlass: { label: 'Cristal ventana',   icon: '💎' },
  countertop:  { label: 'Encimera',          icon: '🪨' },
}

export const STYLE_PRESETS = [
  {
    id: 'modern', label: 'Moderno', icon: '🏢',
    materials: {
      floor: { material: 'wood', color: '#C4A882', roughness: 0.7, metalness: 0.0, opacity: 1.0 },
      walls: { material: 'paint', color: '#FFFFFF', roughness: 0.9, metalness: 0.0, opacity: 1.0 },
      ceiling: { material: 'paint', color: '#FAFAFA', roughness: 0.95, metalness: 0.0, opacity: 1.0 },
      baseboard: { material: 'wood', color: '#F0F0F0', roughness: 0.5, metalness: 0.0, opacity: 1.0, height: 0.06 },
      doorFrame: { material: 'wood', color: '#F0EBE0', roughness: 0.4, metalness: 0.0, opacity: 1.0 },
      doorPanel: { material: 'paint', color: '#F5F5F5', roughness: 0.6, metalness: 0.0, opacity: 1.0 },
      windowFrame: { material: 'metal', color: '#333333', roughness: 0.3, metalness: 0.6, opacity: 1.0 },
      windowGlass: { material: 'glass', color: '#D4E8F0', roughness: 0.05, metalness: 0.1, opacity: 0.25 },
      countertop: { material: 'marble', color: '#F5F5F5', roughness: 0.15, metalness: 0.05, opacity: 1.0 },
    } as SceneMaterials,
  },
  {
    id: 'industrial', label: 'Industrial', icon: '🏭',
    materials: {
      floor: { material: 'concrete', color: '#A9A9A9', roughness: 0.85, metalness: 0.0, opacity: 1.0 },
      walls: { material: 'concrete', color: '#BEBEBE', roughness: 0.8, metalness: 0.0, opacity: 1.0 },
      ceiling: { material: 'concrete', color: '#C0C0C0', roughness: 0.9, metalness: 0.0, opacity: 1.0 },
      baseboard: { material: 'metal', color: '#555555', roughness: 0.4, metalness: 0.6, opacity: 1.0, height: 0.05 },
      doorFrame: { material: 'metal', color: '#444444', roughness: 0.3, metalness: 0.7, opacity: 1.0 },
      doorPanel: { material: 'metal', color: '#555555', roughness: 0.4, metalness: 0.5, opacity: 1.0 },
      windowFrame: { material: 'metal', color: '#333333', roughness: 0.25, metalness: 0.8, opacity: 1.0 },
      windowGlass: { material: 'glass', color: '#C8D8E0', roughness: 0.05, metalness: 0.15, opacity: 0.3 },
      countertop: { material: 'concrete', color: '#909090', roughness: 0.7, metalness: 0.05, opacity: 1.0 },
    } as SceneMaterials,
  },
  {
    id: 'nordic', label: 'Nórdico', icon: '🌲',
    materials: {
      floor: { material: 'wood', color: '#E8D4B8', roughness: 0.65, metalness: 0.0, opacity: 1.0 },
      walls: { material: 'paint', color: '#FAFAFA', roughness: 0.92, metalness: 0.0, opacity: 1.0 },
      ceiling: { material: 'paint', color: '#FFFFFF', roughness: 0.95, metalness: 0.0, opacity: 1.0 },
      baseboard: { material: 'wood', color: '#F5F0E8', roughness: 0.5, metalness: 0.0, opacity: 1.0, height: 0.10 },
      doorFrame: { material: 'wood', color: '#E8DED0', roughness: 0.45, metalness: 0.0, opacity: 1.0 },
      doorPanel: { material: 'wood', color: '#D2C4B0', roughness: 0.55, metalness: 0.0, opacity: 1.0 },
      windowFrame: { material: 'wood', color: '#F0E8D8', roughness: 0.5, metalness: 0.0, opacity: 1.0 },
      windowGlass: { material: 'glass', color: '#E0ECF4', roughness: 0.05, metalness: 0.08, opacity: 0.2 },
      countertop: { material: 'wood', color: '#D2B48C', roughness: 0.6, metalness: 0.0, opacity: 1.0 },
    } as SceneMaterials,
  },
  {
    id: 'mediterranean', label: 'Mediterráneo', icon: '☀️',
    materials: {
      floor: { material: 'tile', color: '#F0E68C', roughness: 0.6, metalness: 0.0, opacity: 1.0 },
      walls: { material: 'paint', color: '#FFF8DC', roughness: 0.88, metalness: 0.0, opacity: 1.0 },
      ceiling: { material: 'paint', color: '#FFFEF5', roughness: 0.95, metalness: 0.0, opacity: 1.0 },
      baseboard: { material: 'ceramic', color: '#E8DDD0', roughness: 0.5, metalness: 0.0, opacity: 1.0, height: 0.10 },
      doorFrame: { material: 'wood', color: '#A0785A', roughness: 0.55, metalness: 0.0, opacity: 1.0 },
      doorPanel: { material: 'wood', color: '#8B6914', roughness: 0.6, metalness: 0.0, opacity: 1.0 },
      windowFrame: { material: 'wood', color: '#4A7090', roughness: 0.5, metalness: 0.0, opacity: 1.0 },
      windowGlass: { material: 'glass', color: '#C8E0F0', roughness: 0.05, metalness: 0.1, opacity: 0.25 },
      countertop: { material: 'ceramic', color: '#FFF8E8', roughness: 0.3, metalness: 0.0, opacity: 1.0 },
    } as SceneMaterials,
  },
  {
    id: 'minimalist', label: 'Minimalista', icon: '◻️',
    materials: {
      floor: { material: 'concrete', color: '#D3D3D3', roughness: 0.75, metalness: 0.0, opacity: 1.0 },
      walls: { material: 'paint', color: '#F5F5F5', roughness: 0.9, metalness: 0.0, opacity: 1.0 },
      ceiling: { material: 'paint', color: '#FFFFFF', roughness: 0.95, metalness: 0.0, opacity: 1.0 },
      baseboard: { material: 'paint', color: '#F5F5F5', roughness: 0.9, metalness: 0.0, opacity: 1.0, height: 0.04 },
      doorFrame: { material: 'metal', color: '#E0E0E0', roughness: 0.3, metalness: 0.4, opacity: 1.0 },
      doorPanel: { material: 'paint', color: '#F0F0F0', roughness: 0.7, metalness: 0.0, opacity: 1.0 },
      windowFrame: { material: 'metal', color: '#D0D0D0', roughness: 0.3, metalness: 0.5, opacity: 1.0 },
      windowGlass: { material: 'glass', color: '#E0E8F0', roughness: 0.03, metalness: 0.1, opacity: 0.2 },
      countertop: { material: 'marble', color: '#F0F0F0', roughness: 0.15, metalness: 0.05, opacity: 1.0 },
    } as SceneMaterials,
  },
  {
    id: 'rustic', label: 'Rústico', icon: '🪵',
    materials: {
      floor: { material: 'wood', color: '#8B6914', roughness: 0.75, metalness: 0.0, opacity: 1.0 },
      walls: { material: 'paint', color: '#F5F5DC', roughness: 0.92, metalness: 0.0, opacity: 1.0 },
      ceiling: { material: 'wood', color: '#D2B48C', roughness: 0.8, metalness: 0.0, opacity: 1.0 },
      baseboard: { material: 'wood', color: '#6B4226', roughness: 0.65, metalness: 0.0, opacity: 1.0, height: 0.12 },
      doorFrame: { material: 'wood', color: '#5C3A1E', roughness: 0.6, metalness: 0.0, opacity: 1.0 },
      doorPanel: { material: 'wood', color: '#6B4226', roughness: 0.65, metalness: 0.0, opacity: 1.0 },
      windowFrame: { material: 'wood', color: '#5C3A1E', roughness: 0.6, metalness: 0.0, opacity: 1.0 },
      windowGlass: { material: 'glass', color: '#D8E8D0', roughness: 0.08, metalness: 0.08, opacity: 0.3 },
      countertop: { material: 'wood', color: '#4A3728', roughness: 0.7, metalness: 0.0, opacity: 1.0 },
    } as SceneMaterials,
  },
]

/* ─── Theme color tokens ─── */
export interface ThemeColors {
  bg: string
  bgPanel: string
  bgCard: string
  bgInput: string
  bgHover: string
  border: string
  borderLight: string
  text: string
  textSecondary: string
  textMuted: string
  accent: string
  accentBg: string
  canvasBg: string
  canvasGrid: string
  canvasGridMajor: string
  canvasText: string
  canvasAxis: string
  shadow: string
}

export const THEMES: Record<'dark' | 'light', ThemeColors> = {
  dark: {
    bg: '#0f1117',
    bgPanel: '#13141c',
    bgCard: '#1a1c28',
    bgInput: '#1a1c28',
    bgHover: '#222438',
    border: '#252840',
    borderLight: '#2a2d42',
    text: '#d0d2de',
    textSecondary: '#a0a2be',
    textMuted: '#8088a0',
    accent: '#5B8DEF',
    accentBg: '#5B8DEF18',
    canvasBg: '#13141c',
    canvasGrid: '#1e2030',
    canvasGridMajor: '#2a2d42',
    canvasText: '#ccd',
    canvasAxis: '#4a4f6a',
    shadow: 'rgba(0,0,0,0.5)',
  },
  light: {
    bg: '#f0f2f5',
    bgPanel: '#ffffff',
    bgCard: '#f8f9fa',
    bgInput: '#f0f2f5',
    bgHover: '#e8eaed',
    border: '#dde0e6',
    borderLight: '#e8eaed',
    text: '#1a1a2e',
    textSecondary: '#555770',
    textMuted: '#8890a0',
    accent: '#4A7AE0',
    accentBg: '#4A7AE018',
    canvasBg: '#f5f6f8',
    canvasGrid: '#e4e6ea',
    canvasGridMajor: '#cdd0d8',
    canvasText: '#333',
    canvasAxis: '#8890a0',
    shadow: 'rgba(0,0,0,0.12)',
  },
}
