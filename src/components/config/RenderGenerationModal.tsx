import React, { useState, useMemo } from 'react'
import { useStore } from '@/store/useStore'
import { THEMES } from '@/types'

const DESIGN_STYLES = [
  'Minimalista', 'Escandinavo', 'Industrial', 'Bohemio', 'Clásico', 'Moderno',
  'Rústico', 'Contemporáneo', 'Mid-century', 'Japónés', 'Tropical', 'Lujo',
]

const FURNITURE_STYLES = [
  'Moderno y funcional', 'Clásico y elegante', 'Vintage', 'Industrial',
  'Natural/madera', 'Lujo premium', 'Compacto urbano', 'Espacioso',
]

const COLOR_PALETTES = [
  'Neutros (blanco, gris, beige)', 'Tierra (marrones, terracota)', 'Azul y blanco',
  'Verde naturaleza', 'Negro y dorado', 'Pasteles suaves', 'Colores vivos',
]

const TIME_OPTIONS = [
  'Amanecer (6-8h)', 'Mañana (9-11h)', 'Mediodía (12-14h)', 'Tarde (15-17h)',
  'Atardecer (18-20h)', 'Noche (21-23h)', 'Luz artificial cálida', 'Luz natural difusa',
]

const ATMOSPHERE = [
  'Acogedor y cálido', 'Luminoso y aireado', 'Íntimo', 'Espacioso',
  'Tranquilo', 'Energético', 'Romántico', 'Profesional',
]

const LIGHTING = [
  'Luz natural predominante', 'Luz artificial suave', 'Combinación natural/artificial',
  'Iluminación dramática', 'Luz difusa', 'Puntos de luz focal',
]

const MATERIALS = [
  'Madera natural', 'Mármol y piedra', 'Metal y cristal', 'Textiles suaves',
  'Concreto pulido', 'Madera oscura', 'Blanco y cristal', 'Materiales mixtos',
]

const RENDER_QUALITY_PREAMBLE = `Fotografía arquitectónica hiperrealista basada estrictamente en la imagen de referencia. Mantener EXACTAMENTE la misma composición, distribución del espacio, proporciones, arquitectura y posición de todos los elementos y muebles. No añadir, eliminar ni mover ningún objeto. No modificar la estructura ni la geometría del espacio.

Mejorar únicamente materiales, texturas e iluminación para lograr calidad fotográfica real. Texturas ultra detalladas y físicamente precisas (madera con veta real, tejidos con trama visible, piedra con microimperfecciones, metal con reflejos naturales).

Fotografía tomada con cámara full-frame profesional, lente 24mm, f/8, ISO 100. Balance de blancos neutro, ligera profundidad de campo realista. Estilo editorial de revista de arquitectura de alta gama.

Sin apariencia CGI. Sin efecto render. Sin reinterpretación del diseño. Sin alterar composición. Sin cambiar perspectiva. Solo mejora de realismo fotográfico.`

const PROMPT_VARIATIONS = [
  'Con un enfoque más acogedor y cálido.',
  'Con un enfoque más luminoso y aireado.',
  'Con un enfoque más minimalista y limpio.',
  'Con un enfoque más elegante y sofisticado.',
  'Con un enfoque más natural y orgánico.',
  'Con un enfoque más moderno y dinámico.',
]

function buildStyleRules(opts: Record<string, string>): string[] {
  // opts.extra se maneja aparte en un bloque de prioridad máxima
  return [
    opts.designStyle && `Estilo de diseño: ${opts.designStyle}`,
    opts.furniture && `Mobiliario: ${opts.furniture}`,
    opts.colors && `Paleta de colores: ${opts.colors}`,
    opts.timeOfDay && `Hora del día / iluminación temporal: ${opts.timeOfDay}`,
    opts.atmosphere && `Atmósfera: ${opts.atmosphere}`,
    opts.lighting && `Tipo de iluminación: ${opts.lighting}`,
    opts.materials && `Materiales predominantes: ${opts.materials}`,
  ].filter(Boolean) as string[]
}

