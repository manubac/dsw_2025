import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useUser } from "../context/user";
import { useNotifications } from "../context/notifications";
import { useLocation } from "react-router-dom";
import { fetchApi } from "../services/api";
import { ReviewModal } from "../components/ReviewModal";
import { CancelOrderModal } from "../components/CancelOrderModal";
import { CancelReviewModal } from "../components/CancelReviewModal";

type VentaItem = { cartaNombre: string; cantidad: number; precio: number };
type Vendedor = { id?: number; nombre: string; alias: string | null; cbu: string | null };
type Venta = {
  id: number;
  estado: string;
  total: number;
  createdAt: string;
  comprador: { id: number | null; nombre: string; email: string };
  vendedores: Vendedor[];
  items: VentaItem[];
  motivoCancelacion?: string;
  canceladoPorRol?: string;
  estadoAntesCancelacion?: string;
};

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
  pendiente:       { label: 'Pendiente',      cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  en_tienda:       { label: 'En tienda',       cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  pago_confirmado: { label: 'Pago confirmado', cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  finalizado:      { label: 'Finalizado',      cls: 'bg-[#f0eaf8] text-[#2d1a4a] border border-[#d8c8e8]' },
  cancelado:       { label: 'Cancelado',       cls: 'bg-red-50 text-red-700 border border-red-200' },
};

function StatusBadge({ estado }: { estado: string }) {
  const s = ESTADO_BADGE[estado] ?? { label: estado, cls: 'bg-gray-100 text-gray-600 border border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}

const STEPS = ['Pendiente', 'En tienda', 'Pago confirmado', 'Finalizado'];
const ESTADO_STEP: Record<string, number> = {
  pendiente: 0,
  en_tienda: 1,
  pago_confirmado: 2,
  finalizado: 3,
  cancelado: 4,
};

function OrderStepper({ estado }: { estado: string }) {
  const currentStep = ESTADO_STEP[estado] ?? 0
  const cancelled = estado === 'cancelado'
  const finalizado = estado === 'finalizado'
  const total = STEPS.length - 1

  return (
    <div>
      {finalizado && (
        <div className="text-center mb-4 py-3 bg-gradient-to-r from-[#f0eaf8] to-[#e8d8f5] rounded-xl border border-[#d8c8e8]">
          <p className="text-base font-bold text-[#2d1a4a]">¡Entrega completada!</p>
          <p className="text-xs text-[#6d3ab0] mt-0.5">La transacción fue finalizada en tu tienda</p>
        </div>
      )}
      <div className="relative flex items-start justify-between py-2">
        <div className="absolute top-[18px] h-1.5 bg-[#d8c8e8] rounded-full" style={{ left: `${50/STEPS.length}%`, right: `${50/STEPS.length}%` }} />
        {!cancelled && currentStep > 0 && (
          <div className="absolute h-1.5 bg-gradient-to-r from-[#6d3ab0] to-[#8d5ad0] rounded-full transition-all duration-700 ease-out"
            style={{ left: `${50/STEPS.length}%`, width: `calc(${(currentStep/total)*(100 - 100/STEPS.length)}%)`, top: '18px' }} />
        )}
        {STEPS.map((label, i) => {
          const done = !cancelled && (i < currentStep || (finalizado && i === currentStep))
          const active = !cancelled && !finalizado && i === currentStep
          return (
            <div key={i} className="flex flex-col items-center z-10 flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-500 ${
                cancelled && i <= currentStep ? 'bg-red-100 border-red-400 text-red-500' :
                done ? 'bg-[#6d3ab0] border-[#6d3ab0] text-white shadow-lg shadow-[#6d3ab0]/40' :
                active ? 'bg-[#6d3ab0] border-[#6d3ab0] text-white shadow-lg shadow-[#6d3ab0]/40 ring-4 ring-[#6d3ab0]/25 animate-pulse' :
                'bg-white border-[#d8c8e8] text-gray-300'
              }`}>
                {done ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                : cancelled && i <= currentStep ? '✕' : i + 1}
              </div>
              <p className={`text-xs mt-2 text-center ${done ? 'font-bold text-[#2d1a4a]' : active ? 'font-bold text-[#6d3ab0]' : 'font-medium text-gray-400'}`}>{label}</p>
              {active && <p className="text-[9px] text-[#6d3ab0] mt-0.5 font-medium animate-pulse">● activo</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TiendaRetiroVentasPage() {
  const { user } = useUser();
  const location = useLocation();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const { markAsRead } = useNotifications();
  const [selectedVentaId, setSelectedVentaId] = useState<number | null>(
    (location.state as any)?.selectedOrderId ?? null
  );
  const [filterEstado, setFilterEstado] = useState<string>('todas');

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string; type: 'user' | 'vendedor'; compraId: number } | null>(null);
  const [reviewedMap, setReviewedMap] = useState<Record<string, number>>({});

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: number; estado: string } | null>(null);
  const [cancelReviewOpen, setCancelReviewOpen] = useState(false);
  const [cancelReviewTarget, setCancelReviewTarget] = useState<{
    compraId: number; targetId: number; targetActorTipo: 'user' | 'vendedor'; targetName: string;
  } | null>(null);
  const [cancelReviewedMap, setCancelReviewedMap] = useState<Record<string, number>>({});

  const fetchVentas = () => {
    if (!user?.id) return;
    Promise.all([
      fetchApi(`/api/tiendas/${user.id}/ventas`).then(r => r.json()),
      fetchApi('/api/valoraciones/mias').then(r => r.json()),
    ]).then(([ventasJson, reviewsJson]) => {
      const sorted = (ventasJson.data ?? []).sort((a: Venta, b: Venta) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setVentas(sorted);
      const map: Record<string, number> = {};
      const cancelMap: Record<string, number> = {};
      for (const v of (reviewsJson.data || [])) {
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
      setLoading(false);
    }).catch(() => {
      setError("Error al cargar las ventas");
      setLoading(false);
    });
  };

  useEffect(() => { fetchVentas(); }, [user?.id]);

  useEffect(() => {
    if (selectedVentaId) markAsRead(selectedVentaId);
  }, [selectedVentaId, markAsRead]);

  const handleMarcarEnTienda = async (ventaId: number) => {
    if (!confirm("¿Confirmás que recibiste este pedido en la tienda?")) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/en-tienda`, { method: "PATCH" });
      fetchVentas();
    } catch { alert("Error al actualizar el estado"); }
    finally { setActionLoading(null); }
  };

  const handleFinalizar = async (ventaId: number) => {
    if (!confirm("¿Confirmás que el comprador retiró el pedido?")) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/finalizar`, { method: "PATCH" });
      fetchVentas();
    } catch (err: any) {
      const msg = await err?.response?.json?.().then((d: any) => d?.message).catch(() => null);
      alert(msg || "Error al finalizar la orden");
    }
    finally { setActionLoading(null); }
  };

  const filteredVentas = ventas.filter(v => filterEstado === 'todas' || v.estado === filterEstado);
  const selectedVenta = ventas.find(v => v.id === selectedVentaId) ?? null;

  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  /* ── LIST VIEW ── */
  if (!selectedVentaId) {
    return (
      <div className="min-h-screen bg-[#f7f4fc] py-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 bg-[#6d3ab0]/10 border border-[#6d3ab0]/30 text-[#6d3ab0] rounded-full px-2.5 py-1 text-[10px] font-semibold mb-2">
              <span>🏬</span> Como intermediario
            </div>
            <h1 className="text-2xl font-bold text-[#2d1a4a]">Gestión de pedidos</h1>
            <p className="text-sm text-[#5a3a7a] mt-0.5">Órdenes donde tu tienda actúa como punto de retiro.</p>
          </div>

          <select
            value={filterEstado}
            onChange={e => setFilterEstado(e.target.value)}
            className="w-full text-sm border border-[#d8c8e8] rounded-lg px-3 py-2 bg-white text-[#2d1a4a] focus:outline-none focus:border-[#6d3ab0] mb-4"
          >
            <option value="todas">Todas</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_tienda">En tienda</option>
            <option value="pago_confirmado">Pago confirmado</option>
            <option value="finalizado">Finalizado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          {loading && <p className="text-sm text-center text-[#5a3a7a] mt-8">Cargando...</p>}
          {!loading && filteredVentas.length === 0 && (
            <p className="text-sm text-center text-[#5a3a7a] mt-8">No hay órdenes.</p>
          )}

          <div className="space-y-3">
            {filteredVentas.map(venta => {
              const buyerName = venta.comprador?.nombre || 'Comprador';
              const badge = ESTADO_BADGE[venta.estado];
              return (
                <button
                  key={venta.id}
                  onClick={() => setSelectedVentaId(venta.id)}
                  className="w-full text-left bg-white rounded-xl border border-[#d8c8e8] px-5 py-4 hover:border-[#6d3ab0] hover:shadow-sm transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-base font-bold text-[#2d1a4a]">Orden #{venta.id}</span>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-medium ${badge?.cls || 'bg-gray-100 text-gray-500'}`}>
                      {badge?.label || venta.estado}
                    </span>
                  </div>
                  <p className="text-sm text-[#5a3a7a]">{buyerName}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-[#7a5a9a]">
                      {new Date(venta.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-sm font-bold text-[#6d3ab0]">${venta.total?.toFixed(2)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ── DETAIL VIEW ── */
  return (
    <div className="min-h-screen bg-[#f7f4fc] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => setSelectedVentaId(null)}
          className="flex items-center gap-2 text-sm text-[#5a3a7a] hover:text-[#2d1a4a] mb-5 transition"
        >
          <ArrowLeft size={16} /> Gestión de pedidos
        </button>

        {!selectedVenta ? null : (<>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-[#2d1a4a]">Orden #{selectedVenta.id}</h2>
              <p className="text-sm text-[#5a3a7a]">
                {new Date(selectedVenta.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <StatusBadge estado={selectedVenta.estado} />
          </div>

          {/* Stepper */}
          <div className="bg-white rounded-xl border border-[#d8c8e8] p-5 mb-4">
            <OrderStepper estado={selectedVenta.estado} />
          </div>

          {/* State guidance boxes */}
          {selectedVenta.estado === 'pendiente' && (
            <div className="rounded-2xl border-2 border-[#6d3ab0] bg-gradient-to-br from-[#f0eaf8] to-[#f7f4fc] p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-[#6d3ab0] flex items-center justify-center text-white text-xl shadow-md">⏳</div>
                <div>
                  <p className="font-bold text-[#2d1a4a] text-base">Esperando llegada del pedido</p>
                  <p className="text-xs text-[#5a3a7a] mt-0.5">El vendedor lo traerá a tu tienda cuando esté listo</p>
                </div>
              </div>
              <button onClick={() => handleMarcarEnTienda(selectedVenta.id)} disabled={actionLoading === selectedVenta.id}
                className="w-full bg-[#6d3ab0] hover:bg-[#5a2e96] text-white text-sm font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-[#6d3ab0]/30 disabled:opacity-50">
                {actionLoading === selectedVenta.id ? 'Procesando...' : <><span>Confirmar llegada a tienda</span><span>→</span></>}
              </button>
            </div>
          )}
          {selectedVenta.estado === 'en_tienda' && (
            <div className="rounded-2xl border-2 border-[#6d3ab0] bg-gradient-to-br from-[#f0eaf8] to-[#f7f4fc] p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-[#6d3ab0] flex items-center justify-center text-white text-xl shadow-md">💳</div>
                <div>
                  <p className="font-bold text-[#2d1a4a] text-base">Pedido en tienda — esperando pago</p>
                  <p className="text-xs text-[#5a3a7a] mt-0.5">El vendedor debe confirmar el pago del comprador</p>
                </div>
              </div>
              {selectedVenta.vendedores?.map((v: Vendedor) => (
                <div key={v.id ?? v.nombre} className="mb-2 text-xs bg-white/60 rounded-lg px-3 py-2 border border-[#d8c8e8]">
                  {v.alias && <p className="text-[#2d1a4a]">Alias <span className="font-semibold text-[#6d3ab0]">{v.nombre}</span>: <span className="font-mono font-bold">{v.alias}</span></p>}
                  {v.cbu && <p className="text-[#5a3a7a] mt-0.5">CBU: <span className="font-mono">{v.cbu}</span></p>}
                </div>
              ))}
            </div>
          )}
          {selectedVenta.estado === 'pago_confirmado' && (
            <div className="rounded-2xl border-2 border-[#6d3ab0] bg-gradient-to-br from-[#e8d8f5] to-[#f0eaf8] p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-[#5a2e96] flex items-center justify-center text-white text-xl shadow-md">✅</div>
                <div>
                  <p className="font-bold text-[#2d1a4a] text-base">¡Pago confirmado! — Listo para entrega</p>
                  <p className="text-xs text-[#5a3a7a] mt-0.5">Entregale el pedido al comprador cuando se presente</p>
                </div>
              </div>
              <button onClick={() => handleFinalizar(selectedVenta.id)} disabled={actionLoading === selectedVenta.id}
                className="w-full bg-[#6d3ab0] hover:bg-[#5a2e96] text-white text-sm font-bold px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition shadow-md shadow-[#6d3ab0]/30 disabled:opacity-50">
                {actionLoading === selectedVenta.id ? 'Procesando...' : <><span>Finalizar — Pedido entregado</span><span>→</span></>}
              </button>
            </div>
          )}
          {selectedVenta.estado === 'cancelado' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
              <span className="text-xl">🚫</span>
              <div>
                <p className="text-sm font-semibold text-red-700">Orden cancelada</p>
                {selectedVenta.motivoCancelacion && (
                  <p className="text-xs text-red-600 mt-0.5">
                    Motivo: {MOTIVO_LABELS[selectedVenta.motivoCancelacion] || selectedVenta.motivoCancelacion}
                  </p>
                )}
                {selectedVenta.canceladoPorRol && (
                  <p className="text-xs text-gray-500 mt-0.5">Cancelado por: el {selectedVenta.canceladoPorRol}</p>
                )}
              </div>
            </div>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-[#d8c8e8] p-4">
              <p className="text-[10px] font-bold text-[#5a3a7a] uppercase tracking-wide mb-2">Comprador</p>
              <p className="text-sm font-semibold text-[#2d1a4a]">{selectedVenta.comprador?.nombre}</p>
              <p className="text-xs text-[#5a3a7a]">{selectedVenta.comprador?.email}</p>
            </div>
            <div className="bg-white rounded-xl border border-[#d8c8e8] p-4">
              <p className="text-[10px] font-bold text-[#5a3a7a] uppercase tracking-wide mb-2">Vendedores</p>
              {selectedVenta.vendedores?.length === 0 ? (
                <p className="text-xs text-[#5a3a7a] italic">Sin datos</p>
              ) : (
                selectedVenta.vendedores?.map((v: Vendedor) => (
                  <div key={v.id ?? v.nombre} className="mb-1">
                    <p className="text-sm font-semibold text-[#2d1a4a]">{v.nombre}</p>
                    {v.alias && <p className="text-xs text-[#5a3a7a]">Alias: {v.alias}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Items */}
          <div className="bg-white rounded-xl border border-[#d8c8e8] p-4 mb-4">
            <p className="text-[10px] font-bold text-[#5a3a7a] uppercase tracking-wide mb-3">Artículos</p>
            {selectedVenta.items?.length === 0 ? (
              <p className="text-sm text-[#5a3a7a] italic">Sin detalle de artículos</p>
            ) : (
              <div className="space-y-2">
                {selectedVenta.items?.map((item: VentaItem, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-[#2d1a4a]">{item.cartaNombre}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#5a3a7a]">x{item.cantidad}</span>
                      <span className="font-semibold text-[#6d3ab0]">${item.precio?.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t border-[#d8c8e8] pt-3 mt-3">
              <span className="text-[#2d1a4a]">Total</span>
              <span className="text-[#6d3ab0]">${selectedVenta.total?.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            {selectedVenta.estado === 'pendiente' && (
              <button
                onClick={() => handleMarcarEnTienda(selectedVenta.id)}
                disabled={actionLoading === selectedVenta.id}
                className="bg-[#6d3ab0] hover:bg-[#5a2e96] text-white text-sm px-5 py-2.5 rounded-lg transition font-medium disabled:opacity-50"
              >
                {actionLoading === selectedVenta.id ? 'Procesando...' : 'Confirmar llegada a tienda'}
              </button>
            )}
            {selectedVenta.estado === 'pago_confirmado' && (
              <button
                onClick={() => handleFinalizar(selectedVenta.id)}
                disabled={actionLoading === selectedVenta.id}
                className="bg-[#6d3ab0] hover:bg-[#5a2e96] text-white text-sm px-5 py-2.5 rounded-lg transition font-medium disabled:opacity-50"
              >
                {actionLoading === selectedVenta.id ? 'Procesando...' : 'Finalizar orden (entregado)'}
              </button>
            )}
            {!['finalizado', 'cancelado'].includes(selectedVenta.estado) && (
              <button
                onClick={() => { setCancelTarget({ id: selectedVenta.id, estado: selectedVenta.estado }); setCancelModalOpen(true); }}
                className="flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:border-red-300 transition"
              >
                🚫 Cancelar
              </button>
            )}
          </div>

          {/* Reviews for finalized */}
          {selectedVenta.estado === 'finalizado' && (
            <div className="mt-4 bg-white rounded-xl border border-[#d8c8e8] p-4">
              <p className="text-sm font-semibold text-[#2d1a4a] mb-3">Calificá a los participantes</p>
              <div className="flex flex-wrap gap-2">
                {selectedVenta.vendedores?.map((v: any) => {
                  if (!v.id) return null;
                  const key = `${selectedVenta.id}_vendedor_${v.id}`;
                  const puntuacion = reviewedMap[key];
                  return (
                    <button
                      key={`v-${v.id}`}
                      onClick={() => {
                        setReviewTarget({ id: v.id, name: v.nombre, type: 'vendedor', compraId: selectedVenta.id });
                        setReviewModalOpen(true);
                      }}
                      disabled={!!puntuacion}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${puntuacion ? 'bg-[#f0eaf8] border-[#d8c8e8] text-[#5a3a7a]' : 'bg-[#6d3ab0] text-white border-[#6d3ab0] hover:bg-[#5a2e96]'}`}
                    >
                      {puntuacion ? `★ ${puntuacion} — ${v.nombre}` : `Calificar a ${v.nombre} (vendedor)`}
                    </button>
                  );
                })}
                {selectedVenta.comprador?.id && (() => {
                  const key = `${selectedVenta.id}_user_${selectedVenta.comprador.id}`;
                  const puntuacion = reviewedMap[key];
                  return (
                    <button
                      key="comprador"
                      onClick={() => {
                        setReviewTarget({ id: selectedVenta.comprador.id as number, name: selectedVenta.comprador.nombre, type: 'user', compraId: selectedVenta.id });
                        setReviewModalOpen(true);
                      }}
                      disabled={!!puntuacion}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition ${puntuacion ? 'bg-[#f0eaf8] border-[#d8c8e8] text-[#5a3a7a]' : 'bg-[#6d3ab0] text-white border-[#6d3ab0] hover:bg-[#5a2e96]'}`}
                    >
                      {puntuacion ? `★ ${puntuacion} — ${selectedVenta.comprador.nombre}` : `Calificar a ${selectedVenta.comprador.nombre} (comprador)`}
                    </button>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Cancel review for cancelled orders */}
          {selectedVenta.estado === 'cancelado' && (() => {
            const rol = selectedVenta.canceladoPorRol;
            if (!rol || rol === 'tienda') return null;
            if (!selectedVenta.estadoAntesCancelacion || selectedVenta.estadoAntesCancelacion === 'pendiente') return null;
            let target: { id: number; tipo: 'user' | 'vendedor'; nombre: string } | null = null;
            if (rol === 'comprador') {
              const cid = selectedVenta.comprador.id;
              if (cid) target = { id: cid, tipo: 'user', nombre: selectedVenta.comprador.nombre };
            } else if (rol === 'vendedor') {
              const v = selectedVenta.vendedores?.[0];
              if (v?.id) target = { id: v.id, tipo: 'vendedor', nombre: v.nombre };
            }
            if (!target) return null;
            const key = `cancel_${selectedVenta.id}_${target.tipo}_${target.id}`;
            const reviewed = cancelReviewedMap[key];
            return (
              <div className="mt-4 bg-white rounded-xl border border-[#d8c8e8] p-4">
                <p className="text-sm font-semibold text-[#2d1a4a] mb-2">Valorar gestión de cancelación</p>
                {reviewed != null ? (
                  <div className="flex items-center gap-1 text-xs text-[#5a3a7a]">
                    <span className="text-orange-300">{'★'.repeat(reviewed)}{'☆'.repeat(5 - reviewed)}</span>
                    <span>Gestión valorada</span>
                  </div>
                ) : (
                  <button
                    className="text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-semibold transition"
                    onClick={() => {
                      setCancelReviewTarget({ compraId: selectedVenta.id, targetId: target!.id, targetActorTipo: target!.tipo, targetName: target!.nombre });
                      setCancelReviewOpen(true);
                    }}
                  >
                    📋 Valorar gestión de esta cancelación
                  </button>
                )}
              </div>
            );
          })()}
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
