import { useEffect, useRef, useState } from 'react'
import { io as socketIO } from 'socket.io-client'
import { useUser } from '../context/user'
import { fetchApi } from '../services/api'
import { ExternalLink } from 'lucide-react'

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
  locked?: boolean
  onOpenInPage?: () => void
  counterpartName?: string
}

export function Chat({ compraId, locked = false, onOpenInPage, counterpartName }: ChatProps) {
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
    <div className="border border-[#c8dbc9] rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-2.5 bg-[#e8f0e9] border-b border-[#c8dbc9] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4a7c59]" />
          <h4 className="text-sm font-semibold text-[#2d4a32]">
            {counterpartName ? `Chat con ${counterpartName}` : 'Chat'}
          </h4>
          {locked && (
            <span className="text-xs text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full ml-1">
              Cerrado
            </span>
          )}
        </div>
        {onOpenInPage && (
          <button
            onClick={onOpenInPage}
            className="flex items-center gap-1 text-xs text-[#4a7c59] hover:text-[#3a6b49] font-medium transition"
          >
            <ExternalLink size={13} />
            Abrir en chats
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={containerRef} className="h-52 overflow-y-auto p-3 space-y-2 bg-white">
        {mensajes.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-8">
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
                    ? 'bg-[#4a7c59] text-white rounded-br-sm'
                    : 'bg-[#f0f4f0] border border-[#c8dbc9] text-[#2d4a32] rounded-bl-sm'
                }`}
              >
                {!esMio && (
                  <p className="text-xs font-semibold mb-1 text-[#4a7c59]">{m.senderNombre}</p>
                )}
                <p>{m.texto}</p>
                <p className={`text-xs mt-1 ${esMio ? 'text-green-100' : 'text-gray-400'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      {locked ? (
        <div className="flex items-center justify-center gap-2 p-3 bg-[#f4f7f4] border-t border-[#c8dbc9] text-xs text-gray-400">
          <span>El chat está cerrado — la orden fue finalizada o cancelada.</span>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex gap-2 p-3 bg-[#f4f7f4] border-t border-[#c8dbc9]">
          <input
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí un mensaje..."
            className="flex-1 border border-[#c8dbc9] rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-[#4a7c59] bg-white"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="bg-[#4a7c59] hover:bg-[#3a6b49] text-white px-4 py-1.5 rounded-full text-sm disabled:opacity-40 transition"
          >
            Enviar
          </button>
        </form>
      )}
    </div>
  )
}
