import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { jsPDF } from 'jspdf'
import FloorPlanEditor from './components/editor2d/FloorPlanEditor'
import ConfigPanel from './components/config/ConfigPanel'
import Viewer3D from './components/viewer3d/Viewer3D'
import RenderGenerationModal from './components/config/RenderGenerationModal'
import AIAnalysisModal from './components/config/AIAnalysisModal'
import ManualTraceModal from './components/config/ManualTraceModal'
import { useStore } from './store/useStore'
import { THEMES, type ThemeColors } from './types'
import { FLOOR_TEMPLATES } from './data/floorTemplates'

function Toast({ message, type = 'success', visible }: { message: string; type?: 'success' | 'info'; visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: type === 'success' ? '#1a3a2a' : '#1a2a4a',
      border: `1px solid ${type === 'success' ? '#2a6a3a' : '#3a5a8a'}`,
      color: type === 'success' ? '#5BE0A0' : '#7BB8EF',
      padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 500,
      fontFamily: '"DM Sans", sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      zIndex: 1000, animation: 'slideIn 0.2s ease-out',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span>{type === 'success' ? '✓' : 'ℹ'}</span> {message}
    </div>
  )
}

function HeaderBar({ onToast, editor2dCanvasRef }: { onToast: (msg: string, type?: 'success' | 'info') => void; editor2dCanvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const store = useStore()
  const theme = useStore((s) => s.theme)
  const t = THEMES[theme]
  const projectName = useStore((s) => s.project.name)
  const hasUnsavedChanges = useStore((s) => s.dirty)
  const [showLoad, setShowLoad] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showExportPlano, setShowExportPlano] = useState(false)
  const [savedList, setSavedList] = useState<{ id: string; name: string; savedAt: string }[]>([])
  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(projectName)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const loadMenuRef = useRef<HTMLDivElement>(null)
  const newMenuRef = useRef<HTMLDivElement>(null)
  const exportPlanoMenuRef = useRef<HTMLDivElement>(null)
  const [, forceRender] = useState(0)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        store.undo()
        forceRender(n => n + 1)
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey))) {
        e.preventDefault()
        store.redo()
        forceRender(n => n + 1)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        store.saveProject()
        onToast('Proyecto guardado')
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        handleExport()
      }
      if (!inInput && (e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (store.copySelectedItem()) {
          e.preventDefault()
          onToast('Elemento copiado', 'info')
        }
      }
      if (!inInput && (e.ctrlKey || e.metaKey) && e.key === 'v') {
        if (store.pasteItem()) {
          e.preventDefault()
          onToast('Elemento pegado', 'info')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [store, onToast])

  useEffect(() => {
    if (isEditingName && nameInputRef.current) nameInputRef.current.focus()
  }, [isEditingName])

  useEffect(() => {
    if (!showLoad && !showExportPlano && !showNewMenu) return
    const onClick = (e: MouseEvent) => {
      if (loadMenuRef.current && !loadMenuRef.current.contains(e.target as Node)) setShowLoad(false)
      if (exportPlanoMenuRef.current && !exportPlanoMenuRef.current.contains(e.target as Node)) setShowExportPlano(false)
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) setShowNewMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showLoad, showExportPlano, showNewMenu])

  const handleNew = useCallback(() => {
    if (store.hasUnsavedChanges() || store.getActiveFloor().walls.length > 0 || store.getActiveFloor().furniture.length > 0) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Continuar? Se perderán los cambios.')) return
    }
    store.newProject()
    onToast('Nuevo proyecto creado', 'info')
  }, [store, onToast])

  const handleSave = useCallback(() => {
    store.saveProject()
    onToast('Proyecto guardado')
  }, [store, onToast])

  const handleExport = useCallback(() => {
    const s = useStore.getState()
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      project: s.project,
      globalWallColor: s.globalWallColor,
      globalFloorMaterial: s.globalFloorMaterial,
      globalFloorColor: s.globalFloorColor,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${s.project.name.replace(/\s+/g, '_')}.floorcraft.json`
    a.click()
    URL.revokeObjectURL(url)
    onToast('Proyecto exportado como JSON', 'info')
  }, [onToast])

  const handleExportPlano = useCallback((format: 'png' | 'pdf') => {
    const canvas = editor2dCanvasRef.current
    if (!canvas) {
      onToast('No se puede exportar: canvas no disponible', 'info')
      return
    }
    const dataUrl = canvas.toDataURL('image/png')
    const baseName = store.project.name.replace(/\s+/g, '_')
    if (format === 'png') {
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${baseName}-plano.png`
      a.click()
      onToast('Plano exportado como PNG', 'info')
    } else {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const imgW = canvas.width
      const imgH = canvas.height
      const scale = Math.min(pageW / imgW, pageH / imgH) * 0.95
      const w = imgW * scale
      const h = imgH * scale
      const x = (pageW - w) / 2
      const y = (pageH - h) / 2
      doc.addImage(dataUrl, 'PNG', x, y, w, h)
      doc.save(`${baseName}-plano.pdf`)
      onToast('Plano exportado como PDF', 'info')
    }
    setShowExportPlano(false)
  }, [editor2dCanvasRef, store.project.name, onToast])

  const handleOpenLoad = useCallback(async () => {
    const list = await store.getSavedProjects()
    setSavedList(list)
    setShowLoad((v) => !v)
  }, [store])

  const handleLoad = useCallback(async (id: string) => {
    if (store.hasUnsavedChanges() || store.getActiveFloor().walls.length > 0 || store.getActiveFloor().furniture.length > 0) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Continuar? Se perderán los cambios.')) return
    }
    const ok = await store.loadProject(id)
    if (ok) {
      setShowLoad(false)
      onToast('Proyecto cargado', 'info')
    } else {
      onToast('No se pudo cargar el proyecto', 'info')
    }
  }, [store, onToast])

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('¿Eliminar este proyecto guardado?')) return
    await store.deleteProject(id)
    const list = await store.getSavedProjects()
    setSavedList(list)
  }, [store])

  const handleNameSubmit = useCallback(() => {
    const trimmed = editName.trim()
    if (trimmed) store.setProjectName(trimmed)
    setIsEditingName(false)
  }, [editName, store])

  const h = useMemo(() => getHeaderStyles(t), [t])
  const btnStyle: React.CSSProperties = h.btn
  const btnSmStyle: React.CSSProperties = h.btnSmall
  const ddStyle: React.CSSProperties = h.dropdown

  return (
    <div style={h.bar}>
      <div style={h.left}>
        <div style={h.logo}>
          <span style={{ color: t.accent }}>Floor</span>
          <span style={{ color: t.textSecondary }}>Craft</span>
        </div>

        <div style={{ ...h.divider, background: t.border }} />

        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); if (e.key === 'Escape') setIsEditingName(false) }}
            style={{ ...h.nameInput, background: t.bgInput, color: t.text, borderColor: t.accent }}
          />
        ) : (
          <span
            style={{ ...h.projectName, color: t.textMuted }}
            onClick={() => { setEditName(projectName); setIsEditingName(true) }}
            title="Clic para renombrar"
          >
            {projectName}
            {hasUnsavedChanges && <span style={{ marginLeft: 4, color: t.accent }} title="Cambios sin guardar">*</span>}
            <span style={{ marginLeft: 6, fontSize: 10 }}>✎</span>
          </span>
        )}
      </div>

      <div style={h.actions}>
        <button
          style={{ ...btnSmStyle, opacity: store.canUndo() ? 1 : 0.3 }}
          onClick={() => { store.undo(); forceRender(n => n + 1) }}
          disabled={!store.canUndo()}
          title="Deshacer (Ctrl+Z)"
        >↩</button>
        <button
          style={{ ...btnSmStyle, opacity: store.canRedo() ? 1 : 0.3 }}
          onClick={() => { store.redo(); forceRender(n => n + 1) }}
          disabled={!store.canRedo()}
          title="Rehacer (Ctrl+Shift+Z)"
        >↪</button>

        <div style={{ ...h.divider, background: t.border }} />

        <div style={{ position: 'relative' }}>
          <button
            style={btnStyle}
            onClick={() => setShowNewMenu((v) => !v)}
            title="Nuevo proyecto o plantilla"
          >
            <span style={h.btnIcon}>+</span> Nuevo
          </button>
          {showNewMenu && (
            <div ref={newMenuRef} style={{ ...h.dropdown, right: 0, width: 220 }}>
              <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.border}` }} onClick={() => { handleNew(); setShowNewMenu(false) }}>
                <span style={{ color: t.text }}>Nuevo vacío</span>
              </div>
              <div style={{ ...h.dropdownHeader, color: t.textMuted }}>Plantillas</div>
              {FLOOR_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.borderLight}` }}
                  onClick={() => {
                    if (store.hasUnsavedChanges() || store.getActiveFloor().walls.length > 0 || store.getActiveFloor().furniture.length > 0) {
                      if (!window.confirm('Tienes cambios sin guardar. ¿Aplicar plantilla? Se reemplazará el piso actual.')) return
                    }
                    store.applyFloorTemplate(tpl.id)
                    setShowNewMenu(false)
                    onToast(`Plantilla "${tpl.name}" aplicada`, 'info')
                  }}
                >
                  <div style={h.dropdownItemInfo}>
                    <span style={{ ...h.dropdownItemName, color: t.text }}>{tpl.name}</span>
                    <span style={{ ...h.dropdownItemDate, color: t.textMuted }}>{tpl.description}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button style={btnStyle} onClick={handleSave} title="Guardar proyecto (Ctrl+S)">
          <span style={h.btnIcon}>💾</span> Guardar
        </button>

        <div style={{ position: 'relative' }}>
          <button style={btnStyle} onClick={handleOpenLoad} title="Cargar proyecto guardado">
            <span style={h.btnIcon}>📂</span> Cargar
          </button>

          {showLoad && (
            <div ref={loadMenuRef} style={ddStyle}>
              <div style={{ ...h.dropdownHeader, color: t.textMuted, borderBottom: `1px solid ${t.border}` }}>Proyectos guardados</div>
              {savedList.length === 0 ? (
                <div style={{ ...h.dropdownEmpty, color: t.textMuted }}>No hay proyectos guardados</div>
              ) : (
                savedList
                  .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
                  .map((p) => (
                    <div key={p.id} style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.border}` }} onClick={() => handleLoad(p.id)}>
                      <div style={h.dropdownItemInfo}>
                        <span style={{ ...h.dropdownItemName, color: t.text }}>{p.name}</span>
                        <span style={{ ...h.dropdownItemDate, color: t.textMuted }}>
                          {new Date(p.savedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <button style={h.dropdownDelete} onClick={(e) => handleDelete(e, p.id)} title="Eliminar">✕</button>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>

        <div style={{ ...h.divider, background: t.border }} />

        <button style={btnStyle} onClick={handleExport} title="Exportar JSON (Ctrl+E)">
          <span style={h.btnIcon}>↗</span> Exportar
        </button>

        <div style={{ position: 'relative' }}>
          <button
            style={btnStyle}
            onClick={() => setShowExportPlano((v) => !v)}
            title="Exportar plano 2D"
          >
            <span style={h.btnIcon}>🖼</span> Plano
          </button>
          {showExportPlano && (
            <div ref={exportPlanoMenuRef} style={{
              ...h.dropdown,
              right: 0,
              width: 160,
            }}>
              <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.border}` }} onClick={() => handleExportPlano('png')}>
                <span style={{ color: t.text }}>PNG</span>
              </div>
              <div style={h.dropdownItem} onClick={() => handleExportPlano('pdf')}>
                <span style={{ color: t.text }}>PDF</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ ...h.divider, background: t.border }} />

        {/* Theme toggle */}
        <button
          style={{ ...btnStyle, gap: 6, padding: '5px 10px' }}
          onClick={store.toggleTheme}
          title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>{theme === 'dark' ? '☀️' : '🌙'}</span>
          <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
        </button>
      </div>
    </div>
  )
}

