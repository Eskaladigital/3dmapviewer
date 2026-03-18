/**
 * Vercel Serverless: POST /api/analyze-scene-image
 * GPT-4 Vision describe el espacio para reproducirlo en DALL·E
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'OPENAI_API_KEY no configurada. Configúrala en Vercel → Settings → Environment Variables' })
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const { image } = body
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
        Authorization: `Bearer ${apiKey}`,
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
    return res.status(200).json({ description })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
