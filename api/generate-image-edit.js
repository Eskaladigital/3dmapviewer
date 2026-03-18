/**
 * Vercel Serverless: POST /api/generate-image-edit
 * OpenAI GPT Image Edit (imagen directa, preserva layout)
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
    const { image, prompt } = body
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Falta la imagen' })
    }
    const editPrompt =
      prompt ||
      'Convert this 3D interior render into a hyperrealistic photograph. Style: professional architecture studio render with Autodesk 3DS Max and V-Ray—ultra-realistic material textures, physical lighting, soft shadows, reflections, photorealistic finishes. Preserve the exact layout, furniture positions, and spatial arrangement.'
    const editRes = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        images: [{ image_url: image }],
        prompt: editPrompt,
        input_fidelity: 'high',
        n: 1,
        size: '1024x1024',
        quality: 'medium',
        output_format: 'jpeg',
        output_compression: 80,
      }),
    })
    const data = await editRes.json()
    if (!editRes.ok) {
      return res.status(editRes.status).json({ error: data.error?.message || 'Error OpenAI' })
    }
    const b64 = data.data?.[0]?.b64_json
    const img = b64 ? `data:image/jpeg;base64,${b64}` : null
    return res.status(200).json({ images: img ? [img] : [], image: img })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
