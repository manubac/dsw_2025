import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFilters } from '../hooks/useFilters'
import { fetchApi } from '../services/api'
import { Flame, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CardGroup } from '../utils/cardGroups'
import { navigateToGroup } from '../utils/cardGroups'

interface PopularCard {
  id: number
  title: string
  thumbnail: string | null
  price: number
  rarity: string | null
  set: string | null
  viewCount: number
  cartaClass: { name: string } | null
  uploader: { id: number; nombre: string } | null
}

const GAME_LABELS: Record<string, string> = {
  pokemon: 'Pokémon',
  magic: 'Magic',
  yugioh: 'Yu-Gi-Oh!',
  digimon: 'Digimon',
  riftbound: 'Riftbound',
}

interface NovedadesCarouselProps {
  cardIdToGroup?: Map<number, CardGroup>
}

export function NovedadesCarousel({ cardIdToGroup }: NovedadesCarouselProps = {}) {
  const [cards, setCards] = useState<PopularCard[]>([])
  const [loading, setLoading] = useState(true)
  const { filters } = useFilters()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchApi(`/api/cartas/populares?game=${filters.game}&limit=12`)
      .then(r => r.json())
      .then(data => {
        setCards(data.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [filters.game])

  useEffect(() => {
    checkScroll()
  }, [cards])

  const displayCards = useMemo(() => {
    if (!cardIdToGroup) return cards
    return cards.filter(c => cardIdToGroup.has(c.id))
  }, [cards, cardIdToGroup])

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 8)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
  }

  function scroll(dir: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
    setTimeout(checkScroll, 350)
  }

  function handleCardClick(card: PopularCard) {
    fetchApi(`/api/cartas/${card.id}/view`, { method: 'POST' }).catch(() => {})
    if (cardIdToGroup) {
      const group = cardIdToGroup.get(card.id)
      if (group) {
        navigateToGroup(navigate, group, 'all')
        return
      }
    }
    navigate(`/card/${card.id}`)
  }

  const gameLabel = GAME_LABELS[filters.game] ?? filters.game

  return (
    <section className="py-14 bg-gray-950 relative overflow-hidden">
      {/* Fondo con gradiente sutil */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, #fea928 0%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 ring-1 ring-primary/30">
              <Flame size={18} className="text-primary" />
            </span>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight leading-none">
                Novedades populares
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Las publicaciones más vistas de {gameLabel}
              </p>
            </div>
          </div>

          {/* Flechas */}
          <div className="flex gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-20 transition"
              aria-label="Anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-20 transition"
              aria-label="Siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Carrusel */}
        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="shrink-0 w-44 h-64 rounded-2xl bg-white/5 animate-pulse"
              />
            ))}
          </div>
        ) : displayCards.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            No hay publicaciones de {gameLabel} todavía.
          </p>
        ) : (
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {displayCards.map(card => (
              <button
                key={card.id}
                onClick={() => handleCardClick(card)}
                className="
                  group shrink-0 snap-start
                  w-44 bg-white/5 rounded-2xl overflow-hidden
                  border border-white/8
                  hover:border-primary/50 hover:bg-white/8
                  transition-all duration-200 text-left
                  hover:-translate-y-1
                "
              >
                {/* Imagen */}
                <div className="relative aspect-[3/4] bg-white/5 overflow-hidden">
                  {card.thumbnail ? (
                    <img
                      src={card.thumbnail}
                      alt={card.title}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-600">
                      🃏
                    </div>
                  )}
                  {card.rarity && (
                    <span className="absolute top-2 left-2 text-[10px] font-semibold bg-primary/90 text-gray-900 px-2 py-0.5 rounded-full">
                      {card.rarity}
                    </span>
                  )}
                  {card.viewCount > 0 && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-orange-200 bg-black/50 px-1.5 py-0.5 rounded-full">
                      <Flame size={9} />
                      {card.viewCount}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col gap-1">
                  <p className="text-xs font-semibold text-white line-clamp-2 leading-snug">
                    {card.title}
                  </p>
                  {card.set && (
                    <p className="text-[10px] text-gray-500 truncate">{card.set}</p>
                  )}
                  <p className="text-sm font-bold text-primary mt-1">
                    {card.price > 0 ? `$${card.price.toFixed(2)}` : '—'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
