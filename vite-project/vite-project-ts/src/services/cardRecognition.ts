// cardRecognition.ts
// Llama al endpoint Node.js POST /api/identify (multipart/form-data).
// Fallback: POST /api/scan con Google Cloud Vision (Base64).

export interface ScannedCardResult {
  id?: number        // id de la Carta en la DB, si se encontró con match exact
  name: string
  set: string
  setCode?: string   // código corto del set (ptcgoCode) para usar en resolve, ej: "SV04"
  number: string
  imageDataUrl: string
  needsReview: boolean
}

// Convierte un data-URL (canvas.toDataURL) en un Blob para FormData
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function recognizeCard(
  imageDataUrl: string,
  onStatusChange: (status: 'scanning' | 'looking-up') => void,
): Promise<ScannedCardResult> {
  onStatusChange('scanning')

  // Convertir el data-URL a Blob y enviarlo como multipart/form-data
  const blob = await dataUrlToBlob(imageDataUrl)
  const formData = new FormData()
  formData.append('image', blob, 'scan.jpg')

  const res = await fetch('/api/identify', {
    method: 'POST',
    body: formData,
    // No poner Content-Type — el browser lo setea con el boundary correcto
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.mensaje ?? `HTTP ${res.status}`)
  }

  onStatusChange('looking-up')

  const data = await res.json()
  console.log('[cardRecognition] respuesta del backend:', JSON.stringify(data, null, 2))

  // El endpoint devolvió success: false (carta no encontrada en la DB)
  // Igual aprovechamos los datos OCR para intentar el resolve por scraping
  if (!data.success) {
    return {
      name:         data.debug?.ocr_raw?.nombre          ?? '',
      set:          '',
      setCode:      data.debug?.ocr_raw?.codigoColeccion ?? '',
      number:       data.debug?.ocr_raw?.numero          ?? '',
      imageDataUrl,
      needsReview:  true,
    }
  }

  const { carta, match, confidence } = data

  // needsReview = true cuando la confianza es baja o el match no fue exacto
  const needsReview = confidence === 'low' || match === 'fuzzy' || match === 'embedding'

  return {
    id:           match === 'exact' ? carta.id : undefined,
    name:         carta.nombre   ?? '',
    set:          carta.coleccion ?? '',
    setCode:      carta.setCode  ?? undefined,
    number:       carta.numero   ?? '',
    // imagen_url puede ser URL externa o vacío; el componente usa imageDataUrl como fallback
    imageDataUrl: carta.imagen_url || imageDataUrl,
    needsReview,
  }
}
