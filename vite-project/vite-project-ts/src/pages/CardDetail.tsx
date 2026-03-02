import { useParams, useNavigate } from 'react-router-dom'
import { useState, useContext, useEffect } from 'react'
import { CartContext } from '../context/cart'
import { AddToCartIcon } from '../components/Icons'
// import axios from 'axios'
import { fetchApi, api } from '../services/api'
import { useUser } from '../context/user'


export function CardDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToCart, cart } = useContext(CartContext)
  const { user } = useUser()
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [card, setCard] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCard = async () => {
      try {
        setLoading(true)
        const response = await fetchApi(`/api/cartas/${id}`)
        if (!response.ok) {
          throw new Error('Card not found')
        }
        const result = await response.json()
        setCard(result.data)
      } catch (error) {
        console.error('Error fetching card:', error)
        navigate('/cards')
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchCard()
    }
  }, [id, navigate])

  if (loading) {
    return <div className="loading">Loading...</div>
  }

  if (!card) {
    return <div>Card not found</div>
  }

  const isInCart = cart.some((item: any) => item.id === card.id)
  const allImages = [card.thumbnail, ...card.images]

  const handleAddToCart = () => {
    addToCart(card, quantity)
  }

  const handleDelete = async () => {
    if (!card?.id) return
    if (!user) {
      alert('Debes estar logueado como vendedor para eliminar esta carta')
      return
    }

    const ok = window.confirm('¿Seguro que querés eliminar esta carta? Esta acción no se puede deshacer.')
    if (!ok) return

    try {
      await api.delete(`/api/cartas/${card.id}`, { data: { userId: user.id } })
      navigate('/cards')
    } catch (err: any) {
      console.error('Error deleting carta', err)
      if (err.response && err.response.status === 403) {
        alert('No estás autorizado para eliminar esta carta')
      } else {
        alert('Error al eliminar la carta')
      }
    }
  }

 return (
  <div className="max-w-6xl mx-auto p-6 bg-green-50 min-h-screen">
    {/* Breadcrumb */}
    <div className="mb-6 text-sm text-gray-500">
      <span onClick={() => navigate('/')} className="cursor-pointer text-green-600 hover:underline">
        Inicio
      </span>
      <span> / </span>
      <span onClick={() => navigate('/cards')} className="cursor-pointer text-green-600 hover:underline">
        Cartas
      </span>
      <span> / </span>
      <span className="text-gray-800 font-medium">{card.title}</span>
    </div>

    <div className="grid md:grid-cols-2 gap-10 mb-10">
      {/* Galería */}
      <div className="flex flex-col gap-4">
        <div className="rounded-xl overflow-hidden shadow-md bg-white">
          <img
            src={allImages[selectedImage]}
            alt={card.title}
            className="w-full h-auto"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          {allImages.map((image, index) => (
            <img
              key={index}
              src={image}
              alt={`${card.title} ${index + 1}`}
              onClick={() => setSelectedImage(index)}
              className={`w-20 h-20 object-cover rounded-lg cursor-pointer border-2 transition
              ${
                selectedImage === index
                  ? 'border-green-500 shadow'
                  : 'border-transparent hover:border-green-400'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col gap-5">
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{card.title}</h1>

          <div className="flex gap-4 text-sm text-gray-500">
            {card.set && <span>{card.set}</span>}
          </div>

          {card.uploader && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
              <span>Vendido por:</span>
              <span
                onClick={() => navigate(`/vendedor/${card.uploader.id}`)}
                className="text-green-600 font-semibold cursor-pointer underline"
              >
                {card.uploader.nombre}
              </span>

              <div className="flex items-center ml-2">
                <span className="text-yellow-400">
                  {'★'.repeat(Math.round(card.uploader.rating || 0))}
                  {'☆'.repeat(5 - Math.round(card.uploader.rating || 0))}
                </span>
                <span className="ml-1 text-xs">
                  ({card.uploader.reviewsCount || 0})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Rareza */}
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 uppercase">
            {card.rarity || 'Unknown'}
          </span>
        </div>

        {/* Precio */}
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-gray-800">${card.price}</span>
        </div>

        {/* Stock */}
        <div>
          <span
            className={`text-sm font-medium ${
              card.stock > 0 ? 'text-green-600' : 'text-red-500'
            }`}
          >
            {card.stock > 0
              ? `En stock (${card.stock} disponibles)`
              : 'Agotado'}
          </span>
        </div>

        {/* Acciones */}
        <div className="mt-2">
          <div className="mb-4">
            <label className="block mb-2 font-semibold text-gray-700">
              Cantidad:
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-10 h-10 border-2 border-green-500 text-green-600 rounded-lg font-bold hover:bg-green-500 hover:text-white transition disabled:border-gray-300 disabled:text-gray-300"
              >
                -
              </button>

              <input
                id="quantity"
                type="number"
                min="1"
                max={card.stock}
                value={quantity}
                onChange={(e) =>
                  setQuantity(
                    Math.min(
                      card.stock,
                      Math.max(1, parseInt(e.target.value) || 1)
                    )
                  )
                }
                className="w-20 h-10 text-center border-2 border-gray-200 rounded-lg font-semibold focus:outline-none focus:ring-2 focus:ring-green-400"
              />

              <button
                type="button"
                onClick={() => setQuantity(Math.min(card.stock, quantity + 1))}
                disabled={quantity >= card.stock}
                className="w-10 h-10 border-2 border-green-500 text-green-600 rounded-lg font-bold hover:bg-green-500 hover:text-white transition disabled:border-gray-300 disabled:text-gray-300"
              >
                +
              </button>
            </div>
          </div>

          <button
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold transition shadow
            ${
              isInCart
                ? 'bg-green-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }
            disabled:bg-gray-300`}
            onClick={handleAddToCart}
            disabled={isInCart || card.stock === 0}
          >
            {isInCart
              ? 'En Carrito'
              : card.stock === 0
              ? 'Agotado'
              : (
                <>
                  <AddToCartIcon />
                  Agregar al Carrito
                </>
              )}
          </button>
        </div>

        {/* Botones vendedor */}
        {user && card?.uploader && user.id === card.uploader.id && (
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => navigate('/editar-carta', { state: { carta: card } })}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition"
            >
              Editar carta
            </button>

            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition"
            >
              Eliminar carta
            </button>
          </div>
        )}

        {/* Detalles */}
        <div className="bg-white border border-green-100 rounded-xl p-5 shadow-sm mt-4">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Detalles del Producto
          </h3>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-gray-500">Marca:</span>
              <span className="text-gray-800">{card.brand}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-gray-500">Categoría:</span>
              <span className="text-gray-800">{card.category}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-gray-500">Set:</span>
              <span className="text-gray-800">{card.set}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-gray-500">Año:</span>
              <span className="text-gray-800">{card.releaseYear}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-gray-500">Rareza:</span>
              <span className="text-gray-800">{card.rarity}</span>
            </div>

            <div className="flex justify-between">
              <span className="font-medium text-gray-500">Stock:</span>
              <span className="text-gray-800">{card.stock}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)
}