import './Cart.css'
import { useId, useContext } from 'react'
import { CartIcon, ClearCartIcon, RemoveFromCartIcon } from './Icons'
import { CartContext } from '../context/cart'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()

  const handleCheckout = () => {
    navigate('/checkout')
  }

  return (
    <>
<label className='cart-button' htmlFor={cartCheckboxId}>
  <CartIcon />
  {cart.length > 0 && (
    <span className="cart-count">{cart.reduce((acc: number, p: any) => acc + p.quantity, 0)}</span>
  )}
</label>
<input id={cartCheckboxId} type='checkbox' hidden />

      <aside className='cart'>
        <div className='cart-content'>
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
        </div>

        {cart.length > 0 && (
          <div className="cart-footer">
            <button onClick={clearCart} className="clear-cart-btn">
              <ClearCartIcon />
            </button>
            <button onClick={handleCheckout} className="checkout-btn">
              Proceder al Checkout
            </button>
          </div>
        )}
      </aside>
    </>
  )
}
