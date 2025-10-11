import { Link } from 'react-router-dom'
import { useContext, useState } from 'react'
import { CartContext } from '../context/cart'
import { useContext as useReactContext } from 'react'
import { FiltersContext } from '../context/filters'
import './Header.css'

export function Header() {
  const { cart } = useContext(CartContext)
  const [query, setQuery] = useState('')
  const { setFilters } = useReactContext(FiltersContext)

  const cartCount = cart.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)

  return (
    <header className="site-header">
      <div className="brand">
        <Link to="/" className="brand-link">Pokémon TCG</Link>
        <small className="tagline">Cards & Collectibles</small>
      </div>

      <div className="search-wrap">
        <input
          className="search-input"
          placeholder="Search cards, sets, artists..."
          value={query}
          onChange={(e) => {
            const v = e.target.value
            setQuery(v)
            setFilters((prev: any) => ({ ...prev, query: v }))
          }}
        />
      </div>

      <nav className="site-nav">
        <Link to="/register" className="nav-link">Register</Link>
        <label className="cart-button" htmlFor="global-cart-checkbox" aria-label="Open cart">
          <span className="cart-icon">🛒</span>
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </label>
      </nav>
    </header>
  )
}
