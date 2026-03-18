/**
 * Vercel Serverless: POST /api/generate-image
 * OpenAI DALL·E 3 — genera imágenes desde prompt de texto
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
    const { prompt } = body
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Falta el prompt' })
    }
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
        style: 'vivid',
        response_format: 'url',
      }),
    })
    const data = await r.json()
    if (!r.ok) {
      return res.status(r.status).json({ error: data.error?.message || 'Error OpenAI' })
    }
    const url = data.data?.[0]?.url
    const images = url ? [url] : []
    return res.status(200).json({ images, image: images[0] || null })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