function buildPrompt(opts: Record<string, string>, variationIndex?: number, sceneDescription?: string): string {
  const styleRules = buildStyleRules(opts)
  const priorityBlock = opts.extra?.trim()
    ? `\n\n# ⚠️ PRIORIDAD MÁXIMA — CONDICIONA TODO\nLo que el usuario escribe aquí tiene prioridad absoluta sobre cualquier otra opción. Aplicar primero y por encima de todo:\n«${opts.extra.trim()}»`
    : ''
  const styleSection = styleRules.length > 0
    ? `${priorityBlock}\n\n# REGLAS DE ESTILO\n${styleRules.map((r) => `- ${r}`).join('\n')}`
    : priorityBlock

  if (sceneDescription) {
    return `Genera una imagen de ESTE ESPACIO EXACTO. ${RENDER_QUALITY_PREAMBLE}

ESPACIO A REPRODUCIR (respeta la posición exacta: izquierda, derecha, centro, fondo):
${sceneDescription}

REGLAS ABSOLUTAS — NO VIOLAR NINGUNA:
1. MISMO NÚMERO EXACTO de muebles — cuenta cada elemento descrito y reproduce exactamente esa cantidad. NO añadas sillas, mesas, lámparas ni ningún objeto extra.
2. MISMAS POSICIONES EXACTAS — cada mueble debe estar en su ubicación exacta. Lo de la izquierda a la izquierda, lo de la derecha a la derecha.
3. MISMA FORMA DE HABITACIÓN — paredes, puertas, ventanas idénticas en posición, tamaño y cantidad.
4. NO INVENTES — si algo no está en la descripción, NO lo añadas. Nada de decoraciones extra, muebles extra ni elementos duplicados.
5. NO DUPLIQUES — si hay 1 sofá, renderiza exactamente 1. Si hay 4 sillas, exactamente 4. Nunca más de los que se describen.${styleSection}${variationIndex !== undefined ? '\n\n' + PROMPT_VARIATIONS[variationIndex % PROMPT_VARIATIONS.length] : ''}`
  }

  const variation = variationIndex !== undefined ? '\n\n' + PROMPT_VARIATIONS[variationIndex % PROMPT_VARIATIONS.length] : ''
  return `Genera una imagen para este espacio interior. ${RENDER_QUALITY_PREAMBLE}${styleSection}${variation}`
}

