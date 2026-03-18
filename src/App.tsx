import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'

const MOBILE_BREAKPOINT = 768

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = () => setIsMobile(mq.matches)
    handler()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}
import { jsPDF } from 'jspdf'
import { Plus, Save, FolderOpen, Download, Image as ImageIcon, Sun, Moon, Map, Settings, Box, Undo2, Redo2, MoreHorizontal, Pencil } from 'lucide-react'
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

function HeaderBar({ onToast, editor2dCanvasRef, compact }: { onToast: (msg: string, type?: 'success' | 'info') => void; editor2dCanvasRef: React.RefObject<HTMLCanvasElement | null>; compact?: boolean }) {
  const store = useStore()
  const theme = useStore((s) => s.theme)
  const t = THEMES[theme]
  const projectName = useStore((s) => s.project.name)
  const hasUnsavedChanges = useStore((s) => s.dirty)
  const [showLoad, setShowLoad] = useState(false)
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showExportPlano, setShowExportPlano] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
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
      if ((e.target as HTMLElement).closest?.('[data-mobile-menu]') === null) setShowMobileMenu(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showLoad, showExportPlano, showNewMenu, showMobileMenu])

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
      theme: s.theme,
      globalWallColor: s.globalWallColor,
      globalFloorMaterial: s.globalFloorMaterial,
      globalFloorColor: s.globalFloorColor,
      sceneMaterials: s.sceneMaterials,
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

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string)
          if (store.loadProjectFromFile(data)) {
            onToast('Proyecto importado correctamente', 'info')
            setShowLoad(false)
            setShowMobileMenu(false)
          } else {
            onToast('Archivo no válido (falta project)', 'info')
          }
        } catch {
          onToast('Error al leer el archivo JSON', 'info')
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }, [store, onToast])

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
    <div style={{ ...h.bar, ...(compact ? { padding: '0 10px', height: 40, minHeight: 40 } : {}) }}>
      <div style={{ ...h.left, ...(compact ? { minWidth: 0 } : {}) }}>
        <div style={{ ...h.logo, ...(compact ? { fontSize: 14 } : {}) }}>
          <span style={{ color: t.accent }}>Floor</span>
          <span style={{ color: t.textSecondary }}>Craft</span>
        </div>

        {!compact && <div style={{ ...h.divider, background: t.border }} />}

        {compact ? (
          <span style={{ ...h.projectName, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }} title={projectName}>
            {projectName}
            {hasUnsavedChanges && <span style={{ marginLeft: 2, color: t.accent }}>*</span>}
          </span>
        ) : isEditingName ? (
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

      <div style={{ ...h.actions, ...(compact ? { gap: 4 } : {}) }}>
        {compact && (
          <>
            <button style={{ ...btnSmStyle, opacity: store.canUndo() ? 1 : 0.3 }} onClick={() => { store.undo(); forceRender(n => n + 1) }} disabled={!store.canUndo()} title="Deshacer"><Undo2 size={16} /></button>
            <button style={{ ...btnSmStyle, opacity: store.canRedo() ? 1 : 0.3 }} onClick={() => { store.redo(); forceRender(n => n + 1) }} disabled={!store.canRedo()} title="Rehacer"><Redo2 size={16} /></button>
            <button style={{ ...btnStyle, padding: '5px 10px' }} onClick={handleSave} title="Guardar"><Save size={16} /></button>
            <div style={{ position: 'relative' }} data-mobile-menu="true">
              <button style={{ ...btnStyle, padding: '5px 10px' }} onClick={() => { setShowMobileMenu(v => !v); if (!showMobileMenu) handleOpenLoad() }} title="Más"><MoreHorizontal size={16} /></button>
              {showMobileMenu && (
                <div ref={loadMenuRef} style={{ ...h.dropdown, right: 0, width: 240, maxHeight: '70vh' }}>
                  <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.border}` }} onClick={() => { handleNew(); setShowMobileMenu(false) }}><span style={{ color: t.text }}>Nuevo vacío</span></div>
                  <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.borderLight}` }} onClick={() => { handleImport(); setShowMobileMenu(false) }}><span style={{ color: t.accent, fontWeight: 600 }}>📥 Importar desde archivo</span></div>
                  <div style={{ ...h.dropdownHeader, color: t.textMuted }}>Cargar proyecto</div>
                  {savedList.length === 0 ? (
                    <div style={{ ...h.dropdownEmpty, color: t.textMuted }}>No hay proyectos guardados</div>
                  ) : (
                    savedList.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).map((p) => (
                      <div key={p.id} style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.borderLight}` }} onClick={() => { handleLoad(p.id); setShowMobileMenu(false) }}>
                        <div style={h.dropdownItemInfo}>
                          <span style={{ ...h.dropdownItemName, color: t.text }}>{p.name}</span>
                          <span style={{ ...h.dropdownItemDate, color: t.textMuted }}>{new Date(p.savedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                        </div>
                      </div>
                    ))
                  )}
                  <div style={{ ...h.dropdownHeader, color: t.textMuted, marginTop: 8 }}>Exportar</div>
                  <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.borderLight}` }} onClick={() => { handleExport(); setShowMobileMenu(false) }}><span style={{ color: t.text }}>Exportar JSON</span></div>
                  <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.borderLight}` }} onClick={() => { handleExportPlano('png'); setShowMobileMenu(false) }}><span style={{ color: t.text }}>Plano PNG</span></div>
                  <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.borderLight}` }} onClick={() => { handleExportPlano('pdf'); setShowMobileMenu(false) }}><span style={{ color: t.text }}>Plano PDF</span></div>
                  <div style={h.dropdownItem} onClick={() => { store.toggleTheme(); setShowMobileMenu(false) }}><span style={{ color: t.text }}>{theme === 'dark' ? '☀️ Claro' : '🌙 Oscuro'}</span></div>
                </div>
              )}
            </div>
          </>
        )}
        {!compact && (
        <>
        <button
          style={{ ...btnSmStyle, opacity: store.canUndo() ? 1 : 0.3 }}
          onClick={() => { store.undo(); forceRender(n => n + 1) }}
          disabled={!store.canUndo()}
          title="Deshacer (Ctrl+Z)"
        ><Undo2 size={16} /></button>
        <button
          style={{ ...btnSmStyle, opacity: store.canRedo() ? 1 : 0.3 }}
          onClick={() => { store.redo(); forceRender(n => n + 1) }}
          disabled={!store.canRedo()}
          title="Rehacer (Ctrl+Shift+Z)"
        ><Redo2 size={16} /></button>

        <div style={{ ...h.divider, background: t.border }} />

        <div style={{ position: 'relative' }}>
          <button
            style={btnStyle}
            onClick={() => setShowNewMenu((v) => !v)}
            title="Nuevo proyecto o plantilla"
          >
            <span style={{...h.btnIcon, display: 'flex', alignItems: 'center'}}><Plus size={16} /></span> Nuevo
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
          <span style={{...h.btnIcon, display: 'flex', alignItems: 'center'}}><Save size={16} /></span> Guardar
        </button>

        <div style={{ position: 'relative' }}>
          <button style={btnStyle} onClick={handleOpenLoad} title="Cargar proyecto guardado">
            <span style={{...h.btnIcon, display: 'flex', alignItems: 'center'}}><FolderOpen size={16} /></span> Cargar
          </button>

          {showLoad && (
            <div ref={loadMenuRef} style={ddStyle}>
              <div style={{ ...h.dropdownItem, borderBottom: `1px solid ${t.border}`, background: t.accentBg || 'transparent' }} onClick={() => { handleImport(); setShowLoad(false) }}>
                <span style={{ color: t.accent, fontWeight: 600 }}>📥 Importar desde archivo</span>
              </div>
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
          <span style={{...h.btnIcon, display: 'flex', alignItems: 'center'}}><Download size={16} /></span> Exportar
        </button>

        <div style={{ position: 'relative' }}>
          <button
            style={btnStyle}
            onClick={() => setShowExportPlano((v) => !v)}
            title="Exportar plano 2D"
          >
            <span style={{...h.btnIcon, display: 'flex', alignItems: 'center'}}><ImageIcon size={16} /></span> Plano
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
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</span>
          <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
        </button>
        </>
        )}
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
      background: t.bgPanel + 'cc',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
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

type MobileTab = '2d' | 'panel' | '3d'

function MobileTabBar({ active, onSelect, t }: { active: MobileTab; onSelect: (tab: MobileTab) => void; t: ThemeColors }) {
  const tabs: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
    { id: '2d', label: 'Plano', icon: <Map size={20} /> },
    { id: 'panel', label: 'Panel', icon: <Settings size={20} /> },
    { id: '3d', label: '3D', icon: <Box size={20} /> },
  ]
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'space-around',
      background: t.bgPanel + 'ee',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: `1px solid ${t.border}`,
      paddingBottom: 'max(8px, env(safe-area-inset-bottom))',
      paddingTop: 8,
      flexShrink: 0,
    }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '8px 4px',
            background: 'none',
            border: 'none',
            color: active === tab.id ? t.accent : t.textMuted,
            fontSize: 11,
            fontWeight: active === tab.id ? 600 : 400,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 20 }}>{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default function App() {
  const theme = useStore((s) => s.theme)
  const t = THEMES[theme]
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<MobileTab>('2d')
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

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100dvh',
        overflow: 'hidden',
        background: t.bg,
        transition: 'background 0.3s',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <HeaderBar onToast={showToast} editor2dCanvasRef={editor2dCanvasRef} compact />
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mobileTab === '2d' && (
            <div style={{ flex: 1, minHeight: 0, background: t.bgPanel }}>
              <FloorPlanEditor canvasRef={editor2dCanvasRef} />
            </div>
          )}
          {mobileTab === 'panel' && (
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <ConfigPanel />
            </div>
          )}
          {mobileTab === '3d' && (
            <div style={{ flex: 1, minHeight: 0, background: theme === 'dark' ? '#0a0b10' : '#e8eaed' }}>
              <Viewer3D />
            </div>
          )}
        </div>
        <MobileTabBar active={mobileTab} onSelect={setMobileTab} t={t} />
        <Toast message={toast.message} type={toast.type} visible={toast.visible} />
        <RenderGenerationModal />
        <AIAnalysisModal />
        <ManualTraceModal />
      </div>
    )
  }

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
