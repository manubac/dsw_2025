import { useContext } from 'react'
import { FiltersContext } from '../context/filters'
import { CartContext } from '../context/cart'

export function Footer() {
  const { filters } = useContext(FiltersContext)
  const { cart } = useContext(CartContext)
  return (
  <footer className="bg-gray-900 text-gray-300 mt-20">
    <div className="container mx-auto px-4 py-12 grid md:grid-cols-3 gap-10">

      {/* BRAND */}
      <div>
        <h4 className="text-2xl font-bold text-white mb-3">
          PokemonCard Market
        </h4>

        <p className="text-gray-400">
          Encuentra las mejores cartas y completa tu colección.
        </p>

        <p className="mt-4 text-sm text-gray-500">
          Items en carrito: {cart.length}
        </p>
      </div>

      {/* LINKS */}
      <div>
        <h5 className="text-lg font-semibold text-white mb-4">
          Enlaces útiles
        </h5>

        <ul className="space-y-2">
          <li>
            <a href="/" className="hover:text-primary transition">
              Inicio
            </a>
          </li>
          <li>
            <a href="/cards" className="hover:text-primary transition">
              Cartas
            </a>
          </li>
          <li>
            <a href="/contact" className="hover:text-primary transition">
              Contacto
            </a>
          </li>
        </ul>
      </div>

      {/* CONTACT */}
      <div>
        <h5 className="text-lg font-semibold text-white mb-4">
          Contacto
        </h5>

        <p className="text-gray-400">
          Email: soporte@pokemoncard.com
        </p>
        <p className="text-gray-400">
          Teléfono: +54 11 1234-5678
        </p>
      </div>
    </div>

    {/* BOTTOM BAR */}
    <div className="border-t border-gray-800 text-center py-4 text-sm text-gray-500">
      © {new Date().getFullYear()} PokemonCard Market — Todos los derechos reservados
    </div>
  </footer>
)
}
