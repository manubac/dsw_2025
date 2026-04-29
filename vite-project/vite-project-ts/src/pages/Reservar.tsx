import { useContext, useState, useEffect } from 'react'
import { CartContext } from '../context/cart'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import '../components/Checkout.css'
import { fetchApi } from '../services/api'

interface TiendaRetiro {
  id: number
  nombre: string
  direccion: string
  horario?: string
}

type ModoRetiro = 'chat' | number | null

export function Reservar() {
  const { cart, clearCart } = useContext(CartContext)
  const { user } = useUser()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    nombre: user?.name || '',
    email: user?.email || '',
    telefono: '',
  })

  const [reservaConfirmada, setReservaConfirmada] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [compraIds, setCompraIds] = useState<number[]>([])

  // vendedorId (string) → { tiendas disponibles para ese vendedor, modo seleccionado }
  const [tiendasPorVendedor, setTiendasPorVendedor] = useState<
    Record<string, { tiendas: TiendaRetiro[]; modo: ModoRetiro }>
  >({})

  // Agrupar items del carrito por vendedor (calculado antes del useEffect para usarlo en la validación)
  interface UploaderTienda {
    id: number
    nombre: string
    direccion: string
    horario?: string | null
  }

  const itemsPorVendedor: Record<string, { vendedorNombre: string; items: any[] }> = {}
  const itemsPorTienda:   Record<string, { tienda: UploaderTienda; items: any[] }> = {}

  for (const item of cart) {
    if (item.uploaderTienda?.id) {
      const key    = String(item.uploaderTienda.id)
      const tienda = item.uploaderTienda as UploaderTienda
      if (!itemsPorTienda[key]) itemsPorTienda[key] = { tienda, items: [] }
      itemsPorTienda[key].items.push(item)
    } else {
      const key    = String(item.uploader?.id ?? 'sin-vendedor')
      const nombre = item.uploader?.nombre ?? 'Vendedor desconocido'
      if (!itemsPorVendedor[key]) itemsPorVendedor[key] = { vendedorNombre: nombre, items: [] }
      itemsPorVendedor[key].items.push(item)
    }
  }

  useEffect(() => {
    const vendedorIds = [...new Set(
      cart.map((item: any) => item.uploader?.id).filter(Boolean)
    )] as number[]

    if (vendedorIds.length === 0) return

    Promise.all(
      vendedorIds.map(id =>
        fetchApi(`/api/vendedores/${id}/tiendas`)
          .then(r => r.json())
          .then(json => ({ id: String(id), tiendas: (json.data || []) as TiendaRetiro[] }))
          .catch(() => ({ id: String(id), tiendas: [] }))
      )
    ).then(results => {
      setTiendasPorVendedor(prev => {
        const next = { ...prev }
        for (const { id, tiendas } of results) {
          next[id] = { tiendas, modo: prev[id]?.modo ?? null }
        }
        return next
      })
    })
  }, [cart])

  const setModoVendedor = (vendedorId: string, modo: ModoRetiro) => {
    setTiendasPorVendedor(prev => ({
      ...prev,
      [vendedorId]: { tiendas: prev[vendedorId]?.tiendas ?? [], modo },
    }))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const subtotal = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

  const handleReservar = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validar que cada vendedor tenga una selección
    const vendedorKeys = Object.keys(itemsPorVendedor)
    for (const key of vendedorKeys) {
      if (!tiendasPorVendedor[key] || tiendasPorVendedor[key].modo === null) {
        setError('Seleccioná una tienda de retiro o "coordinar via chat" para cada vendedor.')
        setLoading(false)
        return
      }
    }

    // Construir mapa vendedorId → tiendaRetiroId (null = chat)
    const tiendaRetiroPorVendedor: Record<string, number | null> = {}
    for (const key of vendedorKeys) {
      const modo = tiendasPorVendedor[key]?.modo
      tiendaRetiroPorVendedor[key] = (modo !== null && modo !== 'chat') ? Number(modo) : null
    }

    try {
      const items = cart.map((item: any) => ({
        ...(item.type === 'bundle'
          ? { itemCartaId: item.bundleId ?? item.id }
          : { cartaId: item.id }),
        quantity: item.quantity,
        price: item.price,
        title: item.title,
      }))

      const res = await fetchApi('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          email: formData.email,
          telefono: formData.telefono,
          metodoPago: 'efectivo',
          total: subtotal,
          tiendaRetiroPorVendedor,
          items,
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        throw new Error(body.message || 'Error al crear la reserva')
      }

      const compras = Array.isArray(body.data) ? body.data : [body.data]
      setCompraIds(compras.map((c: any) => c.id).filter(Boolean))
      clearCart()
      setReservaConfirmada(true)
    } catch (err: any) {
      setError(err.message || 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (cart.length === 0 && !reservaConfirmada) {
    return (
      <div className="checkout-empty">
        <h2>Tu carrito está vacío</h2>
        <p>Agrega algunas cartas para poder reservar.</p>
        <button onClick={() => navigate('/')} className="continue-shopping-btn">
          Continuar Comprando
        </button>
      </div>
    )
  }

  if (reservaConfirmada) {
    const tieneItemsTienda   = Object.keys(itemsPorTienda).length > 0
    const tieneItemsVendedor = Object.keys(itemsPorVendedor).length > 0

    return (
      <div className="checkout-success">
        <div className="success-icon">✅</div>
        <h2>¡Reserva confirmada!</h2>
        {compraIds.length > 0 && (
          <p className="text-sm text-gray-500 mb-1">
            {compraIds.length === 1
              ? `Orden #${compraIds[0]}`
              : `Órdenes: ${compraIds.map((id) => `#${id}`).join(', ')}`}
          </p>
        )}
        {compraIds.length > 1 && (
          <p className="text-sm text-amber-700 mb-2">
            Se generó una orden por cada vendedor / tienda.
          </p>
        )}
        {tieneItemsTienda && (
          <p style={{ marginBottom: '0.5rem' }}>
            🏪 Tus cartas de tienda están listas. Acercate a retirarlas y pagá en el local.
          </p>
        )}
        {tieneItemsVendedor && (
          <p>
            Desde <strong>Mis Compras</strong> podés chatear con el vendedor para acordar el encuentro.
          </p>
        )}
        <button
          onClick={() => navigate('/purchases')}
          className="continue-shopping-btn"
          style={{ marginTop: '1.5rem' }}
        >
          Ver mis compras
        </button>
      </div>
    )
  }

  return (
    <div className="checkout-container">
      <div className="checkout-header">
        <h1>Reservar Cartas</h1>
        <p>Completá tus datos para coordinar la entrega en persona</p>
      </div>

      <div
        style={{
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          color: '#92400e',
        }}
      >
        Una vez confirmada la reserva, podrás chatear con el vendedor desde{' '}
        <strong>Mis Compras</strong> para acordar el punto de encuentro y el pago.
      </div>

      <div className="checkout-content">
        <div className="checkout-form-section">
          <form onSubmit={handleReservar}>
            <div className="form-section">
              <h3>Información de Contacto</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nombre">Nombre Completo *</label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="telefono">Teléfono *</label>
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  placeholder="Ej: 11 1234-5678"
                  required
                />
              </div>
            </div>

            {/* Selector de retiro por vendedor */}
            {Object.entries(itemsPorVendedor).map(([vendedorId, grupo]) => {
              const data = tiendasPorVendedor[vendedorId]
              const tiendas = data?.tiendas ?? []
              const modo = data?.modo ?? null

              return (
                <div className="form-section" key={vendedorId}>
                  <h3>
                    Retiro — <span style={{ color: '#f97316' }}>{grupo.vendedorNombre}</span>
                  </h3>

                  {/* Opción chat */}
                  <label
                    onClick={(e) => {
                      e.preventDefault()
                      setModoVendedor(vendedorId, modo === 'chat' ? null : 'chat')
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      border: `2px solid ${modo === 'chat' ? '#f97316' : '#e5e7eb'}`,
                      borderRadius: '0.5rem',
                      cursor: 'pointer',
                      background: modo === 'chat' ? '#fff7ed' : '#fff',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <input type="radio" checked={modo === 'chat'} onChange={() => {}} />
                    <div>
                      <p style={{ fontWeight: 600, margin: 0 }}>💬 Coordinar via chat con el vendedor</p>
                      <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: '0.1rem 0 0' }}>
                        El vendedor te contactará para acordar el punto de encuentro.
                      </p>
                    </div>
                  </label>

                  {/* Tiendas habilitadas por este vendedor */}
                  {tiendas.length > 0 && (
                    <>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', margin: '0 0 0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        — o elegí una tienda de retiro —
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {tiendas.map(tienda => (
                          <label
                            key={tienda.id}
                            onClick={(e) => {
                              e.preventDefault()
                              setModoVendedor(vendedorId, modo === tienda.id ? null : tienda.id)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.75rem',
                              padding: '0.75rem 1rem',
                              border: `2px solid ${modo === tienda.id ? '#f97316' : '#e5e7eb'}`,
                              borderRadius: '0.5rem',
                              cursor: 'pointer',
                              background: modo === tienda.id ? '#fff7ed' : '#fff',
                            }}
                          >
                            <input
                              type="radio"
                              checked={modo === tienda.id}
                              onChange={() => {}}
                              style={{ marginTop: '0.25rem', flexShrink: 0 }}
                            />
                            <div>
                              <p style={{ fontWeight: 600, margin: 0 }}>📍 {tienda.nombre}</p>
                              <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: '0.1rem 0 0' }}>
                                {tienda.direccion}
                              </p>
                              {tienda.horario && (
                                <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.1rem 0 0' }}>
                                  🕐 {tienda.horario}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            {/* Bloque fijo de retiro para items de tienda */}
            {Object.entries(itemsPorTienda).map(([tiendaKey, grupo]) => (
              <div className="form-section" key={`tienda-${tiendaKey}`}>
                <h3>
                  Retiro — <span style={{ color: '#f97316' }}>{grupo.tienda.nombre}</span>
                </h3>
                <div
                  style={{
                    display:      'flex',
                    alignItems:   'flex-start',
                    gap:          '0.75rem',
                    padding:      '0.75rem 1rem',
                    border:       '2px solid #f97316',
                    borderRadius: '0.5rem',
                    background:   '#fff7ed',
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>📍</span>
                  <div>
                    <p style={{ fontWeight: 600, margin: 0 }}>{grupo.tienda.nombre}</p>
                    <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: '0.1rem 0 0' }}>
                      {grupo.tienda.direccion}
                    </p>
                    {grupo.tienda.horario && (
                      <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.1rem 0 0' }}>
                        🕐 {grupo.tienda.horario}
                      </p>
                    )}
                    <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0.4rem 0 0', fontWeight: 500 }}>
                      Pagás y retirás en el local al momento de buscar tu pedido.
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {error && (
              <p style={{ color: 'red', marginBottom: '1rem' }}>{error}</p>
            )}

            <button type="submit" className="place-order-btn" disabled={loading}>
              {loading ? 'Procesando...' : `Reservar — $${subtotal.toFixed(2)}`}
            </button>
          </form>
        </div>

        <div className="checkout-summary">
          <h3>Resumen del Pedido</h3>

          <div className="order-items">
            {Object.entries(itemsPorVendedor).map(([key, grupo]) => (
              <div key={key} style={{ marginBottom: '1rem' }}>
                <p
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#6b7280',
                    marginBottom: '0.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.25rem',
                  }}
                >
                  Vendedor: {grupo.vendedorNombre}
                </p>
                {grupo.items.map((item: any) => (
                  <div key={item.id} className="order-item">
                    <img src={item.thumbnail} alt={item.title} className="item-image" />
                    <div className="item-details">
                      <h4>{item.title}</h4>
                      <p>Cantidad: {item.quantity}</p>
                      <p className="item-price">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {Object.entries(itemsPorTienda).map(([key, grupo]) => (
              <div key={`tienda-sum-${key}`} style={{ marginBottom: '1rem' }}>
                <p
                  style={{
                    fontSize:       '0.75rem',
                    fontWeight:     600,
                    textTransform:  'uppercase',
                    letterSpacing:  '0.05em',
                    color:          '#6b7280',
                    marginBottom:   '0.5rem',
                    borderBottom:   '1px solid #e5e7eb',
                    paddingBottom:  '0.25rem',
                  }}
                >
                  Tienda: {grupo.tienda.nombre}
                </p>
                {grupo.items.map((item: any) => (
                  <div key={item.id} className="order-item">
                    <img src={item.thumbnail} alt={item.title} className="item-image" />
                    <div className="item-details">
                      <h4>{item.title}</h4>
                      <p>Cantidad: {item.quantity}</p>
                      <p className="item-price">${(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="order-totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row total">
              <span>Total:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="shipping-info">
            <p>🤝 El pago y la entrega se coordinan en persona</p>
            <p>💬 Coordiná el encuentro por el chat en Mis Compras</p>
          </div>
        </div>
      </div>
    </div>
  )
}
