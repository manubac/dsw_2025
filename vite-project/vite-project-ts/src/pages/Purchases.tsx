import { useEffect, useState, useCallback } from 'react'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ReviewModal } from '../components/ReviewModal'
import { CancelOrderModal } from '../components/CancelOrderModal'
import { CancelReviewModal } from '../components/CancelReviewModal'
import { fetchApi } from '../services/api'
import { Chat } from '../components/Chat'

const MOTIVO_LABELS: Record<string, string> = {
  sin_stock: 'Sin stock',
  error_precio: 'Error de precio',
  producto_daniado: 'Producto dañado',
  no_respondio: 'No respondió',
  cambio_decision: 'Cambio de decisión',
  sospecha_fraude: 'Sospecha de fraude',
  problema_tienda: 'Problema con tienda',
  otro: 'Otro',
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pendiente:          { label: 'Pendiente',         cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  en_tienda:          { label: 'En tienda',          cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  pago_confirmado:    { label: 'Pago confirmado',    cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  listo_para_retirar: { label: 'Listo para retirar', cls: 'bg-[#e8f0e9] text-[#2d4a32] border border-[#c8dbc9]' },
  finalizado:         { label: 'Finalizado',         cls: 'bg-[#e8f0e9] text-[#2d4a32] border border-[#c8dbc9]' },
  cancelado:          { label: 'Cancelado',          cls: 'bg-red-50 text-red-700 border border-red-200' },
}

function StatusBadge({ estado }: { estado: string }) {
  const s = ESTADO_BADGE[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600 border border-gray-200' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

function getSteps(comp: any): string[] {
  if (comp.tiendaRetiro) return ['Pendiente', 'En tienda', 'Pago confirmado', 'Finalizado']
  const hasUploaderTienda = comp.itemCartas?.some((i: any) => i.uploaderTienda)
  if (hasUploaderTienda) return ['Pendiente', 'Listo para retirar', 'Finalizado']
  return ['Pendiente', 'Finalizado']
}

function getStepIndex(comp: any): number {
  const estado = comp.estado
  if (comp.tiendaRetiro) {
    const map: Record<string, number> = { pendiente: 0, en_tienda: 1, pago_confirmado: 2, finalizado: 3, cancelado: 4 }
    return map[estado] ?? 0
  }
  const hasUploaderTienda = comp.itemCartas?.some((i: any) => i.uploaderTienda)
  if (hasUploaderTienda) {
    const map: Record<string, number> = { pendiente: 0, listo_para_retirar: 1, finalizado: 2, cancelado: 3 }
    return map[estado] ?? 0
  }
  const map: Record<string, number> = { pendiente: 0, finalizado: 1, cancelado: 2 }
  return map[estado] ?? 0
}

function OrderStepper({ comp }: { comp: any }) {
  const steps = getSteps(comp)
  const currentStep = getStepIndex(comp)
  const cancelled = comp.estado === 'cancelado'
  const finalizado = comp.estado === 'finalizado'
  const total = steps.length - 1

  return (
    <div>
      {finalizado && (
        <div className="text-center mb-4 py-3 bg-gradient-to-r from-[#e8f0e9] to-[#d4edda] rounded-xl border border-[#b8d9bb]">
          <p className="text-base font-bold text-[#2d6a35]">¡Orden completada!</p>
          <p className="text-xs text-[#4a7c59] mt-0.5">Tu pedido fue entregado exitosamente</p>
        </div>
      )}
      {cancelled && (
        <div className="text-center mb-4 py-3 bg-red-50 rounded-xl border border-red-200">
          <p className="text-sm font-bold text-red-700">Orden cancelada</p>
        </div>
      )}
      <div className="relative flex items-start justify-between py-2">
        {/* Track background */}
        <div className="absolute top-[18px] left-[calc(100%/(var(--n)*2))] right-[calc(100%/(var(--n)*2))] h-1.5 bg-[#d4e8d5] rounded-full" style={{ left: `${50/steps.length}%`, right: `${50/steps.length}%` }} />
        {/* Animated progress fill */}
        {!cancelled && currentStep > 0 && (
          <div
            className="absolute h-1.5 bg-gradient-to-r from-[#4a7c59] to-[#5a9a6a] rounded-full transition-all duration-700 ease-out"
            style={{
              left: `${50 / steps.length}%`,
              width: `calc(${(currentStep / total) * (100 - 100 / steps.length)}% - ${(currentStep / total) * (100 / steps.length)}% + ${(currentStep / total) * (100 / steps.length)}%)`,
              top: '18px',
              maxWidth: `calc(100% - ${100 / steps.length}%)`,
            }}
          />
        )}
        {steps.map((label, i) => {
          const done = !cancelled && (i < currentStep || (finalizado && i === currentStep))
          const active = !cancelled && !finalizado && i === currentStep
          return (
            <div key={i} className="flex flex-col items-center z-10 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${
                cancelled && i <= currentStep
                  ? 'bg-red-100 border-red-400 text-red-500'
                  : done
                  ? 'bg-[#4a7c59] border-[#4a7c59] text-white shadow-lg shadow-[#4a7c59]/40'
                  : active
                  ? 'bg-[#4a7c59] border-[#4a7c59] text-white shadow-lg shadow-[#4a7c59]/40 ring-4 ring-[#4a7c59]/25 animate-pulse'
                  : 'bg-white border-[#c8dbc9] text-gray-300'
              }`}>
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : cancelled && i <= currentStep ? '✕' : (
                  <span>{i + 1}</span>
                )}
              </div>
              <p className={`text-xs mt-2 text-center transition-all ${
                done ? 'font-bold text-[#2d4a32]'
                : active ? 'font-bold text-[#4a7c59]'
                : 'font-medium text-gray-400'
              }`}>{label}</p>
              {active && <p className="text-[9px] text-[#4a7c59] mt-0.5 font-medium animate-pulse">● ahora</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Purchases() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [compras, setCompras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedCompraId, setSelectedCompraId] = useState<number | null>(null)
  const [filterEstado, setFilterEstado] = useState<string>('todas')
  const [showChat, setShowChat] = useState(false)

  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string; type: 'vendedor' | 'tiendaRetiro'; compraId: number } | null>(null)
  const [reviewedMap, setReviewedMap] = useState<Record<string, number>>({})

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<{ id: number; estado: string } | null>(null)
  const [cancelReviewOpen, setCancelReviewOpen] = useState(false)
  const [cancelReviewTarget, setCancelReviewTarget] = useState<{
    compraId: number; targetId: number; targetActorTipo: 'vendedor' | 'tiendaRetiro'; targetName: string
  } | null>(null)
  const [cancelReviewedMap, setCancelReviewedMap] = useState<Record<string, number>>({})

  const fetchCompras = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const [comprasRes, misReviewsRes] = await Promise.all([
        fetchApi(`/api/compras?compradorId=${user.id}`),
        fetchApi('/api/valoraciones/mias'),
      ])
      const json = await comprasRes.json()
      setCompras((json.data || []).sort((a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ))

      const reviewsJson = await misReviewsRes.json()
      const map: Record<string, number> = {}
      const cancelMap: Record<string, number> = {}
      for (const v of (reviewsJson.data || [])) {
        if (v.compra?.id != null) {
          map[`${v.compra.id}_${v.tipoObjeto}_${v.objetoId}`] = v.puntuacion
          if (v.tipoObjeto?.startsWith('cancelacion_')) {
            const at = v.tipoObjeto.replace('cancelacion_', '')
            cancelMap[`cancel_${v.compra.id}_${at}_${v.objetoId}`] = v.puntuacion
          }
        }
      }
      setReviewedMap(map)
      setCancelReviewedMap(cancelMap)
    } catch {
      setError('No se pudieron cargar las compras')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { fetchCompras() }, [fetchCompras])

  const selectedCompra = compras.find(c => c.id === selectedCompraId)
  const locked = selectedCompra?.estado === 'finalizado' || selectedCompra?.estado === 'cancelado'
  const filteredCompras = compras.filter(c => filterEstado === 'todas' || c.estado === filterEstado)

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7f4]">
        <div className="bg-white rounded-xl shadow-md p-8 text-center border border-[#c8dbc9]">
          <h2 className="text-lg font-bold mb-2 text-[#2d4a32]">No has iniciado sesión</h2>
          <p className="text-[#5a7a62] mb-4">Iniciá sesión para ver tus compras.</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-[#4a7c59] hover:bg-[#3a6b49] text-white px-4 py-2 rounded-lg transition"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  /* ── LIST VIEW ── */
  if (!selectedCompraId) {
    return (
      <div className="min-h-screen bg-[#f4f7f4] py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 bg-[#4a7c59]/10 border border-[#4a7c59]/30 text-[#4a7c59] rounded-full px-2.5 py-1 text-[10px] font-semibold mb-2">
              <span>🛒</span> Como comprador
            </div>
            <h1 className="text-2xl font-bold text-[#2d4a32]">Mis órdenes</h1>
            <p className="text-sm text-[#5a7a62] mt-0.5">Revisá el estado y detalle de todas tus compras.</p>
          </div>

          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="w-full text-sm border border-[#c8dbc9] rounded-lg px-3 py-2 bg-white text-[#2d4a32] focus:outline-none focus:border-[#4a7c59] mb-4"
          >
            <option value="todas">Todas</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_tienda">En tienda</option>
            <option value="pago_confirmado">Pago confirmado</option>
            <option value="listo_para_retirar">Listo para retirar</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {loading && <p className="text-sm text-center text-[#5a7a62] mt-8">Cargando...</p>}
          {error && <p className="text-sm text-center text-red-500 mt-4">{error}</p>}
          {!loading && filteredCompras.length === 0 && (
            <p className="text-sm text-center text-[#5a7a62] mt-8">No hay órdenes.</p>
          )}

          <div className="space-y-3">
            {filteredCompras.map(comp => {
              const firstItem = comp.itemCartas?.[0]
              const sellerName =
                comp.tiendaRetiro?.nombre ||
                firstItem?.uploaderVendedor?.nombre ||
                firstItem?.uploaderTienda?.nombre ||
                'Vendedor'
              const badge = ESTADO_BADGE[comp.estado]
              return (
                <button
                  key={comp.id}
                  onClick={() => { setSelectedCompraId(comp.id); setShowChat(false) }}
                  className="w-full text-left bg-white rounded-xl border border-[#c8dbc9] px-5 py-4 hover:border-[#4a7c59] hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold text-[#2d4a32]">Orden #{comp.id}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${badge?.cls || 'bg-gray-100 text-gray-500'}`}>
                      {badge?.label || comp.estado}
                    </span>
                  </div>
                  <p className="text-sm text-[#5a7a62]">{sellerName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#7a9a7a]">
                      {new Date(comp.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-sm font-bold text-[#4a7c59]">${Number(comp.total || 0).toFixed(2)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Modals */}
        {reviewModalOpen && reviewTarget && (
          <ReviewModal isOpen={reviewModalOpen} onClose={() => setReviewModalOpen(false)} targetId={reviewTarget.id} targetType={reviewTarget.type} targetName={reviewTarget.name} compraId={reviewTarget.compraId}
            onSuccess={(puntuacion) => { setReviewedMap(prev => ({ ...prev, [`${reviewTarget.compraId}_${reviewTarget.type}_${reviewTarget.id}`]: puntuacion })); setReviewModalOpen(false) }} />
        )}
        {cancelModalOpen && cancelTarget && (
          <CancelOrderModal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} compraId={cancelTarget.id} estadoActual={cancelTarget.estado} onSuccess={() => { setCancelModalOpen(false); fetchCompras() }} />
        )}
        {cancelReviewOpen && cancelReviewTarget && (
          <CancelReviewModal isOpen={cancelReviewOpen} onClose={() => setCancelReviewOpen(false)} compraId={cancelReviewTarget.compraId} targetId={cancelReviewTarget.targetId} targetActorTipo={cancelReviewTarget.targetActorTipo} targetName={cancelReviewTarget.targetName}
            onSuccess={(puntuacion) => { const { compraId, targetId, targetActorTipo } = cancelReviewTarget!; setCancelReviewedMap(prev => ({ ...prev, [`cancel_${compraId}_${targetActorTipo}_${targetId}`]: puntuacion })); setCancelReviewOpen(false) }} />
        )}
      </div>
    )
  }

  /* ── DETAIL VIEW ── */
  return (
    <div className="min-h-screen bg-[#f4f7f4] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => { setSelectedCompraId(null); setShowChat(false) }}
          className="flex items-center gap-2 text-sm text-[#5a7a62] hover:text-[#2d4a32] mb-5 transition"
        >
          <ArrowLeft size={16} /> Mis órdenes
        </button>

        {!selectedCompra ? null : (<>
          {/* Order header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#2d4a32]">Orden #{selectedCompra.id}</h2>
              <p className="text-sm text-[#5a7a62] mt-0.5">
                Realizada el{' '}
                {new Date(selectedCompra.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                a las{' '}
                {new Date(selectedCompra.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <StatusBadge estado={selectedCompra.estado} />
          </div>

          {/* Stepper */}
          <div className="bg-white rounded-xl border border-[#c8dbc9] p-5 mb-4">
            <OrderStepper comp={selectedCompra} />
          </div>

          {/* State info boxes */}
          {selectedCompra.estado === 'en_tienda' && (
            <div className="rounded-2xl border-2 border-[#4a7c59] bg-gradient-to-br from-[#e8f0e9] to-[#f0f8f0] p-5 mb-4">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-11 h-11 rounded-full bg-[#4a7c59] flex items-center justify-center text-white text-xl shadow-md">📦</div>
                <div>
                  <p className="font-bold text-[#1a3a22] text-base">¡Tu pedido llegó a la tienda!</p>
                  <p className="text-xs text-[#4a7c59] mt-0.5">El vendedor lo tiene disponible para retirar</p>
                </div>
              </div>
              {selectedCompra.itemCartas?.map((item: any) => item.uploaderVendedor).filter(Boolean).slice(0,1).map((v: any) =>
                v.alias ? <p key={v.id} className="mt-2 text-xs font-semibold text-[#2d4a32] bg-white/70 rounded-lg px-3 py-1.5 border border-[#c8dbc9]">💳 Alias de pago: <span className="text-[#4a7c59] font-bold">{v.alias}</span></p> : null
              )}
            </div>
          )}

          {selectedCompra.estado === 'pago_confirmado' && (
            <div className="rounded-2xl border-2 border-[#4a7c59] bg-gradient-to-br from-[#d4edda] to-[#e8f5eb] p-5 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#2d6a35] flex items-center justify-center text-white text-xl shadow-md">✅</div>
                <div>
                  <p className="font-bold text-[#1a3a22] text-base">¡Pago confirmado!</p>
                  <p className="text-xs text-[#2d6a35] mt-0.5">Ya podés ir a retirar tu pedido</p>
                </div>
              </div>
            </div>
          )}

          {selectedCompra.estado === 'listo_para_retirar' && (
            <div className="rounded-2xl border-2 border-[#4a7c59] bg-gradient-to-br from-[#d4edda] to-[#e8f5eb] p-5 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#4a7c59] flex items-center justify-center text-white text-xl shadow-md">🟢</div>
                <div>
                  <p className="font-bold text-[#1a3a22] text-base">¡Listo para retirar!</p>
                  <p className="text-xs text-[#4a7c59] mt-0.5">Tu pedido te está esperando</p>
                </div>
              </div>
            </div>
          )}

          {selectedCompra.estado === 'cancelado' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <span className="text-xl">🚫</span>
              <div>
                <p className="text-sm font-semibold text-red-700">Orden cancelada</p>
                {selectedCompra.motivoCancelacion && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Motivo: {MOTIVO_LABELS[selectedCompra.motivoCancelacion] || selectedCompra.motivoCancelacion}
                  </p>
                )}
                {selectedCompra.canceladoPorRol && (
                  <p className="text-xs text-red-500 mt-0.5">Cancelada por: el {selectedCompra.canceladoPorRol}</p>
                )}
              </div>
            </div>
          )}

          {/* Two-column info grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Buyer info */}
            <div className="bg-white rounded-xl border border-[#c8dbc9] p-4">
              <p className="text-[10px] font-bold text-[#5a7a62] uppercase tracking-wide mb-2">Comprador</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#4a7c59] text-white flex items-center justify-center text-sm font-bold">
                  {(user?.name || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#2d4a32]">{user?.name}</p>
                  <p className="text-xs text-[#5a7a62]">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Pickup point */}
            <div className="bg-white rounded-xl border border-[#c8dbc9] p-4">
              <p className="text-[10px] font-bold text-[#5a7a62] uppercase tracking-wide mb-2">Punto de entrega</p>
              {selectedCompra.tiendaRetiro ? (
                <div>
                  <p className="text-sm font-semibold text-[#2d4a32]">{selectedCompra.tiendaRetiro.nombre}</p>
                  {selectedCompra.tiendaRetiro.direccion && (
                    <p className="text-xs text-[#5a7a62]">{selectedCompra.tiendaRetiro.direccion}</p>
                  )}
                </div>
              ) : (
                <div>
                  {selectedCompra.itemCartas?.slice(0, 1).map((item: any) => {
                    const v = item.uploaderVendedor || item.uploaderTienda
                    return v ? (
                      <div key={item.id}>
                        <p className="text-sm font-semibold text-[#2d4a32]">{v.nombre}</p>
                        {v.descripcionCompra && (
                          <p className="text-xs text-[#5a7a62] mt-1">{v.descripcionCompra}</p>
                        )}
                      </div>
                    ) : (
                      <p key={item.id} className="text-sm text-[#5a7a62]">Acordar por chat</p>
                    )
                  })}
                </div>
              )}
              {/* Chat button */}
              {!locked && (
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-white bg-[#4a7c59] hover:bg-[#3a6b49] px-3 py-1.5 rounded-lg transition"
                >
                  💬 {showChat ? 'Cerrar chat' : 'Abrir chat'}
                </button>
              )}
            </div>
          </div>

          {/* Inline chat (toggleable) */}
          {showChat && (
            <div className="mb-4">
              <Chat
                compraId={selectedCompra.id}
                locked={locked}
                onOpenInPage={() => navigate(`/chats?compraId=${selectedCompra.id}`)}
                counterpartName={
                  selectedCompra.tiendaRetiro?.nombre ||
                  selectedCompra.itemCartas?.[0]?.uploaderVendedor?.nombre ||
                  selectedCompra.itemCartas?.[0]?.uploaderTienda?.nombre
                }
              />
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-xl border border-[#c8dbc9] p-4 mb-4">
            <p className="text-[10px] font-bold text-[#5a7a62] uppercase tracking-wide mb-3">Artículos comprados</p>
            <div className="space-y-3">
              {selectedCompra.itemCartas?.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#e8f0e9] overflow-hidden shrink-0">
                    {item.carta?.imageUrl || item.carta?.thumbnail ? (
                      <img
                        src={item.carta.imageUrl || item.carta.thumbnail}
                        alt={item.carta?.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#5a7a62] text-xs">🃏</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#2d4a32]">{item.carta?.name || item.nombre || 'Carta'}</p>
                    <p className="text-xs text-[#5a7a62]">Cantidad: {item.cantidad || 1}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#4a7c59]">${Number(item.precio || 0).toFixed(2)}</p>
                </div>
              ))}
              {/* Fallback for legacy items format */}
              {!selectedCompra.itemCartas && (selectedCompra.items || []).map((it: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#e8f0e9] flex items-center justify-center text-[#5a7a62] text-xs shrink-0">
                    🃏
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#2d4a32]">{it.title || `Carta ${it.cartaId || it.itemCartaId || it.id}`}</p>
                    <p className="text-xs text-[#5a7a62]">Cantidad: {it.quantity || 1}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#4a7c59]">${Number(it.price || 0).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary + additional info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-[#c8dbc9] p-4">
              <p className="text-[10px] font-bold text-[#5a7a62] uppercase tracking-wide mb-3">Resumen de la orden</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#5a7a62]">Subtotal</span>
                  <span className="text-[#2d4a32]">${Number(selectedCompra.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#5a7a62]">Envío a tienda</span>
                  <span className="text-[#2d4a32]">$0.00</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-[#c8dbc9] pt-2 mt-2">
                  <span className="text-[#2d4a32]">Total</span>
                  <span className="text-[#4a7c59]">${Number(selectedCompra.total || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#c8dbc9] p-4">
              <p className="text-[10px] font-bold text-[#5a7a62] uppercase tracking-wide mb-3">Información adicional</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[#5a7a62]">
                  <span>📅</span>
                  <span>
                    {new Date(selectedCompra.createdAt).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[#5a7a62]">
                  <span>💳</span>
                  <span>Mercado Pago</span>
                </div>
                <div className="flex items-center gap-2 text-[#5a7a62]">
                  <span>🔖</span>
                  <span>#OP-{String(selectedCompra.id).padStart(6, '0')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* What's next guide */}
          {selectedCompra.estado === 'pendiente' && (
            <div className="rounded-2xl border border-[#c8dbc9] bg-[#f4f7f4] p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-[#e8f0e9] flex items-center justify-center text-lg">⏳</div>
                <div>
                  <p className="text-sm font-bold text-[#2d4a32]">¿Qué sigue?</p>
                  <p className="text-xs text-[#5a7a62] mt-1">
                    {selectedCompra.tiendaRetiro
                      ? 'El vendedor preparará tu pedido y lo llevará a la tienda. Te notificaremos cuando llegue.'
                      : 'Coordiná con el vendedor por chat para acordar la entrega y el pago.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reviews for finalized orders */}
          {selectedCompra.estado === 'finalizado' && (
            <div className="bg-white rounded-xl border border-[#c8dbc9] p-4 mb-4">
              <p className="text-sm font-semibold text-[#2d4a32] mb-3">Calificá tu experiencia</p>
              <div className="flex flex-wrap gap-2">
                {selectedCompra.itemCartas?.map((item: any) => {
                  const v = item.uploaderVendedor
                  if (!v) return null
                  const key = `${selectedCompra.id}_vendedor_${v.id}`
                  const puntuacion = reviewedMap[key]
                  return (
                    <button
                      key={`v-${v.id}`}
                      onClick={() => {
                        setReviewTarget({ id: v.id, name: v.nombre, type: 'vendedor', compraId: selectedCompra.id })
                        setReviewModalOpen(true)
                      }}
                      disabled={!!puntuacion}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        puntuacion
                          ? 'bg-[#e8f0e9] border-[#c8dbc9] text-[#5a7a62]'
                          : 'bg-[#4a7c59] text-white border-[#4a7c59] hover:bg-[#3a6b49]'
                      }`}
                    >
                      {puntuacion ? `★ ${puntuacion} — ${v.nombre}` : `Calificar a ${v.nombre}`}
                    </button>
                  )
                })}
                {/* Vendedor via uploaderTienda without a vendedor */}
                {!selectedCompra.itemCartas?.some((i: any) => i.uploaderVendedor) &&
                  selectedCompra.itemCartas?.map((item: any) => {
                    const t = item.uploaderTienda
                    if (!t) return null
                    const key = `${selectedCompra.id}_tiendaRetiro_${t.id}`
                    const puntuacion = reviewedMap[key]
                    return (
                      <button
                        key={`it-${t.id}`}
                        onClick={() => {
                          setReviewTarget({ id: t.id, name: t.nombre, type: 'tiendaRetiro', compraId: selectedCompra.id })
                          setReviewModalOpen(true)
                        }}
                        disabled={!!puntuacion}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          puntuacion
                            ? 'bg-[#e8f0e9] border-[#c8dbc9] text-[#5a7a62]'
                            : 'bg-[#4a7c59] text-white border-[#4a7c59] hover:bg-[#3a6b49]'
                        }`}
                      >
                        {puntuacion ? `★ ${puntuacion} — ${t.nombre}` : `Calificar a ${t.nombre}`}
                      </button>
                    )
                  })}
                {selectedCompra.tiendaRetiro && (() => {
                  const t = selectedCompra.tiendaRetiro
                  const key = `${selectedCompra.id}_tiendaRetiro_${t.id}`
                  const puntuacion = reviewedMap[key]
                  return (
                    <button
                      key={`t-${t.id}`}
                      onClick={() => {
                        setReviewTarget({ id: t.id, name: t.nombre, type: 'tiendaRetiro', compraId: selectedCompra.id })
                        setReviewModalOpen(true)
                      }}
                      disabled={!!puntuacion}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                        puntuacion
                          ? 'bg-[#e8f0e9] border-[#c8dbc9] text-[#5a7a62]'
                          : 'bg-[#4a7c59] text-white border-[#4a7c59] hover:bg-[#3a6b49]'
                      }`}
                    >
                      {puntuacion ? `★ ${puntuacion} — ${t.nombre}` : `Calificar a ${t.nombre}`}
                    </button>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Cancel button */}
          {!['finalizado', 'cancelado'].includes(selectedCompra.estado) && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => {
                  setCancelTarget({ id: selectedCompra.id, estado: selectedCompra.estado })
                  setCancelModalOpen(true)
                }}
                className="flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 px-4 py-2 rounded-lg transition"
              >
                🚫 Cancelar orden
              </button>
            </div>
          )}

          {/* Cancel review for cancelled orders */}
          {selectedCompra.estado === 'cancelado' && (() => {
            const compraId = selectedCompra.id
            const rol = selectedCompra.canceladoPorRol
            const vendedor = selectedCompra.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor
            const tiendaVendedora = selectedCompra.itemCartas?.find((ic: any) => ic.uploaderTienda)?.uploaderTienda

            let target: { id: number; tipo: 'vendedor' | 'tiendaRetiro'; nombre: string } | null = null
            let isOptional = false

            if (rol === 'vendedor' && vendedor) {
              target = { id: vendedor.id, tipo: 'vendedor', nombre: vendedor.nombre }
            } else if (rol === 'tienda' && selectedCompra.tiendaRetiro) {
              target = { id: selectedCompra.tiendaRetiro.id, tipo: 'tiendaRetiro', nombre: selectedCompra.tiendaRetiro.nombre }
            } else if (rol === 'comprador') {
              isOptional = true
              if (vendedor) target = { id: vendedor.id, tipo: 'vendedor', nombre: vendedor.nombre }
              else if (selectedCompra.tiendaRetiro) target = { id: selectedCompra.tiendaRetiro.id, tipo: 'tiendaRetiro', nombre: selectedCompra.tiendaRetiro.nombre }
              else if (tiendaVendedora) target = { id: tiendaVendedora.id, tipo: 'tiendaRetiro', nombre: tiendaVendedora.nombre }
            }

            if (!target) return null

            const ckey = `cancel_${compraId}_${target.tipo}_${target.id}`
            if (cancelReviewedMap[ckey]) {
              return (
                <div className="flex items-center gap-2 text-xs text-[#5a7a62] mb-4">
                  <span className="text-amber-400">{'★'.repeat(cancelReviewedMap[ckey])}{'☆'.repeat(5 - cancelReviewedMap[ckey])}</span>
                  <span>Gestión de cancelación valorada</span>
                </div>
              )
            }

            return (
              <div className="flex justify-start mb-4">
                <button
                  onClick={() => {
                    setCancelReviewTarget({
                      compraId,
                      targetId: target!.id,
                      targetActorTipo: target!.tipo,
                      targetName: target!.nombre,
                    })
                    setCancelReviewOpen(true)
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                    isOptional
                      ? 'border-[#c8dbc9] text-[#4a7c59] hover:bg-[#e8f0e9]'
                      : 'border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  📋 {isOptional ? 'Valorar gestión (opcional)' : `Calificar manejo de cancelación de ${target.nombre}`}
                </button>
              </div>
            )
          })()}
        </>)}
      </div>

      {/* Modals */}
      {reviewModalOpen && reviewTarget && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          targetId={reviewTarget.id}
          targetType={reviewTarget.type}
          targetName={reviewTarget.name}
          compraId={reviewTarget.compraId}
          onSuccess={(puntuacion) => {
            setReviewedMap(prev => ({
              ...prev,
              [`${reviewTarget.compraId}_${reviewTarget.type}_${reviewTarget.id}`]: puntuacion,
            }))
            setReviewModalOpen(false)
          }}
        />
      )}

      {cancelModalOpen && cancelTarget && (
        <CancelOrderModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          compraId={cancelTarget.id}
          estadoActual={cancelTarget.estado}
          onSuccess={() => { setCancelModalOpen(false); fetchCompras() }}
        />
      )}

      {cancelReviewOpen && cancelReviewTarget && (
        <CancelReviewModal
          isOpen={cancelReviewOpen}
          onClose={() => setCancelReviewOpen(false)}
          compraId={cancelReviewTarget.compraId}
          targetId={cancelReviewTarget.targetId}
          targetActorTipo={cancelReviewTarget.targetActorTipo}
          targetName={cancelReviewTarget.targetName}
          onSuccess={(puntuacion) => {
            const { compraId, targetId, targetActorTipo } = cancelReviewTarget!
            setCancelReviewedMap(prev => ({
              ...prev,
              [`cancel_${compraId}_${targetActorTipo}_${targetId}`]: puntuacion,
            }))
            setCancelReviewOpen(false)
          }}
        />
      )}
    </div>
  )
}

export default Purchases
