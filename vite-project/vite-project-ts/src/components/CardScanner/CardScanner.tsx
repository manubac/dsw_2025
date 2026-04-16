import { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, X, Check, RefreshCw, Trash2, ScanLine, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import styles from './CardScanner.module.css'

export interface ScannedCard {
  id?: number
  name: string
  set: string
  number: string
  imageDataUrl: string
}

type ScanStatus = 'scanning' | 'looking-up' | 'done' | 'review'

interface QueueItem extends ScannedCard {
  itemId: number
  status: ScanStatus
}

interface CardScannerProps {
  onCardsScanned: (cards: ScannedCard[]) => void
  onClose: () => void
}

const STATUS_LABELS: Record<ScanStatus, string> = {
  'scanning': 'Leyendo número...',
  'looking-up': 'Buscando en base de datos...',
  'done': 'Listo',
  'review': 'Revisar manualmente',
}

const STATUS_CLASS: Record<ScanStatus, string> = {
  'scanning': styles.statusScanning,
  'looking-up': styles.statusLookingUp,
  'done': styles.statusDone,
  'review': styles.statusReview,
}

export function CardScanner({ onCardsScanned, onClose }: CardScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    const startCamera = async () => {
      try {
        // Solicitar la resolución más alta disponible para maximizar precisión del OCR
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width:  { ideal: 4096 },
            height: { ideal: 2160 },
          },
        })
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setCameraReady(true)
          }
        }
      } catch (err) {
        setCameraError('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
        console.error(err)
      }
    }

    startCamera()

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const captureAndScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)

    // Calidad alta para maximizar precisión OCR en Google Vision
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95)
    const itemId = Date.now()

    setCapturing(true)

    // Agregar placeholder con estado "scanning" de inmediato
    setQueue(prev => [...prev, {
      itemId,
      name: '',
      set: '',
      number: '',
      imageDataUrl,
      status: 'scanning',
    }])

    try {
      const scanRes = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageDataUrl }),
      })
      const scanData = await scanRes.json()
      console.log('[CardScanner] Vision →', scanData?.nombre, scanData?.coleccion, scanData?.numero)

      const nombre:    string = scanData?.nombre    ?? ''
      const coleccion: string = scanData?.coleccion ?? ''
      const numero:    string = scanData?.numero    ?? ''
      // Con colección + número ya se puede resolver; nombre es bonus
      const canResolve = !!(coleccion && numero)

      setQueue(prev => prev.map(item =>
        item.itemId === itemId
          ? {
              ...item,
              name:   nombre,
              set:    coleccion,
              number: numero,
              status: canResolve ? 'done' : 'review',
            }
          : item
      ))
    } catch (err) {
      console.error('Card recognition error:', err)
      setQueue(prev => prev.map(item =>
        item.itemId === itemId ? { ...item, status: 'review' } : item
      ))
    } finally {
      setCapturing(false)
    }
  }, [capturing])

  const updateCard = (itemId: number, field: keyof Omit<ScannedCard, 'imageDataUrl' | 'id'>, value: string) => {
    setQueue(prev => prev.map(item => item.itemId === itemId ? { ...item, [field]: value } : item))
  }

  const removeCard = (itemId: number) => {
    setQueue(prev => prev.filter(item => item.itemId !== itemId))
  }

  const handleConfirm = () => {
    const cards: ScannedCard[] = queue.map(({ itemId: _itemId, status: _status, ...card }) => card)
    onCardsScanned(cards)
    onClose()
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <ScanLine size={20} />
            <span>Escanear cartas</span>
          </div>
          <button onClick={onClose} className={styles.closeBtn} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {/* Camera */}
        <div className={styles.cameraSection}>
          {cameraError ? (
            <div className={styles.cameraError}>{cameraError}</div>
          ) : (
            <>
              <video ref={videoRef} className={styles.video} playsInline muted />
              <canvas ref={canvasRef} className={styles.canvas} />
              {/* Guía de encuadre — muestra el contorno de la carta */}
              <div className={styles.cardGuide} aria-hidden="true" />
              {!cameraReady && (
                <div className={styles.cameraLoading}>
                  <div className={styles.spinner} />
                  <span>Iniciando cámara…</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Capture button */}
        <div className={styles.captureBar}>
          <span className={styles.captureHint}>Enfocá la carta y capturá</span>
          <button
            onClick={captureAndScan}
            disabled={!cameraReady || capturing}
            className={styles.captureBtn}
          >
            {capturing ? (
              <>
                <RefreshCw size={18} className={styles.spinIcon} />
                Procesando…
              </>
            ) : (
              <>
                <Camera size={18} />
                Capturar carta
              </>
            )}
          </button>
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className={styles.queueSection}>
            <p className={styles.queueTitle}>
              Cartas escaneadas&nbsp;
              <span className={styles.queueBadge}>{queue.length}</span>
            </p>

            <div className={styles.queueList}>
              {queue.map((card) => (
                <div key={card.itemId} className={styles.queueItem}>
                  <img
                    src={card.imageDataUrl}
                    alt={card.name || `Carta ${card.itemId}`}
                    className={styles.cardThumb}
                  />
                  <div className={styles.cardFields}>
                    <div className={styles.statusRow}>
                      <span className={`${styles.statusBadge} ${STATUS_CLASS[card.status]}`}>
                        {card.status === 'scanning' || card.status === 'looking-up'
                          ? <RefreshCw size={10} className={styles.spinIcon} />
                          : null}
                        {STATUS_LABELS[card.status]}
                      </span>
                      {card.id != null && card.status === 'done' && (
                        <Link
                          to={`/card/${card.id}`}
                          onClick={onClose}
                          className={styles.viewLink}
                          title="Ver carta en el marketplace"
                        >
                          <ExternalLink size={12} />
                          Ver carta
                        </Link>
                      )}
                    </div>
                    <input
                      value={card.name}
                      onChange={e => updateCard(card.itemId, 'name', e.target.value)}
                      placeholder="Nombre de la carta"
                      className={styles.fieldInput}
                    />
                    <div className={styles.fieldRow}>
                      <input
                        value={card.set}
                        onChange={e => updateCard(card.itemId, 'set', e.target.value)}
                        placeholder="Set"
                        className={styles.fieldInputSmall}
                      />
                      <input
                        value={card.number}
                        onChange={e => updateCard(card.itemId, 'number', e.target.value)}
                        placeholder="Nº"
                        className={styles.fieldInputSmall}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => removeCard(card.itemId)}
                    className={styles.removeBtn}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div className={styles.confirmBar}>
              <button onClick={handleConfirm} className={styles.confirmBtn}>
                <Check size={18} />
                Confirmar {queue.length} carta{queue.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
