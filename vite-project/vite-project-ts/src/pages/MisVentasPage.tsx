import React, { useEffect, useState } from 'react';
import { useUser } from '../context/user';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Chat } from '../components/Chat';


export default function MisVentasPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState<number | null>(null);

  const fetchVentas = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/vendedores/${user.id}/ventas`);
      setVentas(res.data.data || []);
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
                  <span className="px-3 py-1 text-sm rounded-full bg-orange-100 text-orange-700 font-medium">
                    {venta.estado === 'ENVIADO_A_INTERMEDIARIO'
                      ? 'Enviado a Intermediario'
                      : venta.estado === 'ENTREGADO'
                      ? 'Entregado'
                      : (venta.envio?.estado || venta.estado)}
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
    </div>
  );
}
