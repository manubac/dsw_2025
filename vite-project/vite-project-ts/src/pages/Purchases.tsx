import React, { useEffect, useState } from 'react'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import './Purchases.css'

export function Purchases() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [compras, setCompras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    const fetchCompras = async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/compras?compradorId=${user.id}`)
        const json = await res.json()
        console.log('API Response:', json)
        console.log('User ID:', user.id, 'User role:', user.role)
        const data = json.data || []
        // No need to filter on frontend anymore - backend does it
        setCompras(data)
      } catch (err: any) {
        console.error('Error fetching compras:', err)
        setError('No se pudieron cargar las compras')
      } finally {
        setLoading(false)
      }
    }

    fetchCompras()
  }, [user])

  if (!user) {
    return (
      <div className="purchases-wrapper">
        <div className="purchases-card">
          <h2>No has iniciado sesión</h2>
          <p>Por favor inicia sesión para ver tus compras.</p>
          <button onClick={() => navigate('/login')} className="btn-primary">Iniciar sesión</button>
        </div>
      </div>
    )
  }

  // Only users (compradores) can view purchases
  if (user.role !== 'usuario') {
    return (
      <div className="purchases-wrapper">
        <div className="purchases-card">
          <h2>Acceso denegado</h2>
          <p>Solo los usuarios compradores pueden ver sus compras.</p>
          <button onClick={() => navigate('/')} className="btn-primary">Volver al inicio</button>
        </div>
      </div>
    )
  }

  return (
    <div className="purchases-wrapper">
      <div className="purchases-card">
        <h2>Mis Compras</h2>
        {loading && <p>Cargando...</p>}
        {error && <div className="alert error">{error}</div>}

        {!loading && compras.length === 0 && (
          <div>
            <p>No encontré compras para tu cuenta.</p>
            <button onClick={() => navigate('/')} className="btn-primary">Volver al inicio</button>
          </div>
        )}

        <div className="orders-list">
          {compras.map((comp: any) => (
            <div key={comp.id} className="order-card">
              <div className="order-header">
                <strong>Orden #{comp.id}</strong>
                <span className="order-status">{comp.estado}</span>
              </div>
              <div className="order-body">
                <p><strong>Total:</strong> ${Number(comp.total || 0).toFixed(2)}</p>
                <p><strong>Contacto:</strong> {comp.nombre} — {comp.email}</p>
                <p><strong>Dirección:</strong> {comp.direccionEntrega ? `${comp.direccionEntrega.calle} ${comp.direccionEntrega.altura}${comp.direccionEntrega.departamento ? `, ${comp.direccionEntrega.departamento}` : ''}, ${comp.direccionEntrega.ciudad}, ${comp.direccionEntrega.provincia} - CP: ${comp.direccionEntrega.codigoPostal}` : 'No especificada'}</p>

                <div className="order-items">
                  <strong>Items:</strong>
                  <ul>
                    {(comp.items || comp.cartas || []).map((it: any, idx: number) => {
                      // comp.items holds JSON with cartaId/quantity/price/title
                      if (it.cartaId !== undefined) {
                        return (
                          <li key={idx}>
                            <a 
                              href={`/card/${it.cartaId}`} 
                              style={{ color: '#4285f4', textDecoration: 'none' }}
                              onClick={(e) => {
                                e.preventDefault();
                                navigate(`/card/${it.cartaId}`);
                              }}
                            >
                              {it.title || `Carta ${it.cartaId}`}
                            </a> — x{it.quantity} — ${Number(it.price || 0).toFixed(2)}
                          </li>
                        )
                      }
                      // fallback to cartas relation
                      return <li key={idx}>Carta id: {it.id || it}</li>
                    })}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Purchases
