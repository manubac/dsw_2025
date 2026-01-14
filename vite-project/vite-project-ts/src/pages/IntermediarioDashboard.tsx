import { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '../context/user';
import './IntermediarioDashboard.css';

interface Direccion {
  id: number;
  provincia: string;
  ciudad: string;
  codigoPostal: string;
  calle: string;
  altura: string;
  departamento?: string;
  intermediario: number;
}

interface Intermediario {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  descripcion: string;
  activo: boolean;
  direccion?: Direccion;
}

interface Envio {
  id: number;
  estado: string;
  fechaEnvio?: string;
  intermediario: Intermediario;
  destinoIntermediario?: Intermediario;
  minimoCompras?: number;
  precioPorCompra?: number;
  compras: any[];
}

export default function IntermediarioDashboard() {
  const { user, getAuthHeaders } = useUser();
  const [intermediarios, setIntermediarios] = useState<Intermediario[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [selectedDestino, setSelectedDestino] = useState<number | null>(null);
  const [planForm, setPlanForm] = useState({
    minimoCompras: 1,
    precioPorCompra: 0,
    fechaEnvio: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'intermediario') {
      loadIntermediarios();
      loadEnvios();
    }
  }, [user]);

  const loadIntermediarios = async () => {
    try {
      const response = await fetch('/api/intermediarios');
      if (response.ok) {
        const data = await response.json();
        setIntermediarios(data.data || []);
      }
    } catch (error) {
      console.error('Error loading intermediarios:', error);
    }
  };

  const loadEnvios = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`/api/envios?intermediarioId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setEnvios(data.data || []);
      }
    } catch (error) {
      console.error('Error loading envios:', error);
    }
  };

  const handlePlanEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDestino || !user?.id) return;

    setLoading(true);
    try {
      const response = await fetch('/api/envios/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeaders() as Record<string, string>),
        },
        body: JSON.stringify({
          intermediarioId: user.id,
          destinoIntermediarioId: selectedDestino,
          ...planForm,
        }),
      });

      if (response.ok) {
        alert('Envio planificado con éxito');
        setSelectedDestino(null);
        setPlanForm({ minimoCompras: 1, precioPorCompra: 0, fechaEnvio: '' });
        loadEnvios();
      } else {
        const error = await response.json();
        alert(error.message || 'Error al planificar envio');
      }
    } catch (error) {
      console.error('Error planning envio:', error);
      alert('Error al planificar envio');
    } finally {
      setLoading(false);
    }
  };

  const handleActivateEnvio = async (envioId: number) => {
    try {
      const response = await fetch(`/api/envios/${envioId}/activate`, {
        method: 'POST',
        headers: getAuthHeaders() as HeadersInit,
      });

      if (response.ok) {
        alert('Envio activado con éxito');
        loadEnvios();
      } else {
        const error = await response.json();
        alert(error.message || 'Error al activar envio');
      }
    } catch (error) {
      console.error('Error activating envio:', error);
      alert('Error al activar envio');
    }
  };

  if (user?.role !== 'intermediario') {
    return <div>No tienes permisos para acceder a esta página</div>;
  }

  return (
    <div className="dashboard-container">
      <h1>Panel de Intermediario</h1>

      <section>
        <h2>Mis Envios</h2>
        <div className="envios-list">
          {envios.map((envio) => (
            <div key={envio.id} className="envio-card">
              <h3>Envio #{envio.id}</h3>
              <p>Estado: {envio.estado}</p>
              <p>Destino: {envio.destinoIntermediario?.nombre || 'N/A'}</p>
              <p>Mínimo compras: {envio.minimoCompras || 'N/A'}</p>
              <p>Precio por compra: ${envio.precioPorCompra || 'N/A'}</p>
              <p>Compras actuales: {envio.compras.length}</p>
              {envio.estado === 'planificado' && envio.compras.length >= (envio.minimoCompras || 0) && (
                <button onClick={() => handleActivateEnvio(envio.id)}>Activar Envio</button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Planificar Nuevo Envio</h2>
        <div className="plan-envio-form">
          <h3>Seleccionar Destino</h3>
          <div className="intermediarios-grid">
            {intermediarios
              .filter((inter) => inter.id !== user.id)
              .map((inter) => (
                <div
                  key={inter.id}
                  className={`intermediario-card ${selectedDestino === inter.id ? 'selected' : ''}`}
                  onClick={() => setSelectedDestino(inter.id)}
                >
                  <h4>{inter.nombre}</h4>
                  <p>{inter.descripcion}</p>
                  <div className="direcciones">
                    {inter.direccion && (
                      <div className="direccion">
                        <p>{inter.direccion.provincia}, {inter.direccion.ciudad}</p>
                        <p>{inter.direccion.calle} {inter.direccion.altura}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {selectedDestino && (
            <form onSubmit={handlePlanEnvio}>
              <div>
                <label>Mínimo de compras:</label>
                <input
                  type="number"
                  value={planForm.minimoCompras}
                  onChange={(e) => setPlanForm({ ...planForm, minimoCompras: Number(e.target.value) })}
                  min="1"
                  required
                />
              </div>
              <div>
                <label>Precio por compra ($):</label>
                <input
                  type="number"
                  value={planForm.precioPorCompra}
                  onChange={(e) => setPlanForm({ ...planForm, precioPorCompra: Number(e.target.value) })}
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label>Fecha de envio:</label>
                <input
                  type="date"
                  value={planForm.fechaEnvio}
                  onChange={(e) => setPlanForm({ ...planForm, fechaEnvio: e.target.value })}
                  required
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Planificando...' : 'Planificar Envio'}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}