function getHeaderStyles(t: ThemeColors): Record<string, React.CSSProperties> {
  return {
    bar: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 44,
      minHeight: 44,
      background: t.bgPanel,
      borderBottom: `1px solid ${t.border}`,
      padding: '0 16px',
      zIndex: 50,
      flexShrink: 0,
    },
    left: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    logo: {
      fontFamily: '"JetBrains Mono", monospace',
      fontWeight: 700,
      fontSize: 16,
      letterSpacing: 0.5,
      userSelect: 'none',
    },
    divider: {
      width: 1,
      height: 18,
      background: t.border,
      flexShrink: 0,
    },
    projectName: {
      fontSize: 14,
      color: t.textMuted,
      cursor: 'pointer',
      padding: '3px 8px',
      borderRadius: 4,
      border: '1px solid transparent',
      transition: 'all 0.15s',
    },
    nameInput: {
      fontSize: 14,
      color: t.text,
      background: t.bgInput,
      border: `1px solid ${t.accent}`,
      borderRadius: 4,
      padding: '3px 8px',
      outline: 'none',
      fontFamily: 'inherit',
      width: 180,
    },
    actions: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    },
    btn: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      background: t.bgCard,
      border: `1px solid ${t.borderLight}`,
      borderRadius: 6,
      color: t.textSecondary,
      fontSize: 13,
      padding: '5px 12px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      whiteSpace: 'nowrap' as const,
    },
    btnSmall: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.bgCard,
      border: `1px solid ${t.borderLight}`,
      borderRadius: 5,
      color: t.textSecondary,
      fontSize: 15,
      width: 30,
      height: 28,
      padding: 0,
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    btnIcon: {
      fontSize: 13,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: 6,
      background: t.bgPanel,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      width: 300,
      maxHeight: 360,
      overflowY: 'auto' as const,
      boxShadow: `0 12px 40px ${t.shadow}`,
      zIndex: 100,
      animation: 'fadeInUp 0.15s ease-out',
    },
    dropdownHeader: {
      padding: '12px 14px 8px',
      fontSize: 11,
      fontWeight: 600,
      color: t.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.05em',
      borderBottom: `1px solid ${t.border}`,
    },
    dropdownEmpty: {
      padding: '24px 16px',
      color: t.textMuted,
      fontSize: 12,
      textAlign: 'center' as const,
    },
    dropdownItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 14px',
      cursor: 'pointer',
      borderBottom: `1px solid ${t.borderLight}`,
      transition: 'background 0.1s',
    },
    dropdownItemInfo: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: 2,
    },
    dropdownItemName: {
      color: t.text,
      fontSize: 13,
      fontWeight: 500,
    },
    dropdownItemDate: {
      color: t.textMuted,
      fontSize: 11,
    },
    dropdownDelete: {
      background: 'none',
      border: 'none',
      color: t.textMuted,
      fontSize: 13,
      cursor: 'pointer',
      padding: '4px 6px',
      borderRadius: 4,
    },
  }
}

