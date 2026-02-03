import { useParams, useNavigate } from 'react-router-dom'
import { useState, useContext, useEffect } from 'react'
import { CartContext } from '../context/cart'
import { AddToCartIcon } from '../components/Icons'
import axios from 'axios'
import { useUser } from '../context/user'
import '../components/CardDetail.css'

export function CardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart, cart } = useContext(CartContext)
  const { user } = useUser()
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [card, setCard] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCard = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/cartas/${id}`)
        if (!response.ok) {
          throw new Error('Card not found')
        }
        const result = await response.json()
        setCard(result.data)
      } catch (error) {
        console.error('Error fetching card:', error)
        navigate('/cards')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchCard()
    }
  }, [id, navigate])

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!card) {
    return <div>Card not found</div>
  }

  const isInCart = cart.some((item: any) => item.id === card.id)
  const allImages = [card.thumbnail, ...card.images]

  const handleAddToCart = () => {
    addToCart(card, quantity)
  }

  const handleDelete = async () => {
    if (!card?.id) return
    if (!user) {
      alert('Debes estar logueado como vendedor para eliminar esta carta')
      return
    }

    const ok = window.confirm('¿Seguro que querés eliminar esta carta? Esta acción no se puede deshacer.')
    if (!ok) return

    try {
      await axios.delete(`http://localhost:3000/api/cartas/${card.id}`, { data: { userId: user.id } })
      navigate('/cards')
    } catch (err: any) {
      console.error('Error deleting carta', err)
      if (err.response && err.response.status === 403) {
        alert('No estás autorizado para eliminar esta carta')
      } else {
        alert('Error al eliminar la carta')
      }
    }
  }

  return (
    <div className="card-detail">
      <div className="breadcrumb">
        <span onClick={() => navigate('/')} className="breadcrumb-link">Inicio</span>
        <span> / </span>
        <span onClick={() => navigate('/cards')} className="breadcrumb-link">Cartas</span>
        <span> / </span>
        <span className="breadcrumb-current">{card.title}</span>
      </div>

      <div className="card-detail-content">
        <div className="card-gallery">
          <div className="main-image">
            <img
              src={allImages[selectedImage]}
              alt={card.title}
              className="card-main-img"
            />
          </div>
          <div className="thumbnail-gallery">
            {allImages.map((image, index) => (
              <img
                key={index}
                src={image}
                alt={`${card.title} ${index + 1}`}
                className={`thumbnail ${selectedImage === index ? 'active' : ''}`}
                onClick={() => setSelectedImage(index)}
              />
            ))}
          </div>
        </div>

        <div className="card-info">
          <div className="card-header">
            <h1 className="card-title">{card.title}</h1>
            <div className="card-meta">
              {card.set && <span className="card-set">{card.set}</span>}
            </div>
            {card.uploader && (
              <div className="seller-info" style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Vendido por:</span>
                <span 
                  onClick={() => navigate(`/vendedor/${card.uploader.id}`)} 
                  style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                >
                  {card.uploader.nombre}
                </span>

                <div 
                  className="seller-rating" 
                  title={`${card.uploader.reviewsCount || 0} valoraciones`}
                  style={{ display: 'flex', alignItems: 'center', marginLeft: '4px' }}
                >
                  <span style={{ color: '#fbbf24', fontSize: '1rem', letterSpacing: '1px' }}>
                     {'★'.repeat(Math.round(card.uploader.rating || 0))}
                     {'☆'.repeat(5 - Math.round(card.uploader.rating || 0))}
                   </span>
                   <span style={{ marginLeft: '4px', fontSize: '0.8rem' }}>
                     ({card.uploader.reviewsCount || 0})
                   </span>
                </div>
              </div>
            )}
          </div>

          <div className="card-rarity">
            <span className={`rarity-badge ${card.rarity ? card.rarity.toLowerCase().replace(/\s+/g, '-') : 'unknown'}`}>
              {card.rarity || 'Unknown'}
            </span>
          </div>

          <div className="card-price-section">
            <div className="price-container">
              <span className="current-price">${card.price}</span>
            </div>
          </div>

          <div className="stock-info">
            <span className={`stock-status ${card.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {card.stock > 0 ? `En stock (${card.stock} disponibles)` : 'Agotado'}
            </span>
          </div>

          <div className="rating" style={{ display: 'none' }}></div>

          <div className="card-actions">
            <div className="quantity-selector">
              <label htmlFor="quantity">Cantidad:</label>
              <div className="quantity-controls">
                <button
                  type="button"
                  className="quantity-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  -
                </button>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max={card.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.min(card.stock, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="quantity-input"
                />
                <button
                  type="button"
                  className="quantity-btn"
                  onClick={() => setQuantity(Math.min(card.stock, quantity + 1))}
                  disabled={quantity >= card.stock}
                >
                  +
                </button>
              </div>
            </div>
            <button
              className={`add-to-cart-btn ${isInCart ? 'in-cart' : ''}`}
              onClick={handleAddToCart}
              disabled={isInCart || card.stock === 0}
            >
              {isInCart ? 'En Carrito' : card.stock === 0 ? 'Agotado' : <><AddToCartIcon /> Agregar al Carrito</>}
            </button>
          </div>

          {/* Show delete button only to the uploader vendedor */}
          {user && card?.uploader && user.id === card.uploader.id && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => navigate('/editar-carta', { state: { carta: card } })} className="save-btn">
                  Editar carta
                </button>
                <button onClick={handleDelete} className="delete-btn" style={{ background: '#e53e3e', color: '#fff' }}>
                  Eliminar carta
                </button>
              </div>
            </div>
          )}

          <div className="card-details">
            <h3>Detalles del Producto</h3>
            <div className="details-grid">
              <div className="detail-item">
                <span className="detail-label">Marca:</span>
                <span className="detail-value">{card.brand}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Categoría:</span>
                <span className="detail-value">{card.category}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Set:</span>
                <span className="detail-value">{card.set}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Año de Lanzamiento:</span>
                <span className="detail-value">{card.releaseYear}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Rareza:</span>
                <span className="detail-value">{card.rarity}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Stock:</span>
                <span className="detail-value">{card.stock}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}