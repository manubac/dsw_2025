import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import { api, fetchApi } from '../services/api';

interface TiendaRetiro {
  id: number;
  nombre: string;
  direccion: string;
  horario?: string;
}

interface Publication {
  id: number;
  title: string;
  thumbnail: string;
  price: number;
  description: string;
  uploader: { id: number; nombre: string };
}

interface Review {
  id: number;
  puntuacion: number;
  comentario?: string;
  createdAt?: string;
  usuario?: { nombre: string };
}

export default function MiPerfilVendedorPage() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [vendedor, setVendedor] = useState<any>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [ventas, setVentas] = useState<any[]>([]);
  const [publicaciones, setPublicaciones] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  const [allTiendas, setAllTiendas] = useState<TiendaRetiro[]>([]);
  const [selectedTiendaIds, setSelectedTiendaIds] = useState<Set<number>>(new Set());
  const [savingTiendas, setSavingTiendas] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchAll = async () => {
      try {
        const [vendedorRes, reviewsRes, avgRes, ventasRes, pubsRes, tiendasVendedorRes, todasTiendasRes] = await Promise.all([
          api.get(`/api/vendedores/${user.id}`),
          api.get(`/api/valoraciones/vendedor/${user.id}`),
          api.get(`/api/valoraciones/vendedor/${user.id}/average`),
          api.get(`/api/vendedores/${user.id}/ventas`),
          fetchApi('/api/cartas'),
          api.get(`/api/vendedores/${user.id}/tiendas`),
          fetchApi('/api/tiendas'),
        ]);

        setVendedor(vendedorRes.data.data);

        const rawReviews = reviewsRes.data;
        setReviews(Array.isArray(rawReviews) ? rawReviews : (rawReviews.data || []));
        setAverage(Number(avgRes.data.average) || 0);
        setVentas(ventasRes.data.data || []);

        const allPubs = (await pubsRes.json()).data || [];
        setPublicaciones(
          allPubs.filter((p: Publication) => p.uploader?.id === user.id)
        );

        const vendedorTiendas: TiendaRetiro[] = tiendasVendedorRes.data.data || [];
        setSelectedTiendaIds(new Set(vendedorTiendas.map(t => t.id)));
        const todasTiendasJson = await todasTiendasRes.json();
        setAllTiendas(todasTiendasJson.data || []);
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user?.id]);

  const totalVentas = ventas.length;
  const ventasNoEnviadas = ventas.filter(v => v.estado === 'pendiente').length;
  const memberYear = vendedor?.createdAt
    ? new Date(vendedor.createdAt).getFullYear()
    : new Date().getFullYear();

  const toggleTienda = (id: number) => {
    setSelectedTiendaIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveTiendas = async () => {
    if (!user?.id) return;
    setSavingTiendas(true);
    try {
      await api.put(`/api/vendedores/${user.id}/tiendas`, { tiendaIds: [...selectedTiendaIds] });
    } catch (err) {
      console.error('Error guardando tiendas:', err);
    } finally {
      setSavingTiendas(false);
    }
  };

  const positiveReviews = reviews.filter(r => r.puntuacion >= 4).length;
  const neutralReviews = reviews.filter(r => r.puntuacion === 3).length;
  const negativeReviews = reviews.filter(r => r.puntuacion <= 2).length;
  const totalReviews = reviews.length;
  const positivePercent = totalReviews > 0 ? Math.round((positiveReviews / totalReviews) * 100) : 100;
  const neutralPercent = totalReviews > 0 ? Math.round((neutralReviews / totalReviews) * 100) : 0;
  const negativePercent = totalReviews > 0 ? Math.round((negativeReviews / totalReviews) * 100) : 0;

  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Cargando perfil...</span>
        </div>
      </div>
    );
  }

  if (!vendedor) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center text-gray-500">
        No se pudo cargar el perfil.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── PROFILE HEADER ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm overflow-hidden">

          {/* Top banner accent */}
          <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300" />

          <div className="p-6">
            {/* Avatar + Name row */}
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-md ring-2 ring-orange-200">
                {vendedor.nombre?.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-800 leading-tight">{vendedor.nombre}</h1>
                  <button
                    onClick={() => navigate('/profile')}
                    className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-full transition-all"
                  >
                    <span>✏</span>
                    <span>Editar perfil</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs bg-orange-100 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full font-medium">
                    Vendedor
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500 text-sm">Miembro desde {memberYear}</span>
                  {vendedor.ciudad && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500 text-sm">📍 {vendedor.ciudad}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Rating row */}
            <div className="mt-5 pt-4 border-t border-orange-100">
              <div className="flex flex-wrap items-center gap-5 text-sm">
                <span className="text-gray-400 font-medium text-xs uppercase tracking-wider">Evaluación</span>
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">😊</span>
                  <span className="text-green-600 font-bold">{positivePercent}%</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">😐</span>
                  <span className="text-amber-500 font-bold">{neutralPercent}%</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-lg">😟</span>
                  <span className="text-red-500 font-bold">{negativePercent}%</span>
                </span>
                {totalReviews > 0 && (
                  <span className="text-gray-400 text-xs">({totalReviews} valoraciones)</span>
                )}
              </div>
            </div>

            {/* Expandable stats */}
            <div className="mt-4">
              <button
                onClick={() => setStatsExpanded(!statsExpanded)}
                className="flex items-center gap-1.5 text-orange-500 hover:text-orange-600 text-xs font-semibold uppercase tracking-wider transition"
              >
                {statsExpanded ? 'Mostrar menos ▲' : 'Mostrar más ▼'}
              </button>

              {statsExpanded && (
                <div className="mt-4 grid grid-cols-2 gap-x-12 text-sm">
                  <div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Publicaciones activas</span>
                      <span className="text-gray-800 font-semibold">{publicaciones.length}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Valoraciones positivas</span>
                      <span className="text-green-600 font-semibold">{positiveReviews}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Alias de pago</span>
                      <span className="text-gray-800 font-semibold font-mono text-xs">{vendedor.alias || '—'}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Ventas totales</span>
                      <span className="text-gray-800 font-semibold">{totalVentas}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Ventas no enviadas</span>
                      <span className={`font-semibold ${ventasNoEnviadas > 0 ? 'text-orange-500' : 'text-gray-800'}`}>
                        {ventasNoEnviadas}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Puntuación media</span>
                      <span className="text-amber-500 font-semibold">
                        {totalReviews > 0 ? average.toFixed(1) : '—'} {'★'.repeat(Math.round(average))}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── PUBLICATIONS ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-800">Mis Publicaciones</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                {publicaciones.length}
              </span>
            </div>
            <button
              onClick={() => navigate('/publicar')}
              className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm shadow-orange-200"
            >
              + Nueva
            </button>
          </div>

          {publicaciones.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3 opacity-40">🃏</div>
              <p className="text-gray-400">No tenés publicaciones activas.</p>
              <button
                onClick={() => navigate('/publicar')}
                className="mt-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
              >
                Publicar primera carta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
              {publicaciones.map(pub => (
                <div
                  key={pub.id}
                  className="bg-amber-50 border border-orange-100 hover:border-orange-300 rounded-xl p-3 transition-all group cursor-pointer hover:shadow-md"
                  onClick={() => navigate('/editar-carta', { state: { carta: pub } })}
                >
                  <div className="relative rounded-lg overflow-hidden mb-3 bg-white border border-orange-100" style={{ aspectRatio: '3/4' }}>
                    <img
                      src={pub.thumbnail || '/placeholder-image.png'}
                      alt={pub.title}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.png'; }}
                    />
                  </div>
                  <p className="text-gray-800 text-sm font-semibold truncate leading-tight">{pub.title}</p>
                  <p className="text-orange-500 font-bold text-sm mt-0.5">${pub.price}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/editar-carta', { state: { carta: pub } });
                    }}
                    className="mt-2.5 w-full bg-white hover:bg-orange-500 border border-orange-200 hover:border-orange-500 text-gray-600 hover:text-white text-xs font-medium py-1.5 rounded-lg transition-all"
                  >
                    ✏ Editar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── TIENDAS DE RETIRO ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-800">Tiendas de retiro</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                {selectedTiendaIds.size} seleccionadas
              </span>
            </div>
            <button
              onClick={saveTiendas}
              disabled={savingTiendas}
              className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm shadow-orange-200"
            >
              {savingTiendas ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          <p className="text-sm text-gray-500 mb-4">
            Seleccioná las tiendas donde podés llevar las cartas para que el comprador las retire.
            Si no seleccionás ninguna, el comprador solo podrá coordinar el punto de encuentro por chat.
          </p>

          {allTiendas.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No hay tiendas de retiro disponibles.</p>
          ) : (
            <div className="space-y-2">
              {allTiendas.map(tienda => {
                const selected = selectedTiendaIds.has(tienda.id);
                return (
                  <label
                    key={tienda.id}
                    onClick={() => toggleTienda(tienda.id)}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selected
                        ? 'border-orange-400 bg-orange-50'
                        : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-amber-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {}}
                      className="mt-0.5 accent-orange-500 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">📍 {tienda.nombre}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{tienda.direccion}</p>
                      {tienda.horario && (
                        <p className="text-xs text-gray-400 mt-0.5">🕐 {tienda.horario}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* ── REVIEWS ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-800">Valoraciones recibidas</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                {totalReviews}
              </span>
            </div>
            {totalReviews > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-sm">
                  {'★'.repeat(Math.round(average))}{'☆'.repeat(5 - Math.round(average))}
                </span>
                <span className="text-gray-500 text-sm font-medium">{average.toFixed(1)}</span>
              </div>
            )}
          </div>

          {totalReviews === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2 opacity-40">⭐</div>
              <p>Aún no tenés valoraciones.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visibleReviews.map(review => (
                  <div
                    key={review.id}
                    className="bg-amber-50 border border-orange-100 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700 text-sm font-medium">
                        {review.usuario?.nombre || 'Usuario'}
                      </span>
                      <span className="text-amber-400 text-sm">
                        {'★'.repeat(review.puntuacion)}{'☆'.repeat(5 - review.puntuacion)}
                      </span>
                    </div>
                    {review.comentario && (
                      <p className="text-gray-500 text-sm italic mt-1">"{review.comentario}"</p>
                    )}
                    {review.createdAt && (
                      <p className="text-gray-400 text-xs mt-2">
                        {new Date(review.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {totalReviews > 3 && (
                <button
                  onClick={() => setShowAllReviews(!showAllReviews)}
                  className="mt-4 w-full py-2 text-orange-500 hover:text-orange-600 text-sm font-medium border border-orange-200 hover:border-orange-300 hover:bg-orange-50 rounded-lg transition"
                >
                  {showAllReviews
                    ? 'Mostrar menos ▲'
                    : `Ver todas las valoraciones (${totalReviews}) ▼`}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
