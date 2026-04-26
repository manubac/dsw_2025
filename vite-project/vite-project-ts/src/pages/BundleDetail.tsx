import { useParams, useNavigate } from 'react-router-dom'
import { useState, useContext, useEffect } from 'react'
import { CartContext } from '../context/cart'
import { fetchApi } from '../services/api'
import { useUser } from '../context/user'
import { ChevronLeft, ChevronRight, Package } from 'lucide-react'

interface BundleCarta {
  id: number
  name: string
  image?: string
  price: number
  rarity?: string
  setName?: string
  cardNumber?: string
}

interface Bundle {
  id: number
  title: string
  thumbnail?: string
  price: number
  description?: string
  cartas: BundleCarta[]
  uploader?: { id: number; nombre: string }
  stock: number
}

export function BundleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart, cart } = useContext(CartContext)
  const { user } = useUser()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchApi(`/api/itemsCarta/${id}`)
      .then(r => r.json())
      .then(json => setBundle(json.data ?? null))
      .catch(() => navigate('/cards'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!bundle) return null

  const cartas = bundle.cartas ?? []
  const activeCarta = cartas[activeIdx]
  const isInCart = cart.some((item: any) => item.id === `bundle-${bundle.id}`)

  const prev = () => setActiveIdx(i => (i - 1 + cartas.length) % cartas.length)
  const next = () => setActiveIdx(i => (i + 1) % cartas.length)

  const handleAddToCart = () => {
    addToCart({
      id: `bundle-${bundle.id}`,
      title: bundle.title,
      thumbnail: bundle.thumbnail,
      price: bundle.price,
      stock: bundle.stock,
    })
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 bg-green-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="mb-6 text-sm text-gray-500 flex items-center gap-1">
        <span onClick={() => navigate('/')} className="cursor-pointer text-green-600 hover:underline">Inicio</span>
        <span>/</span>
        <span onClick={() => navigate('/cards')} className="cursor-pointer text-green-600 hover:underline">Cartas</span>
        <span>/</span>
        <span className="text-gray-800 font-medium truncate max-w-[200px]">{bundle.title}</span>
      </div>

      {/* Badge paquete */}
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
          <Package size={13} />
          Paquete de {cartas.length} cartas
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Carousel */}
        <div className="flex flex-col items-center gap-4">
          {/* Imagen principal */}
          <div className="relative w-full bg-white rounded-2xl shadow-md overflow-hidden flex items-center justify-center" style={{ minHeight: 360 }}>
            {activeCarta?.image ? (
              <img
                key={activeIdx}
                src={activeCarta.image}
                alt={activeCarta.name}
                className="max-h-80 object-contain p-6 transition-opacity duration-200"
              />
            ) : (
              <div className="w-48 h-64 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">
                Sin imagen
              </div>
            )}

            {cartas.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition"
                >
                  <ChevronRight size={20} className="text-gray-600" />
                </button>
              </>
            )}
          </div>

          {/* Miniaturas */}
          {cartas.length > 1 && (
            <div className="flex gap-2 flex-wrap justify-center">
              {cartas.map((c, i) => (
                <button
                  key={c.id}
                  onClick={() => setActiveIdx(i)}
                  className={`w-14 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                    i === activeIdx ? 'border-indigo-500 shadow-md scale-105' : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {c.image
                    ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400 text-center px-0.5">{c.name}</div>
                  }
                </button>
              ))}
            </div>
          )}

          {/* Indicador */}
          <p className="text-sm text-gray-400">{activeIdx + 1} / {cartas.length}</p>
        </div>

        {/* Info */}
        <div className="flex flex-col gap-5">
          <div className="border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">{bundle.title}</h1>
            {bundle.uploader && (
              <p className="text-sm text-gray-500">
                Vendido por{' '}
                <span
                  onClick={() => navigate(`/vendedor/${bundle.uploader!.id}`)}
                  className="text-green-600 font-semibold cursor-pointer hover:underline"
                >
                  {bundle.uploader.nombre}
                </span>
              </p>
            )}
          </div>

          {/* Precio total */}
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-0.5">Precio total del paquete</p>
            <span className="text-3xl font-bold text-gray-800">
              {bundle.price > 0 ? `$${bundle.price.toFixed(2)}` : 'Sin precio'}
            </span>
          </div>

          {/* Carta activa — detalles */}
          {activeCarta && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
              <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">Carta seleccionada</p>
              <p className="font-bold text-gray-800 text-lg leading-tight">{activeCarta.name}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {activeCarta.setName && (
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{activeCarta.setName}</span>
                )}
                {activeCarta.rarity && (
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{activeCarta.rarity}</span>
                )}
                {activeCarta.cardNumber && (
                  <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{activeCarta.cardNumber}</span>
                )}
              </div>
              {(activeCarta.price ?? 0) > 0 && (
                <p className="text-sm text-gray-600">
                  Precio individual: <span className="font-semibold text-green-600">${(activeCarta.price ?? 0).toFixed(2)}</span>
                </p>
              )}
            </div>
          )}

          {/* Lista de todas las cartas */}
          <div>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-2">Incluye</p>
            <ul className="space-y-1.5">
              {cartas.map((c, i) => (
                <li
                  key={c.id}
                  onClick={() => setActiveIdx(i)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition text-sm ${
                    i === activeIdx ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-11 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                    {c.image
                      ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-gray-200" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{c.name}</p>
                    {c.setName && <p className="text-xs text-gray-400 truncate">{c.setName}</p>}
                  </div>
                  {(c.price ?? 0) > 0 && (
                    <span className="text-xs font-semibold text-green-600 flex-shrink-0">${(c.price ?? 0).toFixed(2)}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Agregar al carrito */}
          <button
            onClick={handleAddToCart}
            disabled={isInCart || bundle.stock === 0}
            className={`w-full py-3 rounded-xl font-semibold text-white transition shadow ${
              isInCart ? 'bg-green-600' : bundle.stock === 0 ? 'bg-gray-300' : 'bg-green-500 hover:bg-green-600'
            }`}
          >
            {isInCart ? 'En el carrito' : bundle.stock === 0 ? 'Agotado' : 'Agregar al carrito'}
          </button>
        </div>
      </div>
    </div>
  )
}
