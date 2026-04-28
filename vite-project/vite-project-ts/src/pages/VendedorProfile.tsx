import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../services/api';


export function VendedorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vendedor, setVendedor] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch vendedor details
        const sellerRes = await api.get(`/api/vendedores/${id}`);
        setVendedor(sellerRes.data.data);

        // 2. Fetch reviews
        const reviewsRes = await api.get(`/api/valoraciones/vendedor/${id}`);
        // Backend returns the array directly, so use reviewsRes.data
        // Fallback: check if it wraps in data property just in case it changes later, but prioritized array check
        const reviewsData = Array.isArray(reviewsRes.data) ? reviewsRes.data : (reviewsRes.data.data || []);
        setReviews(reviewsData);

        // 3. Fetch average
        const avgRes = await api.get(`/api/valoraciones/vendedor/${id}/average`);
        setAverage(Number(avgRes.data.average) || 0);
      } catch (error) {
        console.error('Error fetching seller profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) return <div className="loading">Cargando perfil...</div>;
  if (!vendedor) return <div className="error-msg">Vendedor no encontrado</div>;

 return (
  <div className="min-h-screen bg-green-50 py-10 px-4">
    <div className="max-w-5xl mx-auto">
      
      {/* HEADER PERFIL */}
      <div className="flex items-center gap-6 bg-white p-8 rounded-2xl shadow-md border border-green-200 mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-green-500 to-green-400 text-white rounded-full flex items-center justify-center text-4xl font-bold shadow">
          {vendedor.nombre.charAt(0).toUpperCase()}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-green-800">{vendedor.nombre}</h1>

          <p className="inline-block bg-green-100 text-green-600 px-3 py-1 rounded-full text-sm font-semibold mt-1">
            Vendedor Verificado
          </p>

          <div className="flex items-center gap-2 mt-2">
            <div className="text-yellow-400 text-lg tracking-wider">
              {'★'.repeat(Math.round(average))}
              {'☆'.repeat(5 - Math.round(average))}
            </div>
            <span className="text-gray-600 font-medium">
              ({average.toFixed(1)}) • {reviews.length} valoraciones
            </span>
          </div>
        </div>
      </div>

      {/* DESCRIPCIÓN DE COMPRA */}
      {vendedor.descripcionCompra && (
        <div className="bg-white border border-green-200 rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-green-800 mb-3 flex items-center gap-2">
            <span>📋</span> Información de retiro
          </h2>
          <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
            {vendedor.descripcionCompra}
          </p>
        </div>
      )}

      {/* PUBLICACIONES */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-green-800 border-b border-green-200 pb-2 mb-6">
          Publicaciones del Vendedor
        </h2>

        {(!vendedor.itemCartas || vendedor.itemCartas.length === 0) ? (
          <p className="text-center text-gray-500 italic py-10 bg-green-50 rounded-xl">
            Este vendedor no tiene cartas publicadas.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mb-8">
            {vendedor.itemCartas.map((item: any) => {
              if (item.estado === 'pausado' || item.stock <= 0) return null;

              const carta = item.cartas && item.cartas[0];
              if (!carta) return null;

              return (
                <div
                  key={item.id}
                  className="bg-white border border-green-200 rounded-xl p-3 shadow-sm hover:shadow-md transition"
                >
                  {carta.image && (
                    <img
                      src={carta.image}
                      alt={carta.name}
                      className="w-full h-[150px] object-contain"
                    />
                  )}

                  <h4 className="mt-2 font-semibold text-gray-800">{carta.name}</h4>

                  <p className="text-green-600 font-bold">${carta.price}</p>

                  <p className="text-sm text-gray-500 mb-2">
                    Stock: {item.stock}
                  </p>

                  <button
                    onClick={() => navigate(`/card/${carta.id}`)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-1 rounded-md transition"
                  >
                    Ver Detalle
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VALORACIONES */}
      <div>
        <h2 className="text-xl font-semibold text-green-800 border-b border-green-200 pb-2 mb-6">
          Valoraciones
        </h2>

        {reviews.length === 0 ? (
          <p className="text-center text-gray-500 italic py-10 bg-green-50 rounded-xl">
            Este vendedor aún no tiene valoraciones.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {reviews.map((review: any) => (
              <div
                key={review.id}
                className="bg-white p-5 rounded-xl border border-green-200 shadow-sm"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-semibold text-gray-800">
                    {review.usuario ? review.usuario.nombre : 'Usuario'}
                  </span>

                  <div className="text-yellow-400 text-sm">
                    {'★'.repeat(review.puntuacion)}
                    {'☆'.repeat(5 - review.puntuacion)}
                  </div>
                </div>

                {review.comentario && (
                  <p className="text-gray-600 italic">"{review.comentario}"</p>
                )}

                {review.createdAt && (
                  <small className="text-gray-400 text-xs block mt-2">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </small>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTON VOLVER */}
      <button
        className="mt-8 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-lg transition"
        onClick={() => navigate(-1)}
      >
        Volver
      </button>

    </div>
  </div>
);
}
