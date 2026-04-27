import React, { useEffect, useState } from 'react'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import { ReviewModal } from '../components/ReviewModal';
import { fetchApi } from '../services/api';
import { Chat } from '../components/Chat';


export function Purchases() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [compras, setCompras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [chatAbierto, setChatAbierto] = useState<number | null>(null)
  
  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{id: number, name: string} | null>(null);

  const handleOpenReview = (vendedorId: number, vendedorName: string) => {
      setReviewTarget({ id: vendedorId, name: vendedorName });
      setReviewModalOpen(true);
  }

  const handleRetirar = async (compraId: number, vendedorId?: number, vendedorNombre?: string) => {
    try {
      if (!confirm('¿Confirmás que retiraste el pedido de la tienda?')) return;
      await fetchApi(`/api/compras/${compraId}/retirar`, { method: 'PATCH' });
      const res = await fetchApi(`/api/compras?compradorId=${user!.id}`);
      const json = await res.json();
      setCompras(json.data || []);
      if (vendedorId && vendedorNombre) {
        handleOpenReview(vendedorId, vendedorNombre);
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  useEffect(() => {
    if (!user) return

    const fetchCompras = async () => {
      try {
        const res = await fetchApi(`/api/compras?compradorId=${user.id}`)
        const json = await res.json()
        console.log('API Response:', json)
        console.log('User ID:', user.id, 'User role:', user.role)
        const data = json.data || []
        // No need to filter on frontend anymore - backend does it
        setCompras(data)
      } catch (err: any) {
        console.error('Error fetching compras:', err)
        setError('No se pudieron cargar las compras')
      } finally {
        setLoading(false)
      }
    }

    fetchCompras()
  }, [user])

  if (!user) {
    return (
      <div className="purchases-wrapper">
        <div className="purchases-card">
          <h2>No has iniciado sesión</h2>
          <p>Por favor inicia sesión para ver tus compras.</p>
          <button onClick={() => navigate('/login')} className="btn-primary">Iniciar sesión</button>
        </div>
      </div>
    )
  }

  // Only users (compradores) can view purchases
  if (user.role !== 'usuario' && user.role !== 'user') {
    return (
      <div className="purchases-wrapper">
        <div className="purchases-card">
          <h2>Acceso denegado</h2>
          <p>Solo los usuarios compradores pueden ver sus compras.</p>
          <button onClick={() => navigate('/')} className="btn-primary">Volver al inicio</button>
        </div>
      </div>
    )
  }

 return (
  <div className="min-h-screen bg-green-50 flex justify-center p-6">
    <div className="w-[980px] bg-white rounded-xl p-6 shadow-md">
      <h2 className="text-xl font-semibold mb-4">Mis Compras</h2>

      {loading && <p>Cargando...</p>}
      {error && (
        <div className="text-red-800 bg-red-100 p-2 rounded-md mb-3">
          {error}
        </div>
      )}

      {!loading && compras.length === 0 && (
        <div>
          <p>No encontré compras para tu cuenta.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-3 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-md"
          >
            Volver al inicio
          </button>
        </div>
      )}

      <div>
        {compras.map((comp: any) => (
          <div
            key={comp.id}
            className="border border-gray-200 my-3 p-4 rounded-lg shadow-sm"
          >
            <div className="flex justify-between items-center mb-2">
              <strong>Orden #{comp.id}</strong>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  comp.estado === 'retirado'
                    ? 'bg-green-100 text-green-800'
                    : comp.estado === 'entregado_a_tienda'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {comp.estado === 'retirado'
                    ? 'Retirado'
                    : comp.estado === 'entregado_a_tienda'
                    ? 'Listo para retirar'
                    : comp.estado}
                </span>

                {comp.envio && (
                  <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs">
                    Envío: {comp.envio.estado}
                  </span>
                )}

                <button
                  onClick={() => setChatAbierto(chatAbierto === comp.id ? null : comp.id)}
                  className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded text-xs transition"
                >
                  {chatAbierto === comp.id ? 'Cerrar chat' : '💬 Chat'}
                </button>
              </div>
            </div>

            <div>
              <p>
                <strong>Total:</strong> ${Number(comp.total || 0).toFixed(2)}
              </p>

              <p>
                <strong>Contacto:</strong> {comp.nombre} — {comp.email}
              </p>

              {comp.tiendaRetiro ? (
                <div
                  style={{
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '0.5rem',
                    padding: '0.6rem 0.9rem',
                    marginBottom: '0.5rem',
                  }}
                >
                  <p style={{ fontWeight: 600, margin: 0, color: '#92400e' }}>
                    📍 Retiro en tienda: {comp.tiendaRetiro.nombre}
                  </p>
                  <p style={{ fontSize: '0.85rem', color: '#78350f', margin: '0.15rem 0 0' }}>
                    {comp.tiendaRetiro.direccion}
                  </p>
                  {comp.tiendaRetiro.horario && (
                    <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0.1rem 0 0' }}>
                      🕐 {comp.tiendaRetiro.horario}
                    </p>
                  )}
                  {(() => {
                    const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor?.alias || ic.uploaderVendedor?.cbu)?.uploaderVendedor;
                    if (!vendedor?.alias && !vendedor?.cbu) return null;
                    return (
                      <div style={{ marginTop: '0.6rem', background: '#fef3c7', borderRadius: '0.35rem', padding: '0.5rem 0.75rem', border: '1px solid #fcd34d' }}>
                        <p style={{ fontWeight: 600, margin: 0, color: '#92400e', fontSize: '0.82rem' }}>
                          💸 Transferí antes de retirar y mostrá el comprobante en la tienda
                        </p>
                        {vendedor.alias && (
                          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#78350f' }}>
                            <strong>Alias:</strong> {vendedor.alias}
                          </p>
                        )}
                        {vendedor.cbu && (
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: '#78350f' }}>
                            <strong>CBU:</strong> {vendedor.cbu}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                  {comp.estado === 'entregado_a_tienda' && (
                    <button
                      onClick={() => {
                        const v = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor;
                        handleRetirar(comp.id, v?.id, v?.nombre);
                      }}
                      style={{
                        marginTop: '0.75rem',
                        width: '100%',
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.4rem',
                        padding: '0.5rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Confirmar retiro
                    </button>
                  )}
                  {comp.estado === 'retirado' && (
                    <p style={{ marginTop: '0.5rem', color: '#15803d', fontWeight: 600 }}>
                      ✓ Retirado
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  💬 Entrega a coordinar con el vendedor via chat
                </p>
              )}

              <div className="mt-2">
                <strong>Items:</strong>
                <ul className="mt-1 ml-5 list-disc">
                  {(comp.items || comp.cartas || []).map(
                    (it: any, idx: number) => {
                      const associatedItemCarta = comp.itemCartas?.find(
                        (ic: any) =>
                          (ic.cartas || []).some(
                            (c: any) => c.id === it.cartaId
                          )
                      )
                      const vendedor = associatedItemCarta?.uploaderVendedor

                      if (it.itemCartaId !== undefined) {
                        return (
                          <li key={idx} className="mb-1">
                            <a
                              href={`/bundle/${it.itemCartaId}`}
                              className="text-blue-500 hover:underline"
                              onClick={(e) => {
                                e.preventDefault()
                                navigate(`/bundle/${it.itemCartaId}`)
                              }}
                            >
                              {it.title || `Bundle ${it.itemCartaId}`}
                            </a>
                            <span> — x{it.quantity} — ${Number(it.price || 0).toFixed(2)}</span>
                          </li>
                        )
                      }

                      if (it.cartaId !== undefined) {
                        return (
                          <li key={idx} className="mb-1">
                            <a
                              href={`/card/${it.cartaId}`}
                              className="text-blue-500 hover:underline"
                              onClick={(e) => {
                                e.preventDefault()
                                navigate(`/card/${it.cartaId}`)
                              }}
                            >
                              {it.title || `Carta ${it.cartaId}`}
                            </a>

                            <span>
                              {' '}
                              — x{it.quantity} — $
                              {Number(it.price || 0).toFixed(2)}
                            </span>

                            {vendedor && (
                              <span className="ml-2 text-sm text-gray-600">
                                (Vendedor:{' '}
                                <a
                                  href={`/vendedor/${vendedor.id}`}
                                  className="text-gray-600 hover:underline"
                                >
                                  {vendedor.nombre}
                                </a>
                                )
                              </span>
                            )}

                            {comp.estado === 'ENTREGADO' && vendedor && (
                              <button
                                className="ml-3 px-2 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded"
                                onClick={() =>
                                  handleOpenReview(
                                    vendedor.id,
                                    vendedor.nombre
                                  )
                                }
                              >
                                ★ Calificar
                              </button>
                            )}
                          </li>
                        )
                      }

                      return <li key={idx}>Carta id: {it.id || it}</li>
                    }
                  )}
                </ul>
              </div>
            {chatAbierto === comp.id && <Chat compraId={comp.id} />}
            </div>
          </div>
        ))}
      </div>
    </div>

    {reviewTarget && (
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        targetId={reviewTarget.id}
        targetType="vendedor"
        targetName={reviewTarget.name}
        onSuccess={() => {}}
      />
    )}
  </div>
)
}

export default Purchases
