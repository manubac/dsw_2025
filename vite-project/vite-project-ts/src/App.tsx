import { useState } from 'react'
import { Products } from './components/Products'
import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { FiltersProvider } from './context/filters'
import { CartProvider } from './context/cart'

import { products as initialProducts } from './mocks/cartas.json'

import { useFilters } from './hooks/useFilters'
import { Cart } from './components/Cart'

function App() {
  const [products] = useState(initialProducts)
  const { filterProducts, setFilters } = useFilters()

  const filteredProducts = filterProducts(products)

  return (
    <CartProvider>
      <Cart />
      <Header changeFilters={setFilters} />
      <Products products={filteredProducts} />
      <Footer />
    </CartProvider>
  )
}

export default App
