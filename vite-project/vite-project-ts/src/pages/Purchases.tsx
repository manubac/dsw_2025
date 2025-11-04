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
        const res = await fetch('http://localhost:3000/api/compras')
        const json = await res.json()
        const data = json.data || []
        // filter purchases for current user
        const mine = data.filter((c: any) => c.comprador?.id === user.id)
        setCompras(mine)
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
                <p><strong>Dirección:</strong> {comp.direccion}, {comp.ciudad} ({comp.provincia})</p>

                <div className="order-items">
                  <strong>Items:</strong>
                  <ul>
                    {(comp.items || comp.cartas || []).map((it: any, idx: number) => {
                      // comp.items holds JSON with cartaId/quantity/price/title
                      if (it.cartaId !== undefined) {
                        return (
                          <li key={idx}>{it.title || `Carta ${it.cartaId}`} — x{it.quantity} — ${Number(it.price || 0).toFixed(2)}</li>
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
