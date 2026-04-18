import { useEffect, useRef, useState } from 'react'
import { io as socketIO } from 'socket.io-client'
import { useUser } from '../context/user'
import { fetchApi } from '../services/api'

interface Mensaje {
  id: number
  senderId: number
  senderRole: string
  senderNombre: string
  texto: string
  createdAt: string
}

interface ChatProps {
  compraId: number
}

export function Chat({ compraId }: ChatProps) {
  const { user } = useUser()
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    const token = stored ? JSON.parse(stored)?.token : undefined

    const socket = socketIO('http://localhost:3000', {
      auth: { token },
    })

    socket.on('connect', () => {
      socket.emit('join_compra', compraId)
    })

    socket.on('nuevo_mensaje', (msg: Mensaje) => {
      setMensajes((prev) => [...prev, msg])
    })

    fetchApi(`/api/mensajes/${compraId}`)
      .then((res) => res.json())
      .then((json) => setMensajes(json.data || []))
      .catch(() => {})

    return () => {
      socket.disconnect()
    }
  }, [compraId])

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensajes])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim() || enviando) return

    setEnviando(true)
    try {
      await fetchApi(`/api/mensajes/${compraId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      setTexto('')
    } catch {
      // silencioso
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-orange-50 px-4 py-2 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-orange-700">Chat — Acordar punto de encuentro</h4>
      </div>

      <div ref={containerRef} className="h-52 overflow-y-auto p-3 space-y-2 bg-white">
        {mensajes.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-6">
            Aún no hay mensajes. ¡Iniciá la conversación!
          </p>
        )}
        {mensajes.map((m) => {
          const myRole = user?.role === 'usuario' ? 'user' : (user?.role ?? 'user')
          const esMio = Number(m.senderId) === Number(user?.id) && m.senderRole === myRole
          return (
            <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  esMio
                    ? 'bg-orange-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}
              >
                {!esMio && (
                  <p className="text-xs font-semibold mb-1 text-gray-500">{m.senderNombre}</p>
                )}
                <p>{m.texto}</p>
                <p className={`text-xs mt-1 ${esMio ? 'text-orange-100' : 'text-gray-400'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 p-3 bg-gray-50 border-t border-gray-200">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí un mensaje..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-orange-400"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-full text-sm disabled:opacity-40 transition"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
