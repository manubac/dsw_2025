
import { AddToCartIcon, RemoveFromCartIcon } from './Icons'
import { useContext } from 'react'
import { CartContext } from '../context/cart'
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/user'

export function Products({ products }: { products: any[] }) {
  const { addToCart, removeFromCart, cart } = useContext(CartContext)
  const navigate = useNavigate()
  const { user } = useUser()

  const checkProductInCart = (product: any) => {
    return cart.some((item: any) => item.id === product.id)
  }

  const canEdit = (product: any) => {
    return user && user.role === 'vendedor' && product.uploader?.id === user.id
  }

 return (
  <main className="w-full max-w-7xl mx-auto px-4 py-10">
    <ul
      className="
        grid
        grid-cols-1
        sm:grid-cols-2
        md:grid-cols-3
        lg:grid-cols-4
        gap-8
      "
    >
      {products.map(product => {
        const isProductInCart = checkProductInCart(product)
        const isEditable = canEdit(product)

        return (
          <li
            key={product.id}
            className="
              group
              bg-white dark:bg-gray-900
              rounded-2xl
              shadow-lg
              hover:shadow-2xl
              transition-all duration-300
              overflow-hidden
              border border-gray-100 dark:border-gray-800
              hover:-translate-y-1
            "
          >
            {/* Imagen */}
            <div
              className="
                relative
                overflow-hidden
                cursor-pointer
                bg-gradient-to-b from-gray-50 to-gray-100
              "
              onClick={() => navigate(product.type === 'bundle' ? `/bundle/${product.id}` : `/card/${product.id}`)}
            >
              <img
                src={product.thumbnail}
                alt={product.title}
                className="
                  w-full h-64 object-contain
                  p-4
                  transition-transform duration-300
                  group-hover:scale-105
                "
              />

              {product.type === 'bundle' && (
                <div className="absolute top-2 left-2 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                  Paquete · {product.cartas?.length ?? 0} cartas
                </div>
              )}

              {/* brillo tipo carta pokemon */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/10 to-transparent"></div>
            </div>

            {/* Info */}
            <div className="p-4 space-y-3">
              <h3
                onClick={() => navigate(product.type === 'bundle' ? `/bundle/${product.id}` : `/card/${product.id}`)}
                className="
                  font-semibold text-lg
                  cursor-pointer
                  line-clamp-2
                  hover:text-primary
                  transition
                "
              >
                {product.title}
              </h3>

              {/* Precio */}
              <span
                className="
                  text-xl font-bold
                  bg-gradient-to-r from-primary to-secondary
                  bg-clip-text text-transparent
                "
              >
                ${product.price}
              </span>

              {/* Acciones */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    isProductInCart
                      ? removeFromCart(product)
                      : addToCart(product)
                  }}
                  className={`
                    flex-[2]
                    flex items-center justify-center
                    gap-2
                    py-2 px-4
                    rounded-full
                    text-white
                    transition-all duration-200
                    shadow-md
                    hover:scale-105 active:scale-95
                    ${
                      isProductInCart
                        ? "bg-gradient-to-r from-secondary to-primary"
                        : "bg-gradient-to-r from-primary to-secondary"
                    }
                  `}
                >
                  {isProductInCart
                    ? <RemoveFromCartIcon />
                    : <AddToCartIcon />}
                </button>

                {isEditable && (
                  <button
                    onClick={() =>
                      navigate('/editar-item', { state: { item: product } })
                    }
                    className="
                      px-3 py-2
                      rounded-full
                      bg-gray-200 dark:bg-gray-700
                      hover:bg-gray-300 dark:hover:bg-gray-600
                      transition
                    "
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  </main>
)
}