function ShortcutsBar() {
  const theme = useStore((s) => s.theme)
  const t = THEMES[theme]
  const kbdStyle: React.CSSProperties = {
    background: theme === 'dark' ? '#1e2030' : '#dde0e8',
    border: `1px solid ${theme === 'dark' ? '#3a3d55' : '#c0c4d0'}`,
    borderRadius: 4, padding: '2px 6px', fontSize: 11,
    color: theme === 'dark' ? '#b0b8d0' : '#505870',
    marginRight: 3, fontWeight: 600,
  }
  const labelColor = theme === 'dark' ? '#8890aa' : '#606880'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, height: 30, minHeight: 30,
      background: theme === 'dark' ? '#0e1018' : '#eef0f3',
      borderBottom: `1px solid ${theme === 'dark' ? '#252840' : '#d0d4de'}`,
      padding: '0 16px', flexShrink: 0,
      fontSize: 12, color: labelColor, fontFamily: '"JetBrains Mono", monospace',
    }}>
      <span><kbd style={kbdStyle}>Ctrl+S</kbd> Guardar</span>
      <span><kbd style={kbdStyle}>Ctrl+Z</kbd> Deshacer</span>
      <span><kbd style={kbdStyle}>Ctrl+E</kbd> Exportar</span>
      <span><kbd style={kbdStyle}>Ctrl+C</kbd> Copiar</span>
      <span><kbd style={kbdStyle}>Ctrl+V</kbd> Pegar</span>
      <span><kbd style={kbdStyle}>Z</kbd> Zoom a selección</span>
      <span><kbd style={kbdStyle}>Esc</kbd> Cancelar</span>
      <span><kbd style={kbdStyle}>Del</kbd> Borrar</span>
      <span><kbd style={kbdStyle}>R</kbd> Rotar</span>
      <span><kbd style={kbdStyle}>Clic der.</kbd> Fin pared</span>
    </div>
  )
}

