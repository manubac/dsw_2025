import { useState, useEffect } from 'react'
import { useFilters } from '../hooks/useFilters'
import { Products } from '../components/Products'
import { ProductFilters } from '../components/ProductFilters'
import { Hero } from '../components/Hero'
import { fetchApi } from '../services/api'
import { FeaturedCards } from '../components/FeaturedCards'
import { CardScanner, type ScannedCard } from '../components/CardScanner/CardScanner'
import { ScanLine } from 'lucide-react'

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
  const [scannerOpen, setScannerOpen] = useState(false)
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

  const handleCardsScanned = (cards: ScannedCard[]) => {
    console.log('Cartas escaneadas:', cards)
  }

  return (
    <>
      <Hero />
      <FeaturedCards cards={featuredCards} />

      {/* Floating scanner button — bottom-right */}
      <button
        onClick={() => setScannerOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-pink-500 text-white font-semibold px-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        aria-label="Escanear cartas"
      >
        <ScanLine size={18} />
        Escanear cartas
      </button>

      {scannerOpen && (
        <CardScanner
          onCardsScanned={handleCardsScanned}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  )
} 