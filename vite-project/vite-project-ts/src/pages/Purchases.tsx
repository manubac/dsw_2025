import React, { useEffect, useState } from 'react'
import { useUser } from '../context/user'
import { useNavigate } from 'react-router-dom'
import { ReviewModal } from '../components/ReviewModal';
import { fetchApi } from '../services/api';


export function Purchases() {
  const { user } = useUser()
  const navigate = useNavigate()
  const [compras, setCompras] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{id: number, name: string} | null>(null);

  const handleOpenReview = (vendedorId: number, vendedorName: string) => {
      setReviewTarget({ id: vendedorId, name: vendedorName });
      setReviewModalOpen(true);
  }

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
  if (user.role !== 'usuario') {
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
                <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                  {comp.estado}
                </span>

                {comp.envio && (
                  <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs">
                    Envío: {comp.envio.estado}
                  </span>
                )}
              </div>
            </div>

            <div>
              <p>
                <strong>Total:</strong> ${Number(comp.total || 0).toFixed(2)}
              </p>

              <p>
                <strong>Contacto:</strong> {comp.nombre} — {comp.email}
              </p>

              <p>
                <strong>Dirección:</strong>{' '}
                {comp.direccionEntrega
                  ? `${comp.direccionEntrega.calle} ${comp.direccionEntrega.altura}${
                      comp.direccionEntrega.departamento
                        ? `, ${comp.direccionEntrega.departamento}`
                        : ''
                    }, ${comp.direccionEntrega.ciudad}, ${comp.direccionEntrega.provincia} - CP: ${comp.direccionEntrega.codigoPostal}`
                  : 'No especificada'}
              </p>

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
