import React, { useState, useEffect } from 'react';
import { useUser } from '../context/user';
import { api } from '../services/api';


interface Envio {
  id: number;
  estado: string;
  fechaEnvio?: string;
  intermediario: any;
  destinoIntermediario?: any;
  minimoCompras?: number;
  precioPorCompra?: number;
  items: any[]; 
  notas?: string;
}

export default function IntermediarioDashboard() {
  const { user } = useUser();
  const [activeTab, setActiveTab] = useState<'planificar' | 'salientes' | 'entrantes'>('salientes');
  
  // Data
  const [intermediarios, setIntermediarios] = useState<any[]>([]);
  const [enviosSalientes, setEnviosSalientes] = useState<Envio[]>([]);
  const [enviosEntrantes, setEnviosEntrantes] = useState<Envio[]>([]);
  
  // Forms
  const [selectedDestino, setSelectedDestino] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({
    minimoCompras: 5,
    precioPorCompra: 10,
    fechaEnvio: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'intermediario') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
      setLoading(true);
      try {
          // 1. Load Peers
          const resPeers = await api.get('/api/intermediarios');
          setIntermediarios(resPeers.data.data || []);

          // 2. Load Envios (Salientes/Origen)
          const resSalientes = await api.get(`/api/intermediarios/${user?.id}/envios?type=origen`);
          setEnviosSalientes(resSalientes.data.data || []);

          // 3. Load Envios (Entrantes/Destino)
          const resEntrantes = await api.get(`/api/intermediarios/${user?.id}/envios?type=destino`);
          setEnviosEntrantes(resEntrantes.data.data || []);

      } catch (err) {
          console.error(err);
      } finally {
          setLoading(false);
      }
  }

  // --- PLANIFICACION ---
  const handlePlanEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDestino || !user?.id) return;

    try {
      await api.post('/api/intermediarios/envios/plan', {
          intermediarioId: user.id,
          destinoIntermediarioId: selectedDestino,
          ...planForm
      });
      alert('Envio planificado con éxito');
      setPlanForm({ minimoCompras: 5, precioPorCompra: 10, fechaEnvio: '' });
      setSelectedDestino(null);
      loadData();
      setActiveTab('salientes');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al planificar');
    }
  };

  // --- MANAGE SALIENTES (ORIGIN) ---
  const handleConfirmItemReceived = async (compraId: number) => {
      try {
          await api.post(`/api/intermediarios/compras/${compraId}/status`, {
              status: 'EN_MANOS_INTERMEDIARIO_ORIGEN'
          });
          loadData();
      } catch (e: any) { alert(e.message) }
  }

  const handleDispatchEnvio = async (envioId: number) => {
      try {
          const notas = prompt("Numero de seguimiento / Notas:");
          if (notas === null) return;
          await api.post(`/api/intermediarios/envios/${envioId}/despachar`, { notas });
          loadData();
      } catch (e: any) { alert(e.message) }
  }


  // --- MANAGE ENTRANTES (DESTINATION) ---
  const handleReceiveEnvio = async (envioId: number) => {
    try {
        if(!confirm("¿Confirmar llegada del envío?")) return;
        await api.post(`/api/intermediarios/envios/${envioId}/recibir`);
        loadData();
    } catch (e: any) { alert(e.message) }
  }

  const handleItemDeliveredToUser = async (compraId: number) => {
      try {
        if(!confirm("¿Confirmar entrega al usuario final?")) return;
        await api.post(`/api/intermediarios/compras/${compraId}/status`, {
            status: 'ENTREGADO'
        });
        loadData();
      } catch (e: any) { alert(e.message) }
  }

  const handleDeleteEnvio = async (envioId: number) => {
    try {
        if(!confirm("¿Estás seguro de que deseas eliminar este envío? Esta acción no se puede deshacer.")) return;
        await api.delete(`/api/intermediarios/envios/${envioId}`);
        loadData();
    } catch (e: any) { 
        alert(e.response?.data?.message || e.message) 
    }
  }


  if (user?.role !== 'intermediario') return <p>Access Denied</p>;

  return (
  <div className="min-h-screen bg-green-50 p-6">
    <div className="max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Panel de Operaciones</h1>
        <button
          onClick={loadData}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b mb-6">
        <button
          onClick={() => setActiveTab('salientes')}
          className={`px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'salientes'
              ? 'bg-orange-500 text-white'
              : 'bg-white hover:bg-orange-100'
          }`}
        >
          Envios Salientes (Origen)
        </button>

        <button
          onClick={() => setActiveTab('entrantes')}
          className={`px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'entrantes'
              ? 'bg-orange-500 text-white'
              : 'bg-white hover:bg-orange-100'
          }`}
        >
          Envios Entrantes (Destino)
        </button>

        <button
          onClick={() => setActiveTab('planificar')}
          className={`px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'planificar'
              ? 'bg-orange-500 text-white'
              : 'bg-white hover:bg-orange-100'
          }`}
        >
          Planificar Nuevo
        </button>
      </div>

      {loading && <p className="text-gray-600">Cargando...</p>}

      {/* SALIENTES */}
      {activeTab === 'salientes' && (
        <div>
          <h3 className="text-xl font-semibold mb-4">
            Gestionar Salidas
          </h3>

          {enviosSalientes.length === 0 && (
            <p className="text-gray-600">No hay envios planificados.</p>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {enviosSalientes.map(envio => (
              <div
                key={envio.id}
                className="bg-white rounded-xl shadow p-5 border"
              >
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h4 className="font-semibold">
                    Envio #{envio.id} → {envio.destinoIntermediario?.nombre}
                  </h4>
                  <span className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded">
                    {envio.estado}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  <strong>Fecha:</strong>{" "}
                  {envio.fechaEnvio
                    ? new Date(envio.fechaEnvio).toLocaleDateString()
                    : "N/A"}
                </p>

                <div className="bg-gray-50 p-3 rounded mb-3">
                  <h5 className="font-medium mb-2">
                    Items ({envio.items?.length || 0})
                  </h5>

                  {envio.items?.map((item: any) => (
                    <div
                      key={item.compraId}
                      className="flex justify-between items-center py-1 text-sm"
                    >
                      <span>{item.titulo}</span>

                      {envio.estado !== 'cancelado' &&
                        item.estadoCompra === 'ENVIADO_A_INTERMEDIARIO' && (
                          <button
                            onClick={() =>
                              handleConfirmItemReceived(item.compraId)
                            }
                            className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                          >
                            Confirmar
                          </button>
                        )}

                      {item.estadoCompra ===
                        'EN_MANOS_INTERMEDIARIO_ORIGEN' && (
                        <span className="text-green-600 text-xs">
                          ✓ En depósito
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {(envio.estado === 'planificado' ||
                  envio.estado === 'activo') && (
                  <button
                    onClick={() => handleDispatchEnvio(envio.id)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium"
                  >
                    Despachar Camión
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ENTRANTES */}
      {activeTab === 'entrantes' && (
        <div>
          <h3 className="text-xl font-semibold mb-4">
            Gestionar Entradas
          </h3>

          {enviosEntrantes.length === 0 && (
            <p className="text-gray-600">No hay envios en camino.</p>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {enviosEntrantes.map(envio => (
              <div
                key={envio.id}
                className="bg-white rounded-xl shadow p-5 border"
              >
                <div className="flex justify-between mb-3 border-b pb-2">
                  <h4 className="font-semibold">
                    Envio #{envio.id} de {envio.intermediario?.nombre}
                  </h4>
                  <span className="text-sm bg-orange-100 text-orange-700 px-2 py-1 rounded">
                    {envio.estado}
                  </span>
                </div>

                {envio.notas && (
                  <p className="text-sm text-gray-600 mb-3">
                    Notas: {envio.notas}
                  </p>
                )}

                {envio.estado === 'intermediario_enviado' && (
                  <button
                    onClick={() => handleReceiveEnvio(envio.id)}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg mb-3"
                  >
                    Confirmar Llegada
                  </button>
                )}

                <div className="bg-gray-50 p-3 rounded">
                  {envio.items?.map((item: any) => (
                    <div
                      key={item.compraId}
                      className="flex justify-between items-center text-sm py-1"
                    >
                      <span>{item.titulo}</span>

                      {(envio.estado === 'intermediario_recibio' ||
                        envio.estado === 'recibido') &&
                        item.estadoCompra !== 'ENTREGADO' && (
                          <button
                            onClick={() =>
                              handleItemDeliveredToUser(item.compraId)
                            }
                            className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                          >
                            Entregar
                          </button>
                        )}

                      {item.estadoCompra === 'ENTREGADO' && (
                        <span className="text-green-600 text-xs">
                          ✓ Entregado
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLANIFICAR */}
      {activeTab === 'planificar' && (
        <div>
          <h3 className="text-xl font-semibold mb-4">
            Planificar Nuevo Envio
          </h3>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="grid gap-4">
              {intermediarios
                .filter(i => i.id !== user.id)
                .map(i => (
                  <div
                    key={i.id}
                    onClick={() => setSelectedDestino(i.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      selectedDestino === i.id
                        ? "border-orange-500 bg-orange-50"
                        : "bg-white hover:bg-orange-50"
                    }`}
                  >
                    <h4 className="font-semibold">{i.nombre}</h4>
                    <p className="text-sm text-gray-600">
                      {i.direccion
                        ? `${i.direccion.ciudad}, ${i.direccion.provincia}`
                        : "Sin dirección"}
                    </p>
                  </div>
                ))}
            </div>

            {selectedDestino && (
              <form
                onSubmit={handlePlanEnvio}
                className="bg-white p-6 rounded-xl shadow"
              >
                <h4 className="font-semibold mb-4">Configurar Envio</h4>

                <div className="mb-4">
                  <label className="block text-sm mb-1">
                    Mínimo de Compras
                  </label>
                  <input
                    type="number"
                    value={planForm.minimoCompras}
                    onChange={e =>
                      setPlanForm({
                        ...planForm,
                        minimoCompras: Number(e.target.value)
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm mb-1">
                    Costo por Compra
                  </label>
                  <input
                    type="number"
                    value={planForm.precioPorCompra}
                    onChange={e =>
                      setPlanForm({
                        ...planForm,
                        precioPorCompra: Number(e.target.value)
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm mb-1">
                    Fecha de Envío
                  </label>
                  <input
                    type="date"
                    value={planForm.fechaEnvio}
                    onChange={e =>
                      setPlanForm({
                        ...planForm,
                        fechaEnvio: e.target.value
                      })
                    }
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium"
                >
                  Crear Plan
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  </div>
);
}
