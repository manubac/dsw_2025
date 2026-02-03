import React, { useEffect, useState } from 'react';
import { useUser } from '../context/user';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import './Purchases.css'; // Reusing existing styles

export default function MisVentasPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [ventas, setVentas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'vendedor') {
      navigate('/');
      return;
    }

    const fetchVentas = async () => {
      try {
        const res = await api.get(`/api/vendedores/${user.id}/ventas`);
        setVentas(res.data.data || []);
      } catch (err: any) {
        console.error('Error fetching ventas:', err);
        setError('No se pudieron cargar las ventas');
      } finally {
        setLoading(false);
      }
    };

    fetchVentas();
  }, [user, navigate]);

  const handleMarkSent = async (compraId: number) => {
    try {
      if (!confirm("¿Confirmas que has enviado los items al intermediario?")) return;
      
      await api.post(`/api/vendedores/${user?.id}/ventas/${compraId}/enviar`);
      alert("Envío marcado correctamente.");
      // Refresh
      window.location.reload();
    } catch (err: any) {
        alert("Error al actualizar envío: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="purchases-wrapper">
      <div className="purchases-card">
        <h2>Mis Ventas</h2>
        <p style={{color: '#666', marginBottom: '1rem'}}>
           Gestios los pedidos que debes enviar a los intermediarios.
        </p>

        {loading && <p>Cargando...</p>}
        {error && <div className="alert error">{error}</div>}

        {!loading && ventas.length === 0 && (
          <div>
            <p>Aún no tienes ventas.</p>
          </div>
        )}

        <div className="orders-list">
          {ventas.map((venta: any) => (
            <div key={venta.id} className="order-card" style={{borderLeft: '4px solid var(--primary)'}}>
              <div className="order-header">
                <strong>Pedido #{venta.id}</strong>
                <span className={`status-badge ${venta.envio?.estado || venta.estado}`}>
                  {venta.envio?.estado === 'vendedor_envio' ? 'Enviado a Intermediario' : (venta.envio?.estado || venta.estado)}
                </span>
              </div>
              <div className="order-body">
                <p><strong>Comprador:</strong> {venta.comprador.nombre} ({venta.comprador.email})</p>
                
                {venta.envio && venta.envio.intermediario && (
                  <div style={{background: '#eff6ff', padding: '10px', borderRadius: '8px', margin: '10px 0'}}>
                     <h4 style={{margin: '0 0 5px 0', color: '#1e40af'}}>Instrucciones de Envío:</h4>
                     <p style={{margin: 0, fontSize: '0.9rem'}}>Please send items to intermediary:</p>
                     <p style={{margin: '5px 0', fontWeight: 'bold'}}>{venta.envio.intermediario.nombre}</p>
                     <p style={{margin: 0, fontFamily: 'monospace'}}>{venta.envio.intermediario.direccion}</p>
                  </div>
                )}

                <div className="order-items">
                  <strong>Items vendidos:</strong>
                  <ul>
                    {venta.items.map((it: any) => (
                       <li key={it.id} style={{display:'flex', gap:'10px', alignItems:'center', margin:'5px 0'}}>
                          {it.image && <img src={it.image} alt={it.name} style={{width:'30px', height:'40px', objectFit:'contain'}}/>}
                          <span>{it.name}</span>
                          <span style={{color: '#green'}}>${it.price}</span>
                       </li>
                    ))}
                  </ul>
                </div>
                
                {venta.envio && venta.envio.estado !== 'vendedor_envio' && venta.envio.estado !== 'entregado' && (
                    <button 
                       className="cta-button" 
                       style={{width: '100%', marginTop: '1rem', fontSize: '0.9rem'}}
                       onClick={() => handleMarkSent(venta.id)}
                    >
                       Ya envié el paquete al Intermediario
                    </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
