import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { useUser } from '../context/user'
import { useFilters } from '../hooks/useFilters'
import { fetchApi } from '../services/api'
import { NovedadesCarousel } from '../components/NovedadesCarousel'
import { MejoresVendedoresSection } from '../components/MejoresVendedoresSection'
import { CardScanner, type ScannedCard } from '../components/CardScanner/CardScanner'
import ScrollBackground from '../components/ScrollBackground'
import './MainPage.css'

interface TopCard {
  id: number
  title: string
  thumbnail: string | null
  price: number
  rarity: string | null
}

interface VendedorItem {
  id: number
  nombre: string
  rating?: number
  reviewsCount?: number
  ciudad?: string
}

interface TiendaItem {
  id: number
  nombre: string
  ciudad?: string
  activo?: boolean
}

const GC_ANIMS = ['gc-d1', 'gc-d2', 'gc-d3', 'gc-d4', 'gc-d5', 'gc-d6'] as const

const FEATURES = [
  { icon: '🃏', title: 'Publicá en minutos',   desc: 'Subí tus cartas y cobrá con MercadoPago' },
  { icon: '🔒', title: 'Comprá con confianza', desc: 'Vendedores verificados y reseñas reales' },
  { icon: '🎮', title: '5 juegos soportados',  desc: 'Pokémon · Magic · Yu-Gi-Oh! · Digimon · Riftbound' },
  { icon: '📷', title: 'Escaneá tu carta',     desc: 'Identificación automática por foto con IA' },
] as const

