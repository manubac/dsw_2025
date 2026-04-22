import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchApi } from '../services/api'

interface CartaVendedor {
  id: number
  name: string
  price: number
  rarity: string | null
  setName: string | null
  image: string | null
  stock: number
  uploader: { id: number; nombre: string; rating: number; reviewsCount: number } | null
}

interface FavoritoEntry {
  id: number
  disponible: boolean
  cartaClass: { id: number; name: string; description: string } | null
  cartaId: number | null
  cartaNombre?: string
  cartaImage?: string | null
  cartas: CartaVendedor[]
  notificar: boolean
  idioma: string | null
  ciudad: string | null
  precioMax: number | null
}

const CIUDAD_LABELS: Record<string, string> = {
  rosario: 'Rosario',
  buenos_aires: 'Buenos Aires',
}

const IDIOMA_LABELS: Record<string, string> = {
  es: 'ES', en: 'EN', jp: 'JP', fr: 'FR', de: 'DE', pt: 'PT',
}

export default function WishlistPage() {
  const navigate = useNavigate()
  const [favoritos, setFavoritos] = useState<FavoritoEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<number | null>(null)

  useEffect(() => {
    fetchApi('/api/wishlist')
      .then(r => r.json())
      .then(json => setFavoritos(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleRemove = async (cartaClassId: number) => {
    await fetchApi(`/api/wishlist/${cartaClassId}`, { method: 'DELETE' })
    setFavoritos(prev => prev.filter(f => f.cartaClass?.id !== cartaClassId))
  }

  const handleRemoveByCarta = async (cartaId: number) => {
    await fetchApi(`/api/wishlist/carta/${cartaId}`, { method: 'DELETE' })
    setFavoritos(prev => prev.filter(f => f.cartaId !== cartaId))
  }

  const handleToggleNotificar = async (entry: FavoritoEntry) => {
    const nuevo = !entry.notificar
    setFavoritos(prev =>
      prev.map(f => f.id === entry.id ? { ...f, notificar: nuevo } : f)
    )
    try {
      await fetchApi(`/api/wishlist/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificar: nuevo }),
      })
    } catch {
      // Revert on error
      setFavoritos(prev =>
        prev.map(f => f.id === entry.id ? { ...f, notificar: !nuevo } : f)
      )
    }
  }

  const getBadge = (entry: FavoritoEntry) => {
    if (!entry.disponible || !entry.cartaClass) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-500">No disponible</span>
    }
    if (entry.cartas.length === 0) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 text-gray-500">Sin publicaciones</span>
    }
    const conStock = entry.cartas.filter(c => c.stock > 0)
    if (conStock.length === 0) {
      return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Sin stock</span>
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
        {conStock.length} publicación{conStock.length !== 1 ? 'es' : ''} activa{conStock.length !== 1 ? 's' : ''}
      </span>
    )
  }

  const precioMinimo = (cartas: CartaVendedor[]) => {
    const conStock = cartas.filter(c => c.stock > 0)
    if (conStock.length === 0) return null
    return Math.min(...conStock.map(c => c.price))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando favoritos...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-orange-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
            <span className="text-red-500">♥</span>
            Mis Favoritos
            <span className="text-lg font-normal text-gray-400">({favoritos.length})</span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Tus cartas guardadas. Compará precios y recibí alertas cuando se publiquen.
          </p>
        </div>

        {favoritos.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-12 text-center">
            <div className="text-6xl mb-4 text-gray-200">♡</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No tenés favoritos todavía</h2>
            <p className="text-gray-400 mb-6">Explorá las cartas y guardá las que te interesan.</p>
            <button
              onClick={() => navigate('/cards')}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-semibold transition"
            >
              Ver cartas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {favoritos.map(entry => {
              const isExpanded = expandido === entry.id
              const minPrecio = entry.cartas ? precioMinimo(entry.cartas) : null
              const coverImage = entry.cartas?.find(c => c.image)?.image ?? entry.cartaImage

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden"
                >
                  {/* Card row */}
                  <div className="flex items-center gap-4 p-4">
                    {/* Imagen */}
                    <div className="w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      {coverImage ? (
                        <img src={coverImage} alt={entry.cartaClass?.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">?</div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-gray-800 text-lg leading-tight">
                            {entry.cartaClass?.name ?? entry.cartaNombre ?? entry.cartas[0]?.name ?? 'Carta eliminada'}
                          </h3>
                          {entry.cartaClass?.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{entry.cartaClass.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          {/* Toggle notificaciones */}
                          <button
                            onClick={() => handleToggleNotificar(entry)}
                            title={entry.notificar ? 'Desactivar alertas por email' : 'Activar alertas por email'}
                            className={`text-xl transition ${
                              entry.notificar
                                ? 'text-orange-400 hover:text-orange-600'
                                : 'text-gray-300 hover:text-gray-400'
                            }`}
                          >
                            {entry.notificar ? '🔔' : '🔕'}
                          </button>

                          {/* Eliminar */}
                          <button
                            onClick={() => {
                              if (entry.cartaClass) handleRemove(entry.cartaClass.id)
                              else if (entry.cartaId) handleRemoveByCarta(entry.cartaId)
                            }}
                            className="text-red-400 hover:text-red-600 text-2xl transition"
                            title="Quitar de favoritos"
                          >
                            ♥
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Badge disponibilidad solo para entradas con cartaClass */}
                        {entry.cartaClass && getBadge(entry)}

                        {/* Precio mínimo */}
                        {minPrecio !== null && (
                          <span className="text-orange-600 font-semibold text-sm">
                            Desde ${minPrecio.toLocaleString('es-AR')}
                          </span>
                        )}

                        {/* Tag idioma */}
                        {entry.idioma && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-100">
                            {IDIOMA_LABELS[entry.idioma] ?? entry.idioma.toUpperCase()}
                          </span>
                        )}

                        {/* Tag ciudad */}
                        {entry.ciudad && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-100">
                            📍 {CIUDAD_LABELS[entry.ciudad] ?? entry.ciudad}
                          </span>
                        )}

                        {/* Tag precio máximo */}
                        {entry.precioMax != null && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-600 border border-green-100">
                            Máx. ${Number(entry.precioMax).toLocaleString('es-AR')}
                          </span>
                        )}

                        {/* Botón Ver inline para entradas por cartaId */}
                        {!entry.cartaClass && entry.cartaId && (
                          <button
                            onClick={() => setExpandido(isExpanded ? null : entry.id)}
                            className="px-3 py-1 rounded-full text-xs font-semibold transition bg-orange-500 hover:bg-orange-600 text-white flex items-center gap-1"
                          >
                            {isExpanded ? 'Ocultar' : 'Ver'}
                            <span className={`transition-transform inline-block ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Botón expandir (solo para entradas con cartaClass) */}
                    {entry.cartaClass && entry.disponible && entry.cartas.length > 0 && (
                      <button
                        onClick={() => setExpandido(isExpanded ? null : entry.id)}
                        className="flex-shrink-0 px-4 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 font-semibold text-sm transition flex items-center gap-1"
                      >
                        {isExpanded ? 'Ocultar' : 'Comparar'}
                        <span className={`transition-transform inline-block ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                      </button>
                    )}
                  </div>

                  {/* Tabla comparación / publicaciones */}
                  {isExpanded && (
                    <div className="border-t border-orange-100 px-4 pb-4 pt-3">
                      <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">
                        {entry.cartaClass ? 'Comparativa de vendedores' : 'Publicaciones disponibles'}
                      </p>
                      {entry.cartas.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No hay publicaciones disponibles para esta carta.</p>
                      )}
                      {entry.cartas.length > 0 && <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                              <th className="pb-2 font-medium">Vendedor</th>
                              <th className="pb-2 font-medium">Precio</th>
                              <th className="pb-2 font-medium">Stock</th>
                              <th className="pb-2 font-medium">Rareza</th>
                              <th className="pb-2 font-medium">Valoración</th>
                              <th className="pb-2 font-medium"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.cartas.map(carta => (
                              <tr key={carta.id} className="border-b border-gray-50 hover:bg-orange-50 transition">
                                <td className="py-2.5 font-medium text-gray-700">
                                  {carta.uploader?.nombre ?? 'Desconocido'}
                                </td>
                                <td className="py-2.5">
                                  <span className={`font-bold ${carta.stock > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                                    ${carta.price.toLocaleString('es-AR')}
                                  </span>
                                </td>
                                <td className="py-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    carta.stock > 0
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-500'
                                  }`}>
                                    {carta.stock > 0 ? `${carta.stock} disp.` : 'Agotado'}
                                  </span>
                                </td>
                                <td className="py-2.5 text-gray-500 text-xs">{carta.rarity ?? '—'}</td>
                                <td className="py-2.5">
                                  {carta.uploader && carta.uploader.reviewsCount > 0 ? (
                                    <span className="flex items-center gap-1 text-xs">
                                      <span className="text-yellow-400">
                                        {'★'.repeat(Math.round(carta.uploader.rating))}
                                        {'☆'.repeat(5 - Math.round(carta.uploader.rating))}
                                      </span>
                                      <span className="text-gray-400">({carta.uploader.reviewsCount})</span>
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-300">Sin reseñas</span>
                                  )}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    onClick={() => navigate(`/card/${carta.id}`)}
                                    disabled={carta.stock === 0}
                                    className="px-3 py-1 rounded-full text-xs font-semibold transition
                                      bg-orange-500 hover:bg-orange-600 text-white
                                      disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                                  >
                                    Ver
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
