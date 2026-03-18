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
    const { prompt, count = 1 } = body
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Falta el prompt' })
    }
    const num = Math.min(6, Math.max(1, parseInt(String(count), 10) || 1))
    const requests = Array.from({ length: num }, () =>
      fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
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
    return res.status(200).json({ images, image: images[0] })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
