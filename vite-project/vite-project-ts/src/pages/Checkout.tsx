import { useContext, useState } from 'react'
import { CartContext } from '../context/cart'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import '../components/Checkout.css'

export function Checkout() {
  const { cart, clearCart } = useContext(CartContext)
  const { user } = useUser()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    nombre: user?.name || '',
    email: user?.email || '',
    telefono: '',
    direccion: '',
    ciudad: '',
    provincia: '',
    codigoPostal: '',
    metodoPago: 'tarjeta'
  })

  const [orderPlaced, setOrderPlaced] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const subtotal = cart.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
  const envio = subtotal > 100 ? 0 : 10
  const total = subtotal + envio

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Simulate order placement
    console.log('Order placed:', { cart, formData, total })

    // Clear cart and show success
    clearCart()
    setOrderPlaced(true)

    // Redirect after 3 seconds
    setTimeout(() => {
      navigate('/')
    }, 3000)
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
              <div className="form-group">
                <label htmlFor="direccion">Dirección *</label>
                <input
                  type="text"
                  id="direccion"
                  name="direccion"
                  value={formData.direccion}
                  onChange={handleInputChange}
                  placeholder="Calle y número"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ciudad">Ciudad *</label>
                  <input
                    type="text"
                    id="ciudad"
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="provincia">Provincia *</label>
                  <input
                    type="text"
                    id="provincia"
                    name="provincia"
                    value={formData.provincia}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="codigoPostal">Código Postal</label>
                <input
                  type="text"
                  id="codigoPostal"
                  name="codigoPostal"
                  value={formData.codigoPostal}
                  onChange={handleInputChange}
                />
              </div>
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