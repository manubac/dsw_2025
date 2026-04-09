
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
  <section className="py-20 bg-green-50 min-h-screen">
    {/* CONTENEDOR CENTRADO */}
    <div className="max-w-6xl mx-auto px-4">

      {/* HEADER */}
      <div className="text-center mb-14 max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold mb-3">
          Cartas Destacadas
        </h2>

        <p className="text-gray-600">
          Descubre las cartas más codiciadas y populares de nuestra colección
        </p>
      </div>

      {/* GRID CENTRADO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
        {cards.map(card => {
          const isProductInCart = checkProductInCart(card)

          return (
            <div
              key={card.id}
              className="
                group
                bg-white
                rounded-2xl
                shadow-md hover:shadow-xl
                transition-all duration-300
                overflow-hidden
                hover:-translate-y-2
                flex flex-col
                w-full max-w-sm
              "
            >
              {/* IMAGE */}
              <div className="relative p-4 flex justify-center bg-gradient-to-b from-green-100 to-transparent">
                <img
                  src={card.thumbnail}
                  alt={card.title}
                  onClick={() => navigate(`/card/${card.id}`)}
                  className="
                    h-[240px]
                    object-contain
                    cursor-pointer
                    transition-transform duration-300
                    group-hover:scale-105
                  "
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src =
                      `https://via.placeholder.com/300x250/667eea/ffffff?text=${encodeURIComponent(
                        card.title.substring(0, 20)
                      )}`
                    target.style.objectFit = 'contain'
                  }}
                  onLoad={(e) => {
                    const target = e.target as HTMLImageElement
                    target.style.background = 'transparent'
                  }}
                />

                {/* RARITY BADGE */}
                <span
                  className="
                    absolute top-3 right-3
                    bg-gradient-to-r from-primary to-secondary
                    text-white text-xs font-semibold
                    px-3 py-1 rounded-full shadow
                  "
                >
                  {card.rarity}
                </span>
              </div>

              {/* CONTENT */}
              <div className="p-5 flex flex-col flex-1">
                <h3
                  onClick={() => navigate(`/card/${card.id}`)}
                  className="
                    font-bold text-lg cursor-pointer
                    hover:text-primary transition
                  "
                >
                  {card.title}
                </h3>

                <p className="text-sm text-gray-500 mb-2">
                  {card.set}
                </p>

                <p className="text-sm text-gray-600 line-clamp-2 flex-1">
                  {card.description}
                </p>

                {/* FOOTER */}
                <div className="flex items-center justify-between mt-5">
                  <span className="text-xl font-bold text-primary">
                    ${card.price}
                  </span>

                  <button
                    onClick={() => addToCart(card)}
                    disabled={isProductInCart}
                    className={`
                      px-4 py-2 rounded-full
                      text-white font-semibold
                      flex items-center gap-2
                      transition-all duration-200
                      ${
                        isProductInCart
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-primary to-secondary hover:scale-105"
                      }
                    `}
                  >
                    {isProductInCart ? "En Carrito" : <AddToCartIcon />}
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