import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilters } from '../hooks/useFilters'
import { fetchApi } from '../services/api'
import { Star, ShieldCheck } from 'lucide-react'

interface VendedorCard {
  id: number
  title: string
  thumbnail: string | null
  price: number
  rarity: string | null
  set: string | null
  cartaClass: { name: string } | null
  uploader: {
    id: number
    nombre: string
    rating: number
    reviewsCount: number
  } | null
}

const GAME_LABELS: Record<string, string> = {
  pokemon: 'Pokémon',
  magic: 'Magic',
  yugioh: 'Yu-Gi-Oh!',
  digimon: 'Digimon',
  riftbound: 'Riftbound',
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={11}
          className={
            n <= Math.round(rating)
              ? 'text-primary fill-primary'
              : 'text-gray-300 fill-gray-300'
          }
        />
      ))}
    </span>
  )
}

export function MejoresVendedoresSection() {
  const [cards, setCards] = useState<VendedorCard[]>([])
  const [loading, setLoading] = useState(true)
  const { filters } = useFilters()
  const navigate = useNavigate()

  useEffect(() => {
    setLoading(true)
    fetchApi(`/api/cartas/mejores-vendedores?game=${filters.game}&limit=8`)
      .then(r => r.json())
      .then(data => {
        setCards(data.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filters.game])

  const gameLabel = GAME_LABELS[filters.game] ?? filters.game

  if (!loading && cards.length === 0) return null

  return (
    <section className="py-14 bg-green-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 ring-1 ring-primary/30">
            <ShieldCheck size={18} className="text-primary" />
          </span>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight leading-none">
              Vendedores mejor reseñados
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Publicaciones de {gameLabel} de los vendedores con mejor calificación
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl bg-gray-200 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {cards.map(card => (
              <button
                key={card.id}
                onClick={() => navigate(`/card/${card.id}`)}
                className="
                  group bg-white rounded-2xl shadow-sm
                  hover:shadow-md border border-transparent
                  hover:border-primary/20
                  transition-all duration-200 overflow-hidden text-left
                  hover:-translate-y-1
                "
              >
                {/* Imagen */}
                <div className="aspect-[3/4] bg-gray-50 overflow-hidden relative">
                  {card.thumbnail ? (
                    <img
                      src={card.thumbnail}
                      alt={card.title}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">
                      🃏
                    </div>
                  )}
                  {card.rarity && (
                    <span className="absolute top-2 right-2 text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {card.rarity}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">
                    {card.title}
                  </p>
                  {card.set && (
                    <p className="text-[10px] text-gray-400 truncate">{card.set}</p>
                  )}

                  <p className="text-sm font-bold text-primary">
                    {card.price > 0 ? `$${card.price.toFixed(2)}` : '—'}
                  </p>

                  {card.uploader && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 mt-0.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                        {card.uploader.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-gray-600 font-medium truncate leading-tight">
                          {card.uploader.nombre}
                        </p>
                        <div className="flex items-center gap-1">
                          <StarRating rating={card.uploader.rating} />
                          <span className="text-[9px] text-gray-400">
                            ({card.uploader.reviewsCount})
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
