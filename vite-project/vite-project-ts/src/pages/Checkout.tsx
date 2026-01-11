import { useContext, useState, useEffect } from 'react'
import { CartContext } from '../context/cart'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import '../components/Checkout.css'

export function Checkout() {
  const { cart, clearCart } = useContext(CartContext)
  const { user, login, loadDirecciones, addDireccion } = useUser()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    nombre: user?.name || '',
    email: user?.email || '',
    telefono: '',
    metodoPago: 'tarjeta'
  })

  const [selectedDireccionId, setSelectedDireccionId] = useState<number | null>(null)
  const [showNewDireccionForm, setShowNewDireccionForm] = useState(false)
  const [newDireccion, setNewDireccion] = useState({
    provincia: '',
    ciudad: '',
    codigoPostal: '',
    calle: '',
    altura: '',
    departamento: '',
  })

  const [orderPlaced, setOrderPlaced] = useState(false)

  // Cargar direcciones al montar
  useEffect(() => {
    if (user?.id) {
      loadDirecciones()
    }
  }, [user?.id, loadDirecciones])

  // Si el usuario tiene direcciones, seleccionar la primera por defecto
  useEffect(() => {
    if (user?.direcciones && user.direcciones.length > 0 && !selectedDireccionId) {
      setSelectedDireccionId(user.direcciones[0].id)
    }
  }, [user?.direcciones, selectedDireccionId])

  const handleNewDireccionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewDireccion(prev => ({ ...prev, [name]: value }))
  }

  const handleSaveNewDireccion = async () => {
    if (!user?.id) return

    try {
      const response = await fetch('/api/direcciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDireccion,
          usuarioId: user.id,
        }),
      })

      if (response.ok) {
        const result = await response.json()
        addDireccion(result.data)
        setSelectedDireccionId(result.data.id)
        setShowNewDireccionForm(false)
        setNewDireccion({
          provincia: '',
          ciudad: '',
          codigoPostal: '',
          calle: '',
          altura: '',
          departamento: '',
        })
      } else {
        alert('Error al guardar la dirección')
      }
    } catch (error) {
      alert('Error al guardar la dirección')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const subtotal = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
  const envio = subtotal > 100 ? 0 : 10
  const total = subtotal + envio

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      let compradorId: number | undefined = user?.id

      if (!compradorId) {
        const usersRes = await fetch('http://localhost:3000/api/users')
        const usersJson = await usersRes.json()
        const existing = (usersJson.data || []).find((u: any) => u.email === formData.email)

        if (existing) {
          compradorId = existing.id
          login({ id: existing.id, name: existing.username || existing.name || '', email: existing.email, password: existing.password || '', role: existing.role })
        } else {
          
          const username = formData.nombre.split(' ')[0] || formData.email.split('@')[0]
          const password = Math.random().toString(36).slice(-8)
          const createRes = await fetch('http://localhost:3000/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email: formData.email, password, role: 'user' })
          })

          if (!createRes.ok) {
            const err = await createRes.json()
            throw new Error(err.message || 'Error creating user')
          }

          const created = await createRes.json()
          compradorId = created.data.id
          const u = created.data
          login({ id: u.id, name: u.username || u.name || '', email: u.email, password: u.password || '', role: u.role })
        }
      }

      // 2) Prepare compra payload
      const items = cart.map((item: any) => ({ cartaId: item.id, quantity: item.quantity, price: item.price, title: item.title }))
      const cartasIds = Array.from(new Set(cart.map((i: any) => i.id)))

      const payload = {
        compradorId,
        cartasIds,
        items,
        total,
        estado: 'pendiente',
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        direccionEntregaId: selectedDireccionId,
        metodoPago: formData.metodoPago,
      }

      const compraRes = await fetch('http://localhost:3000/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!compraRes.ok) {
        const err = await compraRes.json()
        throw new Error(err.message || 'Error creating compra')
      }

      const compraJson = await compraRes.json()
      console.log('Compra created:', compraJson)

      // Clear cart and show success
      clearCart()
      setOrderPlaced(true)

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (error: any) {
      console.error('Error placing order:', error)
      alert('Error al procesar el pedido: ' + (error.message || 'unknown'))
    }
  }

  if (cart.length === 0 && !orderPlaced) {
    return (
      <div className="checkout-empty">
        <h2>Tu carrito está vacío</h2>
        <p>Agrega algunas cartas para continuar con el checkout.</p>
        <button onClick={() => navigate('/')} className="continue-shopping-btn">
          Continuar Comprando
        </button>
      </div>
    )
  }

  if (orderPlaced) {
    return (
      <div className="checkout-success">
        <div className="success-icon">✅</div>
        <h2>¡Pedido Realizado con Éxito!</h2>
        <p>Gracias por tu compra. Recibirás un email con los detalles de tu pedido.</p>
        <p>Serás redirigido a la página principal en unos segundos...</p>
      </div>
    )
  }

  return (
    <div className="checkout-container">
      <div className="checkout-header">
        <h1>Checkout</h1>
        <p>Completa tu pedido</p>
      </div>

      <div className="checkout-content">
        <div className="checkout-form-section">
          <form onSubmit={handleSubmit} className="checkout-form">
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
                <label htmlFor="telefono">Teléfono</label>
                <input
                  type="tel"
                  id="telefono"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-section">
              <h3>Dirección de Envío</h3>
              
              {user?.direcciones && user.direcciones.length > 0 ? (
                <div className="direccion-selector">
                  <label>Seleccionar Dirección:</label>
                  <select
                    value={selectedDireccionId || ''}
                    onChange={(e) => setSelectedDireccionId(Number(e.target.value))}
                    required
                  >
                    {user.direcciones.map((direccion) => (
                      <option key={direccion.id} value={direccion.id}>
                        {direccion.calle} {direccion.altura}{direccion.departamento && `, ${direccion.departamento}`} - {direccion.ciudad}, {direccion.provincia}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p>No tienes direcciones registradas.</p>
              )}

              {!showNewDireccionForm ? (
                <button 
                  type="button"
                  className="add-direccion-btn"
                  onClick={() => setShowNewDireccionForm(true)}
                >
                  {user?.direcciones && user.direcciones.length > 0 ? 'Agregar Nueva Dirección' : 'Crear Dirección de Envío'}
                </button>
              ) : (
                <div className="new-direccion-form">
                  <h4>Nueva Dirección</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="provincia">Provincia *</label>
                      <input
                        type="text"
                        id="provincia"
                        name="provincia"
                        value={newDireccion.provincia}
                        onChange={handleNewDireccionChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="ciudad">Ciudad *</label>
                      <input
                        type="text"
                        id="ciudad"
                        name="ciudad"
                        value={newDireccion.ciudad}
                        onChange={handleNewDireccionChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="codigoPostal">Código Postal</label>
                      <input
                        type="text"
                        id="codigoPostal"
                        name="codigoPostal"
                        value={newDireccion.codigoPostal}
                        onChange={handleNewDireccionChange}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="calle">Calle *</label>
                      <input
                        type="text"
                        id="calle"
                        name="calle"
                        value={newDireccion.calle}
                        onChange={handleNewDireccionChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="altura">Altura *</label>
                      <input
                        type="text"
                        id="altura"
                        name="altura"
                        value={newDireccion.altura}
                        onChange={handleNewDireccionChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="departamento">Departamento (opcional)</label>
                      <input
                        type="text"
                        id="departamento"
                        name="departamento"
                        value={newDireccion.departamento}
                        onChange={handleNewDireccionChange}
                      />
                    </div>
                  </div>

                  <div className="direccion-actions">
                    <button 
                      type="button"
                      className="save-direccion-btn"
                      onClick={handleSaveNewDireccion}
                    >
                      Guardar Dirección
                    </button>
                    <button 
                      type="button"
                      className="cancel-direccion-btn"
                      onClick={() => {
                        setShowNewDireccionForm(false)
                        setNewDireccion({
                          provincia: '',
                          ciudad: '',
                          codigoPostal: '',
                          calle: '',
                          altura: '',
                          departamento: '',
                        })
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>Método de Pago</h3>
              <div className="form-group">
                <select
                  id="metodoPago"
                  name="metodoPago"
                  value={formData.metodoPago}
                  onChange={handleInputChange}
                >
                  <option value="tarjeta">Tarjeta de Crédito/Débito</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                  <option value="efectivo">Efectivo</option>
                </select>
              </div>
            </div>

            <button type="submit" className="place-order-btn">
              Realizar Pedido - ${total.toFixed(2)}
            </button>
          </form>
        </div>

        <div className="checkout-summary">
          <h3>Resumen del Pedido</h3>

          <div className="order-items">
            {cart.map((item: any) => (
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

          <div className="order-totals">
            <div className="total-row">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="total-row">
              <span>Envío:</span>
              <span>{envio === 0 ? 'Gratis' : `$${envio.toFixed(2)}`}</span>
            </div>
            <div className="total-row total">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="shipping-info">
            <p>🚚 Envío gratuito en pedidos mayores a $100</p>
            <p>📦 Tiempo de entrega: 3-5 días hábiles</p>
          </div>
        </div>
      </div>
    </div>
  )
}