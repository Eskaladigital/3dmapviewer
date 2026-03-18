import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

const DATA_DIR = path.join(process.cwd(), 'floorcraft-data')
const PROJECTS_DIR = path.join(DATA_DIR, 'projects')

if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true })
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))
  return {
  server: { port: 3000 },
  plugins: [
    react(),
    {
      name: 'floorcraft-api',
      configureServer(server) {
        server.middlewares.use('/api', (req, res, next) => {
          res.setHeader('Content-Type', 'application/json')
          const url = req.url || ''

          // GET /api/projects — list all
          if (url === '/projects' || url === '/projects/') {
            if (req.method !== 'GET') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            try {
              const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'))
              const index = files.map((f) => {
                const raw = fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8')
                const data = JSON.parse(raw)
                return {
                  id: data.project?.id || f.replace('.json', ''),
                  name: data.project?.name || 'Sin nombre',
                  savedAt: data.savedAt || new Date().toISOString(),
                }
              })
              res.end(JSON.stringify(index))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: String(e) }))
            }
            return
          }

          // GET /api/projects/:id — load one
          const getMatch = url.match(/^\/projects\/([^/]+)$/)
          if (getMatch && req.method === 'GET') {
            const id = getMatch[1]
            const file = path.join(PROJECTS_DIR, `${id}.json`)
            if (fs.existsSync(file)) {
              res.end(fs.readFileSync(file, 'utf8'))
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Not found' }))
            }
            return
          }

          // DELETE /api/projects/:id
          if (getMatch && req.method === 'DELETE') {
            const id = getMatch[1]
            const file = path.join(PROJECTS_DIR, `${id}.json`)
            if (fs.existsSync(file)) {
              fs.unlinkSync(file)
              res.end(JSON.stringify({ ok: true }))
            } else {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Not found' }))
            }
            return
          }

          // POST /api/analyze-floor-plan — GPT-4 Vision analiza plano y detecta elementos
          if (url === '/analyze-floor-plan' || url === '/analyze-floor-plan/') {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const apiKey = process.env.OPENAI_API_KEY
            if (!apiKey) {
              res.statusCode = 503
              res.end(JSON.stringify({ error: 'OPENAI_API_KEY no configurada' }))
              return
            }
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', async () => {
              try {
                const { image, imageWidth, imageHeight } = JSON.parse(body)
                if (!image || typeof image !== 'string') {
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Falta la imagen (base64 o data URL)' }))
                  return
                }
                const base64 = image.replace(/^data:image\/\w+;base64,/, '')
                const mime = image.match(/^data:(image\/\w+);/)?.[1] || 'image/png'
                const wallsOnlyPrompt = `TAREA ÚNICA: Extraer CADA segmento de pared del plano como líneas en píxeles.
Eres un trazador CAD. Tu ÚNICO trabajo: mirar la imagen y listar TODAS las líneas que representan paredes. Cada línea = un segmento recto entre dos esquinas.
REGLAS: Coordenadas en píxeles. Origen (0,0) arriba-izquierda. X→derecha, Y→abajo. Cada pared visible = una entrada en walls[]. No simplifiques. No uses un solo rectángulo. Perímetro exterior: cada tramo del contorno. Tabiques interiores: CADA pared que separa habitaciones. Plano con 4+ habitaciones = mínimo 15-25 segmentos. Valores con decimales.
Responde SOLO JSON: {"imageWidth":n,"imageHeight":n,"walls":[{"start":{"x":n,"y":n},"end":{"x":n,"y":n}},...]}`
                const restPrompt = `Extrae muebles, puertas/ventanas, habitaciones y referencia. Coordenadas en píxeles. Formato JSON: {"furniture":[...],"openings":[...],"rooms":[...],"referenceSuggestion":{...}}. wallIndex=índice de pared. Arrays vacíos [] si no hay.`
                async function callOpenAI(promptText: string, parseWalls: boolean) {
                  const r = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({
                      model: 'gpt-4o',
                      messages: [{ role: 'user', content: [{ type: 'text', text: promptText }, { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' } }] }],
                      max_tokens: parseWalls ? 8192 : 4096,
                      response_format: { type: 'json_object' },
                    }),
                  })
                  const d = await r.json()
                  if (!r.ok) throw new Error(d.error?.message || 'Error OpenAI')
                  const raw = d.choices?.[0]?.message?.content?.trim() || '{}'
                  const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
                  const m = cleaned.match(/\{[\s\S]*\}/)
                  return JSON.parse(m ? m[0] : cleaned)
                }
                let wallsResult: Record<string, unknown>
                let restResult: Record<string, unknown>
                try {
                  wallsResult = await callOpenAI(wallsOnlyPrompt, true)
                  restResult = await callOpenAI(restPrompt, false)
                } catch (e) {
                  throw e
                }
                const parsed: Record<string, unknown> = {
                  imageWidth: wallsResult.imageWidth || imageWidth,
                  imageHeight: wallsResult.imageHeight || imageHeight,
                  walls: wallsResult.walls || [],
                  furniture: restResult.furniture || [],
                  openings: restResult.openings || [],
                  rooms: restResult.rooms || [],
                  referenceSuggestion: restResult.referenceSuggestion || null,
                }
                if (imageWidth && imageHeight) {
                  parsed.imageWidth = parsed.imageWidth || imageWidth
                  parsed.imageHeight = parsed.imageHeight || imageHeight
                }
                parsed.walls = parsed.walls || []
                parsed.furniture = parsed.furniture || []
                parsed.openings = parsed.openings || []
                parsed.rooms = parsed.rooms || []
                if (!parsed.referenceSuggestion || !(parsed.referenceSuggestion as Record<string, unknown>).widthPx) {
                  if (parsed.furniture?.length > 0) {
                    const f = (parsed.furniture as Array<Record<string, unknown>>)[0]
                    parsed.referenceSuggestion = { type: f.type, label: f.label, room: f.room, widthPx: f.widthPx, heightPx: f.heightPx }
                  } else if (parsed.walls?.length > 0) {
                    const walls = parsed.walls as Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>
                    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                    walls.forEach((w) => {
                      minX = Math.min(minX, w.start.x, w.end.x)
                      minY = Math.min(minY, w.start.y, w.end.y)
                      maxX = Math.max(maxX, w.start.x, w.end.x)
                      maxY = Math.max(maxY, w.start.y, w.end.y)
                    })
                    const w = maxX - minX || 100
                    const h = maxY - minY || 100
                    parsed.referenceSuggestion = { type: 'plano', label: 'Ancho total del plano', room: 'General', widthPx: w, heightPx: h }
                  }
                }
                res.end(JSON.stringify(parsed))
              } catch (e) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
            return
          }

          // POST /api/analyze-scene-image — GPT-4 Vision describe el espacio para reproducirlo en DALL·E
          if (url === '/analyze-scene-image' || url === '/analyze-scene-image/') {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const apiKey = process.env.OPENAI_API_KEY
            if (!apiKey) {
              res.statusCode = 503
              res.end(JSON.stringify({ error: 'OPENAI_API_KEY no configurada' }))
              return
            }
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', async () => {
              try {
                const { image } = JSON.parse(body)
                if (!image || typeof image !== 'string') {
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Falta la imagen (base64 o data URL)' }))
                  return
                }
                const base64 = image.replace(/^data:image\/\w+;base64,/, '')
                const mime = image.match(/^data:(image\/\w+);/)?.[1] || 'image/png'
                const prompt = `Esta imagen es una captura 3D de un proyecto de planificación de viviendas. Objetivo: RENDER HIPERREALISTA tipo estudio de arquitectura (3DS Max + V-Ray) con texturas ultra realistas y UBICACIÓN EXACTA de cada elemento.

CRÍTICO: La precisión espacial es lo más importante. Describe la posición de cada objeto como si dibujaras un plano desde el punto de vista del observador.

ESTRUCTURA OBLIGATORIA (sigue este orden):

1. PUNTO DE VISTA: Desde qué esquina o ángulo se ve la habitación (ej: esquina izquierda mirando hacia la derecha y al fondo).

2. LADO IZQUIERDO DE LA IMAGEN: Lista todo lo que está a la izquierda (pared, ventanas, muebles) con su posición exacta (ej: "sofá largo pegado a la pared izquierda, debajo de dos ventanas").

3. LADO DERECHO DE LA IMAGEN: Lista todo lo que está a la derecha (ej: "estantería de madera oscura en la esquina derecha, televisor negro sobre mueble bajo a la izquierda de la estantería").

4. CENTRO / FONDO: Lo que está en el centro y al fondo (ventana grande, mesa de centro sobre alfombra amarilla, etc.).

5. SUELO, TECHO, ILUMINACIÓN: Colores y elementos (ventilador de techo, luces).

Para cada mueble indica: posición relativa ("a la izquierda de", "junto a", "pegado a la pared X"), color, material. La ubicación debe ser tan precisa que alguien pueda colocar cada objeto en el mismo sitio.

Escribe en español. Sé exhaustivo. La descripción debe permitir reproducir el espacio con la misma disposición exacta.`
                const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [
                      {
                        role: 'user',
                        content: [
                          { type: 'text', text: prompt },
                          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
                        ],
                      },
                    ],
                    max_tokens: 4096,
                  }),
                })
                const data = await openaiRes.json()
                if (!openaiRes.ok) {
                  res.statusCode = openaiRes.status
                  res.end(JSON.stringify({ error: data.error?.message || 'Error OpenAI' }))
                  return
                }
                const description = data.choices?.[0]?.message?.content?.trim() || ''
                res.end(JSON.stringify({ description }))
              } catch (e) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
            return
          }

          // POST /api/generate-image-edit — OpenAI GPT Image Edit (imagen directa, preserva layout)
          if (url === '/generate-image-edit' || url === '/generate-image-edit/') {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const apiKey = process.env.OPENAI_API_KEY
            if (!apiKey) {
              res.statusCode = 503
              res.end(JSON.stringify({ error: 'OPENAI_API_KEY no configurada' }))
              return
            }
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', async () => {
              try {
                const { image, prompt } = JSON.parse(body)
                if (!image || typeof image !== 'string') {
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Falta la imagen' }))
                  return
                }
                const editPrompt = prompt || 'Convert this 3D interior render into a hyperrealistic photograph. Style: professional architecture studio render with Autodesk 3DS Max and V-Ray—ultra-realistic material textures, physical lighting, soft shadows, reflections, photorealistic finishes. Preserve the exact layout, furniture positions, and spatial arrangement.'
                const editRes = await fetch('https://api.openai.com/v1/images/edits', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: 'gpt-image-1.5',
                    images: [{ image_url: image }],
                    prompt: editPrompt,
                    input_fidelity: 'high',
                    n: 1,
                    size: '1536x1024',
                    quality: 'high',
                  }),
                })
                const data = await editRes.json()
                if (!editRes.ok) {
                  res.statusCode = editRes.status
                  res.end(JSON.stringify({ error: data.error?.message || 'Error OpenAI' }))
                  return
                }
                const b64 = data.data?.[0]?.b64_json
                const img = b64 ? `data:image/png;base64,${b64}` : null
                res.end(JSON.stringify({ images: img ? [img] : [], image: img }))
              } catch (e) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
            return
          }

          // POST /api/generate-image — OpenAI DALL·E 3 (proxy, clave en servidor)
          if (url === '/generate-image' || url === '/generate-image/') {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            const apiKey = process.env.OPENAI_API_KEY
            if (!apiKey) {
              res.statusCode = 503
              res.end(JSON.stringify({ error: 'OPENAI_API_KEY no configurada. Crea .env.local con OPENAI_API_KEY=sk-...' }))
              return
            }
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', async () => {
              try {
                const { prompt, count = 1 } = JSON.parse(body)
                if (!prompt || typeof prompt !== 'string') {
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Falta el prompt' }))
                  return
                }
                const num = Math.min(6, Math.max(1, parseInt(String(count), 10) || 1))
                const requests = Array.from({ length: num }, () =>
                  fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${apiKey}`,
                    },
                    body: JSON.stringify({
                      model: 'dall-e-3',
                      prompt,
                      n: 1,
                      size: '1792x1024',
                      quality: 'hd',
                      style: 'vivid',
                      response_format: 'b64_json',
                    }),
                  })
                )
                const results = await Promise.all(requests)
                const images: string[] = []
                for (const r of results) {
                  const data = await r.json()
                  if (!r.ok) throw new Error(data.error?.message || 'Error OpenAI')
                  const b64 = data.data?.[0]?.b64_json
                  if (b64) images.push(`data:image/png;base64,${b64}`)
                }
                res.end(JSON.stringify({ images, image: images[0] }))
              } catch (e) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
            return
          }

          // POST /api/projects/save
          if (url === '/projects/save' || url === '/projects/save/') {
            if (req.method !== 'POST') {
              res.statusCode = 405
              res.end(JSON.stringify({ error: 'Method not allowed' }))
              return
            }
            let body = ''
            req.on('data', (chunk) => { body += chunk })
            req.on('end', () => {
              try {
                const data = JSON.parse(body)
                const id = data.project?.id
                if (!id) {
                  res.statusCode = 400
                  res.end(JSON.stringify({ error: 'Missing project id' }))
                  return
                }
                const toSave = { ...data, savedAt: new Date().toISOString() }
                const file = path.join(PROJECTS_DIR, `${id}.json`)
                fs.writeFileSync(file, JSON.stringify(toSave, null, 2), 'utf8')
                res.end(JSON.stringify({ ok: true }))
              } catch (e) {
                res.statusCode = 500
                res.end(JSON.stringify({ error: String(e) }))
              }
            })
            return
          }

          res.statusCode = 404
          res.end(JSON.stringify({ error: 'Not found' }))
        })
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}})
