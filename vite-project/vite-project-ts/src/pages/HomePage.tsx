import { useState, useEffect } from 'react'
import { useFilters } from '../hooks/useFilters'
import { Products } from '../components/Products'
import { ProductFilters } from '../components/ProductFilters'
import { Hero } from '../components/Hero'
import { fetchApi } from '../services/api'
import { FeaturedCards } from '../components/FeaturedCards'

interface Card {
  id: number
  title: string
  description: string
  price: number
  thumbnail: string
  rarity: string
  set: string
  // Add other properties as needed
}

export function HomePage () {
  const [products, setProducts] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { filterProducts } = useFilters()
  const filteredProducts = filterProducts(products)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetchApi('/api/cartas')
        if (!response.ok) {
          throw new Error('Failed to fetch cards')
        }
        const data = await response.json()
        setProducts(data.data || [])
      } catch (err) {
        console.error('Error fetching products:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [])

  // Select featured cards (random from oldest cards)
  const featuredCards = products
    .sort((a, b) => a.id - b.id) // Sort by ID ascending (oldest first)
    .slice(0, Math.min(products.length, 20)) // Take oldest 20 or all if less
    .sort(() => Math.random() - 0.5) // Shuffle randomly
    .slice(0, 6) // Take first 6 after shuffle

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <>
      <Hero />
      <FeaturedCards cards={featuredCards} />
    </>
  )
} 