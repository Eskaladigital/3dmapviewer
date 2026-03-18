import React, { useState, useMemo, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { FURNITURE_CATALOG, MATERIALS, STYLE_PRESETS, OPENING_CATALOG, THEMES, MATERIAL_SECTION_LABELS, DEFAULT_SCENE_MATERIALS } from '@/types'
import type { EditorTool, OpeningCatalogItem, ThemeColors, SceneMaterials, MaterialSlot } from '@/types'
import { loadFloorPlanFile, extractWallsFromDxf } from '@/utils/floorPlanImport'
import { detectWallsWithOpenCV, isOpenCvReady } from '@/utils/opencvWallDetection'

const CATEGORIES = [
  { id: 'living', label: 'Salón', icon: '🛋️' },
  { id: 'kitchen', label: 'Cocina', icon: '🍳' },
  { id: 'bedroom', label: 'Dormitorio', icon: '🛏️' },
  { id: 'bathroom', label: 'Baño', icon: '🚿' },
  { id: 'lighting', label: 'Iluminación', icon: '💡' },
  { id: 'general', label: 'General', icon: '🪴' },
]

const CONFIG_TABS = ['tools', 'furniture', 'style', 'floors'] as const

/** Input editable para valores numéricos: clic para seleccionar y escribir con precisión */
function EditableValue({
  value,
  suffix,
  min,
  max,
  step = 0.01,
  decimals = 2,
  onChange,
  style,
}: {
  value: number
  suffix: string
  min: number
  max: number
  step?: number
  decimals?: number
  onChange: (v: number) => void
  style: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const apply = () => {
    const n = parseFloat(inputVal.replace(',', '.'))
    if (!isNaN(n)) {
      const clamped = Math.max(min, Math.min(max, n))
      onChange(clamped)
    }
    setEditing(false)
  }

  const startEdit = () => {
    setInputVal(value.toFixed(decimals))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => { if (e.key === 'Enter') apply() }}
        autoFocus
        style={{
          ...style,
          width: 56,
          padding: '2px 4px',
          border: '1px solid #5B8DEF',
          borderRadius: 4,
          background: 'rgba(91,141,239,0.08)',
          outline: 'none',
        }}
      />
    )
  }
  return (
    <span onClick={startEdit} style={{ ...style, cursor: 'text', minWidth: 52 }} title="Clic para editar valor">
      {value.toFixed(decimals)}{suffix}
    </span>
  )
}

