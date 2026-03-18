const { app, BrowserWindow } = require('electron')
const path = require('path')
const fs = require('fs')
const express = require('express')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function getProjectsDir() {
  const base = app.isPackaged ? app.getPath('userData') : process.cwd()
  const dir = path.join(base, 'floorcraft-data', 'projects')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function createApiServer(PROJECTS_DIR) {
  const api = express()
  api.use(express.json({ limit: '50mb' }))

  api.get('/projects', (req, res) => {
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
      res.json(index)
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  api.get('/projects/:id', (req, res) => {
    const file = path.join(PROJECTS_DIR, `${req.params.id}.json`)
    if (fs.existsSync(file)) {
      res.send(fs.readFileSync(file, 'utf8'))
    } else {
      res.status(404).json({ error: 'Not found' })
    }
  })

  api.delete('/projects/:id', (req, res) => {
    const file = path.join(PROJECTS_DIR, `${req.params.id}.json`)
    if (fs.existsSync(file)) {
      fs.unlinkSync(file)
      res.json({ ok: true })
    } else {
      res.status(404).json({ error: 'Not found' })
    }
  })

  api.post('/projects/save', (req, res) => {
    try {
      const data = req.body
      const id = data.project?.id
      if (!id) return res.status(400).json({ error: 'Missing project id' })
      const toSave = { ...data, savedAt: new Date().toISOString() }
      const file = path.join(PROJECTS_DIR, `${id}.json`)
      fs.writeFileSync(file, JSON.stringify(toSave, null, 2), 'utf8')
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  api.post('/analyze-floor-plan', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY no configurada' })
    }
    try {
      const { image, imageWidth, imageHeight } = req.body
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Falta la imagen (base64 o data URL)' })
      }
      const base64 = image.replace(/^data:image\/\w+;base64,/, '')
      const mime = image.match(/^data:(image\/\w+);/)?.[1] || 'image/png'
      const wallsOnlyPrompt = `TAREA ÚNICA: Extraer CADA segmento de pared del plano como líneas en píxeles.

Eres un trazador CAD. Tu ÚNICO trabajo: mirar la imagen y listar TODAS las líneas que representan paredes. Cada línea = un segmento recto entre dos esquinas.

REGLAS:
- Coordenadas en píxeles. Origen (0,0) arriba-izquierda. X→derecha, Y→abajo.
- Cada pared visible = una entrada en walls[]. No simplifiques. No uses un solo rectángulo.
- Perímetro exterior: cada tramo del contorno (si es L, son varios segmentos; si es U, varios; si es irregular, muchos).
- Tabiques interiores: CADA pared que separa habitaciones.
- Cuenta las líneas en el plano. walls[] debe tener un número similar. Plano con 4+ habitaciones = mínimo 15-25 segmentos.
- Conecta esquinas exactas. Doble línea de pared → usa el eje central.
- Valores con decimales (ej: 142.3, 87.6).

Responde SOLO JSON válido, sin markdown:
{"imageWidth":n,"imageHeight":n,"walls":[{"start":{"x":n,"y":n},"end":{"x":n,"y":n}},...]}`

      const restPrompt = `Extrae muebles, puertas/ventanas, habitaciones y referencia de escala del plano. Las paredes ya están extraídas; no las incluyas.

Coordenadas en píxeles. Origen (0,0) arriba-izquierda.

Formato JSON exacto:
{
  "furniture": [{"type":"tipo","label":"nombre","room":"habitación","x":n,"y":n,"widthPx":n,"heightPx":n,"rotation":0}],
  "openings": [{"type":"door"|"window","subtype":"single|sliding|fixed|double","wallIndex":índice,"position":0.0_a_1.0,"widthPx":n,"heightPx":n}],
  "rooms": [{"name":"Salón","type":"living|bedroom|kitchen|bathroom|hallway|other","wallIndices":[0,1,2,3]}],
  "referenceSuggestion": {"type":"tipo","label":"nombre","room":"habitación","widthPx":n,"heightPx":n}
}

FURNITURE: Sofá, cama, mesa, silla, armario, nevera, bañera, inodoro, etc. x,y=centro. widthPx, heightPx=dimensiones.
OPENINGS: Puertas y ventanas. wallIndex=índice de pared (0-based). position=0-1 a lo largo.
ROOMS: Cada estancia. wallIndices=índices de paredes del perímetro.
REFERENCE_SUGGESTION: Elemento para escalar (sofá ~220cm, cama ~160cm, bañera ~170cm).

Responde SOLO JSON válido, sin markdown. Arrays vacíos [] si no hay.`

      async function callOpenAI(promptText, parseWalls = false) {
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
                  { type: 'text', text: promptText },
                  { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}`, detail: 'high' } },
                ],
              },
            ],
            max_tokens: parseWalls ? 8192 : 4096,
            response_format: { type: 'json_object' },
          }),
        })
        const data = await openaiRes.json()
        if (!openaiRes.ok) {
          throw new Error(data.error?.message || 'Error OpenAI')
        }
        const raw = data.choices?.[0]?.message?.content?.trim() || '{}'
        const cleaned = raw.replace(/```json\n?|\n?```/g, '').trim()
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
        const jsonStr = jsonMatch ? jsonMatch[0] : cleaned
        return JSON.parse(jsonStr)
      }

      let wallsResult
      let restResult
      try {
        wallsResult = await callOpenAI(wallsOnlyPrompt, true)
        restResult = await callOpenAI(restPrompt, false)
      } catch (parseErr) {
        const msg = String(parseErr)
        return res.status(500).json({
          error: msg.includes('JSON') ? msg : `Error en análisis: ${msg}`,
        })
      }

      const parsed = {
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
      if (!parsed.referenceSuggestion || !parsed.referenceSuggestion.widthPx) {
        if (parsed.furniture?.length > 0) {
          const f = parsed.furniture[0]
          parsed.referenceSuggestion = { type: f.type, label: f.label, room: f.room, widthPx: f.widthPx, heightPx: f.heightPx }
        } else if (parsed.walls?.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          parsed.walls.forEach((w) => {
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
      res.json(parsed)
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  api.post('/analyze-scene-image', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY no configurada' })
    }
    try {
      const { image } = req.body
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Falta la imagen (base64 o data URL)' })
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
        return res.status(openaiRes.status).json({ error: data.error?.message || 'Error OpenAI' })
      }
      const description = data.choices?.[0]?.message?.content?.trim() || ''
      res.json({ description })
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  api.post('/generate-image-edit', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY no configurada' })
    }
    try {
      const { image, prompt } = req.body
      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Falta la imagen' })
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
        return res.status(editRes.status).json({ error: data.error?.message || 'Error OpenAI' })
      }
      const b64 = data.data?.[0]?.b64_json
      const img = b64 ? `data:image/png;base64,${b64}` : null
      return res.json({ images: img ? [img] : [], image: img })
    } catch (e) {
      return res.status(500).json({ error: String(e) })
    }
  })

  api.post('/generate-image', async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(503).json({ error: 'OPENAI_API_KEY no configurada' })
    }
    try {
      const { prompt, count = 1 } = req.body
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Falta el prompt' })
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
      const images = []
      for (const r of results) {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error?.message || 'Error OpenAI')
        const b64 = data.data?.[0]?.b64_json
        if (b64) images.push(`data:image/png;base64,${b64}`)
      }
      res.json({ images, image: images[0] })
    } catch (e) {
      res.status(500).json({ error: String(e) })
    }
  })

  return api
}

function createWindow(loadUrl) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    ...(fs.existsSync(path.join(__dirname, '..', 'public', 'icon.png')) && { icon: path.join(__dirname, '..', 'public', 'icon.png') }),
  })
  win.loadURL(loadUrl)
  if (isDev) win.webContents.openDevTools()
}

app.whenReady().then(() => {
  const PROJECTS_DIR = getProjectsDir()

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    createWindow(process.env.VITE_DEV_SERVER_URL)
  } else {
    const expressApp = require('express')()
    expressApp.use('/api', createApiServer(PROJECTS_DIR))
    let distPath = path.join(__dirname, '..', 'dist')
    if (app.isPackaged) {
      const unpacked = path.join(path.dirname(app.getAppPath()), 'app.asar.unpacked', 'dist')
      distPath = fs.existsSync(unpacked) ? unpacked : path.join(app.getAppPath(), 'dist')
    }
    expressApp.use(express.static(distPath))
    expressApp.get('/{*any}', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
    const server = expressApp.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      createWindow(`http://127.0.0.1:${port}`)
    })
  }
})

app.on('window-all-closed', () => app.quit())
