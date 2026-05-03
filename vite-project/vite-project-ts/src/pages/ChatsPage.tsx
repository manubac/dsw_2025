import { useEffect, useRef, useState, useCallback } from 'react'
import { useUser } from '../context/user'
import { useNotifications } from '../context/notifications'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { fetchApi } from '../services/api'
import { io as socketIO, Socket } from 'socket.io-client'
import { Search, Send, ArrowLeft, ExternalLink } from 'lucide-react'

interface Mensaje {
  id: number
  senderId: number
  senderRole: string
  senderNombre: string
  texto: string
  createdAt: string
  compraId?: number
}

interface Compra {
  id: number
  estado: string
  total: number
  createdAt: string
  comprador?: { id: number; nombre: string; email: string }
  compradorTienda?: { id: number; nombre: string }
  itemCartas?: Array<{
    uploaderVendedor?: { id: number; nombre: string }
    uploaderTienda?: { id: number; nombre: string }
    carta?: { name: string; imageUrl?: string }
    precio?: number
  }>
  tiendaRetiro?: { id: number; nombre: string }
}

const ACTIVE_ESTADOS = ['pendiente', 'en_tienda', 'pago_confirmado', 'listo_para_retirar']
const ARCHIVED_ESTADOS = ['finalizado', 'cancelado']

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  pendiente:          { label: 'Pendiente',         cls: 'bg-amber-50 text-amber-700 border border-amber-200' },
  en_tienda:          { label: 'En tienda',          cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  pago_confirmado:    { label: 'Pago confirmado',    cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  listo_para_retirar: { label: 'Listo para retirar', cls: 'bg-[#e8f0e9] text-[#2d4a32] border border-[#c8dbc9]' },
  finalizado:         { label: 'Finalizado',         cls: 'bg-[#e8f0e9] text-[#2d4a32] border border-[#c8dbc9]' },
  cancelado:          { label: 'Cancelado',          cls: 'bg-red-50 text-red-700 border border-red-200' },
}

function getCounterpart(compra: Compra, role: string | undefined): { id: number; name: string } {
  if (role === 'vendedor') {
    if (compra.comprador) return { id: compra.comprador.id, name: compra.comprador.nombre }
    if (compra.compradorTienda) return { id: compra.compradorTienda.id, name: compra.compradorTienda.nombre }
    return { id: 0, name: 'Comprador' }
  }
  // buyer or tiendaRetiro
  const firstItem = compra.itemCartas?.[0]
  if (firstItem?.uploaderVendedor) return { id: firstItem.uploaderVendedor.id, name: firstItem.uploaderVendedor.nombre }
  if (firstItem?.uploaderTienda) return { id: firstItem.uploaderTienda.id, name: firstItem.uploaderTienda.nombre }
  return { id: 0, name: 'Vendedor' }
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export default function ChatsPage() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialCompraId = searchParams.get('compraId') ? Number(searchParams.get('compraId')) : null

  const [compras, setCompras] = useState<Compra[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'activos' | 'archivados'>('activos')
  const [search, setSearch] = useState('')
  const { markAsRead } = useNotifications()
  const [selectedCompraId, setSelectedCompraId] = useState<number | null>(initialCompraId)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [lastMessages, setLastMessages] = useState<Record<number, Mensaje | null>>({})
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Fetch compras
  const fetchCompras = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      let url = '/api/compras'
      if (user.role === 'vendedor') url = `/api/vendedores/${user.id}/ventas`
      const res = await fetchApi(url)
      const json = await res.json()
      const list: Compra[] = (json.data || []).sort((a: Compra, b: Compra) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setCompras(list)
      // Fetch last message for each active compra
      const activeList = list.filter(c => ACTIVE_ESTADOS.includes(c.estado))
      await Promise.all(activeList.map(async (c) => {
        try {
          const r = await fetchApi(`/api/mensajes/${c.id}`)
          const j = await r.json()
          const msgs: Mensaje[] = j.data || []
          setLastMessages(prev => ({ ...prev, [c.id]: msgs.length > 0 ? msgs[msgs.length - 1] : null }))
        } catch {}
      }))
    } catch {}
    setLoading(false)
  }, [user])

  useEffect(() => { fetchCompras() }, [fetchCompras])

  useEffect(() => {
    if (selectedCompraId) markAsRead(selectedCompraId)
  }, [selectedCompraId, markAsRead])

  // Socket setup
  useEffect(() => {
    if (!user) return
    const stored = localStorage.getItem('user')
    const token = stored ? JSON.parse(stored)?.token : undefined
    const socket = socketIO('http://localhost:3000', { auth: { token } })
    socketRef.current = socket
    socket.on('nuevo_mensaje', (msg: Mensaje) => {
      setMensajes(prev => [...prev, msg])
      // Update last message preview
      if (msg.compraId) {
        setLastMessages(prev => ({ ...prev, [msg.compraId!]: msg }))
      } else if (selectedCompraId) {
        setLastMessages(prev => ({ ...prev, [selectedCompraId]: msg }))
      }
    })
    return () => { socket.disconnect() }
  }, [user])

  // Load messages when compra selected
  useEffect(() => {
    if (!selectedCompraId) return
    setLoadingMessages(true)
    setMensajes([])
    fetchApi(`/api/mensajes/${selectedCompraId}`)
      .then(r => r.json())
      .then(j => setMensajes(j.data || []))
      .catch(() => {})
      .finally(() => setLoadingMessages(false))
    socketRef.current?.emit('join_compra', selectedCompraId)
  }, [selectedCompraId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim() || enviando || !selectedCompraId) return
    setEnviando(true)
    try {
      await fetchApi(`/api/mensajes/${selectedCompraId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      setTexto('')
    } catch {}
    setEnviando(false)
  }

  if (!user) return null

  const filtered = compras.filter(c => {
    const inTab = activeTab === 'activos' ? ACTIVE_ESTADOS.includes(c.estado) : ARCHIVED_ESTADOS.includes(c.estado)
    if (!inTab) return false
    if (!search.trim()) return true
    const cp = getCounterpart(c, user.role)
    return cp.name.toLowerCase().includes(search.toLowerCase()) ||
      `#${c.id}`.includes(search)
  })

  const selectedCompra = compras.find(c => c.id === selectedCompraId)
  const isLocked = selectedCompra ? ARCHIVED_ESTADOS.includes(selectedCompra.estado) : false
  const counterpart = selectedCompra ? getCounterpart(selectedCompra, user.role) : null

  const ordersLink = user.role === 'vendedor' ? '/mis-ventas' : user.role === 'tiendaRetiro' ? '/tienda-retiro/ventas' : '/purchases'

  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#f4f7f4]">
      {/* LEFT PANEL */}
      <div className="w-72 shrink-0 flex flex-col bg-[#e8f0e9] border-r border-[#c8dbc9]">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <h1 className="text-lg font-bold text-[#2d4a32]">Chats</h1>
          <p className="text-xs text-[#5a7a62] mt-0.5">Coordiná con vendedores y compradores</p>
        </div>

        {/* Tabs */}
        <div className="flex mx-4 mb-3 bg-white rounded-lg p-0.5 border border-[#c8dbc9]">
          <button
            onClick={() => setActiveTab('activos')}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${activeTab === 'activos' ? 'bg-[#4a7c59] text-white' : 'text-[#5a7a62] hover:bg-[#daeade]'}`}
          >
            Activos ({compras.filter(c => ACTIVE_ESTADOS.includes(c.estado)).length})
          </button>
          <button
            onClick={() => setActiveTab('archivados')}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${activeTab === 'archivados' ? 'bg-[#4a7c59] text-white' : 'text-[#5a7a62] hover:bg-[#daeade]'}`}
          >
            Archivados
          </button>
        </div>

        {/* Search */}
        <div className="relative mx-4 mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a7a62]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversaciones..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-[#c8dbc9] rounded-lg focus:outline-none focus:border-[#4a7c59] text-[#2d4a32] placeholder-[#a0b5a0]"
          />
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-xs text-center text-[#5a7a62] mt-8">Cargando...</p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-center text-[#5a7a62] mt-8 px-4">
              {activeTab === 'activos' ? 'No tenés chats activos.' : 'No hay chats archivados.'}
            </p>
          )}
          {filtered.map(c => {
            const cp = getCounterpart(c, user.role)
            const badge = ESTADO_BADGE[c.estado]
            const lastMsg = lastMessages[c.id]
            const isSelected = c.id === selectedCompraId
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCompraId(c.id)}
                className={`w-full text-left px-4 py-3 transition border-l-4 ${
                  isSelected
                    ? 'bg-white border-[#4a7c59]'
                    : 'border-transparent hover:bg-[#daeade]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#4a7c59] text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {initials(cp.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-semibold text-[#2d4a32] truncate">{cp.name}</span>
                      <span className="text-[10px] text-[#5a7a62] shrink-0">{formatDate(c.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[10px] text-[#5a7a62]">Orden #{c.id}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${badge?.cls || 'bg-gray-100 text-gray-500'}`}>
                        {badge?.label || c.estado}
                      </span>
                    </div>
                    <p className="text-xs text-[#7a9a7a] truncate mt-0.5">
                      {lastMsg ? lastMsg.texto : 'Sin mensajes aún'}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Bottom link */}
        <div className="p-4 border-t border-[#c8dbc9]">
          <Link
            to={ordersLink}
            className="flex items-center gap-2 text-xs text-[#4a7c59] hover:text-[#3a6b49] font-medium"
          >
            <ArrowLeft size={13} />
            Ver mis órdenes
          </Link>
        </div>
      </div>

      {/* RIGHT PANEL */}
      {!selectedCompra ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-[#5a7a62]">
          <div className="w-16 h-16 rounded-full bg-[#e8f0e9] flex items-center justify-center mb-4">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#4a7c59" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.862 9.862 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-[#2d4a32]">Seleccioná una conversación</p>
          <p className="text-xs mt-1">Elegí un chat de la lista para empezar</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat header */}
          <div className="px-5 py-3.5 border-b border-[#c8dbc9] flex items-center justify-between bg-[#f4f7f4]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#4a7c59] text-white flex items-center justify-center text-sm font-bold">
                {counterpart ? initials(counterpart.name) : '?'}
              </div>
              <div>
                <p className="font-semibold text-[#2d4a32] text-sm">{counterpart?.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#5a7a62]">Orden #{selectedCompra.id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${ESTADO_BADGE[selectedCompra.estado]?.cls || 'bg-gray-100 text-gray-500'}`}>
                    {ESTADO_BADGE[selectedCompra.estado]?.label || selectedCompra.estado}
                  </span>
                </div>
              </div>
            </div>
            <Link
              to={`${ordersLink}?compraId=${selectedCompra.id}`}
              className="flex items-center gap-1.5 text-xs font-medium text-[#4a7c59] hover:text-[#3a6b49] bg-[#e8f0e9] px-3 py-1.5 rounded-lg transition"
            >
              <ExternalLink size={12} />
              Ver orden
            </Link>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafcfa]">
            {loadingMessages && (
              <p className="text-xs text-center text-[#5a7a62] mt-8">Cargando mensajes...</p>
            )}
            {!loadingMessages && mensajes.length === 0 && (
              <p className="text-xs text-center text-[#5a7a62] mt-8">
                Aún no hay mensajes. ¡Iniciá la conversación!
              </p>
            )}
            {mensajes.map((m) => {
              const myRole = user.role === 'usuario' ? 'user' : user.role
              const esMio = Number(m.senderId) === Number(user.id) && m.senderRole === myRole
              return (
                <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
                  {!esMio && (
                    <div className="w-7 h-7 rounded-full bg-[#4a7c59] text-white flex items-center justify-center text-[10px] font-bold mr-2 mt-auto shrink-0">
                      {initials(m.senderNombre)}
                    </div>
                  )}
                  <div className={`max-w-[65%] ${esMio ? '' : ''}`}>
                    {!esMio && <p className="text-[10px] text-[#5a7a62] mb-1 ml-1">{m.senderNombre}</p>}
                    <div className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                      esMio
                        ? 'bg-[#4a7c59] text-white rounded-br-sm'
                        : 'bg-white border border-[#c8dbc9] text-[#2d4a32] rounded-bl-sm'
                    }`}>
                      <p className="leading-relaxed">{m.texto}</p>
                      <p className={`text-[10px] mt-1 text-right ${esMio ? 'text-green-200' : 'text-gray-400'}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {esMio && ' ✓'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {isLocked ? (
            <div className="px-5 py-3 border-t border-[#c8dbc9] bg-[#f4f7f4] text-center text-xs text-[#5a7a62]">
              Este chat está cerrado — la orden fue finalizada o cancelada.
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex items-center gap-3 px-4 py-3 border-t border-[#c8dbc9] bg-[#f4f7f4]">
              <input
                value={texto}
                onChange={e => setTexto(e.target.value)}
                placeholder="Escribí un mensaje..."
                className="flex-1 border border-[#c8dbc9] rounded-full px-4 py-2 text-sm bg-white focus:outline-none focus:border-[#4a7c59] text-[#2d4a32]"
              />
              <button
                type="submit"
                disabled={enviando || !texto.trim()}
                className="w-9 h-9 rounded-full bg-[#4a7c59] hover:bg-[#3a6b49] text-white flex items-center justify-center disabled:opacity-40 transition shrink-0"
              >
                <Send size={15} />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