function CalibrationMetersPrompt({ store, c, s }: { store: ReturnType<typeof useStore>; c: ThemeColors; s: ReturnType<typeof getStyles> }) {
  const [meters, setMeters] = useState('')
  const cal = store.floorPlanCalibration
  if (!cal?.waitingForMeters) return null
  return (
    <div style={{ padding: 10, background: c.bgCard, borderRadius: 8, border: `1px solid ${c.border}` }}>
      <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 6 }}>
        ¿Cuántos metros mide la distancia que marcaste?
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="number"
          step="0.1"
          min="0.1"
          value={meters}
          onChange={(e) => setMeters(e.target.value)}
          placeholder="Ej: 4"
          style={s.numberInput}
        />
        <span style={{ fontSize: 12, color: c.textMuted }}>metros</span>
        <button
          onClick={() => {
            const m = parseFloat(meters)
            if (m > 0) {
              store.applyCalibration(m)
              setMeters('')
            }
          }}
          style={{ padding: '6px 12px', background: c.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          Aplicar
        </button>
        <button
          onClick={() => store.setFloorPlanCalibration(null)}
          style={{ padding: '6px 12px', background: 'transparent', color: c.textMuted, border: `1px solid ${c.border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function ImportPlanoButton({ store, c, s }: { store: ReturnType<typeof useStore>; c: ThemeColors; s: ReturnType<typeof getStyles> }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processFile = async (file: File) => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const bg = await loadFloorPlanFile(file)
      if (bg) {
        store.setFloorPlanBackground(bg)
        const ext = (file.name.split('.').pop() ?? '').toLowerCase()
        if (ext === 'dxf') {
          const walls = await extractWallsFromDxf(file)
          if (walls.length > 0) {
            const ok = window.confirm(`Se encontraron ${walls.length} líneas en el DXF. ¿Importarlas como paredes?`)
            if (ok) {
              const scale = 1 / 1000
              walls.forEach((w) => {
                store.addWall(
                  { x: w.start.x * scale, y: w.start.y * scale },
                  { x: w.end.x * scale, y: w.end.y * scale }
                )
              })
            }
          }
        }
      } else {
        setError('Formato no soportado')
      }
    } catch {
      setError('Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: 12,
        borderRadius: 10,
        border: `2px dashed ${loading ? '#5B8DEF44' : '#3a3d5544'}`,
        background: '#1a1c2811',
        transition: 'all 0.2s',
      }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
      onDrop={(e) => {
        e.preventDefault()
        const f = e.dataTransfer?.files?.[0]
        if (f && /\.(jpg|jpeg|png|gif|webp|bmp|pdf|dxf)$/i.test(f.name)) processFile(f)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.pdf,.dxf"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        style={{
          ...s.toolBtn,
          width: '100%',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '⏳ Cargando...' : '📂 Seleccionar o arrastrar archivo'}
      </button>
      {store.floorPlanBackground && (
        <>
          <button
            onClick={async () => {
              const bg = store.floorPlanBackground
              if (!bg?.dataUrl) return
              store.setAiAnalysisModalOpen(true)
              store.setAiAnalysisResult(null)
              try {
                const img = new Image()
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve()
                  img.onerror = () => reject(new Error('Error cargando imagen'))
                  img.src = bg.dataUrl
                })

                // Paralelizar: Detección OpenCV (frontend) + Análisis IA (backend)
                const runOpenCV = async () => {
                  if (isOpenCvReady()) {
                    try {
                      console.log('Iniciando detección OpenCV...')
                      return await detectWallsWithOpenCV(bg.dataUrl)
                    } catch (e) {
                      console.error('Error OpenCV:', e)
                      return []
                    }
                  }
                  return []
                }

                const runAI = async () => {
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
                  return data
                }

                const [cvWalls, aiData] = await Promise.all([runOpenCV(), runAI()])

                // 1. Filtrado semántico: La IA sabe dónde hay muebles. Si OpenCV detectó una línea ahí, ES UN MUEBLE, NO UNA PARED.
                let finalWalls = cvWalls || []
                if (finalWalls.length > 0 && aiData.furniture && aiData.furniture.length > 0) {
                  const initialCount = finalWalls.length
                  finalWalls = finalWalls.filter((wall: any) => {
                    const midX = (wall.start.x + wall.end.x) / 2
                    const midY = (wall.start.y + wall.end.y) / 2
                    
                    // Verificar si el muro cruza o está dentro de un mueble
                    return !aiData.furniture.some((f: any) => {
                      const fw = f.widthPx || 0
                      const fh = f.heightPx || 0
                      const left = f.x - fw / 2 - 10 // Margen de 10px
                      const right = f.x + fw / 2 + 10
                      const top = f.y - fh / 2 - 10
                      const bottom = f.y + fh / 2 + 10
                      return midX >= left && midX <= right && midY >= top && midY <= bottom
                    })
                  })
                  console.log(`🧹 Limpieza Semántica: Eliminadas ${initialCount - finalWalls.length} líneas que eran muebles.`)
                }

                // 2. Si OpenCV detectó paredes válidas, las usamos
                if (finalWalls.length > 4) {
                  aiData.walls = finalWalls
                } else if (aiData.walls.length === 0 && finalWalls.length > 0) {
                   // Si la IA falló completamente pero OpenCV vio algo, úsalo aunque sea poco
                   aiData.walls = finalWalls
                }

                store.setAiAnalysisResult(aiData)
              } catch (e) {
                store.setAiAnalysisError(String(e))
              }
            }}
            style={{
              ...s.toolBtn,
              width: '100%',
              marginTop: 0,
              background: 'linear-gradient(135deg, #5B8DEF22, #7B4DEF22)',
              borderColor: '#5B8DEF',
            }}
          >
            ✨ Analizar plano (Visión + IA)
          </button>
          <button
            onClick={() => store.setManualTraceModalOpen(true)}
            style={{
              ...s.toolBtn,
              width: '100%',
              marginTop: 0,
              background: 'linear-gradient(135deg, #2a4a2a22, #3a6a3a22)',
              borderColor: '#4a8a4a',
            }}
          >
            ✏️ Calcar manualmente
          </button>
          <button
            onClick={() => store.setFloorPlanCalibration({ points: [], waitingForMeters: false, measuredPixels: 0 })}
            style={{ ...s.toolBtn, width: '100%', marginTop: 0 }}
          >
            📐 Calibrar escala manual
          </button>
          <button
            onClick={() => store.setFloorPlanBackground(null)}
            style={{ ...s.deleteBtn, marginTop: 0 }}
          >
            Quitar plano de fondo
          </button>
        </>
      )}
      {store.floorPlanCalibration?.waitingForMeters && (
        <CalibrationMetersPrompt store={store} c={c} s={s} />
      )}
      {error && <span style={{ fontSize: 12, color: '#ef5b5b' }}>{error}</span>}
    </div>
  )
}

const TOOLS: { tool: EditorTool; label: string; icon: string }[] = [
  { tool: 'select', label: 'Seleccionar', icon: '👆' },
  { tool: 'wall', label: 'Pared', icon: '🧱' },
  { tool: 'door', label: 'Puerta', icon: '🚪' },
  { tool: 'window', label: 'Ventana', icon: '🪟' },
  { tool: 'furniture', label: 'Muebles', icon: '🛋️' },
  { tool: 'erase', label: 'Borrar', icon: '🗑️' },
]

export default function ConfigPanel() {
  const store = useStore()
  const { editor, project, theme } = store
  const floor = store.getActiveFloor()
  const [furnitureCategory, setFurnitureCategory] = useState('living')
  const [furnitureSearch, setFurnitureSearch] = useState('')
  const [configTab, setConfigTab] = useState<'tools' | 'furniture' | 'style' | 'floors'>('tools')
  const [openMatSection, setOpenMatSection] = useState<keyof SceneMaterials | null>('walls')
  const [validationOpen, setValidationOpen] = useState(false)
  const activeCatalogOpening = editor.selectedOpeningCatalog
  const setSelectedOpening = store.setSelectedOpeningCatalog

  const c = THEMES[theme]
  const s = useMemo(() => getStyles(c), [c])

  const selectFurnitureForPlacement = (catalogItem: typeof FURNITURE_CATALOG[0]) => {
    store.setSelectedFurnitureCatalog(catalogItem)
  }

  const selectedWall = editor.selectedItemId && editor.selectedItemType === 'wall'
    ? floor.walls.find(w => w.id === editor.selectedItemId)
    : null

  const selectedFurnitureIds = (editor.selectedFurnitureIds?.length ? editor.selectedFurnitureIds : (editor.selectedItemType === 'furniture' && editor.selectedItemId ? [editor.selectedItemId] : []))
  const selectedFurniture = selectedFurnitureIds.length === 1
    ? floor.furniture.find(f => f.id === selectedFurnitureIds[0])
    : null
  const hasMultipleFurnitureSelected = selectedFurnitureIds.length > 1

  const selectedOpening = editor.selectedItemId && editor.selectedItemType === 'opening'
    ? floor.openings.find(o => o.id === editor.selectedItemId)
    : null

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <h2 style={s.title}>Panel de Control</h2>
        <span style={s.subtitle}>{floor.name} — {project.name}</span>
      </div>

      <div style={s.tabs}>
        {CONFIG_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setConfigTab(tab)}
            style={{ ...s.tab, ...(configTab === tab ? s.tabActive : {}) }}
          >
            {tab === 'tools' && '🔧'}
            {tab === 'furniture' && '🛋️'}
            {tab === 'style' && '🎨'}
            {tab === 'floors' && '🏢'}
            <span style={s.tabLabel}>
              {tab === 'tools' ? 'Herramientas' : tab === 'furniture' ? 'Muebles' : tab === 'style' ? 'Estilo' : 'Pisos'}
            </span>
          </button>
        ))}
      </div>

      <div style={s.content}>
        {configTab === 'tools' && (
          <>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Vista 2D</h3>
              <div style={s.propRow}>
                <span style={s.propLabel}>Rotación</span>
                <input type="range" min={0} max={360} step={1} value={editor.viewRotationDeg ?? 0} onChange={(e) => store.setViewRotation(Number(e.target.value))} style={s.slider} />
                <EditableValue value={editor.viewRotationDeg ?? 0} suffix="°" min={0} max={360} decimals={0} step={1} onChange={(v) => store.setViewRotation(v)} style={s.propValue} />
              </div>
            </div>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Herramientas</h3>
              <div style={s.toolGrid}>
                {TOOLS.map((t) => (
                  <button
                    key={t.tool}
                    onClick={() => {
                      store.setTool(t.tool)
                      if (t.tool === 'furniture') setConfigTab('furniture')
                    }}
                    style={{ ...s.toolBtn, ...(editor.activeTool === t.tool ? s.toolBtnActive : {}) }}
                  >
                    <span style={{ fontSize: 20 }}>{t.icon}</span>
                    <span style={s.toolLabel}>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={s.section}>
              <h3 style={s.sectionTitle}>📥 Importar plano</h3>
              <p style={{ fontSize: 12, color: c.textMuted, marginBottom: 8, lineHeight: 1.4 }}>
                Imagen, PDF o DXF. Se mostrará como fondo para calcar paredes y muebles.
              </p>
              <ImportPlanoButton store={store} c={c} s={s} />
            </div>

            <div style={s.section}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                onClick={() => {
                  setValidationOpen((v) => {
                    if (!v) store.runValidation()
                    return !v
                  })
                }}
              >
                <h3 style={s.sectionTitle}>
                  {store.validationIssues.length > 0 ? '⚠️ Validación' : '✓ Validación'}
                </h3>
                <span style={{ fontSize: 12, color: c.textMuted }}>{validationOpen ? '▼' : '▶'}</span>
              </div>
              <button
                onClick={() => store.runValidation()}
                style={{ ...s.toolBtn, width: '100%', marginTop: 6 }}
              >
                Validar plano
              </button>
              {validationOpen && store.validationIssues.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, background: c.bgInput, borderRadius: 8, border: `1px solid ${c.border}` }}>
                  {store.validationIssues.map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        fontSize: 12,
                        color: issue.severity === 'error' ? '#ef5b5b' : c.textMuted,
                        marginBottom: 6,
                        cursor: issue.elementId ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (issue.elementId && issue.elementType) {
                          store.setSelected(issue.elementId, issue.elementType)
                        }
                      }}
                    >
                      {issue.severity === 'error' ? '●' : '○'} {issue.message}
                    </div>
                  ))}
                </div>
              )}
              {validationOpen && store.validationIssues.length === 0 && (
                <div style={{ marginTop: 10, fontSize: 12, color: c.textMuted }}>
                  Sin problemas detectados.
                </div>
              )}
            </div>

            {(editor.activeTool === 'door' || editor.activeTool === 'window') && (
              <div style={s.section}>
                <h3 style={s.sectionTitle}>
                  {editor.activeTool === 'door' ? '🚪 Tipo de puerta' : '🪟 Tipo de ventana'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {OPENING_CATALOG.filter(cat => cat.type === editor.activeTool).map((item) => (
                    <button
                      key={item.subtype}
                      onClick={() => setSelectedOpening(item)}
                      style={{
                        ...s.openingOption,
                        ...(activeCatalogOpening?.subtype === item.subtype && activeCatalogOpening?.type === item.type ? s.openingOptionActive : {}),
                      }}
                    >
                      <span style={{ fontSize: 18, minWidth: 28, textAlign: 'center' }}>{item.icon}</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={{ fontSize: 13, color: c.text }}>{item.label}</div>
                        <div style={{ fontSize: 11, color: c.textMuted }}>
                          {(item.defaultWidth * 100).toFixed(0)}×{(item.defaultHeight * 100).toFixed(0)} cm
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: c.textMuted, lineHeight: 1.5 }}>
                  {activeCatalogOpening
                    ? `Seleccionado: ${activeCatalogOpening.label}. Haz clic sobre una pared para colocarlo.`
                    : 'Selecciona un tipo y haz clic sobre una pared.'}
                </div>
              </div>
            )}

            {selectedWall && (
              <div style={s.section}>
                <h3 style={s.sectionTitle}>🧱 Pared seleccionada</h3>
                <div style={s.propRow}>
                  <span style={s.propLabel}>Longitud</span>
                  <span style={s.propValue}>
                    {Math.sqrt(Math.pow(selectedWall.end.x - selectedWall.start.x, 2) + Math.pow(selectedWall.end.y - selectedWall.start.y, 2)).toFixed(2)}m
                  </span>
                </div>
                <div style={s.propRow}>
                  <span style={s.propLabel}>Grosor</span>
                  <input type="range" min={0.05} max={0.5} step={0.01} value={selectedWall.thickness} onChange={(e) => store.updateWall(selectedWall.id, { thickness: Number(e.target.value) })} style={s.slider} />
                  <EditableValue value={selectedWall.thickness * 100} suffix="cm" min={5} max={50} decimals={0} onChange={(v) => store.updateWall(selectedWall.id, { thickness: v / 100 })} style={s.propValue} />
                </div>
                <div style={s.propRow}>
                  <span style={s.propLabel}>Altura</span>
                  <input type="range" min={2.0} max={4.0} step={0.01} value={selectedWall.height} onChange={(e) => store.updateWall(selectedWall.id, { height: Number(e.target.value) })} style={s.slider} />
                  <EditableValue value={selectedWall.height} suffix="m" min={2} max={4} decimals={2} onChange={(v) => store.updateWall(selectedWall.id, { height: v })} style={s.propValue} />
                </div>
                <div style={s.propRow}>
                  <span style={s.propLabel}>Color</span>
                  <input type="color" value={selectedWall.color || '#FFFFFF'} onChange={(e) => store.updateWall(selectedWall.id, { color: e.target.value })} style={s.colorInput} />
                </div>
                <button onClick={() => { store.removeWall(selectedWall.id); store.setSelected(null, null) }} style={s.deleteBtn}>
                  🗑️ Eliminar pared
                </button>
              </div>
            )}

            {selectedOpening && (
              <div style={s.section}>
                <h3 style={s.sectionTitle}>📐 {selectedOpening.type === 'door' ? 'Puerta' : 'Ventana'}</h3>
                <div style={s.propRow}>
                  <span style={s.propLabel}>Ancho</span>
                  <input type="range" min={0.4} max={3.0} step={0.01} value={selectedOpening.width} onChange={(e) => store.updateOpening(selectedOpening.id, { width: Number(e.target.value) })} style={s.slider} />
                  <EditableValue value={selectedOpening.width} suffix="m" min={0.4} max={3} decimals={2} onChange={(v) => store.updateOpening(selectedOpening.id, { width: v })} style={s.propValue} />
                </div>
                <div style={s.propRow}>
                  <span style={s.propLabel}>Alto</span>
                  <input type="range" min={0.5} max={2.5} step={0.01} value={selectedOpening.height} onChange={(e) => store.updateOpening(selectedOpening.id, { height: Number(e.target.value) })} style={s.slider} />
                  <EditableValue value={selectedOpening.height} suffix="m" min={0.5} max={2.5} decimals={2} onChange={(v) => store.updateOpening(selectedOpening.id, { height: v })} style={s.propValue} />
                </div>
                {selectedOpening.type === 'window' && (
                  <div style={s.propRow}>
                    <span style={s.propLabel}>Elevación</span>
                    <input type="range" min={0} max={2.0} step={0.01} value={selectedOpening.elevation} onChange={(e) => store.updateOpening(selectedOpening.id, { elevation: Number(e.target.value) })} style={s.slider} />
                    <EditableValue value={selectedOpening.elevation} suffix="m" min={0} max={2} decimals={2} onChange={(v) => store.updateOpening(selectedOpening.id, { elevation: v })} style={s.propValue} />
                  </div>
                )}
                <div style={s.propRow}>
                  <span style={s.propLabel}>Color</span>
                  <input type="color" value={selectedOpening.color || (selectedOpening.type === 'door' ? '#8B6914' : '#F5F5F5')} onChange={(e) => store.updateOpening(selectedOpening.id, { color: e.target.value })} style={s.colorInput} />
                </div>
                {selectedOpening.type === 'door' && !['sliding', 'pocket', 'pocket_pladur'].includes(selectedOpening.subtype) && (
                  <>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Abre hacia</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => store.updateOpening(selectedOpening.id, { openDirection: 'left' })}
                          style={{ ...s.catBtn, ...(selectedOpening.openDirection !== 'right' ? s.catBtnActive : {}) }}
                        >← Izquierda</button>
                        <button
                          onClick={() => store.updateOpening(selectedOpening.id, { openDirection: 'right' })}
                          style={{ ...s.catBtn, ...(selectedOpening.openDirection === 'right' ? s.catBtnActive : {}) }}
                        >Derecha →</button>
                      </div>
                    </div>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Apertura</span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => store.updateOpening(selectedOpening.id, { flip: false })}
                          style={{ ...s.catBtn, ...(!selectedOpening.flip ? s.catBtnActive : {}) }}
                        >Interior</button>
                        <button
                          onClick={() => store.updateOpening(selectedOpening.id, { flip: true })}
                          style={{ ...s.catBtn, ...(selectedOpening.flip ? s.catBtnActive : {}) }}
                        >Exterior</button>
                      </div>
                    </div>
                  </>
                )}
                <button onClick={() => { store.removeOpening(selectedOpening.id); store.setSelected(null, null) }} style={s.deleteBtn}>
                  🗑️ Eliminar
                </button>
              </div>
            )}

            {(selectedFurniture || hasMultipleFurnitureSelected) && (
              <div style={s.section}>
                <h3 style={s.sectionTitle}>
                  {hasMultipleFurnitureSelected ? `📐 ${selectedFurnitureIds.length} muebles seleccionados` : `📐 ${selectedFurniture!.label}`}
                </h3>
                {hasMultipleFurnitureSelected && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Color (aplica a todos)</span>
                      <input type="color" value={floor.furniture.find(f => selectedFurnitureIds.includes(f.id))?.color || '#b0a090'} onChange={(e) => store.updateFurnitureBatch(selectedFurnitureIds, { color: e.target.value })} style={s.colorInput} />
                    </div>
                    <span style={{ fontSize: 12, color: c.textMuted }}>Alinear / Distribuir</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
                      <button onClick={() => store.alignFurnitureHorizontal(selectedFurnitureIds)} style={{ ...s.toolBtn, flexDirection: 'row', padding: '8px 10px', fontSize: 12 }} title="Alinear al mismo eje horizontal (X)">
                        ↔️ Alinear horiz.
                      </button>
                      <button onClick={() => store.alignFurnitureVertical(selectedFurnitureIds)} style={{ ...s.toolBtn, flexDirection: 'row', padding: '8px 10px', fontSize: 12 }} title="Alinear al mismo eje vertical (Y)">
                        ↕️ Alinear vert.
                      </button>
                      <button onClick={() => store.distributeFurnitureHorizontal(selectedFurnitureIds)} style={{ ...s.toolBtn, flexDirection: 'row', padding: '8px 10px', fontSize: 12 }} title="Distribuir con espacio igual horizontal (3+ muebles)" disabled={selectedFurnitureIds.length < 3}>
                        ⇔ Distribuir horiz.
                      </button>
                      <button onClick={() => store.distributeFurnitureVertical(selectedFurnitureIds)} style={{ ...s.toolBtn, flexDirection: 'row', padding: '8px 10px', fontSize: 12 }} title="Distribuir con espacio igual vertical (3+ muebles)" disabled={selectedFurnitureIds.length < 3}>
                        ⇕ Distribuir vert.
                      </button>
                    </div>
                  </div>
                )}
                {selectedFurniture && !hasMultipleFurnitureSelected && (
                  <>
                    {selectedFurniture.type === 'desk_L' && (
                      <div style={s.propRow}>
                        <span style={s.propLabel}>Orientación L</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => store.updateFurniture(selectedFurniture.id, { flipL: true })}
                            style={{ ...s.catBtn, ...(selectedFurniture.flipL ? s.catBtnActive : {}) }}
                          >L ← Izquierda</button>
                          <button
                            onClick={() => store.updateFurniture(selectedFurniture.id, { flipL: false })}
                            style={{ ...s.catBtn, ...(!selectedFurniture.flipL ? s.catBtnActive : {}) }}
                          >L Derecha →</button>
                        </div>
                      </div>
                    )}
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Ancho</span>
                      <input type="range" min={0.2} max={5} step={0.01} value={selectedFurniture.width} onChange={(e) => store.updateFurniture(selectedFurniture.id, { width: Number(e.target.value) })} style={s.slider} />
                      <EditableValue value={selectedFurniture.width} suffix="m" min={0.2} max={5} decimals={2} onChange={(v) => store.updateFurniture(selectedFurniture.id, { width: v })} style={s.propValue} />
                    </div>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Largo</span>
                      <input type="range" min={0.2} max={5} step={0.01} value={selectedFurniture.depth} onChange={(e) => store.updateFurniture(selectedFurniture.id, { depth: Number(e.target.value) })} style={s.slider} />
                      <EditableValue value={selectedFurniture.depth} suffix="m" min={0.2} max={5} decimals={2} onChange={(v) => store.updateFurniture(selectedFurniture.id, { depth: v })} style={s.propValue} />
                    </div>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Alto</span>
                      <input type="range" min={0.05} max={4} step={0.01} value={selectedFurniture.height} onChange={(e) => store.updateFurniture(selectedFurniture.id, { height: Number(e.target.value) })} style={s.slider} />
                      <EditableValue value={selectedFurniture.height} suffix="m" min={0.05} max={4} decimals={2} onChange={(v) => store.updateFurniture(selectedFurniture.id, { height: v })} style={s.propValue} />
                    </div>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Rotación</span>
                      <input type="range" min={0} max={360} step={1} value={selectedFurniture.rotation} onChange={(e) => store.updateFurniture(selectedFurniture.id, { rotation: Number(e.target.value) })} style={s.slider} />
                      <EditableValue value={selectedFurniture.rotation} suffix="°" min={0} max={360} decimals={0} step={1} onChange={(v) => store.updateFurniture(selectedFurniture.id, { rotation: v })} style={s.propValue} />
                    </div>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Altura sobre suelo</span>
                      <input type="range" min={0} max={2.5} step={0.01} value={selectedFurniture.elevation ?? 0} onChange={(e) => store.updateFurniture(selectedFurniture.id, { elevation: Number(e.target.value) })} style={s.slider} title="0 = suelo, sube para encimeras, campanas, etc." />
                      <EditableValue value={selectedFurniture.elevation ?? 0} suffix="m" min={0} max={2.5} decimals={2} onChange={(v) => store.updateFurniture(selectedFurniture.id, { elevation: v })} style={s.propValue} />
                    </div>
                    <div style={s.propRow}>
                      <span style={s.propLabel}>Color</span>
                      <input type="color" value={selectedFurniture.color} onChange={(e) => store.updateFurniture(selectedFurniture.id, { color: e.target.value })} style={s.colorInput} />
                    </div>
                  </>
                )}
                <button onClick={() => {
                  selectedFurnitureIds.forEach(id => store.removeFurniture(id))
                  store.setSelected(null, null)
                }} style={s.deleteBtn}>
                  🗑️ Eliminar{hasMultipleFurnitureSelected ? ` (${selectedFurnitureIds.length})` : ''}
                </button>
              </div>
            )}

            <div style={s.section}>
              <h3 style={s.sectionTitle}>Resumen</h3>
              <div style={s.statsGrid}>
                <div style={s.statCard}><span style={s.statNum}>{floor.walls.length}</span><span style={s.statLabel}>Paredes</span></div>
                <div style={s.statCard}><span style={s.statNum}>{floor.openings.filter(o => o.type === 'door').length}</span><span style={s.statLabel}>Puertas</span></div>
                <div style={s.statCard}><span style={s.statNum}>{floor.openings.filter(o => o.type === 'window').length}</span><span style={s.statLabel}>Ventanas</span></div>
                <div style={s.statCard}><span style={s.statNum}>{floor.furniture.length}</span><span style={s.statLabel}>Muebles</span></div>
              </div>
              <div style={s.statTotal}>
                Perímetro: {floor.walls.reduce((sum, w) => {
                  const dx = w.end.x - w.start.x; const dy = w.end.y - w.start.y
                  return sum + Math.sqrt(dx * dx + dy * dy)
                }, 0).toFixed(1)}m
              </div>
              {floor.furniture.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 600, color: c.textMuted }}>Listado de muebles</h4>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: c.text, lineHeight: 1.6, maxHeight: 200, overflowY: 'auto' }}>
                    {Object.entries(
                      floor.furniture.reduce<Record<string, number>>((acc, f) => {
                        const name = f.label || f.type
                        acc[name] = (acc[name] || 0) + 1
                        return acc
                      }, {})
                    )
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([name, count]) => (
                        <li key={name}>
                          {count > 1 ? `${name} × ${count}` : name}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        {configTab === 'furniture' && (() => {
          const searchTerm = furnitureSearch.toLowerCase().trim()
          const filtered = searchTerm
            ? FURNITURE_CATALOG.filter((f) => f.label.toLowerCase().includes(searchTerm) || f.type.toLowerCase().includes(searchTerm))
            : FURNITURE_CATALOG.filter((f) => f.category === furnitureCategory)
          return (
            <>
              <div style={s.searchBox}>
                <span style={{ fontSize: 13, opacity: 0.5 }}>🔍</span>
                <input
                  type="text"
                  placeholder="Buscar mueble..."
                  value={furnitureSearch}
                  onChange={(e) => setFurnitureSearch(e.target.value)}
                  style={s.searchInput}
                />
                {furnitureSearch && (
                  <button onClick={() => setFurnitureSearch('')} style={s.searchClear}>✕</button>
                )}
              </div>
              {!searchTerm && (
                <div style={s.categoryTabs}>
                  {CATEGORIES.map((cat) => {
                    const count = FURNITURE_CATALOG.filter(f => f.category === cat.id).length
                    return (
                      <button key={cat.id} onClick={() => setFurnitureCategory(cat.id)} style={{ ...s.catBtn, ...(furnitureCategory === cat.id ? s.catBtnActive : {}), display: 'flex', alignItems: 'center', gap: 4 }}>
                        {cat.icon} {cat.label}
                        <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 2 }}>({count})</span>
                      </button>
                    )
                  })}
                </div>
              )}
              {searchTerm && <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 8 }}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</div>}
              <div style={s.furnitureGrid}>
                {filtered.map((item) => (
                  <button key={item.type} onClick={() => selectFurnitureForPlacement(item)} style={{ ...s.furnitureCard, ...(editor.selectedFurnitureCatalog?.type === item.type ? s.furnitureCardActive : {}) }} title={`${item.label}\nClic en el mapa 2D para colocar\n${(item.width * 100).toFixed(0)}×${(item.depth * 100).toFixed(0)}×${(item.height * 100).toFixed(0)} cm`}>
                    <div style={{ ...s.furnitureIconBg, backgroundColor: item.defaultColor + '18' }}>
                      <span style={{ fontSize: 26 }}>{item.icon}</span>
                    </div>
                    <span style={s.furnitureName}>{item.label}</span>
                    <span style={s.furnitureSize}>{(item.width * 100).toFixed(0)}×{(item.depth * 100).toFixed(0)} cm</span>
                    <div style={{ ...s.furnitureMaterialDot, backgroundColor: item.defaultColor }} />
                  </button>
                ))}
              </div>
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 12px', color: c.textMuted, fontSize: 12 }}>
                  No se encontraron muebles
                </div>
              )}

              {editor.selectedFurnitureCatalog && (
                <div style={{ fontSize: 11, color: c.accent, marginTop: 8, textAlign: 'center' }}>
                  Clic en el mapa 2D para colocar
                </div>
              )}
            </>
          )
        })()}

        {configTab === 'style' && (
          <>
            {/* ─── Presets ─── */}
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Presets de estilo</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {STYLE_PRESETS.map((preset) => (
                  <button key={preset.id} onClick={() => store.setSceneMaterials(preset.materials)} style={{ ...s.catBtn, display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px' }}>
                    <span>{preset.icon}</span>
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ─── Material Sections (accordion) ─── */}
            {(Object.keys(MATERIAL_SECTION_LABELS) as (keyof SceneMaterials)[]).map((key) => {
              const label = MATERIAL_SECTION_LABELS[key]
              const slot = store.sceneMaterials[key]
              const isOpen = openMatSection === key
              const matDef = MATERIALS.find(m => m.id === slot.material)

              return (
                <div key={key} style={{ marginBottom: 2 }}>
                  {/* Accordion header */}
                  <button
                    onClick={() => setOpenMatSection(isOpen ? null : key)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '9px 12px', border: `1px solid ${c.border}`, borderRadius: isOpen ? '8px 8px 0 0' : 8,
                      background: isOpen ? c.accentBg : c.bgCard, color: isOpen ? c.accent : c.text,
                      cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
                      textAlign: 'left' as const, fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: 16, minWidth: 22, textAlign: 'center' }}>{label.icon}</span>
                    <span style={{ flex: 1 }}>{label.label}</span>
                    <div style={{ width: 18, height: 18, borderRadius: 3, background: slot.color, border: `1px solid ${c.borderLight}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: c.textMuted }}>{matDef?.label || slot.material}</span>
                    <span style={{ fontSize: 12, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                  </button>

                  {/* Accordion body */}
                  {isOpen && (
                    <div style={{
                      border: `1px solid ${c.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px',
                      padding: 10, background: c.bgCard,
                    }}>
                      {/* Material type */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Material</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {MATERIALS.map((mat) => (
                            <button
                              key={mat.id}
                              onClick={() => store.updateMaterialSlot(key, { material: mat.id, color: mat.colors[0] })}
                              style={{
                                padding: '5px 10px', fontSize: 12, borderRadius: 5,
                                border: `1px solid ${slot.material === mat.id ? c.accent + '55' : c.border}`,
                                background: slot.material === mat.id ? c.accentBg : 'transparent',
                                color: slot.material === mat.id ? c.accent : c.textSecondary,
                                cursor: 'pointer', fontFamily: 'inherit',
                              }}
                            >{mat.label}</button>
                          ))}
                        </div>
                      </div>

                      {/* Color */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Color</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <input type="color" value={slot.color} onChange={(e) => store.updateMaterialSlot(key, { color: e.target.value })} style={{ ...s.colorInput, width: 40, height: 40 }} title="Paleta de colores" />
                          <span style={{ fontSize: 11, color: c.textMuted }}>Clic para elegir cualquier color</span>
                        </div>
                        <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 4 }}>Colores del material</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {matDef?.colors.map((col, i) => (
                            <button key={i} onClick={() => store.updateMaterialSlot(key, { color: col })} style={{
                              width: 28, height: 28, borderRadius: 4, background: col, border: `2px solid ${slot.color === col ? c.accent : c.borderLight}`,
                              cursor: 'pointer', padding: 0, boxShadow: slot.color === col ? `0 0 0 1px ${c.accent}` : 'none',
                            }} title={col} />
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: c.textMuted, marginTop: 6, marginBottom: 4 }}>Paleta extendida</div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {['#FFFFFF','#F5F5F5','#E8E8E8','#D3D3D3','#A9A9A9','#808080','#696969','#2F2F2F','#1a1a1a','#C4A882','#8B6914','#4A3728','#E8D4B8','#B0C4DE','#87CEEB','#4A7AE0','#228B22','#F0E68C','#CD853F','#8B4513','#DC143C','#FF6B6B'].map((col) => (
                            <button key={col} onClick={() => store.updateMaterialSlot(key, { color: col })} style={{
                              width: 22, height: 22, borderRadius: 3, background: col, border: `1px solid ${c.borderLight}`,
                              cursor: 'pointer', padding: 0, boxShadow: slot.color === col ? `0 0 0 2px ${c.accent}` : 'none',
                            }} title={col} />
                          ))}
                        </div>
                      </div>

                      {/* Roughness */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Rugosidad</span>
                          <span style={{ fontSize: 12, color: c.text, fontFamily: '"JetBrains Mono", monospace' }}>{(slot.roughness * 100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.01} value={slot.roughness} onChange={(e) => store.updateMaterialSlot(key, { roughness: Number(e.target.value) })} style={s.slider} />
                      </div>

                      {/* Metalness */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Metalicidad</span>
                          <span style={{ fontSize: 12, color: c.text, fontFamily: '"JetBrains Mono", monospace' }}>{(slot.metalness * 100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.01} value={slot.metalness} onChange={(e) => store.updateMaterialSlot(key, { metalness: Number(e.target.value) })} style={s.slider} />
                      </div>

                      {/* Opacity (mainly for glass) */}
                      {(key === 'windowGlass' || slot.opacity < 1) && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Opacidad</span>
                            <span style={{ fontSize: 12, color: c.text, fontFamily: '"JetBrains Mono", monospace' }}>{(slot.opacity * 100).toFixed(0)}%</span>
                          </div>
                          <input type="range" min={0.05} max={1} step={0.01} value={slot.opacity} onChange={(e) => store.updateMaterialSlot(key, { opacity: Number(e.target.value) })} style={s.slider} />
                        </div>
                      )}

                      {/* Height for baseboard */}
                      {key === 'baseboard' && 'height' in slot && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Altura</span>
                            <span style={{ fontSize: 12, color: c.text, fontFamily: '"JetBrains Mono", monospace' }}>{((slot as any).height * 100).toFixed(0)} cm</span>
                          </div>
                          <input type="range" min={0.02} max={0.20} step={0.01} value={(slot as any).height} onChange={(e) => store.updateMaterialSlot(key, { height: Number(e.target.value) })} style={s.slider} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}

        {configTab === 'floors' && (
          <>
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Pisos del proyecto</h3>
              <div style={s.floorList}>
                {project.floors.map((f) => (
                  <div key={f.id} style={{ ...s.floorItem, ...(project.activeFloorId === f.id ? s.floorItemActive : {}) }}>
                    <button onClick={() => store.setActiveFloor(f.id)} style={s.floorBtn}>
                      <span style={{ fontSize: 18 }}>🏠</span>
                      <div style={{ flex: 1, textAlign: 'left' }}>
                        <div style={s.floorName}>{f.name}</div>
                        <div style={s.floorMeta}>{f.walls.length} paredes · {f.furniture.length} muebles</div>
                      </div>
                    </button>
                    {project.floors.length > 1 && (
                      <button onClick={() => store.removeFloor(f.id)} style={s.floorDeleteBtn} title="Eliminar piso">✕</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => store.addFloor()} style={s.addFloorBtn}>+ Añadir piso</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function getStyles(c: ThemeColors) {
  const card: React.CSSProperties = { background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 8, transition: 'all 0.15s' }
  const active: React.CSSProperties = { background: c.accentBg, borderColor: `${c.accent}55`, color: c.accent }
  return {
    panel: { display: 'flex' as const, flexDirection: 'column' as const, height: '100%', background: c.bgPanel, fontFamily: '"DM Sans", sans-serif', color: c.text, borderLeft: `1px solid ${c.border}`, borderRight: `1px solid ${c.border}`, overflow: 'hidden' as const, transition: 'background 0.3s, color 0.3s' },
    header: { padding: '16px 16px 8px', borderBottom: `1px solid ${c.border}` },
    title: { margin: 0, fontSize: 20, fontWeight: 700, color: c.text, letterSpacing: '-0.02em' } as React.CSSProperties,
    subtitle: { fontSize: 13, color: c.textMuted, marginTop: 2, display: 'block' } as React.CSSProperties,
    tabs: { display: 'flex' as const, gap: 0, borderBottom: `1px solid ${c.border}` },
    tab: { flex: 1, padding: '10px 4px', border: 'none', background: 'transparent', color: c.textMuted, cursor: 'pointer', fontSize: 13, display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, gap: 3, transition: 'all 0.15s', borderBottom: '2px solid transparent' },
    tabActive: { color: c.accent, borderBottomColor: c.accent, background: c.accentBg },
    tabLabel: { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
    content: { flex: 1, overflow: 'auto' as const, padding: '14px' },
    section: { marginBottom: 20 },
    sectionTitle: { margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: c.textSecondary, textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as React.CSSProperties,
    toolGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
    toolBtn: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, gap: 4, padding: '10px 4px', ...card, color: c.textSecondary, cursor: 'pointer', fontSize: 13 },
    toolBtnActive: active,
    toolLabel: { fontSize: 12 },
    modeBtn: { flex: 1, padding: '8px', ...card, borderRadius: 6, color: c.textSecondary, cursor: 'pointer', fontSize: 13 },
    modeBtnActive: active,
    checkLabel: { display: 'flex' as const, alignItems: 'center' as const, gap: 8, marginTop: 8, fontSize: 13, color: c.textSecondary, cursor: 'pointer' },
    checkbox: { accentColor: c.accent, width: 16, height: 16 },
    slider: { width: '100%', accentColor: c.accent, background: 'transparent', marginTop: 4 },
    timeLabels: { display: 'flex' as const, justifyContent: 'space-between' as const, fontSize: 11, color: c.textMuted, marginTop: 2 },
    propRow: { display: 'flex' as const, alignItems: 'center' as const, gap: 8, marginBottom: 8 },
    propLabel: { fontSize: 13, color: c.textMuted, minWidth: 70 },
    propValue: { fontSize: 12, color: c.textMuted, fontFamily: '"JetBrains Mono", monospace' },
    colorInput: { width: 34, height: 34, border: `1px solid ${c.borderLight}`, borderRadius: 6, cursor: 'pointer', padding: 0, background: 'transparent' },
    colorRow: { display: 'flex' as const, alignItems: 'center' as const, gap: 10 },
    colorValue: { fontSize: 12, color: c.textMuted, fontFamily: '"JetBrains Mono", monospace' },
    deleteBtn: { width: '100%', padding: '10px', border: '1px solid #6a2020', borderRadius: 6, background: c.bgCard, color: '#ef5b5b', cursor: 'pointer', fontSize: 13, marginTop: 8 },
    numberInput: { width: 75, padding: '5px 8px', background: c.bgInput, border: `1px solid ${c.borderLight}`, borderRadius: 4, color: c.text, fontSize: 13, fontFamily: '"JetBrains Mono", monospace', textAlign: 'right' as const },
    openingOption: { display: 'flex' as const, alignItems: 'center' as const, gap: 8, padding: '8px 10px', ...card, borderRadius: 6, color: c.textSecondary, cursor: 'pointer', fontSize: 13 },
    openingOptionActive: active,
    statsGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, marginBottom: 8 },
    statCard: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, padding: '10px 8px', background: c.bgCard, borderRadius: 8, border: `1px solid ${c.border}` },
    statNum: { fontSize: 20, fontWeight: 700, color: c.accent, fontFamily: '"JetBrains Mono", monospace' } as React.CSSProperties,
    statLabel: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    statTotal: { fontSize: 13, color: c.textMuted, padding: '6px 10px', background: c.bgCard, borderRadius: 6, border: `1px solid ${c.border}`, fontFamily: '"JetBrains Mono", monospace' },
    categoryTabs: { display: 'flex' as const, flexWrap: 'wrap' as const, gap: 4, marginBottom: 12 },
    catBtn: { padding: '6px 10px', ...card, borderRadius: 6, color: c.textMuted, cursor: 'pointer', fontSize: 12 },
    catBtnActive: active,
    searchBox: { display: 'flex' as const, alignItems: 'center' as const, gap: 6, padding: '8px 10px', marginBottom: 10, background: c.bgInput, border: `1px solid ${c.borderLight}`, borderRadius: 8 },
    searchInput: { flex: 1, border: 'none', background: 'transparent', color: c.text, fontSize: 13, outline: 'none', fontFamily: '"DM Sans", sans-serif' },
    searchClear: { border: 'none', background: 'transparent', color: c.textMuted, cursor: 'pointer', fontSize: 13, padding: '2px 4px', borderRadius: 4 },
    furnitureGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 },
    furnitureCard: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, gap: 3, padding: '8px 4px', ...card, color: c.text, cursor: 'pointer', position: 'relative' as const, overflow: 'hidden' as const, transition: 'all 0.15s, transform 0.12s', minHeight: 84 },
    furnitureCardActive: { borderColor: c.accent, background: c.accentBg },
    furnitureIconBg: { width: 42, height: 42, borderRadius: 10, display: 'flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const },
    furnitureName: { fontSize: 11, textAlign: 'center' as const, lineHeight: '1.25', maxHeight: 28, overflow: 'hidden' as const },
    furnitureSize: { fontSize: 10, color: c.textMuted, fontFamily: '"JetBrains Mono", monospace' },
    furnitureMaterialDot: { position: 'absolute' as const, top: 4, right: 4, width: 10, height: 10, borderRadius: '50%', border: `1px solid ${c.borderLight}` },
    presetGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 },
    presetBtn: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, padding: '10px 6px', ...card, color: c.textSecondary, cursor: 'pointer', fontSize: 13 },
    presetLabel: { fontSize: 12 },
    materialGrid: { display: 'grid' as const, gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 },
    materialBtn: { display: 'flex' as const, flexDirection: 'column' as const, alignItems: 'center' as const, padding: '10px', ...card, color: c.textSecondary, cursor: 'pointer', fontSize: 13 },
    materialBtnActive: active,
    colorSwatches: { display: 'flex' as const, gap: 8, flexWrap: 'wrap' as const },
    swatch: { width: 34, height: 34, borderRadius: 6, border: `1px solid ${c.borderLight}`, cursor: 'pointer', transition: 'all 0.15s' },
    floorList: { display: 'flex' as const, flexDirection: 'column' as const, gap: 6 },
    floorItem: { display: 'flex' as const, alignItems: 'center' as const, border: `1px solid ${c.border}`, borderRadius: 8, background: c.bgCard, overflow: 'hidden' as const, transition: 'all 0.15s' },
    floorItemActive: { borderColor: `${c.accent}55`, background: `${c.accent}10` },
    floorBtn: { flex: 1, display: 'flex' as const, alignItems: 'center' as const, gap: 10, padding: '10px 12px', border: 'none', background: 'transparent', color: c.text, cursor: 'pointer', textAlign: 'left' as const },
    floorName: { fontSize: 14, fontWeight: 500 } as React.CSSProperties,
    floorMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    floorDeleteBtn: { padding: '8px 12px', border: 'none', background: 'transparent', color: c.textMuted, cursor: 'pointer', fontSize: 15 },
    addFloorBtn: { width: '100%', padding: '10px', marginTop: 8, border: `1px dashed ${c.border}`, borderRadius: 8, background: 'transparent', color: c.accent, cursor: 'pointer', fontSize: 13, fontWeight: 500 } as React.CSSProperties,
  }
}
