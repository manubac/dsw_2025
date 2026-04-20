// cardRecognition.ts
// Identifica una carta Pokémon usando POST /api/scan (Google Cloud Vision).
// Recibe un data-URL (canvas.toDataURL) y devuelve los datos de la carta.

export interface ScannedCardResult {
  name: string
  set: string
  number: string
  imageDataUrl: string
  needsReview: boolean
  fuenteColeccion?: string   // 'footer' | 'footer-alt' | 'reverse' | 'ocr'
  candidatos?: unknown[]
}

export async function recognizeCard(
  imageDataUrl: string,
  onStatusChange: (status: 'scanning' | 'looking-up') => void,
): Promise<ScannedCardResult> {
  onStatusChange('scanning')

  const res = await fetch('/api/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.mensaje ?? `HTTP ${res.status}`)
  }

  onStatusChange('looking-up')

  const data = await res.json()
  console.log('[cardRecognition] respuesta /api/scan:', JSON.stringify(data, null, 2))

  if (!data.success) {
    return {
      name:          data.nombre          ?? '',
      set:           data.coleccion        ?? '',
      number:        data.numero           ?? '',
      imageDataUrl,
      needsReview:   true,
      fuenteColeccion: data.fuenteColeccion,
    }
  }

  const needsReview = !data.nombre || data.fuenteColeccion === 'ocr' || data.fuenteColeccion === 'reverse' || data.fuenteColeccion === 'number-name'

  return {
    name:            data.nombre    ?? '',
    set:             data.coleccion ?? '',
    number:          data.numero    ?? '',
    imageDataUrl,
    needsReview,
    fuenteColeccion: data.fuenteColeccion,
    candidatos:      data.candidatos,
  }
}
