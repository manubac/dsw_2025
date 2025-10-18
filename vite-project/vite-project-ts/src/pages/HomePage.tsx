import { useState } from 'react'
import { products as initialProducts } from '../mocks/cartas.json'
import { useFilters } from '../hooks/useFilters'
import { Products } from '../components/Products'
import { ProductFilters } from '../components/ProductFilters'
import { Hero } from '../components/Hero'
import { FeaturedCards } from '../components/FeaturedCards'

export function HomePage () {
  const [products] = useState(initialProducts)
  const { filterProducts } = useFilters()
  const filteredProducts = filterProducts(products)

  // Select featured cards (most expensive/rare ones)
  const featuredCards = products
    .filter(card => card.price > 100) // Only high-value cards
    .sort((a, b) => b.price - a.price) // Sort by price descending
    .slice(0, 6) // Take top 6

  return (
    <>
      <Hero />
      <FeaturedCards cards={featuredCards} />
    </>
  )
} 