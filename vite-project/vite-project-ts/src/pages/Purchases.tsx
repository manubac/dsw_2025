import { useEffect, useState, useCallback } from 'react'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import { ReviewModal } from '../components/ReviewModal';
import { CancelOrderModal } from '../components/CancelOrderModal';
import { CancelReviewModal } from '../components/CancelReviewModal';
import { fetchApi } from '../services/api';
import { Chat } from '../components/Chat';

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
  en_tienda:          { label: 'Llegó al local 📦',    color: 'bg-blue-100 text-blue-800' },
  pago_confirmado:    { label: 'Pago confirmado ✓',    color: 'bg-purple-100 text-purple-800' },
  listo_para_retirar: { label: 'Listo para retirar 🟠', color: 'bg-orange-100 text-orange-700' },
  finalizado:         { label: 'Finalizado ✓',         color: 'bg-green-100 text-green-800' },
  cancelado:          { label: 'Cancelado 🚫',         color: 'bg-red-100 text-red-700' },
};

export function Purchases() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [compras, setCompras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatAbierto, setChatAbierto] = useState<number | null>(null)

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string; type: 'vendedor' | 'tiendaRetiro'; compraId: number } | null>(null);
  const [reviewedMap, setReviewedMap] = useState<Record<string, number>>({});

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: number; estado: string } | null>(null);
  const [cancelReviewOpen, setCancelReviewOpen] = useState(false);
  const [cancelReviewTarget, setCancelReviewTarget] = useState<{
    compraId: number; targetId: number; targetActorTipo: 'vendedor' | 'tiendaRetiro'; targetName: string;
  } | null>(null);
  const [cancelReviewedMap, setCancelReviewedMap] = useState<Record<string, number>>({});

  const fetchCompras = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [comprasRes, misReviewsRes] = await Promise.all([
        fetchApi(`/api/compras?compradorId=${user.id}`),
        fetchApi('/api/valoraciones/mias'),
      ]);
      const json = await comprasRes.json();
      setCompras((json.data || []).sort((a: any, b: any) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ));

      const reviewsJson = await misReviewsRes.json();
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
    } catch {
      setError('No se pudieron cargar las compras');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchCompras(); }, [fetchCompras]);

  const renderReviewButton = (compraId: number, tipo: 'vendedor' | 'tiendaRetiro', objId: number, name: string) => {
    const key = `${compraId}_${tipo}_${objId}`;
    const puntuacion = reviewedMap[key];
    if (puntuacion != null) {
      return (
        <div className="flex items-center gap-2 bg-gray-100 text-gray-400 px-3 py-2 rounded-lg text-sm">
          <span className="text-orange-300">{'★'.repeat(puntuacion)}{'☆'.repeat(5 - puntuacion)}</span>
          <span>{name} — ya valorado</span>
        </div>
      );
    }
    const isStore = tipo === 'tiendaRetiro';
    return (
      <button
        className={`text-sm font-medium px-3 py-2 rounded-lg transition ${
          isStore
            ? 'bg-orange-100 hover:bg-orange-200 text-orange-800'
            : 'bg-green-100 hover:bg-green-200 text-green-800'
        }`}
        onClick={() => { setReviewTarget({ id: objId, name, type: tipo, compraId }); setReviewModalOpen(true); }}
      >
        ★ Valorar {isStore ? 'tienda' : 'vendedor'}: {name}
      </button>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <h2 className="text-lg font-bold mb-2">No has iniciado sesión</h2>
          <p className="text-gray-500 mb-4">Iniciá sesión para ver tus compras.</p>
          <button onClick={() => navigate('/login')} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg">
            Iniciar sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-green-50 flex justify-center p-6">
      <div className="w-full max-w-4xl">
        <h2 className="text-2xl font-bold mb-1">Mis Compras</h2>
        <p className="text-sm text-gray-500 mb-6">Historial de tus órdenes de compra.</p>

        {loading && <p className="text-gray-500">Cargando...</p>}
        {error && <div className="text-red-800 bg-red-100 p-3 rounded-lg mb-4">{error}</div>}

        {!loading && compras.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <p className="text-gray-500 mb-4">No encontré compras para tu cuenta.</p>
            <button onClick={() => navigate('/')} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg">
              Volver al inicio
            </button>
          </div>
        )}

        <div className="space-y-4">
          {compras.map((comp: any) => {
            const badge = ESTADO_BADGE[comp.estado] ?? { label: comp.estado, color: 'bg-gray-100 text-gray-700' };
            const locked = comp.estado === 'finalizado' || comp.estado === 'cancelado';
            const canCancel = !locked;
            const fecha = comp.createdAt ? new Date(comp.createdAt).toLocaleDateString('es-AR') : '';

            const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor
                          ?? comp.itemCartas?.find((ic: any) => ic.uploaderVendedor?.id)?.uploaderVendedor;
            const tiendaVendedora = comp.itemCartas?.find((ic: any) => ic.uploaderTienda)?.uploaderTienda;
            const vendedorPago = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor?.alias || ic.uploaderVendedor?.cbu)?.uploaderVendedor
                              ?? comp.itemCartas?.find((ic: any) => ic.uploaderTienda?.alias || ic.uploaderTienda?.cbu)?.uploaderTienda;

            return (
              <div key={comp.id} className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">

                {/* Header */}
                <div className="flex justify-between items-center px-5 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-800">Orden #{comp.id}</span>
                    {fecha && <span className="text-xs text-gray-400">{fecha}</span>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
                    {comp.envio && (
                      <span className="bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full text-xs font-medium">
                        Envío: {comp.envio.estado}
                      </span>
                    )}
                    <button
                      onClick={() => setChatAbierto(chatAbierto === comp.id ? null : comp.id)}
                      className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-full text-sm transition"
                    >
                      {chatAbierto === comp.id ? 'Cerrar chat' : '💬 Chat'}
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="px-5 py-4 space-y-4">

                  {/* Info grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {comp.tiendaRetiro ? 'Punto de retiro' : 'Entrega'}
                      </p>
                      {comp.tiendaRetiro ? (
                        <>
                          <p className="text-gray-800 font-medium">{comp.tiendaRetiro.nombre}</p>
                          <p className="text-gray-500 text-xs">{comp.tiendaRetiro.direccion}</p>
                        </>
                      ) : (
                        <p className="text-gray-500 italic">Coordinar con el vendedor por chat</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        {tiendaVendedora ? 'Tienda' : 'Vendedor'}
                      </p>
                      {vendedor ? (
                        <p className="text-gray-800 font-medium">{vendedor.nombre}</p>
                      ) : tiendaVendedora ? (
                        <p className="text-gray-800 font-medium">{tiendaVendedora.nombre}</p>
                      ) : (
                        <p className="text-gray-400 italic text-xs">Sin datos</p>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Artículos</p>
                    <div className="space-y-1">
                      {(comp.items || []).map((it: any, idx: number) => {
                        if (it.itemCartaId !== undefined) {
                          return (
                            <div key={idx} className="flex justify-between text-sm bg-gray-50 px-3 py-1.5 rounded-lg">
                              <button
                                className="text-blue-600 hover:underline text-left"
                                onClick={() => navigate(`/bundle/${it.itemCartaId}`)}
                              >
                                {it.title || `Bundle ${it.itemCartaId}`}
                              </button>
                              <span className="text-gray-600 font-medium ml-2 whitespace-nowrap">
                                ×{it.quantity} — ${Number(it.price || 0).toLocaleString('es-AR')}
                              </span>
                            </div>
                          );
                        }
                        if (it.cartaId !== undefined) {
                          return (
                            <div key={idx} className="flex justify-between text-sm bg-gray-50 px-3 py-1.5 rounded-lg">
                              <button
                                className="text-blue-600 hover:underline text-left"
                                onClick={() => navigate(`/card/${it.cartaId}`)}
                              >
                                {it.title || `Carta ${it.cartaId}`}
                              </button>
                              <span className="text-gray-600 font-medium ml-2 whitespace-nowrap">
                                ×{it.quantity} — ${Number(it.price || 0).toLocaleString('es-AR')}
                              </span>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="text-sm bg-gray-50 px-3 py-1.5 rounded-lg text-gray-600">
                            Carta id: {it.id || it}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Estado info box (tiendaRetiro + estados intermedios) */}
                  {comp.tiendaRetiro && (
                    <>
                      {comp.estado === 'en_tienda' && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-sm">
                          <p className="font-semibold text-blue-800 mb-2">📦 Tu carta llegó al local</p>
                          <p className="text-blue-700 text-xs mb-2">
                            Para retirarla, primero realizá el pago al vendedor. Una vez que el vendedor confirme el pago, podrás retirar en la tienda.
                          </p>
                          {vendedorPago && (vendedorPago.alias || vendedorPago.cbu) && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs">
                              <p className="font-semibold text-yellow-800 mb-1">💸 Datos de pago</p>
                              {vendedorPago.alias && <p className="text-yellow-700">Alias: <span className="font-mono font-bold">{vendedorPago.alias}</span></p>}
                              {vendedorPago.cbu   && <p className="text-yellow-700">CBU: <span className="font-mono">{vendedorPago.cbu}</span></p>}
                            </div>
                          )}
                        </div>
                      )}

                      {comp.estado === 'pago_confirmado' && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3.5 text-sm">
                          <p className="font-semibold text-purple-800 mb-1">✅ ¡El vendedor confirmó tu pago!</p>
                          <p className="text-purple-700 text-xs">
                            Ya podés ir a retirar tu carta a <strong>{comp.tiendaRetiro.nombre}</strong>.
                          </p>
                        </div>
                      )}

                      {comp.estado === 'listo_para_retirar' && (
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3.5 text-sm">
                          <p className="font-semibold text-orange-800 mb-1">🟠 Tu carta está lista para retirar</p>
                          <p className="text-orange-700 text-xs">
                            Presentate en <strong>{comp.tiendaRetiro.nombre}</strong> con el número de orden y completá el pago en la tienda.
                          </p>
                          {comp.tiendaRetiro.descripcionCompra && (
                            <p className="text-orange-600 text-xs mt-1 italic">{comp.tiendaRetiro.descripcionCompra}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Reviews cuando finalizado */}
                  {comp.estado === 'finalizado' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">¿Cómo fue la experiencia?</p>
                      <div className="flex flex-col gap-2">
                        {comp.tiendaRetiro && renderReviewButton(comp.id, 'tiendaRetiro', comp.tiendaRetiro.id, comp.tiendaRetiro.nombre)}
                        {vendedor && renderReviewButton(comp.id, 'vendedor', vendedor.id, vendedor.nombre)}
                        {!vendedor && tiendaVendedora && renderReviewButton(comp.id, 'tiendaRetiro', tiendaVendedora.id, tiendaVendedora.nombre)}
                      </div>
                    </div>
                  )}

                  {/* Cancelación */}
                  {comp.estado === 'cancelado' && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                      <p className="font-semibold text-red-700 mb-1">🚫 Orden cancelada</p>
                      {comp.motivoCancelacion && (
                        <p className="text-red-600 text-xs">
                          Motivo: {MOTIVO_LABELS[comp.motivoCancelacion] ?? comp.motivoCancelacion}
                        </p>
                      )}
                      {comp.canceladoPorRol && (
                        <p className="text-gray-500 text-xs mt-0.5">Cancelada por: el {comp.canceladoPorRol}</p>
                      )}
                      {(() => {
                        const rol = comp.canceladoPorRol;
                        if (!rol) return null;
                        let target: { id: number; tipo: 'vendedor' | 'tiendaRetiro'; nombre: string } | null = null;
                        let isOptional = false;
                        if (rol === 'vendedor' && vendedor) {
                          target = { id: vendedor.id, tipo: 'vendedor', nombre: vendedor.nombre };
                        } else if (rol === 'tienda' && comp.tiendaRetiro) {
                          target = { id: comp.tiendaRetiro.id, tipo: 'tiendaRetiro', nombre: comp.tiendaRetiro.nombre };
                        } else if (rol === 'comprador') {
                          isOptional = true;
                          if (vendedor) target = { id: vendedor.id, tipo: 'vendedor', nombre: vendedor.nombre };
                          else if (comp.tiendaRetiro) target = { id: comp.tiendaRetiro.id, tipo: 'tiendaRetiro', nombre: comp.tiendaRetiro.nombre };
                        }
                        if (!target) return null;
                        const key = `cancel_${comp.id}_${target.tipo}_${target.id}`;
                        const reviewed = cancelReviewedMap[key];
                        return reviewed != null ? (
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                            <span className="text-orange-300">{'★'.repeat(reviewed)}{'☆'.repeat(5 - reviewed)}</span>
                            <span>Gestión de cancelación valorada</span>
                          </div>
                        ) : (
                          <button
                            className={`mt-2 text-xs px-3 py-1.5 rounded-lg transition font-semibold ${
                              isOptional
                                ? 'bg-white border border-gray-200 hover:bg-gray-50 text-gray-500'
                                : 'bg-white border border-red-200 hover:bg-red-50 text-red-600'
                            }`}
                            onClick={() => {
                              setCancelReviewTarget({ compraId: comp.id, targetId: target!.id, targetActorTipo: target!.tipo, targetName: target!.nombre });
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
                    Total: ${Number(comp.total || 0).toLocaleString('es-AR')}
                  </span>
                  <div className="flex items-center gap-2">
                    {canCancel && (
                      <button
                        onClick={() => { setCancelTarget({ id: comp.id, estado: comp.estado }); setCancelModalOpen(true); }}
                        className="bg-red-100 hover:bg-red-200 text-red-700 text-sm font-semibold px-3 py-2 rounded-lg transition"
                      >
                        🚫 Cancelar
                      </button>
                    )}
                  </div>
                </div>

                {/* Chat */}
                {chatAbierto === comp.id && (
                  <div className="px-5 pb-5 pt-3 border-t border-gray-100">
                    <Chat compraId={comp.id} locked={locked} />
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
          onSuccess={() => fetchCompras()}
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

export default Purchases;
