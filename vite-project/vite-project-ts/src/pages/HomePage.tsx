import { useState } from 'react'
import { products as initialProducts } from '../mocks/cartas.json'
import { useFilters } from '../hooks/useFilters'
import { Products } from '../components/Products'
import { ProductFilters } from '../components/ProductFilters'
import { Hero } from '../components/Hero'

export function HomePage () {
  //const [products] = useState(initialProducts)
  //const { filterProducts } = useFilters()

  //const filteredProducts = filterProducts(products)

  return (
    <>
  <Hero />

    </>
  )
}
  //<ProductFilters />
  //<Products products={filteredProducts} /> 