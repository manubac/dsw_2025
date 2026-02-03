import React, { useState, useEffect } from 'react';
import { useUser } from '../context/user';
import axios from 'axios';
import './IntermediarioDashboard.css';

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
          const resPeers = await axios.get('http://localhost:3000/api/intermediarios');
          setIntermediarios(resPeers.data.data || []);

          // 2. Load Envios (Salientes/Origen)
          const resSalientes = await axios.get(`http://localhost:3000/api/intermediarios/${user?.id}/envios?type=origen`);
          setEnviosSalientes(resSalientes.data.data || []);

          // 3. Load Envios (Entrantes/Destino)
          const resEntrantes = await axios.get(`http://localhost:3000/api/intermediarios/${user?.id}/envios?type=destino`);
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
      await axios.post('http://localhost:3000/api/intermediarios/envios/plan', {
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
          await axios.post(`http://localhost:3000/api/intermediarios/compras/${compraId}/status`, {
              status: 'EN_MANOS_INTERMEDIARIO_ORIGEN'
          });
          loadData();
      } catch (e: any) { alert(e.message) }
  }

  const handleDispatchEnvio = async (envioId: number) => {
      try {
          const notas = prompt("Numero de seguimiento / Notas:");
          if (notas === null) return;
          await axios.post(`http://localhost:3000/api/intermediarios/envios/${envioId}/despachar`, { notas });
          loadData();
      } catch (e: any) { alert(e.message) }
  }


  // --- MANAGE ENTRANTES (DESTINATION) ---
  const handleReceiveEnvio = async (envioId: number) => {
    try {
        if(!confirm("¿Confirmar llegada del envío?")) return;
        await axios.post(`http://localhost:3000/api/intermediarios/envios/${envioId}/recibir`);
        loadData();
    } catch (e: any) { alert(e.message) }
  }

  const handleItemDeliveredToUser = async (compraId: number) => {
      try {
        if(!confirm("¿Confirmar entrega al usuario final?")) return;
        await axios.post(`http://localhost:3000/api/intermediarios/compras/${compraId}/status`, {
            status: 'ENTREGADO'
        });
        loadData();
      } catch (e: any) { alert(e.message) }
  }

  const handleDeleteEnvio = async (envioId: number) => {
    try {
        if(!confirm("¿Estás seguro de que deseas eliminar este envío? Esta acción no se puede deshacer.")) return;
        await axios.delete(`http://localhost:3000/api/intermediarios/envios/${envioId}`);
        loadData();
    } catch (e: any) { 
        alert(e.response?.data?.message || e.message) 
    }
  }


  if (user?.role !== 'intermediario') return <p>Access Denied</p>;

  return (
    <div className="dashboard-container">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
        <h1>Panel de Operaciones</h1>
        <button onClick={loadData} className="btn-secondary">Actualizar</button>
      </div>

      <div className="tabs">
        <button className={activeTab === 'salientes' ? 'active':''} onClick={() => setActiveTab('salientes')}>Envios Salientes (Origen)</button>
        <button className={activeTab === 'entrantes' ? 'active':''} onClick={() => setActiveTab('entrantes')}>Envios Entrantes (Destino)</button>
        <button className={activeTab === 'planificar' ? 'active':''} onClick={() => setActiveTab('planificar')}>Planificar Nuevo</button>
      </div>

      {loading && <p>Cargando...</p>}

      {/* --- TAB SALIENTES --- */}
      {activeTab === 'salientes' && (
          <div className="tab-content">
              <h3>Gestionar Salidas (Recibir de Vendedores &rarr; Enviar a Intermediarios)</h3>
              {enviosSalientes.length === 0 && <p>No hay envios planificados.</p>}
              
              <div className="envios-grid">
              {enviosSalientes.map(envio => (
                  <div key={envio.id} className={`envio-card status-${envio.estado}`}>
                      <div className="card-header">
                          <h4>Envio #{envio.id} &rarr; {envio.destinoIntermediario?.nombre}</h4>
                          <span className="badge">{envio.estado}</span>
                      </div>
                      <p><strong>Fecha Planificada:</strong> {envio.fechaEnvio ? new Date(envio.fechaEnvio).toLocaleDateString() : 'N/A'}</p>
                      
                      <div className="items-list">
                          <h5>Items ({envio.items?.length || 0})</h5>
                          {envio.items?.map((item: any) => (
                              <div key={item.compraId} className="item-row">
                                  <span>Item: {item.titulo} (Orden #{item.compraId})</span>
                                  <div className="item-meta">
                                      <small>Vendedor: {item.vendedor}</small>
                                      &nbsp;|&nbsp;
                                      <small>Estado: {item.estadoCompra}</small>
                                  </div>
                                  
                                  {/* Actions for Item at Origin */}
                                  {envio.estado !== 'cancelado' && item.estadoCompra === 'ENVIADO_A_INTERMEDIARIO' && (
                                     <button className="btn-small" onClick={() => handleConfirmItemReceived(item.compraId)}>
                                         Confirmar Recepción
                                     </button>
                                  )}
                                  {item.estadoCompra === 'EN_MANOS_INTERMEDIARIO_ORIGEN' && (
                                      <span className="check">✓ En depósito</span>
                                  )}
                              </div>
                          ))}
                      </div>

                      <div className="card-actions">
                          {envio.estado === 'planificado' && (
                              <p><small>Esperando {envio.minimoCompras} compras...</small></p>
                          )}
                          {envio.estado === 'intermediario_enviado' && (
                             <p><small>En tránsito...</small></p>
                          )}
                          
                          <div style={{display:'flex', gap:'10px', marginTop: '10px'}}>
                            {/* If items are ready, allow dispatch (simplified logic: if active or planificado) */}
                            {(envio.estado === 'planificado' || envio.estado === 'activo') && (
                                <button className="btn-primary" onClick={() => handleDispatchEnvio(envio.id)} style={{flex:1}}>
                                    Despachar Camión
                                </button>
                            )}
                            
                            {/* Delete button (only if planned for now, or depending on logic) */}
                            {(envio.estado === 'planificado' || envio.estado === 'orden_generada' || envio.estado === 'cancelado') && (
                                <button className="btn-secondary" style={{background: '#ef4444', color: 'white', border: 'none'}} onClick={() => handleDeleteEnvio(envio.id)}>
                                    Eliminar
                                </button>
                            )}
                          </div>
                      </div>
                  </div>
              ))}
              </div>
          </div>
      )}

      {/* --- TAB ENTRANTES --- */}
      {activeTab === 'entrantes' && (
          <div className="tab-content">
              <h3>Gestionar Entradas (Recibir de Intermediarios &rarr; Entregar a Usuarios)</h3>
              {enviosEntrantes.length === 0 && <p>No hay envios en camino.</p>}
              
              <div className="envios-grid">
              {enviosEntrantes.map(envio => (
                  <div key={envio.id} className={`envio-card status-${envio.estado}`}>
                      <div className="card-header">
                          <h4>Envio #{envio.id} de {envio.intermediario?.nombre}</h4>
                          <span className="badge">{envio.estado}</span>
                      </div>
                      {envio.notas && <p className="notes">Notas: {envio.notas}</p>}

                      <div className="card-actions">
                          {envio.estado === 'intermediario_enviado' && (
                              <button className="btn-primary" onClick={() => handleReceiveEnvio(envio.id)}>
                                  Confirmar Llegada
                              </button>
                          )}
                      </div>
                      
                      <div className="items-list">
                          <h5>Items para entregar</h5>
                          {envio.items?.map((item: any) => (
                              <div key={item.compraId} className="item-row">
                                  <span>User: {item.comprador} (Orden #{item.compraId})</span>
                                  <span>{item.titulo}</span>
                                  
                                  {/* Actions for Item at Destination */}
                                  {(envio.estado === 'intermediario_recibio' || envio.estado === 'recibido') && item.estadoCompra !== 'ENTREGADO' && (
                                     <button className="btn-small btn-success" onClick={() => handleItemDeliveredToUser(item.compraId)}>
                                         Entregar a Usuario
                                     </button>
                                  )}
                                  {item.estadoCompra === 'ENTREGADO' && (
                                     <span className="check">✓ Entregado</span>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>
              ))}
              </div>
          </div>
      )}

      {/* --- TAB PLANIFICAR --- */}
      {activeTab === 'planificar' && (
        <div className="tab-content">
          <h3>Planificar Nuevo Envio</h3>
          <div className="plan-container">
              <div className="peers-list">
                  {intermediarios
                    .filter(i => i.id !== user.id)
                    .map(i => (
                      <div 
                        key={i.id} 
                        className={`peer-card ${selectedDestino === i.id ? 'selected':''}`}
                        onClick={() => setSelectedDestino(i.id)}
                      >
                          <h4>{i.nombre}</h4>
                          <p>{i.direccion ? `${i.direccion.ciudad}, ${i.direccion.provincia}` : 'Sin dirección'}</p>
                      </div>
                  ))}
              </div>

              {selectedDestino && (
                  <form onSubmit={handlePlanEnvio} className="plan-form">
                      <h4>Configurar Envio</h4>
                      <div className="form-group">
                          <label>Mínimo de Compras para activar:</label>
                          <input 
                              type="number" 
                              value={planForm.minimoCompras} 
                              onChange={e => setPlanForm({...planForm, minimoCompras: Number(e.target.value)})}
                          />
                      </div>
                      <div className="form-group">
                          <label>Costo de Envío por Compra ($):</label>
                          <input 
                              type="number" 
                              value={planForm.precioPorCompra} 
                              onChange={e => setPlanForm({...planForm, precioPorCompra: Number(e.target.value)})}
                          />
                      </div>
                      <div className="form-group">
                          <label>Fecha Límite / Salida:</label>
                          <input 
                              type="date" 
                              value={planForm.fechaEnvio} 
                              onChange={e => setPlanForm({...planForm, fechaEnvio: e.target.value})}
                          />
                      </div>
                      <button type="submit" className="btn-primary">Crear Plan</button>
                  </form>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
