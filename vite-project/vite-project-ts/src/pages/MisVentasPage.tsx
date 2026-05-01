import React, { useEffect, useState } from 'react';
import { useUser } from '../context/user';
import { useNavigate } from 'react-router-dom';
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

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  pendiente:          { label: 'Pendiente',             color: 'bg-yellow-100 text-yellow-800' },
  en_tienda:          { label: 'Llegó al local',         color: 'bg-blue-100 text-blue-800' },
  pago_confirmado:    { label: 'Pago confirmado ✓',      color: 'bg-purple-100 text-purple-800' },
  listo_para_retirar: { label: 'Listo para retirar',     color: 'bg-orange-100 text-orange-800' },
  finalizado:         { label: 'Finalizado ✓',           color: 'bg-green-100 text-green-800' },
  cancelado:          { label: 'Cancelado 🚫',           color: 'bg-red-100 text-red-700' },
};

export default function MisVentasPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState<number | null>(null);
  const [miAlias, setMiAlias] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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
      const [ventasRes, perfilRes, misReviewsRes] = await Promise.all([
        api.get(`/api/vendedores/${user.id}/ventas`),
        api.get(`/api/vendedores/${user.id}`),
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
    if (!user || user.role !== 'vendedor') { navigate('/'); return; }
    fetchVentas();
  }, [user, navigate]);

  const handleMarkSent = async (compraId: number) => {
    if (!confirm('¿Confirmás que has enviado los items al intermediario?')) return;
    try {
      await api.post(`/api/vendedores/${user?.id}/ventas/${compraId}/enviar`);
      await fetchVentas();
    } catch (err: any) {
      alert('Error al actualizar envío: ' + (err.response?.data?.message || err.message));
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

  const renderReviewButton = (compraId: number, tipo: 'tiendaRetiro' | 'user', objId: number, name: string) => {
    const key = `${compraId}_${tipo}_${objId}`;
    const puntuacion = reviewedMap[key];
    if (puntuacion != null) {
      return (
        <div className="flex items-center gap-2 bg-gray-100 text-gray-400 font-medium py-2 px-3 rounded-lg text-sm">
          <span className="text-orange-300">{'★'.repeat(puntuacion)}{'☆'.repeat(5 - puntuacion)}</span>
          <span>{name} — ya valorado</span>
        </div>
      );
    }
    const isStore = tipo === 'tiendaRetiro';
    return (
      <button
        className={`flex-1 font-medium py-2 px-3 rounded-lg text-sm transition ${
          isStore ? 'bg-orange-100 hover:bg-orange-200 text-orange-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
        }`}
        onClick={() => { setReviewTarget({ id: objId, name, type: tipo, compraId }); setReviewModalOpen(true); }}
      >
        ★ Valorar {isStore ? 'tienda' : 'comprador'}: {name}
      </button>
    );
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</div>;

  return (
    <div className="min-h-screen bg-green-100 p-6 flex justify-center">
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-1">Mis Ventas</h2>
        <p className="text-gray-600 mb-6 text-sm">Pedidos que debés enviar a la tienda o coordinar con el comprador.</p>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">{error}</div>}
        {!loading && ventas.length === 0 && <p className="text-gray-500">Aún no tenés ventas.</p>}

        <div className="space-y-4">
          {ventas.map((venta: any) => {
            const badge = ESTADO_BADGE[venta.estado] ?? { label: venta.estado, color: 'bg-gray-100 text-gray-600' };
            const locked = venta.estado === 'finalizado' || venta.estado === 'cancelado';
            const canCancel = !locked;
            const fecha = venta.fecha ? new Date(venta.fecha).toLocaleDateString('es-AR') : '';
            const esTiendaInterm = !!(venta.tiendaRetiro) && !venta.esTiendaCompradora;

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
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {esTiendaInterm ? 'Punto de entrega' : 'Entrega'}
                      </p>
                      {esTiendaInterm ? (
                        <>
                          <p className="text-gray-800 font-medium">{venta.tiendaRetiro.nombre}</p>
                          <p className="text-gray-500 text-xs">{venta.tiendaRetiro.direccion}</p>
                          {miAlias && (
                            <p className="text-xs text-orange-700 mt-1">
                              Tu alias: <span className="font-mono font-bold">{miAlias}</span>
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-gray-500 italic">Coordinar por chat</p>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Artículos vendidos</p>
                    <div className="space-y-1.5">
                      {venta.items.map((it: any) => (
                        <div key={it.id} className="flex items-center gap-3 bg-gray-50 px-3 py-2 rounded-lg">
                          {it.image && <img src={it.image} alt={it.name} className="w-7 h-9 object-contain flex-shrink-0" />}
                          <span className="flex-1 text-sm text-gray-700">{it.name}</span>
                          <span className="text-sm font-semibold text-green-700">${String(it.price ?? '').replace(/^\$/, '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Estado info box */}
                  {esTiendaInterm && venta.estado === 'en_tienda' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-sm">
                      <p className="font-semibold text-blue-800 mb-1">📦 La carta llegó a la tienda</p>
                      <p className="text-blue-700 text-xs">
                        Esperando que el comprador realice el pago. Cuando lo recibas, confirmalo con el botón de abajo.
                      </p>
                    </div>
                  )}

                  {esTiendaInterm && venta.estado === 'pago_confirmado' && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3.5 text-sm">
                      <p className="font-semibold text-purple-800 mb-1">✅ Pago confirmado</p>
                      <p className="text-purple-700 text-xs">
                        La tienda finalizará la orden cuando el comprador retire la carta.
                      </p>
                    </div>
                  )}

                  {venta.envio?.intermediario && (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-3.5 text-sm">
                      <p className="font-semibold text-teal-800 mb-1">Envío a intermediario</p>
                      <p className="text-teal-700">{venta.envio.intermediario.nombre}</p>
                      <p className="text-teal-600 text-xs font-mono">{venta.envio.intermediario.direccion}</p>
                    </div>
                  )}

                  {/* Reviews cuando finalizado */}
                  {venta.estado === 'finalizado' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">¿Cómo fue la experiencia?</p>
                      <div className="flex flex-col gap-2">
                        {venta.tiendaRetiro && renderReviewButton(venta.id, 'tiendaRetiro', venta.tiendaRetiro.id, venta.tiendaRetiro.nombre)}
                        {venta.comprador?.id && renderReviewButton(venta.id, 'user', venta.comprador.id, venta.comprador.nombre)}
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
                        if (!rol) return null;
                        let target: { id: number; tipo: 'user' | 'tiendaRetiro'; nombre: string } | null = null;
                        let isOptional = false;
                        if (rol === 'comprador') {
                          const cid = venta.comprador?.id;
                          if (cid) target = { id: cid, tipo: 'user', nombre: venta.comprador.nombre };
                        } else if (rol === 'vendedor') {
                          isOptional = true;
                          const cid = venta.comprador?.id;
                          if (cid) target = { id: cid, tipo: 'user', nombre: venta.comprador.nombre };
                        } else if (rol === 'tienda' && venta.tiendaRetiro) {
                          target = { id: venta.tiendaRetiro.id, tipo: 'tiendaRetiro', nombre: venta.tiendaRetiro.nombre };
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
                            className={`mt-2 text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                              isOptional
                                ? 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-500'
                                : 'bg-white border border-red-200 hover:bg-red-50 text-red-600'
                            }`}
                            onClick={() => {
                              setCancelReviewTarget({ compraId: venta.id, targetId: target!.id, targetActorTipo: target!.tipo, targetName: target!.nombre });
                              setCancelReviewOpen(true);
                            }}
                          >
                            📋 {isOptional ? 'Valorar gestión (opcional)' : 'Valorar gestión de esta cancelación'}
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center px-5 py-3 border-t border-gray-100 bg-gray-50 flex-wrap gap-2">
                  <span className="font-bold text-gray-900 text-sm">
                    Total: ${Number(venta.total || 0).toLocaleString('es-AR')}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Finalizar (directo, sin tienda o Tc→V) */}
                    {venta.estado === 'pendiente' && (!esTiendaInterm) && (
                      <button
                        disabled={actionLoading === venta.id}
                        onClick={() => handleFinalizar(venta.id)}
                        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                      >
                        {actionLoading === venta.id ? 'Procesando...' : 'Marcar como finalizado'}
                      </button>
                    )}

                    {/* Marcar pago recibido (flujo 3 actores, en_tienda) */}
                    {esTiendaInterm && venta.estado === 'en_tienda' && (
                      <button
                        disabled={actionLoading === venta.id}
                        onClick={() => handleMarcarPagoRecibido(venta.id)}
                        className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                      >
                        {actionLoading === venta.id ? 'Procesando...' : '💸 Marcar pago recibido'}
                      </button>
                    )}

                    {/* Marcar enviado al intermediario (flujo con envio) */}
                    {venta.envio &&
                      venta.estado !== 'ENVIADO_A_INTERMEDIARIO' &&
                      venta.estado !== 'ENTREGADO' &&
                      venta.estado !== 'entregado' && (
                        <button
                          onClick={() => handleMarkSent(venta.id)}
                          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                        >
                          Ya envié al Intermediario
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
