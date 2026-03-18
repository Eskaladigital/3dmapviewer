// @ts-ignore
export const isOpenCvReady = () => !!(window.cv && window.cv.Mat)

export interface DetectedWall {
  start: { x: number; y: number }
  end: { x: number; y: number }
  length?: number
  angle?: number
}

function getLineAngle(start: { x: number; y: number }, end: { x: number; y: number }) {
  const dy = end.y - start.y
  const dx = end.x - start.x
  let theta = Math.atan2(dy, dx)
  theta *= 180 / Math.PI
  if (theta < 0) theta += 180
  return theta
}

function isParallel(angle1: number, angle2: number, tolerance = 10) {
  const diff = Math.abs(angle1 - angle2)
  return diff < tolerance || Math.abs(diff - 180) < tolerance
}

// Distancia perpendicular de un punto a una recta definida por dos puntos
function pointToLineDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const A = px - x1
  const B = py - y1
  const C = x2 - x1
  const D = y2 - y1
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  if (lenSq === 0) return Math.sqrt(A * A + B * B)
  const param = dot / lenSq
  let xx, yy
  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }
  const dx = px - xx
  const dy = py - yy
  return Math.sqrt(dx * dx + dy * dy)
}

export const detectWallsWithOpenCV = async (imageUrl: string): Promise<DetectedWall[]> => {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    if (!window.cv) {
      reject(new Error('OpenCV no está cargado aún'))
      return
    }

    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.onload = () => {
      try {
        // @ts-ignore
        const cv = window.cv
        const src = cv.imread(img)
        const gray = new cv.Mat()
        
        // 1. Convertir a escala de grises
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0)
        
        // 2. Pre-procesamiento
        const inverted = new cv.Mat()
        cv.bitwise_not(gray, inverted)
        
        // SUAVIZADO: Usamos kernel más pequeño (2x2) para no matar paredes finas
        // Antes era 3x3 y era muy agresivo
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2))
        const eroded = new cv.Mat()
        cv.erode(inverted, eroded, kernel)
        
        // 3. Detectar bordes (Canny) - Umbrales ajustados
        const edges = new cv.Mat()
        cv.Canny(eroded, edges, 50, 150, 3)
        
        // 4. Detectar líneas (HoughLinesP)
        const lines = new cv.Mat()
        // minLineLength 60 (para evitar ruido muy corto), threshold 50
        cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 60, 20)
        
        let detectedWalls: DetectedWall[] = []
        
        // 5. Extraer líneas
        for (let i = 0; i < lines.rows; ++i) {
          const start = { x: lines.data32S[i * 4], y: lines.data32S[i * 4 + 1] }
          const end = { x: lines.data32S[i * 4 + 2], y: lines.data32S[i * 4 + 3] }
          const len = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
          const angle = getLineAngle(start, end)
          
          if (len > 40) {
            detectedWalls.push({ start, end, length: len, angle })
          }
        }
        
        // 6. FILTRO DE DENSIDAD (Anti-Trama)
        // Eliminamos líneas que tienen muchas otras líneas paralelas muy cerca (típico de suelos rayados)
        const toRemove = new Set<number>()
        
        for (let i = 0; i < detectedWalls.length; i++) {
          if (toRemove.has(i)) continue
          
          const w1 = detectedWalls[i]
          let neighbors = 0
          
          for (let j = 0; j < detectedWalls.length; j++) {
            if (i === j) continue
            const w2 = detectedWalls[j]
            
            // Si son paralelas
            if (isParallel(w1.angle || 0, w2.angle || 0)) {
              // Y están cerca (distancia del punto medio de w2 a la recta w1)
              const midX = (w2.start.x + w2.end.x) / 2
              const midY = (w2.start.y + w2.end.y) / 2
              const dist = pointToLineDist(midX, midY, w1.start.x, w1.start.y, w1.end.x, w1.end.y)
              
              // Si está muy cerca (< 15px) es sospechoso de ser trama
              if (dist < 15) {
                neighbors++
              }
            }
          }
          
          // Si tiene más de 2 vecinos paralelos muy cerca, es trama
          if (neighbors > 2) {
            toRemove.add(i)
            // Marcar también los vecinos (se hará en sus iteraciones, o podríamos marcarlos aquí)
          }
        }
        
        let cleanWalls = detectedWalls.filter((_, i) => !toRemove.has(i))
        console.log(`OpenCV: Eliminadas ${toRemove.size} líneas por ser trama densa.`)

        // 7. Filtrado final y ordenación
        cleanWalls.sort((a, b) => (b.length || 0) - (a.length || 0))
        
        // Cap de seguridad relajado (si hemos filtrado bien la trama, podemos permitir más paredes reales)
        if (cleanWalls.length > 200) {
          cleanWalls = cleanWalls.slice(0, 200)
        }
        
        // Limpieza
        src.delete()
        gray.delete()
        inverted.delete()
        kernel.delete()
        eroded.delete()
        edges.delete()
        lines.delete()
        
        resolve(cleanWalls)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = (err) => reject(err)
    img.src = imageUrl
  })
}