export default function App() {
  const theme = useStore((s) => s.theme)
  const t = THEMES[theme]
  const pendingToast = useStore((s) => s.pendingToast)
  const setPendingToast = useStore((s) => s.setPendingToast)
  const [toast, setToast] = useState({ message: '', type: 'success' as 'success' | 'info', visible: false })
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(`theme-${theme}`)
  }, [theme])

  useEffect(() => {
    if (pendingToast) {
      setToast({ message: pendingToast.message, type: pendingToast.type, visible: true })
      setPendingToast(null)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000)
    }
  }, [pendingToast, setPendingToast])

  const showToast = useCallback((message: string, type: 'success' | 'info' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type, visible: true })
    toastTimer.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2000)
  }, [])

  const editor2dCanvasRef = useRef<HTMLCanvasElement>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden', background: t.bg, transition: 'background 0.3s' }}>
      <HeaderBar onToast={showToast} editor2dCanvasRef={editor2dCanvasRef} />
      <ShortcutsBar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: '1 1 35%', minWidth: 300, background: t.bgPanel, borderRight: `1px solid ${t.border}`, transition: 'background 0.3s, border-color 0.3s' }}>
          <FloorPlanEditor canvasRef={editor2dCanvasRef} />
        </div>
        <div style={{ width: 280, minWidth: 260, maxWidth: 320, flexShrink: 0, transition: 'background 0.3s' }}>
          <ConfigPanel />
        </div>
        <div style={{ flex: '1 1 40%', minWidth: 400, background: theme === 'dark' ? '#0a0b10' : '#e8eaed', transition: 'background 0.3s' }}>
          <Viewer3D />
        </div>
      </div>
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      <RenderGenerationModal />
      <AIAnalysisModal />
      <ManualTraceModal />
    </div>
  )
}
