import './Products.css'
import { AddToCartIcon, RemoveFromCartIcon } from './Icons'
import { useContext } from 'react'
import { CartContext } from '../context/cart'
import { useNavigate } from 'react-router-dom'

export function Products({ products }: { products: any[] }) {
  const { addToCart, removeFromCart, cart } = useContext(CartContext)
  const navigate = useNavigate()

  const checkProductInCart = (product: any) => {
    return cart.some((item: any) => item.id === product.id)
  }

  return (
    <main className='products'>
      <ul>
        {products.map(product => {
          const isProductInCart = checkProductInCart(product)
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
              </div>
            </li>
          )
        })}
      </ul>
    </main>
  )
}