export function MainPage() {
  const { user } = useUser()
  const { filters } = useFilters()
  const navigate = useNavigate()

  const [scannerOpen, setScannerOpen]   = useState(false)
  const [scrollPct, setScrollPct]       = useState(0)
  const [topCards, setTopCards]         = useState<TopCard[]>([])
  const [vendedores, setVendedores]     = useState<VendedorItem[]>([])
  const [tiendas, setTiendas]           = useState<TiendaItem[]>([])
  const [selectedCity, setSelectedCity] = useState('all')
  const ghostRef = useRef<HTMLDivElement>(null)

  /* scroll progress */
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setScrollPct(max > 0 ? (window.scrollY / max) * 100 : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ghost cards */
  useEffect(() => {
    const container = ghostRef.current
    if (!container || container.children.length > 0) return
    for (let i = 0; i < 14; i++) {
      const el = document.createElement('div')
      el.className = 'mp-gc'
      const anim = GC_ANIMS[i % 6]
      const dur   = (18 + Math.random() * 14).toFixed(1)
      const delay = (-(Math.random() * 20)).toFixed(1)
      el.style.cssText = `left:${(Math.random()*94).toFixed(1)}%;top:${(Math.random()*200).toFixed(1)}vh;animation:${anim} ${dur}s ${delay}s ease-in-out infinite alternate;`
      container.appendChild(el)
    }
  }, [])

  /* top 3 cards para el hero (cambia con el juego seleccionado) */
  useEffect(() => {
    fetchApi(`/api/cartas/populares?game=${filters.game}&limit=3`)
      .then(r => r.json())
      .then(d => setTopCards(d.data ?? []))
      .catch(() => {})
  }, [filters.game])

  /* vendedores */
  useEffect(() => {
    fetchApi('/api/vendedores')
      .then(r => r.json())
      .then(d => setVendedores(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {})
  }, [])

  /* tiendas */
  useEffect(() => {
    fetchApi('/api/tiendas')
      .then(r => r.json())
      .then(d => setTiendas(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => {})
  }, [])

  const cities = useMemo(() => {
    const s = new Set(vendedores.map(v => v.ciudad).filter(Boolean) as string[])
    return Array.from(s).sort()
  }, [vendedores])

  const filteredVendedores = useMemo(() =>
    selectedCity === 'all' ? vendedores : vendedores.filter(v => v.ciudad === selectedCity),
    [vendedores, selectedCity]
  )

  const activeTiendas = useMemo(() => tiendas.filter(t => t.activo !== false), [tiendas])

  const [c1, c2, c3] = topCards

  return (
    <>
      <ScrollBackground />

      {/* barra de progreso */}
      <div className="mp-spbar" style={{ width: `${scrollPct}%` }} />

      {/* ghost cards */}
      <div ref={ghostRef} className="mp-ghost-layer" />

      {/* ruido */}
      <div className="mp-noise" />

      {/* ═══════════════════════ HERO ═══════════════════════ */}
      <section className="mp-hero">
        <div className="mp-corner">
          <div className="mp-cc" style={{ width:40,height:56,top:0,left:0,transform:'rotate(-16deg)' }} />
          <div className="mp-cc" style={{ width:55,height:77,top:6,left:12,transform:'rotate(-5deg)' }} />
          <div className="mp-cc" style={{ width:48,height:67,top:10,left:20,transform:'rotate(9deg)' }} />
          <div className="mp-cc" style={{ width:36,height:50,top:14,left:4,transform:'rotate(22deg)' }} />
          <div className="mp-cc" style={{ width:62,height:87,top:2,left:24,transform:'rotate(-30deg)' }} />
        </div>

        <div className="mp-hero-left">
          <div className="mp-h-badge">✦ TCG Market Argentina</div>
          <h1 className="mp-h1">El mercado de cartas de tu comunidad</h1>
          <p className="mp-hero-sub">
            Comprá y vendé cartas con vendedores verificados de tu ciudad.
          </p>
          <div className="mp-hero-cta">
            <button className="mp-btn-h1" onClick={() => navigate('/cards')}>
              Explorar cartas
            </button>
            {(user?.role === 'vendedor' || user?.role === 'tiendaRetiro') && (
              <button className="mp-btn-h2" onClick={() => navigate('/publicar')}>
                Publicar carta
              </button>
            )}
            {!user && (
              <button className="mp-btn-h2" onClick={() => navigate('/register')}>
                Registrate gratis
              </button>
            )}
          </div>
          <div className="mp-hero-loc">
            📍 Argentina · Pokémon · Magic · Yu-Gi-Oh! · Digimon · Riftbound
          </div>
        </div>

        {/* FAN DE CARTAS — top 3 del juego seleccionado */}
        <div className="mp-hero-right">
          <div className="mp-card-fan">
            <div className="mp-fan-glow" />

            {/* Carta izquierda */}
            <div
              className="mp-fan-card mp-fc1"
              onClick={() => c1 && navigate(`/card/${c1.id}`)}
              title={c1?.title}
            >
              {c1?.thumbnail
                ? <img src={c1.thumbnail} alt={c1.title} className="mp-fc-img" />
                : <span className="mp-fc-sym">◆</span>
              }
              {c1 && (
                <div className="mp-fc-overlay">
                  <span className="mp-fc-name">{c1.title}</span>
                  <span className="mp-fc-price">${c1.price.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Carta central */}
            <div
              className="mp-fan-card mp-fc2 mp-hero-card-main"
              onClick={() => c2 && navigate(`/card/${c2.id}`)}
              title={c2?.title}
            >
              {c2?.thumbnail
                ? <img src={c2.thumbnail} alt={c2.title} className="mp-fc-img" />
                : (
                  <>
                    <div className="mp-pokeball">
                      <div className="mp-pb-top" />
                      <div className="mp-pb-bot" />
                      <div className="mp-pb-line" />
                      <div className="mp-pb-dot" />
                    </div>
                    <div className="mp-fc2-txt">TCG</div>
                  </>
                )
              }
              {c2 && (
                <div className="mp-fc-overlay">
                  <span className="mp-fc-name">{c2.title}</span>
                  <span className="mp-fc-price">${c2.price.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Carta derecha */}
            <div
              className="mp-fan-card mp-fc3"
              onClick={() => c3 && navigate(`/card/${c3.id}`)}
              title={c3?.title}
            >
              {c3?.thumbnail
                ? <img src={c3.thumbnail} alt={c3.title} className="mp-fc-img" />
                : <span className="mp-fc-sym">♠</span>
              }
              {c3 && (
                <div className="mp-fc-overlay">
                  <span className="mp-fc-name">{c3.title}</span>
                  <span className="mp-fc-price">${c3.price.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
          {topCards.length > 0 && (
            <p className="mp-fan-label">🔥 Top cartas de la semana</p>
          )}
        </div>
      </section>

      {/* ═══════════════════════ NOVEDADES ═══════════════════════ */}
      <div className="mp-novedades-wrap" style={{ position: 'relative', zIndex: 2 }}>
        <NovedadesCarousel />
      </div>

      {/* ═══════════════════════ CARDS DE MEJORES VENDEDORES ═══════════════════════ */}
      <div className="mp-vendedores-cards-wrap" style={{ position: 'relative', zIndex: 2 }}>
        <MejoresVendedoresSection />
      </div>

      {/* ═══════════════════════ VENDEDORES MÁS CONFIABLES ═══════════════════════ */}
      {vendedores.length > 0 && (
        <section className="mp-sellers" style={{ position: 'relative', zIndex: 2 }}>
          <div className="mp-sec-header">
            <div>
              <h2 className="mp-sec-h2">Vendedores Confiables ⭐</h2>
              <div className="mp-title-bar" />
            </div>
            {cities.length > 0 && (
              <div className="mp-city-filter">
                <button
                  className={`mp-city-pill${selectedCity === 'all' ? ' mp-city-pill--active' : ''}`}
                  onClick={() => setSelectedCity('all')}
                >
                  Todas las ciudades
                </button>
                {cities.map(city => (
                  <button
                    key={city}
                    className={`mp-city-pill${selectedCity === city ? ' mp-city-pill--active' : ''}`}
                    onClick={() => setSelectedCity(city)}
                  >
                    📍 {city}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mp-sellers-carousel">
            {filteredVendedores.slice(0, 10).map(v => (
              <div
                key={v.id}
                className="mp-scard"
                onClick={() => navigate(`/vendedor/${v.id}`)}
              >
                <div className="mp-savatar">
                  {v.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="mp-sinfo">
                  <div className="mp-sname">{v.nombre}</div>
                  {typeof v.rating === 'number' && (
                    <div className="mp-sstars">
                      {[1,2,3,4,5].map(n => (
                        <Star
                          key={n}
                          size={11}
                          className={n <= Math.round(v.rating!) ? 'mp-star-filled' : 'mp-star-empty'}
                        />
                      ))}
                      {v.reviewsCount != null && (
                        <span className="mp-sreviewcount">({v.reviewsCount})</span>
                      )}
                    </div>
                  )}
                  {v.ciudad && <div className="mp-smeta">📍 {v.ciudad}</div>}
                  <button
                    className="mp-slink"
                    onClick={e => { e.stopPropagation(); navigate(`/vendedor/${v.id}`) }}
                  >
                    Ver perfil →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════ TIENDAS AFILIADAS ═══════════════════════ */}
      {activeTiendas.length > 0 && (
        <section className="mp-tiendas" style={{ position: 'relative', zIndex: 2 }}>
          <div className="mp-tiendas-hdr">
            <h2 className="mp-sec-h2">Nuestras Tiendas Afiliadas</h2>
            <p className="mp-tiendas-sub">
              Tiendas verificadas que actúan como intermediarios de confianza
            </p>
            <div className="mp-title-bar" />
          </div>
          <div className="mp-tiendas-grid">
            {activeTiendas.map(t => (
              <div
                key={t.id}
                className="mp-tcard"
                onClick={() => navigate(`/tienda/${t.id}`)}
              >
                <div className="mp-tcard-banner" />
                <div className="mp-tcard-body">
                  <div className="mp-tcard-av-wrap">
                    <div className="mp-tcard-av">🃏</div>
                  </div>
                  <div className="mp-tcard-name">{t.nombre}</div>
                  {t.ciudad && (
                    <div className="mp-tcard-city">📍 {t.ciudad}</div>
                  )}
                  <button className="mp-tcard-btn">Ver tienda →</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════════ FEATURES ═══════════════════════ */}
      <section className="mp-features">
        <h2 className="mp-feat-h2">Una plataforma hecha por y para la comunidad TCG</h2>
        <div className="mp-feat-grid">
          {FEATURES.map(f => (
            <div key={f.title} className="mp-feat">
              <div className="mp-feat-ico">{f.icon}</div>
              <div className="mp-feat-title">{f.title}</div>
              <div className="mp-feat-desc">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════ CAFECITO ═══════════════════════ */}
      <section className="mp-cafecito">
        <div className="mp-coffee-wrap">
          <div className="mp-st" /><div className="mp-st2" /><div className="mp-st3" />
          <div className="mp-cup-rim" /><div className="mp-cup-body" />
          <div className="mp-cup-handle" /><div className="mp-saucer" />
          <span className="mp-suit mp-s1">♦</span>
          <span className="mp-suit mp-s2">♥</span>
          <span className="mp-suit mp-s3">♠</span>
          <span className="mp-suit mp-s4">♣</span>
        </div>
        <div className="mp-cafe-txt">
          <h2>¿Te gusta la plataforma?</h2>
          <p>
            Somos estudiantes que amamos los TCGs. Si la plataforma te sirve,
            un cafecito nos ayuda a seguir desarrollándola.
          </p>
          <button className="mp-btn-cafe">Invitanos un cafecito ☕</button>
        </div>
      </section>

      {/* FAB */}
      <div className="mp-fab">
        <button className="mp-fab-btn" onClick={() => setScannerOpen(true)}>
          📷 Escanear carta
        </button>
      </div>

      {scannerOpen && (
        <CardScanner
          onCardsScanned={(_: ScannedCard[]) => {}}
          onClose={() => setScannerOpen(false)}
        />
      )}
    </>
  )
}
