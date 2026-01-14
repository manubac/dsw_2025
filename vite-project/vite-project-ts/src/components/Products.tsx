import './Products.css'
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
    <main className='products'>
      <ul>
        {products.map(product => {
          const isProductInCart = checkProductInCart(product)
          const isEditable = canEdit(product)
          return (
            <li key={product.id}>
              <img
                src={product.thumbnail}
                alt={product.title}
                onClick={() => navigate(`/card/${product.id}`)}
                style={{ cursor: 'pointer' }}
              />
              <div>
                <strong
                  onClick={() => navigate(`/card/${product.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {product.title}
                </strong> - ${product.price}
              </div>
              <div>
                <button
                  style={{ backgroundColor: isProductInCart ? 'red' : '#09f' }}
                  onClick={() => {
                    isProductInCart
                      ? removeFromCart(product)
                      : addToCart(product)
                  }}
                >
                  {
                    isProductInCart
                      ? <RemoveFromCartIcon />
                      : <AddToCartIcon />
                  }
                </button>
                {isEditable && (
                  <button
                    style={{ backgroundColor: '#28a745', marginLeft: '5px' }}
                    onClick={() => navigate('/editar-item', { state: { item: product } })}
                  >
                    Editar
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
