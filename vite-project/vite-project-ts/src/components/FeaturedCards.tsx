import './FeaturedCards.css'
import { AddToCartIcon } from './Icons'
import { useContext } from 'react'
import { CartContext } from '../context/cart'
import { useNavigate } from 'react-router-dom'

interface Card {
  id: number
  title: string
  description: string
  price: number
  thumbnail: string
  rarity: string
  set: string
}

interface FeaturedCardsProps {
  cards: Card[]
}

export function FeaturedCards({ cards }: FeaturedCardsProps) {
  const { addToCart, cart } = useContext(CartContext)
  const navigate = useNavigate()

  const checkProductInCart = (card: Card) => {
    return cart.some((item: any) => item.id === card.id)
  }

  return (
    <section className='featured-cards'>
      <div className='featured-container'>
        <h2>Cartas Destacadas</h2>
        <p className='featured-subtitle'>Descubre las cartas más codiciadas y populares de nuestra colección</p>

        <div className='featured-grid'>
          {cards.map(card => {
            const isProductInCart = checkProductInCart(card)
            return (
              <div key={card.id} className='featured-card'>
                <div className='card-image-container'>
                  <img
                    src={card.thumbnail}
                    alt={card.title}
                    className='card-image'
                    onClick={() => navigate(`/card/${card.id}`)}
                    style={{ cursor: 'pointer' }}
                  />
                  <div className='card-badge'>{card.rarity}</div>
                </div>

                <div className='card-content'>
                  <h3
                    className='card-title'
                    onClick={() => navigate(`/card/${card.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {card.title}
                  </h3>
                  <p className='card-set'>{card.set}</p>
                  <p className='card-description'>{card.description}</p>

                  <div className='card-footer'>
                    <span className='card-price'>${card.price}</span>
                    <button
                      className={`add-to-cart-btn ${isProductInCart ? 'in-cart' : ''}`}
                      onClick={() => addToCart(card)}
                      disabled={isProductInCart}
                    >
                      {isProductInCart ? 'En Carrito' : <AddToCartIcon />}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}