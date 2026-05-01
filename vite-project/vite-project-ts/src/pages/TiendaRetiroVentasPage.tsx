import { useEffect, useState } from "react";
import { useUser } from "../context/user";
import { fetchApi } from "../services/api";
import { Chat } from "../components/Chat";
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

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  pendiente:          { label: 'Pendiente',           color: 'bg-yellow-100 text-yellow-800' },
  en_tienda:          { label: 'Llegó al local',       color: 'bg-blue-100 text-blue-800' },
  pago_confirmado:    { label: 'Pago confirmado ✓',    color: 'bg-purple-100 text-purple-800' },
  listo_para_retirar: { label: 'Listo para retirar',   color: 'bg-orange-100 text-orange-800' },
  finalizado:         { label: 'Finalizado ✓',         color: 'bg-green-100 text-green-800' },
  cancelado:          { label: 'Cancelado 🚫',         color: 'bg-red-100 text-red-700' },
};

export default function TiendaRetiroVentasPage() {
  const { user } = useUser();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [chatAbierto, setChatAbierto] = useState<number | null>(null);

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

  const renderReviewButton = (compraId: number, tipo: 'user' | 'vendedor', objId: number, objNombre: string) => {
    const key = `${compraId}_${tipo}_${objId}`;
    const puntuacion = reviewedMap[key];
    if (puntuacion != null) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 px-3 py-2 rounded-lg">
          <span className="text-orange-300">{'★'.repeat(puntuacion)}{'☆'.repeat(5 - puntuacion)}</span>
          <span>{objNombre} — ya valorado</span>
        </div>
      );
    }
    return (
      <button
        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-2 rounded-lg transition"
        onClick={() => {
          setReviewTarget({ id: objId, name: objNombre, type: tipo, compraId });
          setReviewModalOpen(true);
        }}
      >
        ★ Valorar {tipo === 'user' ? 'comprador' : 'vendedor'}: {objNombre}
      </button>
    );
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando ventas...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Ventas en mi tienda</h1>
      <p className="text-sm text-gray-500 mb-6">Órdenes donde actuás como punto de retiro intermediario.</p>

      {ventas.length === 0 && (
        <div className="p-8 text-center text-gray-500">No hay ventas asociadas a esta tienda todavía.</div>
      )}

      <div className="space-y-4">
        {ventas.map((venta) => {
          const badge = ESTADO_BADGE[venta.estado] ?? { label: venta.estado, color: "bg-gray-100 text-gray-700" };
          const locked = venta.estado === 'finalizado' || venta.estado === 'cancelado';
          const canCancel = !locked;
          const fecha = venta.createdAt ? new Date(venta.createdAt).toLocaleDateString("es-AR") : '';

          return (
            <div key={venta.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">

              {/* Header */}
              <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">Orden #{venta.id}</span>
                  {fecha && <span className="text-xs text-gray-400">{fecha}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
                  <button
                    onClick={() => setChatAbierto(chatAbierto === venta.id ? null : venta.id)}
                    className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-full text-sm transition"
                  >
                    {chatAbierto === venta.id ? 'Cerrar chat' : '💬 Chat'}
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Comprador</p>
                    <p className="text-gray-800 font-medium">{venta.comprador.nombre}</p>
                    <p className="text-gray-500 text-xs">{venta.comprador.email}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Vendedor(es)</p>
                    {venta.vendedores.length === 0 ? (
                      <p className="text-gray-400 italic text-xs">Sin datos</p>
                    ) : (
                      venta.vendedores.map((v, i) => (
                        <div key={i} className="mb-1">
                          <p className="text-gray-800 font-medium">{v.nombre}</p>
                          {v.alias && <p className="text-gray-500 text-xs">Alias: <span className="font-mono font-semibold">{v.alias}</span></p>}
                          {v.cbu   && <p className="text-gray-500 text-xs">CBU: <span className="font-mono">{v.cbu}</span></p>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Artículos</p>
                  {venta.items.length === 0 ? (
                    <p className="text-gray-400 text-sm italic">Sin detalle de artículos</p>
                  ) : (
                    <div className="space-y-1">
                      {venta.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg">
                          <span>{item.cartaNombre} × {item.cantidad}</span>
                          <span className="font-medium">${item.precio.toLocaleString("es-AR")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Estado info box */}
                {venta.estado === 'pendiente' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3.5 text-sm">
                    <p className="text-yellow-800 text-xs">⏳ Esperando que el vendedor traiga la carta al local.</p>
                  </div>
                )}

                {venta.estado === 'en_tienda' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-sm">
                    <p className="font-semibold text-blue-800 mb-1">📦 Carta en el local</p>
                    <p className="text-blue-700 text-xs">
                      Esperando que el vendedor confirme que recibió el pago del comprador.
                    </p>
                  </div>
                )}

                {venta.estado === 'pago_confirmado' && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3.5 text-sm">
                    <p className="font-semibold text-purple-800 mb-1">✅ El vendedor confirmó el pago</p>
                    <p className="text-purple-700 text-xs">
                      El comprador puede retirar. Finalizá la orden cuando retire la carta.
                    </p>
                  </div>
                )}

                {/* Reviews cuando finalizado */}
                {venta.estado === 'finalizado' && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">¿Cómo fue la experiencia?</p>
                    <div className="flex flex-col gap-2">
                      {venta.comprador.id != null && renderReviewButton(venta.id, 'user', venta.comprador.id, venta.comprador.nombre)}
                      {venta.vendedores.map((v, i) => v.id != null && (
                        <div key={i}>{renderReviewButton(venta.id, 'vendedor', v.id!, v.nombre)}</div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cancelación */}
                {venta.estado === 'cancelado' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                    <p className="font-semibold text-red-700 mb-1">🚫 Pedido cancelado</p>
                    {venta.motivoCancelacion && (
                      <p className="text-xs text-red-600">Motivo: {MOTIVO_LABELS[venta.motivoCancelacion] ?? venta.motivoCancelacion}</p>
                    )}
                    {venta.canceladoPorRol && (
                      <p className="text-xs text-gray-500 mt-0.5">Cancelado por: el {venta.canceladoPorRol}</p>
                    )}
                    {(() => {
                      const rol = venta.canceladoPorRol;
                      if (!rol || rol === 'tienda') return null;
                      if (!venta.estadoAntesCancelacion || venta.estadoAntesCancelacion === 'pendiente') return null;
                      let target: { id: number; tipo: 'user' | 'vendedor'; nombre: string } | null = null;
                      if (rol === 'comprador') {
                        const cid = venta.comprador.id;
                        if (cid) target = { id: cid, tipo: 'user', nombre: venta.comprador.nombre };
                      } else if (rol === 'vendedor') {
                        const v = venta.vendedores?.[0];
                        if (v?.id) target = { id: v.id, tipo: 'vendedor', nombre: v.nombre };
                      }
                      if (!target) return null;
                      const key = `cancel_${venta.id}_${target.tipo}_${target.id}`;
                      const reviewed = cancelReviewedMap[key];
                      return reviewed != null ? (
                        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                          <span className="text-orange-300">{'★'.repeat(reviewed)}{'☆'.repeat(5 - reviewed)}</span>
                          <span>Gestión valorada</span>
                        </div>
                      ) : (
                        <button
                          className="mt-2 text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-semibold transition"
                          onClick={() => {
                            setCancelReviewTarget({ compraId: venta.id, targetId: target!.id, targetActorTipo: target!.tipo, targetName: target!.nombre });
                            setCancelReviewOpen(true);
                          }}
                        >
                          📋 Valorar gestión de esta cancelación
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
                <span className="font-bold text-gray-900 text-sm">Total: ${venta.total.toLocaleString("es-AR")}</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {venta.estado === "pendiente" && (
                    <button
                      disabled={actionLoading === venta.id}
                      onClick={() => handleMarcarEnTienda(venta.id)}
                      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {actionLoading === venta.id ? "Procesando..." : "Confirmar llegada al local"}
                    </button>
                  )}

                  {venta.estado === "pago_confirmado" && (
                    <button
                      disabled={actionLoading === venta.id}
                      onClick={() => handleFinalizar(venta.id)}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {actionLoading === venta.id ? "Procesando..." : "Finalizar orden"}
                    </button>
                  )}

                  {canCancel && (
                    <button
                      onClick={() => { setCancelTarget({ id: venta.id, estado: venta.estado }); setCancelModalOpen(true); }}
                      className="bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold px-3 py-2 rounded-lg transition"
                    >
                      🚫 Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Chat */}
              {chatAbierto === venta.id && (
                <div className="px-5 pb-5 pt-3 border-t border-gray-100">
                  <Chat compraId={venta.id} locked={locked} />
                </div>
              )}
            </div>
          );
        })}
      </div>

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