export default function RenderGenerationModal() {
  const store = useStore()
  const theme = useStore((s) => s.theme)
  const open = useStore((s) => s.renderGenerationModalOpen)
  const lastImage = useStore((s) => s.lastCapturedImage)
  const setRenderGenerationModalOpen = useStore((s) => s.setRenderGenerationModalOpen)
  const setLastCapturedImage = useStore((s) => s.setLastCapturedImage)

  const [opts, setOpts] = useState({
    designStyle: '',
    furniture: '',
    colors: '',
    timeOfDay: '',
    atmosphere: '',
    lighting: '',
    materials: '',
    extra: '',
  })
  const [copied, setCopied] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [imageCount, setImageCount] = useState<2 | 4 | 6>(2)
  const [generating, setGenerating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState<number>(0)
  const [analyzingScene, setAnalyzingScene] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [lastAnalyzedPrompt, setLastAnalyzedPrompt] = useState<string | null>(null)
  const [method, setMethod] = useState<'direct' | 'dalle'>('direct')

  const c = THEMES[theme]
  const prompt = useMemo(() => buildPrompt(opts), [opts])

  const handleClose = () => {
    setRenderGenerationModalOpen(false)
    setLastCapturedImage(null)
    setGeneratedImages([])
    setApiError(null)
    setLastAnalyzedPrompt(null)
  }

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadImage = () => {
    if (!lastImage) return
    const a = document.createElement('a')
    a.href = lastImage
    a.download = `floorcraft-render-${Date.now()}.png`
    a.click()
  }

  const handleGenerateWithDalle = async () => {
    setGenerating(true)
    setApiError(null)
    setGeneratingProgress(0)
    setLastAnalyzedPrompt(null)
    const images: string[] = []
    let sceneDescription = ''
    try {
      // Método IMAGEN DIRECTA: envía la imagen a GPT Image Edit (preserva layout)
      if (method === 'direct' && lastImage) {
        const baseDirectives = [
          opts.designStyle && `Design style: ${opts.designStyle}.`,
          opts.furniture && `Furniture style: ${opts.furniture}.`,
          opts.colors && `COLOR PALETTE (apply strongly to walls, textiles, furniture, decor): ${opts.colors}.`,
          opts.atmosphere && `Atmosphere: ${opts.atmosphere}.`,
          opts.timeOfDay && `Time of day / lighting: ${opts.timeOfDay}.`,
          opts.lighting && `Lighting type: ${opts.lighting}.`,
          opts.materials && `Predominant materials and finishes: ${opts.materials}.`,
        ].filter(Boolean)
        const styleDirectives = opts.extra?.trim()
          ? `CRITICAL — HIGHEST PRIORITY (override all other options): ${opts.extra.trim()}. ${baseDirectives.join(' ')}`
          : baseDirectives.join(' ')
        const editPrompt = `Transform this 3D interior render into a hyperrealistic architectural photograph (Autodesk 3DS Max + V-Ray quality: ultra-realistic textures, physical lighting, soft shadows, reflections, photorealistic finishes).

ABSOLUTE RULES — VIOLATING ANY OF THESE RUINS THE IMAGE:
1. EXACT SAME NUMBER of furniture pieces — count every item in the original and reproduce exactly that count. Do NOT add extra chairs, tables, lamps, or any object that is not in the original.
2. EXACT SAME POSITIONS — every piece of furniture must stay in its exact location. Left stays left, right stays right. Do NOT move anything.
3. EXACT SAME ROOM SHAPE — walls, doors, windows must remain identical in position, size and count.
4. DO NOT INVENT — if something is not visible in the original image, do NOT add it. No extra decorations, no extra furniture, no duplicated items.
5. DO NOT DUPLICATE — if there is 1 sofa, render exactly 1 sofa. If there are 4 chairs, render exactly 4 chairs. Never 2 sofas or 6 chairs.

WHAT YOU CAN CHANGE (style only): ${styleDirectives || 'Upgrade to professional modern interior.'} Apply these style changes ONLY to colors, materials, textures, finishes, and lighting. The spatial layout and furniture count must remain IDENTICAL to the source image.`.trim()
        setLastAnalyzedPrompt(editPrompt)
        for (let i = 0; i < imageCount; i++) {
          setGeneratingProgress(i + 1)
          const res = await fetch('/api/generate-image-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: lastImage, prompt: editPrompt }),
          })
          const data = await res.json()
          if (!res.ok) {
            setApiError(data.error || 'Error al generar (¿tienes acceso a GPT Image?)')
            return
          }
          const img = data.images?.[0] || data.image
          if (img) images.push(img)
          setGeneratedImages([...images])
        }
        return
      }

      // Método DALL·E: analizar con Vision + generar con DALL·E
      if (lastImage) {
        setAnalyzingScene(true)
        const analyzeRes = await fetch('/api/analyze-scene-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: lastImage }),
        })
        const analyzeData = await analyzeRes.json()
        setAnalyzingScene(false)
        if (!analyzeRes.ok) {
          setApiError(analyzeData.error || 'Error al analizar la imagen')
          return
        }
        sceneDescription = analyzeData.description || ''
      }

      for (let i = 0; i < imageCount; i++) {
        setGeneratingProgress(i + 1)
        const promptWithVariation = buildPrompt(opts, i, sceneDescription || undefined)
        if (i === 0) setLastAnalyzedPrompt(promptWithVariation)
        const res = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptWithVariation, count: 1 }),
        })
        const data = await res.json()
        if (!res.ok) {
          setApiError(data.error || 'Error al generar')
          return
        }
        const img = data.images?.[0] || data.image
        if (img) images.push(img)
        setGeneratedImages([...images])
      }
    } catch (e) {
      setApiError(String(e))
      setAnalyzingScene(false)
    } finally {
      setGenerating(false)
      setGeneratingProgress(0)
    }
  }

  const handleDownloadGenerated = (img: string, idx: number) => {
    if (!img) return
    const a = document.createElement('a')
    a.href = img
    a.download = `floorcraft-render-${idx + 1}-${Date.now()}.png`
    a.click()
  }

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        style={{
          background: theme === 'dark' ? '#181a24' : '#ffffff',
          borderRadius: 16,
          maxWidth: 720,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          border: theme === 'dark' ? '1px solid #2a2d42' : '1px solid #e0e4ec',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, fontSize: 18, color: c.text }}>🎨 Generar render con IA</h2>
          <button onClick={handleClose} style={{
            background: 'none', border: 'none', fontSize: 24, cursor: 'pointer',
            color: c.textMuted, padding: '0 8px', lineHeight: 1,
          }}>×</button>
        </div>

        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {lastImage ? (
            <>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ flex: '0 0 200px' }}>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 6 }}>Vista capturada</div>
                  <img src={lastImage} alt="Captura" style={{
                    width: '100%', borderRadius: 8, border: `1px solid ${c.border}`,
                  }} />
                  <button onClick={handleDownloadImage} style={{
                    width: '100%', marginTop: 8, padding: 8, fontSize: 12,
                    background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 6,
                    color: c.text, cursor: 'pointer',
                  }}>Descargar imagen</button>
                </div>
                {generatedImages.length > 0 && (
                  <div style={{ flex: '1 1 100%', minWidth: 280 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 12, color: c.textMuted }}>
                        Generadas por IA ({generatedImages.length} imágenes)
                      </span>
                      {generatedImages.length > 1 && (
                        <button
                          onClick={() => {
                            generatedImages.forEach((img, i) => {
                              setTimeout(() => handleDownloadGenerated(img, i), i * 200)
                            })
                          }}
                          style={{
                            padding: '4px 10px', fontSize: 11,
                            background: c.accent, color: '#fff', border: 'none',
                            borderRadius: 6, cursor: 'pointer',
                          }}
                        >
                          Descargar todas
                        </button>
                      )}
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(generatedImages.length, 3)}, 1fr)`,
                      gap: 12,
                    }}>
                      {generatedImages.map((img, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <img src={img} alt={`Render ${i + 1}`} style={{
                            width: '100%', maxWidth: 180, borderRadius: 8, border: `1px solid ${c.border}`,
                          }} />
                          <button
                            onClick={() => handleDownloadGenerated(img, i)}
                            style={{
                              marginTop: 6, padding: '6px 12px', fontSize: 11,
                              background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 6,
                              color: c.text, cursor: 'pointer', width: '100%',
                            }}
                          >
                            Descargar {generatedImages.length > 1 ? i + 1 : ''}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 8 }}>
                    {method === 'direct'
                      ? 'Imagen directa: la captura se envía al modelo (GPT Image Edit). Mejor para preservar el layout exacto.'
                      : 'DALL·E: GPT-4 Vision describe el espacio; DALL·E genera desde texto. Puede variar más.'}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 4 }}>Método</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['direct', 'dalle'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMethod(m)}
                          style={{
                            padding: '8px 14px', fontSize: 12,
                            background: method === m ? c.accent : c.bgCard,
                            color: method === m ? '#fff' : c.text,
                            border: `1px solid ${method === m ? c.accent : c.border}`,
                            borderRadius: 6, cursor: 'pointer',
                          }}
                        >
                          {m === 'direct' ? '🖼️ Imagen directa (recomendado)' : '📝 DALL·E (descripción)'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 8 }}>
                    Todos los parámetros son opcionales. Puedes generar sin seleccionar ninguno (se usan valores por defecto).
                  </div>
                  <SelectField label="Estilo de diseño (opcional)" options={DESIGN_STYLES} value={opts.designStyle} onChange={(v) => setOpts(o => ({ ...o, designStyle: v }))} c={c} />
                  <SelectField label="Mobiliario (opcional)" options={FURNITURE_STYLES} value={opts.furniture} onChange={(v) => setOpts(o => ({ ...o, furniture: v }))} c={c} />
                  <SelectField label="Colores (opcional)" options={COLOR_PALETTES} value={opts.colors} onChange={(v) => setOpts(o => ({ ...o, colors: v }))} c={c} />
                  <SelectField label="Hora del día (opcional)" options={TIME_OPTIONS} value={opts.timeOfDay} onChange={(v) => setOpts(o => ({ ...o, timeOfDay: v }))} c={c} />
                  <SelectField label="Atmósfera (opcional)" options={ATMOSPHERE} value={opts.atmosphere} onChange={(v) => setOpts(o => ({ ...o, atmosphere: v }))} c={c} />
                  <SelectField label="Iluminación (opcional)" options={LIGHTING} value={opts.lighting} onChange={(v) => setOpts(o => ({ ...o, lighting: v }))} c={c} />
                  <SelectField label="Materiales (opcional)" options={MATERIALS} value={opts.materials} onChange={(v) => setOpts(o => ({ ...o, materials: v }))} c={c} />

                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 4 }}>
                      Detalles adicionales — <strong style={{ color: c.accent }}>PRIORIDAD MÁXIMA</strong> (condiciona todo lo demás)
                    </label>
                    <textarea
                      value={opts.extra}
                      onChange={(e) => setOpts(o => ({ ...o, extra: e.target.value }))}
                      placeholder="Ej: plantas, cuadros, alfombra persa..."
                      style={{
                        width: '100%', minHeight: 60, padding: 10, fontSize: 13,
                        background: c.bgInput, border: `1px solid ${c.borderLight}`, borderRadius: 8,
                        color: c.text, fontFamily: 'inherit', resize: 'vertical',
                      }}
                    />
                  </div>
                </div>
              </div>

              {(generating || analyzingScene) && (
                <div style={{
                  padding: 16, background: theme === 'dark' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)',
                  borderRadius: 12, border: `1px solid ${c.accent}`, marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', background: c.accent,
                      animation: 'pulse 1.2s ease-in-out infinite',
                    }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>
                      {analyzingScene ? 'Paso 1: Analizando imagen con GPT-4 Vision...' : `Paso 2: Generando imagen ${generatingProgress} de ${imageCount}...`}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: c.textMuted, marginBottom: 8 }}>
                    {analyzingScene ? 'Puede tardar unos segundos.' : 'Cada imagen tarda ~30-60 s. No cierres la ventana.'}
                  </div>
                  <div style={{
                    height: 6, background: c.bgInput, borderRadius: 3, overflow: 'hidden',
                    width: '100%',
                  }}>
                    <div style={{
                      width: analyzingScene ? '50%' : `${50 + (generatingProgress / imageCount) * 50}%`,
                      height: '100%', background: c.accent, transition: 'width 0.4s ease',
                    }} />
                  </div>
                  {lastAnalyzedPrompt && !analyzingScene && (
                    <div style={{ marginTop: 12, fontSize: 12, color: c.textMuted, lineHeight: 1.5 }}>
                      Prompt enviado a DALL·E: <span style={{ color: c.text }}>{lastAnalyzedPrompt.slice(0, 120)}...</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, color: c.textMuted, marginBottom: 6 }}>Prompt generado</div>
                <div style={{
                  padding: 12, background: c.bgInput, borderRadius: 8, fontSize: 13,
                  color: c.text, fontFamily: '"JetBrains Mono", monospace',
                  border: `1px solid ${c.borderLight}`, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {prompt}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: c.textMuted }}>Nº imágenes:</span>
                    {([2, 4, 6] as const).map((n) => (
                      <button
                        key={n}
                        onClick={() => setImageCount(n)}
                        style={{
                          padding: '6px 12px', fontSize: 13,
                          background: imageCount === n ? c.accent : c.bgCard,
                          color: imageCount === n ? '#fff' : c.text,
                          border: `1px solid ${imageCount === n ? c.accent : c.border}`,
                          borderRadius: 6, cursor: 'pointer',
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      onClick={handleGenerateWithDalle}
                      disabled={generating || analyzingScene}
                      style={{
                        padding: '10px 16px', background: c.accent, color: '#fff', border: 'none',
                        borderRadius: 8, fontSize: 13, fontWeight: 500,                         cursor: generating || analyzingScene ? 'wait' : 'pointer',
                        opacity: generating || analyzingScene ? 0.7 : 1,
                      }}
                    >
                      {analyzingScene ? '🔍 Analizando imagen con GPT-4 Vision...' : generating ? `⏳ Generando ${generatingProgress}/${imageCount}...` : `✨ Generar ${imageCount} ${method === 'direct' ? '(imagen directa)' : 'con DALL·E'}`}
                    </button>
                    {(generating || analyzingScene) && (
                      <div style={{
                        height: 4, background: c.bgInput, borderRadius: 2, overflow: 'hidden',
                        width: 120, alignSelf: 'flex-start',
                      }}>
                        <div style={{
                          width: analyzingScene ? '100%' : `${(generatingProgress / imageCount) * 100}%`,
                          height: '100%', background: c.accent, transition: 'width 0.3s',
                        }} />
                      </div>
                    )}
                  </div>
                  <button onClick={handleCopyPrompt} style={{
                    padding: '10px 16px', background: c.bgCard, color: c.accent,
                    border: `1px solid ${c.accent}`, borderRadius: 8, fontSize: 13,
                    fontWeight: 500, cursor: 'pointer',
                  }}>
                    {copied ? '✓ Copiado' : '📋 Copiar prompt'}
                  </button>
                  <a
                    href="https://chat.openai.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '10px 16px', background: c.bgCard, color: c.accent,
                      border: `1px solid ${c.accent}`, borderRadius: 8, fontSize: 13,
                      fontWeight: 500, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    Abrir ChatGPT ↗
                  </a>
                </div>
                {apiError && (
                  <div style={{ marginTop: 8, padding: 10, background: 'rgba(239,91,91,0.15)', borderRadius: 8, fontSize: 13, color: '#ef5b5b' }}>
                    {apiError}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: 40, textAlign: 'center', color: c.textMuted }}>
              Capturando vista 3D...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SelectField({
  label,
  options,
  value,
  onChange,
  c,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
  c: { textMuted: string; bgInput: string; borderLight: string; text: string }
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 12, color: c.textMuted, display: 'block', marginBottom: 4 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '8px 10px', fontSize: 13,
          background: c.bgInput, border: `1px solid ${c.borderLight}`, borderRadius: 6,
          color: c.text, fontFamily: 'inherit',
        }}
      >
        <option value="">— Opcional (usar por defecto) —</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}
