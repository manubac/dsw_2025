import { useState } from 'react'
import { fetchApi } from '../services/api'

interface WishlistPrefs {
  idioma: string
  ciudad: string
  precioMax: string
  notificar: boolean
}

interface Props {
  cartaClassId?: number
  cartaId?: number
  onSaved: () => void
  onCancel: () => void
}

const IDIOMAS = [
  { value: '', label: 'Cualquier idioma' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'jp', label: 'Japonés' },
  { value: 'fr', label: 'Francés' },
  { value: 'de', label: 'Alemán' },
  { value: 'pt', label: 'Portugués' },
]

const CIUDADES = [
  { value: '', label: 'Cualquier ciudad' },
  { value: 'rosario', label: 'Rosario' },
  { value: 'buenos_aires', label: 'Buenos Aires' },
]

export default function WishlistModal({ cartaClassId, cartaId, onSaved, onCancel }: Props) {
  const [prefs, setPrefs] = useState<WishlistPrefs>({
    idioma: '',
    ciudad: '',
    precioMax: '',
    notificar: true,
  })
  const [loading, setLoading] = useState(false)

  const handleGuardar = async () => {
    setLoading(true)
    try {
      const body: Record<string, any> = {
        idioma: prefs.idioma || null,
        ciudad: prefs.ciudad || null,
        notificar: prefs.notificar,
        precioMax: prefs.precioMax !== '' ? Number(prefs.precioMax) : null,
      }
      if (cartaClassId) body.cartaClassId = cartaClassId
      else if (cartaId) body.cartaId = cartaId

      await fetchApi('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Agregar a favoritos</h2>
        <p className="text-sm text-gray-500 mb-5">
          Configurá tus preferencias. Te avisamos por email cuando se publique.
        </p>

        {/* Idioma */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 block mb-1">Idioma de la carta</span>
          <select
            value={prefs.idioma}
            onChange={e => setPrefs(p => ({ ...p, idioma: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {IDIOMAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </label>

        {/* Ciudad */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 block mb-1">Ciudad</span>
          <select
            value={prefs.ciudad}
            onChange={e => setPrefs(p => ({ ...p, ciudad: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {CIUDADES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        {/* Precio máximo */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 block mb-1">
            Precio máximo <span className="text-gray-400 font-normal">(opcional)</span>
          </span>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium">$</span>
            <input
              type="number"
              min="0"
              placeholder="Sin límite"
              value={prefs.precioMax}
              onChange={e => setPrefs(p => ({ ...p, precioMax: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Solo te avisamos si el precio es menor a este valor.</p>
        </label>

        {/* Toggle notificaciones */}
        <div className="flex items-center justify-between mb-6 bg-orange-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Recibir alertas por email</p>
            <p className="text-xs text-gray-400">Te avisamos cuando la carta se publique</p>
          </div>
          <button
            type="button"
            onClick={() => setPrefs(p => ({ ...p, notificar: !p.notificar }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              prefs.notificar ? 'bg-orange-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                prefs.notificar ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-60"
          >
            {loading ? 'Guardando...' : '♥ Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
