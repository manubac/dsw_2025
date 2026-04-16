// DebugCropPage.tsx
// Herramienta de desarrollo para ajustar los parámetros de detección de
// polígonos de cartas Pokémon en tiempo real.
//
// Ruta: /debug-crop (solo para desarrollo)

import { useRef, useState, useCallback, useEffect } from 'react'
import styles from './DebugCropPage.module.css'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface DebugParams {
  toleranceAuto: boolean
  tolerance: number
  borderEstimate: number
  procSize: number
  blurRadius: number
  stablePercent: number  // 1–20 (%)
}

interface DebugStats {
  bgLuma: number
  tolerance: number
  edgePointCount: number
  ratio: number
  areaFrac: number
}

interface DebugResult {
  corners: [[number, number], [number, number], [number, number], [number, number]] | null
  valid: boolean
  stats: DebugStats
  origWidth: number
  origHeight: number
  maskImageBase64: string
  croppedImageBase64: string
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: DebugParams = {
  toleranceAuto: true,
  tolerance: 20,
  borderEstimate: 200,
  procSize: 600,
  blurRadius: 1.5,
  stablePercent: 3,
}

// Corner labels & colors
const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']
const CORNER_COLORS = ['#ffe600', '#ff8c00', '#ff00c8', '#00dcff']

// ── Componente principal ──────────────────────────────────────────────────────

export default function DebugCropPage() {
  const [params, setParams] = useState<DebugParams>(DEFAULT_PARAMS)
  const [result, setResult] = useState<DebugResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Ref para el canvas donde dibujamos la imagen original + polígono
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Debounce timer
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Cargar imagen ──────────────────────────────────────────────────────────

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setResult(null)
    setError(null)
    const url = URL.createObjectURL(file)
    setImageUrl(url)
  }, [])

  // ── Llamar al backend ───────────────────────────────────────────────────────

  const runDebug = useCallback(async (p: DebugParams, file: File) => {
    setLoading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('toleranceAuto', String(p.toleranceAuto))
      fd.append('tolerance', String(p.tolerance))
      fd.append('borderEstimate', String(p.borderEstimate))
      fd.append('procSize', String(p.procSize))
      fd.append('blurRadius', String(p.blurRadius))
      fd.append('stablePercent', String(p.stablePercent))

      const res = await fetch('/api/identify/debug-crop', { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.success) throw new Error(json.mensaje ?? 'Error desconocido')
      setResult(json as DebugResult)
    } catch (err: any) {
      setError(err.message ?? 'Error al procesar')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-run con debounce cuando cambian params o imagen
  useEffect(() => {
    if (!imageFile) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runDebug(params, imageFile)
    }, 350)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [params, imageFile, runDebug])

  // ── Dibujar polígono en canvas ─────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageUrl) return

    const img = new Image()
    img.onload = () => {
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      if (result?.corners) {
        const [tl, tr, br, bl] = result.corners

        // Polígono semi-transparente
        ctx.beginPath()
        ctx.moveTo(tl[0], tl[1])
        ctx.lineTo(tr[0], tr[1])
        ctx.lineTo(br[0], br[1])
        ctx.lineTo(bl[0], bl[1])
        ctx.closePath()
        ctx.strokeStyle = result.valid ? '#22c55e' : '#ef4444'
        ctx.lineWidth   = Math.max(2, img.naturalWidth / 300)
        ctx.stroke()
        ctx.fillStyle = result.valid ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)'
        ctx.fill()

        // Esquinas
        const R = Math.max(8, img.naturalWidth / 80)
        const pts = [tl, tr, br, bl]
        CORNER_COLORS.forEach((color, i) => {
          const [cx, cy] = pts[i]
          ctx.beginPath()
          ctx.arc(cx, cy, R, 0, Math.PI * 2)
          ctx.fillStyle = color
          ctx.fill()
          ctx.strokeStyle = '#000'
          ctx.lineWidth   = 1.5
          ctx.stroke()

          // Label
          ctx.font         = `bold ${Math.max(12, R * 1.2)}px monospace`
          ctx.fillStyle    = '#000'
          ctx.fillText(CORNER_LABELS[i], cx + R + 2, cy + R / 3)
        })
      }
    }
    img.src = imageUrl
  }, [imageUrl, result])

  // ── Helpers de update de parámetros ──────────────────────────────────────

  const set = <K extends keyof DebugParams>(key: K, value: DebugParams[K]) =>
    setParams(prev => ({ ...prev, [key]: value }))

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Debug · Detección de polígono</h1>
        <p className={styles.subtitle}>
          Ajustá los parámetros y la detección se actualiza automáticamente.
        </p>
      </header>

      <div className={styles.body}>

        {/* ── Panel izquierdo: imágenes ── */}
        <div className={styles.leftPanel}>

          {/* Carga de archivo */}
          <label className={styles.uploadZone}>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className={styles.fileInput}
            />
            {imageFile
              ? <span className={styles.uploadLabel}>📷 {imageFile.name}</span>
              : <span className={styles.uploadLabel}>📂 Seleccioná una imagen</span>
            }
          </label>

          {/* Canvas con polígono overlay */}
          {imageUrl && (
            <div className={styles.canvasWrapper}>
              <div className={styles.canvasLabel}>
                Imagen original + polígono detectado
                {loading && <span className={styles.loadingDot}> ●</span>}
              </div>
              <canvas ref={canvasRef} className={styles.canvas} />
            </div>
          )}

          {/* Imagen de debug de la máscara */}
          {result?.maskImageBase64 && (
            <div className={styles.canvasWrapper}>
              <div className={styles.canvasLabel}>
                Máscara de flood-fill
                <span className={styles.legend}>
                  <span style={{ color: '#dc3c3c' }}>■</span> fondo &nbsp;
                  <span style={{ color: '#00e600' }}>■</span> borde carta &nbsp;
                  <span style={{ color: '#ffe600' }}>■</span> TL &nbsp;
                  <span style={{ color: '#ff8c00' }}>■</span> TR &nbsp;
                  <span style={{ color: '#ff00c8' }}>■</span> BR &nbsp;
                  <span style={{ color: '#00dcff' }}>■</span> BL
                </span>
              </div>
              <img src={result.maskImageBase64} className={styles.maskImg} alt="debug mask" />
            </div>
          )}

          {/* Carta recortada */}
          {result?.croppedImageBase64 && (
            <div className={styles.canvasWrapper}>
              <div className={styles.canvasLabel}>
                Resultado del crop ({result.valid ? '✅ válido' : '⚠ fallback'})
              </div>
              <img src={result.croppedImageBase64} className={styles.croppedImg} alt="card crop" />
            </div>
          )}
        </div>

        {/* ── Panel derecho: controles + stats ── */}
        <div className={styles.rightPanel}>

          {/* Stats */}
          {result && (
            <section className={styles.statsSection}>
              <h2 className={styles.sectionTitle}>Estadísticas</h2>
              <table className={styles.statsTable}>
                <tbody>
                  <tr>
                    <td>Estado</td>
                    <td>
                      <span className={result.valid ? styles.badgeGreen : styles.badgeRed}>
                        {result.valid ? 'VÁLIDO' : 'INVÁLIDO'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Luma de fondo</td>
                    <td><b>{result.stats.bgLuma}</b> / 255</td>
                  </tr>
                  <tr>
                    <td>Tolerancia usada</td>
                    <td><b>{result.stats.tolerance}</b></td>
                  </tr>
                  <tr>
                    <td>Puntos de borde</td>
                    <td><b>{result.stats.edgePointCount.toLocaleString()}</b></td>
                  </tr>
                  <tr>
                    <td>Ratio W/H</td>
                    <td>
                      <b className={
                        result.stats.ratio >= 0.55 && result.stats.ratio <= 0.85
                          ? styles.numGreen : styles.numRed
                      }>
                        {result.stats.ratio.toFixed(3)}
                      </b>
                      <span className={styles.hint}> (rango válido 0.55–0.85)</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Área del quad</td>
                    <td>
                      <b className={result.stats.areaFrac >= 0.05 ? styles.numGreen : styles.numRed}>
                        {(result.stats.areaFrac * 100).toFixed(1)}%
                      </b>
                      <span className={styles.hint}> (mínimo 5%)</span>
                    </td>
                  </tr>
                  {result.corners && (
                    <tr>
                      <td>Esquinas (px)</td>
                      <td className={styles.cornersCell}>
                        {CORNER_LABELS.map((lbl, i) => (
                          <span key={lbl} style={{ color: CORNER_COLORS[i] }}>
                            {lbl}({result.corners![i][0]},{result.corners![i][1]})
                          </span>
                        ))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          )}

          {error && (
            <div className={styles.errorBox}>{error}</div>
          )}

          {/* Parámetros */}
          <section className={styles.paramsSection}>
            <h2 className={styles.sectionTitle}>Parámetros</h2>

            {/* Tolerancia */}
            <div className={styles.paramGroup}>
              <div className={styles.paramHeader}>
                <label className={styles.paramLabel}>Tolerancia flood-fill</label>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={params.toleranceAuto}
                    onChange={e => set('toleranceAuto', e.target.checked)}
                  />
                  Auto
                </label>
              </div>
              <div className={styles.sliderRow}>
                <input
                  type="range" min={1} max={80} step={1}
                  value={params.tolerance}
                  disabled={params.toleranceAuto}
                  onChange={e => set('tolerance', Number(e.target.value))}
                  className={styles.slider}
                />
                <span className={styles.sliderVal}>
                  {params.toleranceAuto ? 'auto' : params.tolerance}
                </span>
              </div>
              <p className={styles.paramDesc}>
                Cuánto puede diferir un píxel del color de fondo para entrar al fill.
                Bajo = conservador (solo pixels casi idénticos al fondo).
                Alto = agresivo (puede comerse el borde de la carta).
              </p>
            </div>

            {/* Border Estimate */}
            <div className={styles.paramGroup}>
              <div className={styles.paramHeader}>
                <label className={styles.paramLabel}>
                  Estimación luma del borde de carta
                </label>
                <span className={styles.paramVal}>{params.borderEstimate}</span>
              </div>
              <input
                type="range" min={100} max={255} step={1}
                value={params.borderEstimate}
                onChange={e => set('borderEstimate', Number(e.target.value))}
                className={styles.slider}
              />
              <p className={styles.paramDesc}>
                Luma esperada del borde de la carta (0=negro, 255=blanco).
                Borde gris claro ≈ 200, borde amarillo ≈ 220, borde negro ≈ 30.
              </p>
            </div>

            {/* Proc Size */}
            <div className={styles.paramGroup}>
              <div className={styles.paramHeader}>
                <label className={styles.paramLabel}>Tamaño de procesamiento</label>
                <span className={styles.paramVal}>{params.procSize}px</span>
              </div>
              <input
                type="range" min={200} max={1200} step={50}
                value={params.procSize}
                onChange={e => set('procSize', Number(e.target.value))}
                className={styles.slider}
              />
              <p className={styles.paramDesc}>
                La imagen se achica a este lado máximo antes de detectar.
                Más grande = más preciso pero más lento.
              </p>
            </div>

            {/* Blur Radius */}
            <div className={styles.paramGroup}>
              <div className={styles.paramHeader}>
                <label className={styles.paramLabel}>Radio de desenfoque</label>
                <span className={styles.paramVal}>{params.blurRadius}</span>
              </div>
              <input
                type="range" min={0} max={5} step={0.5}
                value={params.blurRadius}
                onChange={e => set('blurRadius', Number(e.target.value))}
                className={styles.slider}
              />
              <p className={styles.paramDesc}>
                Desenfoque gaussiano antes del flood-fill.
                Suaviza ruido pero puede redondear los bordes de la carta.
              </p>
            </div>

            {/* Stable Percent */}
            <div className={styles.paramGroup}>
              <div className={styles.paramHeader}>
                <label className={styles.paramLabel}>% puntos extremos (esquinas)</label>
                <span className={styles.paramVal}>{params.stablePercent}%</span>
              </div>
              <input
                type="range" min={1} max={20} step={1}
                value={params.stablePercent}
                onChange={e => set('stablePercent', Number(e.target.value))}
                className={styles.slider}
              />
              <p className={styles.paramDesc}>
                Porcentaje del top de puntos más extremos para promediar cada esquina.
                Bajo = más preciso pero sensible a ruido. Alto = más estable pero puede desplazarse.
              </p>
            </div>

            <button
              className={styles.resetBtn}
              onClick={() => setParams(DEFAULT_PARAMS)}
            >
              Resetear parámetros
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
