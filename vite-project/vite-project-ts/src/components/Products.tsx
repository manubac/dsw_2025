import './Products.css'
import { AddToCartIcon, RemoveFromCartIcon } from './Icons'
import { useContext } from 'react'
import { CartContext } from '../context/cart'

export function Products({ products }: { products: any[] }) {
  const { addToCart, removeFromCart, cart } = useContext(CartContext)

  const checkProductInCart = (product: any) => {
    return cart.some((item: any) => item.id === product.id)
  }

  return (
    <main className='products'>
      <ul>
        {products.map(carta => {
          const isProductInCart = checkProductInCart(carta)
          return (
            <li key={carta.id}>
              {/* Si más adelante agregás imágenes, poné carta.image o similar */}
              <div>
                <strong>{carta.name}</strong>
                <p>Clase: {carta.cartaClass?.name}</p>
                <p>Nivel: {carta.level}</p>
                <p>HP: {carta.hp}</p>
                <p>Mana: {carta.mana}</p>
                <p>Ataque: {carta.attack}</p>
              </div>
              <div>
                <button
                  style={{ backgroundColor: isProductInCart ? 'red' : '#09f' }}
                  onClick={() => {
                    isProductInCart
                      ? removeFromCart(carta)
                      : addToCart(carta)
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
