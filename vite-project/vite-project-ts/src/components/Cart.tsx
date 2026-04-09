import { useContext } from 'react'
import { CartIcon, ClearCartIcon, RemoveFromCartIcon } from './Icons'
import { CartContext } from '../context/cart'
import { useNavigate } from 'react-router-dom'
import { FiX } from "react-icons/fi";

function CartItem ({
  thumbnail,
  price,
  title,
  quantity,
  stock,
  addToCart,
  decreaseFromCart,
  removeFromCart
}: any) {
  return (
    <li className="flex gap-3 border-b pb-3">

      <img
        src={thumbnail}
        alt={title}
        className="w-14 h-14 object-cover rounded-md"
      />

      <div className="flex-1">
        <strong className="block text-sm">{title}</strong>
        <span className="text-sm text-gray-500">${price}</span>

        <footer className="flex items-center gap-2 mt-2">

          <small className="text-xs text-gray-500">
            Qty: {quantity}
          </small>

          <button
            onClick={addToCart}
            disabled={stock !== undefined && quantity >= stock}
            className="px-2 py-1 bg-primary text-white rounded disabled:opacity-40"
          >
            +
          </button>

          <button
            onClick={decreaseFromCart}
            className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            -
          </button>

          <button
            onClick={removeFromCart}
            className="p-1 text-red-500 hover:scale-110 transition"
          >
            <RemoveFromCartIcon />
          </button>

        </footer>
      </div>
    </li>
  )
}

export function Cart () {
  const cartCheckboxId = 'global-cart-checkbox'
  const { cart, clearCart, addToCart, decreaseFromCart, removeFromCart } =
    useContext(CartContext)

  const navigate = useNavigate()

 return (
  <>
    {/* CONTROL */}
    <input
      id={cartCheckboxId}
      type="checkbox"
      className="peer hidden"
    />

    {/* BOTON FLOTANTE */}
    <label
      htmlFor={cartCheckboxId}
      className="
        fixed bottom-6 right-6 z-[70]
        w-16 h-16
        flex items-center justify-center
        rounded-full
        bg-gradient-to-r from-primary to-secondary
        text-white
        shadow-xl
        cursor-pointer
        hover:scale-110 active:scale-95
        transition-all duration-200
        peer-checked:opacity-0
        peer-checked:scale-75
        peer-checked:pointer-events-none
      "
    >
      <CartIcon />

      {cart.length > 0 && (
        <span
          className="
            absolute -top-1 -right-1
            bg-red-500 text-white text-xs font-bold
            w-5 h-5 flex items-center justify-center
            rounded-full
          "
        >
          {cart.reduce((acc: number, p: any) => acc + p.quantity, 0)}
        </span>
      )}
    </label>

    {/* DRAWER */}
    <aside
      className="
        fixed top-0 right-0 h-full w-80
        bg-white shadow-2xl z-[60]
        translate-x-full
        peer-checked:translate-x-0
        transition-transform duration-300
        flex flex-col
      "
    >
      {/* HEADER DEL DRAWER */}
      <div className="relative border-b p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Carrito</h2>

        {/* CRUZ CERRAR */}
        <label
          htmlFor={cartCheckboxId}
          className="
            cursor-pointer
            p-2 rounded-full
            hover:bg-gray-100
            transition
          "
        >
          <FiX size={22} />
        </label>
      </div>

      {/* CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-4">
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

      {/* FOOTER */}
      <div className="border-t p-4 flex flex-col gap-3">
        <button
          onClick={() => navigate("/checkout")}
          className="
            w-full bg-gradient-to-r from-primary to-secondary
            text-white py-2 rounded-full
            hover:scale-105 transition
          "
        >
          Ir al Checkout
        </button>

        {cart.length > 0 && (
          <button
            onClick={clearCart}
            className="
              flex items-center justify-center gap-2
              w-full py-2 rounded-full
              bg-gray-200 hover:bg-gray-300
              transition
            "
          >
            <ClearCartIcon />
            Vaciar carrito
          </button>
        )}
      </div>
    </aside>
  </>
);
}