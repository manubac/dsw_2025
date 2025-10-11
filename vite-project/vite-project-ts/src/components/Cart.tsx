import './Cart.css'
import { useId, useContext } from 'react'
import { CartIcon, ClearCartIcon, RemoveFromCartIcon } from './Icons'
import { CartContext } from '../context/cart'

function CartItem ({ thumbnail, price, title, quantity, addToCart, decreaseFromCart, removeFromCart }: any) {
  return (
    <li>
      <img
        src={thumbnail}
        alt={title}
      />
      <div>
        <strong>{title}</strong> - ${price}
      </div>

      <footer>
        <small>
          Qty: {quantity}
        </small>
        <button onClick={addToCart}>+</button>
        <button onClick={decreaseFromCart}>-</button>
        <button onClick={removeFromCart}><RemoveFromCartIcon /></button>
      </footer>
    </li>
  )
}

export function Cart () {
  const cartCheckboxId = 'global-cart-checkbox'
  const { cart, clearCart, addToCart, decreaseFromCart, removeFromCart } = useContext(CartContext)

  return (
    <>
      <label className='cart-button' htmlFor={cartCheckboxId}>
        <CartIcon />
      </label>
      <input id={cartCheckboxId} type='checkbox' hidden />

      <aside className='cart'>
        <ul>
          {cart.map((product: any) => (
            <CartItem
              key={product.id}
              addToCart={() => addToCart(product)}
              decreaseFromCart={() => decreaseFromCart(product)}
              removeFromCart={() => removeFromCart(product)}
              {...product}
            />
          ))}
        </ul>

        <button onClick={clearCart}>
          <ClearCartIcon />
        </button>
      </aside>
    </>
  )
}
