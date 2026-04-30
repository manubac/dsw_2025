import React, { useEffect, useState } from 'react';
import { useUser } from '../context/user';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Chat } from '../components/Chat';
import { ReviewModal } from '../components/ReviewModal';


export default function MisVentasPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState<number | null>(null);
  const [miAlias, setMiAlias] = useState<string | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string; type: 'tiendaRetiro' | 'user'; compraId: number } | null>(null);
  // key: `${compraId}_${tipoObjeto}_${objetoId}` → puntuacion ya enviada
  const [reviewedMap, setReviewedMap] = useState<Record<string, number>>({});

  const fetchVentas = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [ventasRes, perfilRes, misReviewsRes] = await Promise.all([
        api.get(`/api/vendedores/${user.id}/ventas`),
        api.get(`/api/vendedores/${user.id}`),
        api.get('/api/valoraciones/mias'),
      ]);
      setVentas(ventasRes.data.data || []);
      setMiAlias(perfilRes.data.data?.alias ?? null);

      const map: Record<string, number> = {};
      for (const v of (misReviewsRes.data.data || [])) {
        if (v.compra?.id != null) {
          map[`${v.compra.id}_${v.tipoObjeto}_${v.objetoId}`] = v.puntuacion;
        }
      }
      setReviewedMap(map);
    } catch (err: any) {
      console.error('Error fetching ventas:', err);
      setError('No se pudieron cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'vendedor') {
      navigate('/');
      return;
    }
    fetchVentas();
  }, [user, navigate]);

  const handleMarkSent = async (compraId: number) => {
    try {
      if (!confirm("¿Confirmas que has enviado los items al intermediario?")) return;

      await api.post(`/api/vendedores/${user?.id}/ventas/${compraId}/enviar`);
      alert("Envío marcado correctamente.");
      await fetchVentas();
    } catch (err: any) {
        alert("Error al actualizar envío: " + (err.response?.data?.message || err.message));
    }
  };

  const handleOpenReview = (id: number, name: string, type: 'tiendaRetiro' | 'user', compraId: number) => {
    setReviewTarget({ id, name, type, compraId });
    setReviewModalOpen(true);
  };

  const renderReviewButton = (compraId: number, tipo: 'tiendaRetiro' | 'user', objId: number, name: string, activeClass: string) => {
    const key = `${compraId}_${tipo}_${objId}`;
    const puntuacion = reviewedMap[key];
    if (puntuacion != null) {
      return (
        <div className="w-full flex items-center gap-2 bg-gray-100 text-gray-400 font-medium py-2 px-4 rounded-lg text-sm cursor-not-allowed">
          <span className="text-orange-300">{'★'.repeat(puntuacion)}{'☆'.repeat(5 - puntuacion)}</span>
          <span>{name} — ya valorado</span>
        </div>
      );
    }
    return (
      <button
        className={`w-full ${activeClass} font-medium py-2 px-4 rounded-lg text-sm transition`}
        onClick={() => handleOpenReview(objId, name, tipo, compraId)}
      >
        ★ Valorar {tipo === 'tiendaRetiro' ? 'tienda' : 'comprador'}: {name}
      </button>
    );
  };

  const handleFinalizar = async (compraId: number) => {
    try {
      if (!confirm('¿Confirmás que la entrega fue completada?')) return;
      await api.patch(`/api/vendedores/${user?.id}/ventas/${compraId}/finalizar`);
      await fetchVentas();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

    return (
    <div className="min-h-screen bg-green-100 p-6 flex justify-center">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-8">
        
        <h2 className="text-2xl font-bold mb-2">Mis Ventas</h2>
        <p className="text-gray-600 mb-6">
          Gestionás los pedidos que debes enviar a los intermediarios.
        </p>

        {loading && <p className="text-gray-500">Cargando...</p>}

        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {!loading && ventas.length === 0 && (
          <p className="text-gray-500">Aún no tienes ventas.</p>
        )}

        <div className="space-y-6">
          {ventas.map((venta: any) => (
            <div
              key={venta.id}
              className="border-l-4 border-orange-500 bg-gray-50 rounded-xl shadow-sm"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <strong className="text-lg">Pedido #{venta.id}</strong>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm rounded-full font-medium ${
                    venta.estado === 'finalizado'          ? 'bg-green-100 text-green-800'
                    : venta.estado === 'en_tienda'         ? 'bg-blue-100 text-blue-800'
                    : venta.estado === 'listo_para_retirar' ? 'bg-orange-100 text-orange-800'
                    : 'bg-gray-100 text-gray-600'
                  }`}>
                    {venta.estado === 'finalizado'             ? 'Finalizado ✓'
                      : venta.estado === 'en_tienda'           ? 'Llegó al local ✓'
                      : venta.estado === 'listo_para_retirar'  ? 'Listo para retirar'
                      : venta.estado === 'ENVIADO_A_INTERMEDIARIO' ? 'Enviado a Intermediario'
                      : 'Pendiente'}
                  </span>
                  <button
                    onClick={() => setChatAbierto(chatAbierto === venta.id ? null : venta.id)}
                    className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-full text-sm transition"
                  >
                    {chatAbierto === venta.id ? 'Cerrar chat' : '💬 Chat'}
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">

                <p>
                  <strong>Comprador:</strong> {venta.comprador.nombre} ({venta.comprador.email})
                </p>

                {venta.tiendaRetiro ? (
                  <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-orange-800 mb-1">
                      📍 Entregar en tienda
                    </h4>
                    <p className="font-bold text-orange-900">{venta.tiendaRetiro.nombre}</p>
                    <p className="text-sm text-orange-700">{venta.tiendaRetiro.direccion}</p>
                    {venta.tiendaRetiro.horario && (
                      <p className="text-xs text-orange-600 mt-1">🕐 {venta.tiendaRetiro.horario}</p>
                    )}
                    {miAlias && (
                      <p className="text-sm text-orange-800 mt-2 font-medium">
                        💸 Tu alias: <span className="font-mono font-bold">{miAlias}</span>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-gray-700 mb-1">💬 Coordinar via chat</h4>
                    <p className="text-sm text-gray-500">El comprador prefiere acordar el punto de encuentro por chat.</p>
                  </div>
                )}

                {venta.envio && venta.envio.intermediario && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-1">
                      Instrucciones de Envío
                    </h4>
                    <p className="text-sm">Enviar los items al intermediario:</p>
                    <p className="font-bold mt-1">
                      {venta.envio.intermediario.nombre}
                    </p>
                    <p className="font-mono text-sm">
                      {venta.envio.intermediario.direccion}
                    </p>
                  </div>
                )}

                <div>
                  <strong>Items vendidos:</strong>
                  <ul className="mt-2 space-y-2">
                    {venta.items.map((it: any) => (
                      <li
                        key={it.id}
                        className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm"
                      >
                        {it.image && (
                          <img
                            src={it.image}
                            alt={it.name}
                            className="w-8 h-10 object-contain"
                          />
                        )}
                        <span className="flex-1">{it.name}</span>
                        <span className="font-semibold text-green-600">
                          ${String(it.price ?? '').replace(/^\$/, '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Botón finalizar — flujos 3 y 4 (sin tienda de retiro, o comprador es tienda) */}
                {venta.estado === 'pendiente' && (!venta.tiendaRetiro || venta.esTiendaCompradora) && (
                  <button
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                    onClick={() => handleFinalizar(venta.id)}
                  >
                    Marcar como finalizado
                  </button>
                )}

                {venta.estado === 'finalizado' && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold text-gray-700">¿Cómo fue la experiencia?</p>
                    {venta.tiendaRetiro && renderReviewButton(venta.id, 'tiendaRetiro', venta.tiendaRetiro.id, venta.tiendaRetiro.nombre, 'bg-orange-100 hover:bg-orange-200 text-orange-800')}
                    {venta.comprador?.id && renderReviewButton(venta.id, 'user', venta.comprador.id, venta.comprador.nombre, 'bg-gray-100 hover:bg-gray-200 text-gray-800')}
                  </div>
                )}

                {venta.envio &&
                  venta.estado !== 'ENVIADO_A_INTERMEDIARIO' &&
                  venta.estado !== 'ENTREGADO' &&
                  venta.estado !== 'entregado' && (
                    <button
                      className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
                      onClick={() => handleMarkSent(venta.id)}
                    >
                      Ya envié el paquete al Intermediario
                    </button>
                  )}

                {chatAbierto === venta.id && (
                  <div className="px-4 pb-4">
                    <Chat compraId={venta.id} />
                  </div>
                )}
              </div>
            </div>
          ))}
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
    </div>
  );
}
