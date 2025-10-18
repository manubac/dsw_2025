import { useParams, useNavigate } from 'react-router-dom'
import { useState, useContext, useEffect } from 'react'
import { products } from '../mocks/cartas.json'
import { CartContext } from '../context/cart'
import { AddToCartIcon } from '../components/Icons'
import '../components/CardDetail.css'

export function CardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart, cart } = useContext(CartContext)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)

  const card = products.find(p => p.id === parseInt(id || '0'))

  useEffect(() => {
    if (!card) {
      navigate('/cards')
    }
  }, [card, navigate])

  if (!card) {
    return <div>Loading...</div>
  }

  const isInCart = cart.some((item: any) => item.id === card.id)
  const allImages = [card.thumbnail, ...card.images]

  const handleAddToCart = () => {
    addToCart(card, quantity)
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
              <span className="card-set">{card.set}</span>
              <span className="card-year">{card.releaseYear}</span>
            </div>
          </div>

          <div className="card-rarity">
            <span className={`rarity-badge ${card.rarity.toLowerCase().replace(' ', '-')}`}>
              {card.rarity}
            </span>
          </div>

          <div className="card-price-section">
            <div className="price-container">
              <span className="current-price">${card.price}</span>
              {card.discountPercentage > 0 && (
                <span className="original-price">
                  ${(card.price / (1 - card.discountPercentage / 100)).toFixed(0)}
                </span>
              )}
            </div>
            {card.discountPercentage > 0 && (
              <span className="discount">-{card.discountPercentage}% OFF</span>
            )}
          </div>

          <div className="stock-info">
            <span className={`stock-status ${card.stock > 0 ? 'in-stock' : 'out-of-stock'}`}>
              {card.stock > 0 ? `En stock (${card.stock} disponibles)` : 'Agotado'}
            </span>
          </div>

          <div className="rating">
            <div className="stars">
              {'★'.repeat(Math.floor(card.rating))}
              {'☆'.repeat(5 - Math.floor(card.rating))}
            </div>
            <span className="rating-score">{card.rating}/5</span>
          </div>

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

      <div className="card-description">
        <h3>Descripción</h3>
        <p>{card.description}</p>
      </div>

      <div className="related-cards">
        <h3>Cartas Relacionadas</h3>
        <div className="related-grid">
          {products
            .filter(p => p.set === card.set && p.id !== card.id)
            .slice(0, 4)
            .map(relatedCard => (
              <div
                key={relatedCard.id}
                className="related-card"
                onClick={() => navigate(`/card/${relatedCard.id}`)}
              >
                <img src={relatedCard.thumbnail} alt={relatedCard.title} />
                <div className="related-info">
                  <h4>{relatedCard.title}</h4>
                  <span className="related-price">${relatedCard.price}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}