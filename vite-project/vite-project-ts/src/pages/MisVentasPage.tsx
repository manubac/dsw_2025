import React, { useEffect, useState } from 'react';
import { useUser } from '../context/user';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { Chat } from '../components/Chat';
import { ReviewModal } from '../components/ReviewModal';
import { CancelOrderModal } from '../components/CancelOrderModal';
import { CancelReviewModal } from '../components/CancelReviewModal';

const MOTIVO_LABELS: Record<string, string> = {
  sin_stock: 'Sin stock',
  error_precio: 'Error de precio',
  producto_daniado: 'Producto dañado',
  no_respondio: 'No respondió',
  cambio_decision: 'Cambio de decisión',
  sospecha_fraude: 'Sospecha de fraude',
  problema_tienda: 'Problema con tienda',
  otro: 'Otro',
};

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pendiente:          { label: 'Pendiente',         cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  en_tienda:          { label: 'En tienda',          cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  pago_confirmado:    { label: 'Pago confirmado',    cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  listo_para_retirar: { label: 'Listo para retirar', cls: 'bg-[#e8f2f8] text-[#1a3a52] border border-[#c2d9ec]' },
  finalizado:         { label: 'Finalizado',         cls: 'bg-[#e8f2f8] text-[#1a3a52] border border-[#c2d9ec]' },
  cancelado:          { label: 'Cancelado',          cls: 'bg-red-50 text-red-700 border border-red-200' },
};

function StatusBadge({ estado }: { estado: string }) {
  const s = ESTADO_BADGE[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

function getSteps(venta: any): string[] {
  if (venta.tiendaRetiro) return ['Pendiente', 'En tienda', 'Pago confirmado', 'Finalizado'];
  return ['Pendiente', 'Finalizado'];
}

function getStepIndex(venta: any): number {
  if (venta.tiendaRetiro) {
    const map: Record<string, number> = { pendiente: 0, en_tienda: 1, pago_confirmado: 2, finalizado: 3, cancelado: 4 };
    return map[venta.estado] ?? 0;
  }
  const map: Record<string, number> = { pendiente: 0, finalizado: 1, cancelado: 2 };
  return map[venta.estado] ?? 0;
}

function OrderStepper({ venta }: { venta: any }) {
  const steps = getSteps(venta)
  const currentStep = getStepIndex(venta)
  const cancelled = venta.estado === 'cancelado'
  const finalizado = venta.estado === 'finalizado'
  const total = steps.length - 1

  return (
    <div>
      {finalizado && (
        <div className="text-center mb-4 py-3 bg-gradient-to-r from-[#e8f2f8] to-[#d4eaf8] rounded-xl border border-[#c2d9ec]">
          <p className="text-base font-bold text-[#1a3a52]">¡Venta completada!</p>
          <p className="text-xs text-[#1e6fa8] mt-0.5">Esta transacción fue finalizada exitosamente</p>
        </div>
      )}
      <div className="relative flex items-start justify-between py-2">
        <div className="absolute top-[18px] h-1.5 bg-[#c2d9ec] rounded-full" style={{ left: `${50/steps.length}%`, right: `${50/steps.length}%` }} />
        {!cancelled && currentStep > 0 && (
          <div className="absolute h-1.5 bg-gradient-to-r from-[#1e6fa8] to-[#2a8fd8] rounded-full transition-all duration-700 ease-out"
            style={{ left: `${50/steps.length}%`, width: `calc(${(currentStep/total)*(100 - 100/steps.length)}%)`, top: '18px' }} />
        )}
        {steps.map((label, i) => {
          const done = !cancelled && (i < currentStep || (finalizado && i === currentStep))
          const active = !cancelled && !finalizado && i === currentStep
          return (
            <div key={i} className="flex flex-col items-center z-10 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${
                cancelled && i <= currentStep ? 'bg-red-100 border-red-400 text-red-500' :
                done ? 'bg-[#1e6fa8] border-[#1e6fa8] text-white shadow-lg shadow-[#1e6fa8]/40' :
                active ? 'bg-[#1e6fa8] border-[#1e6fa8] text-white shadow-lg shadow-[#1e6fa8]/40 ring-4 ring-[#1e6fa8]/25 animate-pulse' :
                'bg-white border-[#c2d9ec] text-gray-300'
              }`}>
                {done ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                : cancelled && i <= currentStep ? '✕' : i + 1}
              </div>
              <p className={`text-xs mt-2 text-center ${done ? 'font-bold text-[#1a3a52]' : active ? 'font-bold text-[#1e6fa8]' : 'font-medium text-gray-400'}`}>{label}</p>
              {active && <p className="text-[9px] text-[#1e6fa8] mt-0.5 font-medium animate-pulse">● activo</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MisVentasPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [miAlias, setMiAlias] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [selectedVentaId, setSelectedVentaId] = useState<number | null>(
    (location.state as any)?.selectedOrderId ?? null
  );
  const [filterEstado, setFilterEstado] = useState<string>('todas');
  const [showChat, setShowChat] = useState(false);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string; type: 'tiendaRetiro' | 'user'; compraId: number } | null>(null);
  const [reviewedMap, setReviewedMap] = useState<Record<string, number>>({});

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: number; estado: string } | null>(null);
  const [cancelReviewOpen, setCancelReviewOpen] = useState(false);
  const [cancelReviewTarget, setCancelReviewTarget] = useState<{
    compraId: number; targetId: number; targetActorTipo: 'user' | 'tiendaRetiro'; targetName: string;
  } | null>(null);
  const [cancelReviewedMap, setCancelReviewedMap] = useState<Record<string, number>>({});

  const fetchVentas = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const isTienda = user.role === 'tiendaRetiro';
      const ventasUrl = isTienda
        ? `/api/tiendas/${user.id}/ventas-directas`
        : `/api/vendedores/${user.id}/ventas`;
      const [ventasRes, perfilRes, misReviewsRes] = await Promise.all([
        api.get(ventasUrl),
        isTienda ? Promise.resolve({ data: { data: null } }) : api.get(`/api/vendedores/${user.id}`),
        api.get('/api/valoraciones/mias'),
      ]);
      setVentas((ventasRes.data.data || []).sort((a: any, b: any) =>
        new Date(b.fecha || b.createdAt || 0).getTime() - new Date(a.fecha || a.createdAt || 0).getTime()
      ));
      setMiAlias(perfilRes.data.data?.alias ?? null);

      const map: Record<string, number> = {};
      const cancelMap: Record<string, number> = {};
      for (const v of (misReviewsRes.data.data || [])) {
        if (v.compra?.id != null) {
          map[`${v.compra.id}_${v.tipoObjeto}_${v.objetoId}`] = v.puntuacion;
          if (v.tipoObjeto?.startsWith('cancelacion_')) {
            const at = v.tipoObjeto.replace('cancelacion_', '');
            cancelMap[`cancel_${v.compra.id}_${at}_${v.objetoId}`] = v.puntuacion;
          }
        }
      }
      setReviewedMap(map);
      setCancelReviewedMap(cancelMap);
    } catch {
      setError('No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || (user.role !== 'vendedor' && user.role !== 'tiendaRetiro')) { navigate('/'); return; }
    fetchVentas();
  }, [user, navigate]);

  const handleMarkSent = async (compraId: number) => {
    if (!confirm('¿Confirmás que has enviado los items al intermediario?')) return;
    setActionLoading(compraId);
    try {
      await api.post(`/api/vendedores/${user?.id}/ventas/${compraId}/enviar`);
      await fetchVentas();
    } catch (err: any) {
      alert('Error al actualizar envío: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalizar = async (compraId: number) => {
    if (!confirm('¿Confirmás que la entrega fue completada?')) return;
    setActionLoading(compraId);
    try {
      await api.patch(`/api/vendedores/${user?.id}/ventas/${compraId}/finalizar`);
      await fetchVentas();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarcarPagoRecibido = async (compraId: number) => {
    if (!confirm('¿Confirmás que recibiste el pago del comprador?')) return;
    setActionLoading(compraId);
    try {
      await api.patch(`/api/vendedores/${user?.id}/ventas/${compraId}/pago-confirmado`);
      await fetchVentas();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredVentas = ventas.filter(v => filterEstado === 'todas' || v.estado === filterEstado);
  const selectedVenta = ventas.find(v => v.id === selectedVentaId) ?? null;

  /* ── LIST VIEW ── */
  if (!selectedVentaId) {
    return (
      <div className="min-h-screen bg-[#f4f7fc] py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 bg-[#1e6fa8]/10 border border-[#1e6fa8]/30 text-[#1e6fa8] rounded-full px-2.5 py-1 text-[10px] font-semibold mb-2">
              <span>{user?.role === 'tiendaRetiro' ? '🏬' : '📦'}</span>
              {user?.role === 'tiendaRetiro' ? 'Como tienda (vendedor)' : 'Como vendedor'}
            </div>
            <h1 className="text-2xl font-bold text-[#1a3a52]">Mis ventas</h1>
            <p className="text-sm text-[#3a6a8a] mt-0.5">Gestioná todas tus ventas activas.</p>
          </div>

          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="w-full text-sm border border-[#c2d9ec] rounded-lg px-3 py-2 bg-white text-[#1a3a52] focus:outline-none focus:border-[#1e6fa8] mb-4"
          >
            <option value="todas">Todas</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_tienda">En tienda</option>
            <option value="pago_confirmado">Pago confirmado</option>
            <option value="listo_para_retirar">Listo para retirar</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          {loading && <p className="text-sm text-center text-[#3a6a8a] mt-8">Cargando...</p>}
          {!loading && filteredVentas.length === 0 && (
            <p className="text-sm text-center text-[#3a6a8a] mt-8">
              {filterEstado === 'todas' ? 'Aún no tenés ventas.' : 'No hay ventas con este estado.'}
            </p>
          )}

          <div className="space-y-3">
            {filteredVentas.map(venta => {
              const buyerName = venta.comprador?.nombre || venta.compradorTienda?.nombre || 'Comprador';
              const badge = ESTADO_BADGE[venta.estado];
              return (
                <button
                  key={venta.id}
                  onClick={() => { setSelectedVentaId(venta.id); setShowChat(false); }}
                  className="w-full text-left bg-white rounded-xl border border-[#c2d9ec] px-5 py-4 hover:border-[#1e6fa8] hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold text-[#1a3a52]">Orden #{venta.id}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${badge?.cls || 'bg-gray-100 text-gray-500'}`}>
                      {badge?.label || venta.estado}
                    </span>
                  </div>
                  <p className="text-sm text-[#3a6a8a]">{buyerName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#6a8aaa]">
                      {new Date(venta.createdAt || venta.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-sm font-bold text-[#1e6fa8]">${Number(venta.total || 0).toFixed(2)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Modals in list view */}
        {reviewTarget && (<ReviewModal isOpen={reviewModalOpen} onClose={() => setReviewModalOpen(false)} targetId={reviewTarget.id} targetType={reviewTarget.type} targetName={reviewTarget.name} compraId={reviewTarget.compraId}
          onSuccess={(puntuacion) => { const key = `${reviewTarget.compraId}_${reviewTarget.type}_${reviewTarget.id}`; setReviewedMap(prev => ({ ...prev, [key]: puntuacion })); setReviewModalOpen(false); }} />)}
        {cancelTarget && (<CancelOrderModal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} compraId={cancelTarget.id} estadoActual={cancelTarget.estado} onSuccess={() => fetchVentas()} />)}
        {cancelReviewTarget && (<CancelReviewModal isOpen={cancelReviewOpen} onClose={() => setCancelReviewOpen(false)} targetId={cancelReviewTarget.targetId} targetActorTipo={cancelReviewTarget.targetActorTipo} targetName={cancelReviewTarget.targetName} compraId={cancelReviewTarget.compraId}
          onSuccess={(puntuacion) => { const { compraId, targetId, targetActorTipo } = cancelReviewTarget!; setCancelReviewedMap(prev => ({ ...prev, [`cancel_${compraId}_${targetActorTipo}_${targetId}`]: puntuacion })); setCancelReviewOpen(false); }} />)}
      </div>
    );
  }

  /* ── DETAIL VIEW ── */
  return (
    <div className="min-h-screen bg-[#f4f7fc] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => { setSelectedVentaId(null); setShowChat(false); }}
          className="flex items-center gap-2 text-sm text-[#3a6a8a] hover:text-[#1a3a52] mb-5 transition"
        >
          <ArrowLeft size={16} /> Mis ventas
        </button>

        {!selectedVenta ? null : (<>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#1a3a52]">Orden #{selectedVenta.id}</h2>
              <p className="text-sm text-[#3a6a8a] mt-0.5">
                Realizada el {new Date(selectedVenta.createdAt || selectedVenta.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <StatusBadge estado={selectedVenta.estado} />
          </div>

          {/* Stepper */}
          <div className="bg-white rounded-xl border border-[#c2d9ec] p-5 mb-4">
            <OrderStepper venta={selectedVenta} />
          </div>

          {/* State info boxes */}
          {selectedVenta.estado === 'pendiente' && selectedVenta.tiendaRetiro && (
            <div className="rounded-2xl border-2 border-[#1e6fa8] bg-gradient-to-br from-[#e8f2f8] to-[#f0f7fd] p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-[#1e6fa8] flex items-center justify-center text-white text-xl shadow-md">🚀</div>
                <div>
                  <p className="font-bold text-[#1a3a52] text-base">Acción requerida</p>
                  <p className="text-xs text-[#3a6a8a] mt-0.5">Llevá el pedido a {selectedVenta.tiendaRetiro.nombre}</p>
                </div>
              </div>
              <button onClick={() => handleMarkSent(selectedVenta.id)} disabled={actionLoading === selectedVenta.id}
                className="w-full bg-[#1e6fa8] hover:bg-[#155e8a] text-white text-sm font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-[#1e6fa8]/30 disabled:opacity-50">
                {actionLoading === selectedVenta.id ? 'Procesando...' : <><span>Confirmar entrega a tienda</span><span>→</span></>}
              </button>
            </div>
          )}
          {selectedVenta.estado === 'en_tienda' && (
            <div className="rounded-2xl border-2 border-[#1e6fa8] bg-gradient-to-br from-[#e8f2f8] to-[#f0f7fd] p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-[#1e6fa8] flex items-center justify-center text-white text-xl shadow-md">💳</div>
                <div>
                  <p className="font-bold text-[#1a3a52] text-base">Esperando pago del comprador</p>
                  <p className="text-xs text-[#3a6a8a] mt-0.5">Tu alias: <span className="font-bold text-[#1e6fa8]">{miAlias || '—'}</span></p>
                </div>
              </div>
              <button onClick={() => handleMarcarPagoRecibido(selectedVenta.id)} disabled={actionLoading === selectedVenta.id}
                className="w-full bg-[#1e6fa8] hover:bg-[#155e8a] text-white text-sm font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-[#1e6fa8]/30 disabled:opacity-50">
                {actionLoading === selectedVenta.id ? 'Procesando...' : <><span>Confirmar pago recibido</span><span>→</span></>}
              </button>
            </div>
          )}
          {selectedVenta.estado === 'pago_confirmado' && (
            <div className="rounded-2xl border-2 border-[#1e6fa8] bg-gradient-to-br from-[#d4eaf8] to-[#e8f5fd] p-5 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#2d6a9a] flex items-center justify-center text-white text-xl shadow-md">✅</div>
                <div>
                  <p className="font-bold text-[#1a3a52] text-base">¡Pago confirmado!</p>
                  <p className="text-xs text-[#3a6a8a] mt-0.5">El comprador ya puede ir a retirar su pedido</p>
                </div>
              </div>
            </div>
          )}
          {selectedVenta.estado === 'cancelado' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <span className="text-xl">🚫</span>
              <div>
                <p className="text-sm font-semibold text-red-700">Venta cancelada</p>
                {selectedVenta.motivoCancelacion && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Motivo: {MOTIVO_LABELS[selectedVenta.motivoCancelacion] || selectedVenta.motivoCancelacion}
                  </p>
                )}
                {selectedVenta.canceladoPorRol && (
                  <p className="text-xs text-red-500 mt-0.5">Cancelado por: el {selectedVenta.canceladoPorRol}</p>
                )}
                {/* Cancel review button */}
                {(() => {
                  const rol = selectedVenta.canceladoPorRol;
                  if (!rol) return null;
                  let target: { id: number; tipo: 'user' | 'tiendaRetiro'; nombre: string } | null = null;
                  let isOptional = false;
                  if (rol === 'comprador') {
                    const cid = selectedVenta.comprador?.id;
                    if (cid) target = { id: cid, tipo: 'user', nombre: selectedVenta.comprador.nombre };
                  } else if (rol === 'vendedor') {
                    isOptional = true;
                    const cid = selectedVenta.comprador?.id;
                    if (cid) target = { id: cid, tipo: 'user', nombre: selectedVenta.comprador.nombre };
                  } else if (rol === 'tienda' && selectedVenta.tiendaRetiro) {
                    target = { id: selectedVenta.tiendaRetiro.id, tipo: 'tiendaRetiro', nombre: selectedVenta.tiendaRetiro.nombre };
                  }
                  if (!target) return null;
                  const key = `cancel_${selectedVenta.id}_${target.tipo}_${target.id}`;
                  const reviewed = cancelReviewedMap[key];
                  return reviewed != null ? (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                      <span className="text-orange-300">{'★'.repeat(reviewed)}{'☆'.repeat(5 - reviewed)}</span>
                      <span>Gestión valorada</span>
                    </div>
                  ) : (
                    <button
                      className={`mt-2 text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                        isOptional
                          ? 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-500'
                          : 'bg-white border border-red-200 hover:bg-red-50 text-red-600'
                      }`}
                      onClick={() => {
                        setCancelReviewTarget({ compraId: selectedVenta.id, targetId: target!.id, targetActorTipo: target!.tipo, targetName: target!.nombre });
                        setCancelReviewOpen(true);
                      }}
                    >
                      📋 {isOptional ? 'Valorar gestión (opcional)' : 'Valorar gestión de esta cancelación'}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Buyer + Delivery point info grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-[#c2d9ec] p-4">
              <p className="text-[10px] font-bold text-[#3a6a8a] uppercase tracking-wide mb-2">Comprador</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#e8f2f8] text-[#1e6fa8] flex items-center justify-center text-sm font-bold">
                  {(selectedVenta.comprador?.nombre || 'C')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1a3a52]">{selectedVenta.comprador?.nombre || 'N/A'}</p>
                  <p className="text-xs text-[#3a6a8a]">{selectedVenta.comprador?.email || ''}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#c2d9ec] p-4">
              <p className="text-[10px] font-bold text-[#3a6a8a] uppercase tracking-wide mb-2">Punto de entrega</p>
              {selectedVenta.tiendaRetiro ? (
                <>
                  <p className="text-sm font-semibold text-[#1a3a52]">{selectedVenta.tiendaRetiro.nombre}</p>
                  {selectedVenta.tiendaRetiro.direccion && (
                    <p className="text-xs text-[#3a6a8a]">{selectedVenta.tiendaRetiro.direccion}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[#3a6a8a]">Entrega directa — coordiná por chat</p>
              )}
              {/* Chat button — only for non-tiendaRetiro orders */}
              {!selectedVenta.tiendaRetiro && !['finalizado', 'cancelado'].includes(selectedVenta.estado) && (
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="mt-3 flex items-center gap-1.5 text-xs font-medium text-white bg-[#1e6fa8] hover:bg-[#155e8a] px-3 py-1.5 rounded-lg transition"
                >
                  💬 {showChat ? 'Cerrar chat' : 'Abrir chat'}
                </button>
              )}
            </div>
          </div>

          {/* Inline chat for direct sales */}
          {showChat && !selectedVenta.tiendaRetiro && (
            <div className="mb-4">
              <Chat
                compraId={selectedVenta.id}
                locked={['finalizado', 'cancelado'].includes(selectedVenta.estado)}
                onOpenInPage={() => navigate(`/chats?compraId=${selectedVenta.id}`)}
                counterpartName={selectedVenta.comprador?.nombre}
              />
            </div>
          )}

          {/* Intermediario envio info */}
          {selectedVenta.envio?.intermediario && (
            <div className="bg-white rounded-xl border border-[#c2d9ec] p-4 mb-4">
              <p className="text-[10px] font-bold text-[#3a6a8a] uppercase tracking-wide mb-2">Envío a intermediario</p>
              <p className="text-sm font-semibold text-[#1a3a52]">{selectedVenta.envio.intermediario.nombre}</p>
              <p className="text-xs text-[#3a6a8a] font-mono">{selectedVenta.envio.intermediario.direccion}</p>
            </div>
          )}

          {/* Items */}
          <div className="bg-white rounded-xl border border-[#c2d9ec] p-4 mb-4">
            <p className="text-[10px] font-bold text-[#3a6a8a] uppercase tracking-wide mb-3">Artículos vendidos</p>
            <div className="space-y-3">
              {(selectedVenta.itemCartas || selectedVenta.items || []).map((item: any, idx: number) => (
                <div key={item.id ?? idx} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#e8f2f8] overflow-hidden shrink-0">
                    {item.carta?.imageUrl || item.carta?.thumbnail || item.image ? (
                      <img
                        src={item.carta?.imageUrl || item.carta?.thumbnail || item.image}
                        alt={item.carta?.name || item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#3a6a8a] text-xs">🃏</div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1a3a52]">
                      {item.carta?.name || item.cartaNombre || item.nombre || item.name || 'Carta'}
                    </p>
                    <p className="text-xs text-[#3a6a8a]">Cantidad: {item.cantidad || 1}</p>
                  </div>
                  <p className="text-sm font-semibold text-[#1e6fa8]">
                    ${Number(item.precio ?? item.price ?? 0).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Order summary + Info */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-[#c2d9ec] p-4">
              <p className="text-[10px] font-bold text-[#3a6a8a] uppercase tracking-wide mb-3">Resumen</p>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-[#1a3a52]">Total</span>
                <span className="text-[#1e6fa8]">${Number(selectedVenta.total || 0).toFixed(2)}</span>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#c2d9ec] p-4">
              <p className="text-[10px] font-bold text-[#3a6a8a] uppercase tracking-wide mb-3">Información</p>
              <div className="text-xs text-[#3a6a8a] space-y-1">
                <p>📅 {new Date(selectedVenta.createdAt || selectedVenta.fecha).toLocaleDateString('es-AR')}</p>
                <p>🔖 #OP-{String(selectedVenta.id).padStart(6, '0')}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {/* pendiente + no tiendaRetiro → finalizar */}
          {selectedVenta.estado === 'pendiente' && !selectedVenta.tiendaRetiro && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => handleFinalizar(selectedVenta.id)}
                disabled={actionLoading === selectedVenta.id}
                className="bg-[#1e6fa8] hover:bg-[#155e8a] text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                {actionLoading === selectedVenta.id ? 'Procesando...' : 'Marcar como finalizado'}
              </button>
            </div>
          )}
          {/* Marcar enviado al intermediario (flujo con envio) */}
          {selectedVenta.envio &&
            selectedVenta.estado !== 'ENVIADO_A_INTERMEDIARIO' &&
            selectedVenta.estado !== 'ENTREGADO' &&
            selectedVenta.estado !== 'entregado' && (
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => handleMarkSent(selectedVenta.id)}
                  disabled={actionLoading === selectedVenta.id}
                  className="bg-[#1e6fa8] hover:bg-[#155e8a] text-white text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
                >
                  {actionLoading === selectedVenta.id ? 'Procesando...' : 'Ya envié al Intermediario'}
                </button>
              </div>
            )}
          {/* Only keep cancel button here — action buttons moved to state banners */}
          {!['finalizado','cancelado'].includes(selectedVenta.estado) && (
            <div className="flex justify-end mb-4">
              <button onClick={() => { setCancelTarget({ id: selectedVenta.id, estado: selectedVenta.estado }); setCancelModalOpen(true) }}
                className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:border-red-300 transition">
                🚫 Cancelar orden
              </button>
            </div>
          )}

          {/* Reviews for finalized */}
          {selectedVenta.estado === 'finalizado' && (
            <div className="bg-white rounded-xl border border-[#c2d9ec] p-4 mb-4">
              <p className="text-sm font-semibold text-[#1a3a52] mb-3">Calificá al comprador</p>
              <div className="flex flex-col gap-2">
                {selectedVenta.tiendaRetiro && (() => {
                  const key = `${selectedVenta.id}_tiendaRetiro_${selectedVenta.tiendaRetiro.id}`;
                  const puntuacion = reviewedMap[key];
                  return (
                    <button
                      onClick={() => { setReviewTarget({ id: selectedVenta.tiendaRetiro.id, name: selectedVenta.tiendaRetiro.nombre, type: 'tiendaRetiro', compraId: selectedVenta.id }); setReviewModalOpen(true); }}
                      disabled={!!puntuacion}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition text-left ${puntuacion ? 'bg-[#e8f2f8] border-[#c2d9ec] text-[#3a6a8a]' : 'bg-[#1e6fa8] text-white border-[#1e6fa8] hover:bg-[#155e8a]'}`}
                    >
                      {puntuacion ? `★ ${puntuacion} — ${selectedVenta.tiendaRetiro.nombre}` : `Calificar tienda: ${selectedVenta.tiendaRetiro.nombre}`}
                    </button>
                  );
                })()}
                {selectedVenta.comprador?.id && (() => {
                  const key = `${selectedVenta.id}_user_${selectedVenta.comprador.id}`;
                  const puntuacion = reviewedMap[key];
                  return (
                    <button
                      onClick={() => { setReviewTarget({ id: selectedVenta.comprador.id, name: selectedVenta.comprador.nombre, type: 'user', compraId: selectedVenta.id }); setReviewModalOpen(true); }}
                      disabled={!!puntuacion}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition text-left ${puntuacion ? 'bg-[#e8f2f8] border-[#c2d9ec] text-[#3a6a8a]' : 'bg-[#1e6fa8] text-white border-[#1e6fa8] hover:bg-[#155e8a]'}`}
                    >
                      {puntuacion ? `★ ${puntuacion} — ${selectedVenta.comprador.nombre}` : `Calificar a ${selectedVenta.comprador.nombre}`}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

        </>)}
      </div>

      {/* Modals */}
      {reviewTarget && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => setReviewModalOpen(false)}
          targetId={reviewTarget.id}
          targetType={reviewTarget.type}
          targetName={reviewTarget.name}
          compraId={reviewTarget.compraId}
          onSuccess={(puntuacion) => {
            const key = `${reviewTarget.compraId}_${reviewTarget.type}_${reviewTarget.id}`;
            setReviewedMap(prev => ({ ...prev, [key]: puntuacion }));
            setReviewModalOpen(false);
          }}
        />
      )}

      {cancelTarget && (
        <CancelOrderModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          compraId={cancelTarget.id}
          estadoActual={cancelTarget.estado}
          onSuccess={() => fetchVentas()}
        />
      )}

      {cancelReviewTarget && (
        <CancelReviewModal
          isOpen={cancelReviewOpen}
          onClose={() => setCancelReviewOpen(false)}
          targetId={cancelReviewTarget.targetId}
          targetActorTipo={cancelReviewTarget.targetActorTipo}
          targetName={cancelReviewTarget.targetName}
          compraId={cancelReviewTarget.compraId}
          onSuccess={(puntuacion) => {
            const { compraId, targetId, targetActorTipo } = cancelReviewTarget!;
            setCancelReviewedMap(prev => ({ ...prev, [`cancel_${compraId}_${targetActorTipo}_${targetId}`]: puntuacion }));
            setCancelReviewOpen(false);
          }}
        />
      )}
    </div>
  );
}
