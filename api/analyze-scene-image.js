/**
 * Vercel Serverless: POST /api/analyze-scene-image
 * GPT-4 Vision describe el espacio para reproducirlo en DALL·E
 * Adapta el prompt según cameraMode (firstPerson vs orbit) y viewType (topDown vs perspective)
 */

const PROMPT_FIRST_PERSON = `Esta imagen es una captura 3D desde PRIMERA PERSONA (vista interior a nivel de los ojos) de un proyecto arquitectónico. Objetivo: RENDER HIPERREALISTA tipo estudio de arquitectura (3DS Max + V-Ray).

CONTEXTO CRÍTICO SOBRE LA IMAGEN:
- Esta es una maqueta 3D. Las zonas planas de color VERDE OSCURO visibles a través de ventanas, puertas o aberturas representan el EXTERIOR (jardín, césped, paisaje). NO son paredes verdes ni pintura verde.
- Al describir la escena, interpreta esas zonas verdes como "vistas al exterior con jardín/vegetación" y NO como "paredes de color verde".
- Las paredes interiores reales son las superficies con otros colores/materiales DENTRO de la habitación.

CRÍTICO: La precisión espacial es lo más importante. Describe la posición de cada objeto como si dibujaras un plano desde el punto de vista del observador.

ESTRUCTURA OBLIGATORIA:

1. PUNTO DE VISTA: Desde qué esquina o ángulo se ve la habitación.
2. LADO IZQUIERDO DE LA IMAGEN: Lista todo lo que está a la izquierda con su posición exacta.
3. LADO DERECHO DE LA IMAGEN: Lista todo lo que está a la derecha con su posición exacta.
4. CENTRO / FONDO: Lo que está en el centro y al fondo.
5. VENTANAS Y ABERTURAS: Describe lo que se ve al exterior (jardín, cielo, paisaje). Las zonas verdes a través de aberturas = exterior.
6. SUELO, TECHO, ILUMINACIÓN: Colores y elementos.

Para cada elemento indica: posición relativa, color, material. La descripción debe permitir reproducir el espacio con la misma disposición exacta.

Escribe en español. Sé exhaustivo.`

const PROMPT_ORBIT_PERSPECTIVE = `Esta imagen es una captura 3D desde una VISTA ORBITAL/EXTERIOR en perspectiva de un proyecto arquitectónico. Puede mostrar: un edificio desde fuera, un conjunto de edificios, una urbanización, una vivienda vista desde el exterior, un paisaje con construcciones, o cualquier escena arquitectónica vista desde una perspectiva elevada exterior.

Objetivo: RENDER HIPERREALISTA tipo estudio de arquitectura profesional.

CRÍTICO: Describe EXACTAMENTE lo que ves, sin asumir que es un interior.

ESTRUCTURA OBLIGATORIA:

1. TIPO DE ESCENA: ¿Qué se ve? (edificio individual, conjunto de viviendas, urbanización, paisaje, etc.)
2. PUNTO DE VISTA: Desde qué ángulo se ve la escena (ej: vista aérea a 45°, vista frontal del edificio, etc.)
3. ELEMENTOS PRINCIPALES: Edificios, estructuras, carreteras, jardines, etc. con sus posiciones relativas.
4. MATERIALES Y COLORES: Fachadas, tejados, suelos, vegetación, etc.
5. ENTORNO: Vegetación, cielo, terreno, elementos urbanísticos.
6. ILUMINACIÓN: Hora del día aparente, dirección de la luz.

Para cada elemento indica: posición relativa, tamaño aproximado, color, material. La descripción debe permitir reproducir la escena con la misma disposición exacta.

Escribe en español. Sé exhaustivo.`

const PROMPT_TOP_DOWN = `Esta imagen es una captura 3D desde una VISTA CENITAL (desde arriba, mirando hacia abajo) de un proyecto arquitectónico. Puede ser: un plano de planta, una vista aérea de un edificio, una urbanización vista desde un dron, etc.

Objetivo: RENDER HIPERREALISTA tipo fotografía aérea/dron profesional.

CRÍTICO: Describe EXACTAMENTE lo que ves desde arriba, sin asumir que es un interior.

ESTRUCTURA OBLIGATORIA:

1. TIPO DE ESCENA: ¿Qué se ve desde arriba? (planta de una vivienda, tejado de un edificio, urbanización, etc.)
2. DISTRIBUCIÓN: Cómo están organizados los elementos en el espacio (habitaciones, edificios, calles, etc.)
3. ELEMENTOS VISIBLES: Todo lo que se ve desde arriba con sus posiciones relativas.
4. MATERIALES Y COLORES: Suelos, tejados, vegetación, pavimentos, etc.
5. ESCALA Y PROPORCIONES: Tamaños relativos de los elementos.

Para cada elemento indica: posición relativa (arriba, abajo, izquierda, derecha, centro), color, material.

Escribe en español. Sé exhaustivo.`

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
    const { image, cameraMode, viewType } = body
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Falta la imagen (base64 o data URL)' })
    }
    const base64 = image.replace(/^data:image\/\w+;base64,/, '')
    const mime = image.match(/^data:(image\/\w+);/)?.[1] || 'image/png'

    let prompt
    if (cameraMode === 'firstPerson') {
      prompt = PROMPT_FIRST_PERSON
    } else if (viewType === 'topDown') {
      prompt = PROMPT_TOP_DOWN
    } else {
      prompt = PROMPT_ORBIT_PERSPECTIVE
    }

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
