import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { CancelacionStats } from '../components/CancelacionStats';

interface HorarioDia {
  abre: string;
  cierra: string;
  cerrado: boolean;
}

interface HorarioSemanal {
  lunes: HorarioDia;
  martes: HorarioDia;
  miercoles: HorarioDia;
  jueves: HorarioDia;
  viernes: HorarioDia;
  sabado: HorarioDia;
  domingo: HorarioDia;
}

interface ItemCarta {
  id: number;
  stock: number;
  estado: string;
  price: number;
}

interface Carta {
  id: number;
  name: string;
  price: number;
  rarity?: string;
  setName?: string;
  image?: string;
  items: ItemCarta[];
}

interface Tienda {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  ciudad?: string;
  direccion: string;
  activo: boolean;
  horario: HorarioSemanal;
  descripcionCompra?: string;
}

interface Review {
  id: number;
  puntuacion: number;
  comentario?: string;
  createdAt?: string;
  usuario?: { nombre: string };
}

const DIAS_LABELS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

const DIAS_ORDER = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

export function TiendaProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [publicaciones, setPublicaciones] = useState<Carta[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchName, setSearchName] = useState('');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [filterRarity, setFilterRarity] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const tiendaRes = await api.get(`/api/tiendas/${id}`);
        setTienda(tiendaRes.data.data);
      } catch {
        setLoading(false);
        return;
      }

      try {
        const [reviewsRes, avgRes, pubRes] = await Promise.all([
          api.get(`/api/valoraciones/tiendaRetiro/${id}`),
          api.get(`/api/valoraciones/tiendaRetiro/${id}/average`),
          api.get(`/api/tiendas/${id}/publicaciones`),
        ]);

        const reviewsData = Array.isArray(reviewsRes.data)
          ? reviewsRes.data
          : reviewsRes.data.data || [];
        setReviews(reviewsData);
        setAverage(Number(avgRes.data.average) || 0);

        const pubData = Array.isArray(pubRes.data)
          ? pubRes.data
          : pubRes.data.data || [];
        setPublicaciones(pubData);
      } catch {
        console.error('Error fetching secondary tienda data');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) return <div className="p-10 text-center text-gray-600">Cargando tienda...</div>;
  if (!tienda) return <div className="p-10 text-center text-red-500">Tienda no encontrada</div>;

  // Only show publications with at least one active item with stock
  const activePublicaciones = publicaciones.filter(carta =>
    carta.items?.some(item => item.estado !== 'pausado' && item.stock > 0)
  );

  // Unique rarities for dropdown
  const uniqueRarities = Array.from(
    new Set(activePublicaciones.map(c => c.rarity).filter(Boolean) as string[])
  );

  // Apply filters
  const filtered = activePublicaciones.filter(carta => {
    const matchesName = carta.name.toLowerCase().includes(searchName.toLowerCase());
    const price = carta.items?.[0]?.price ?? carta.price ?? 0;
    const matchesMin = minPrice === '' || Number(price) >= Number(minPrice);
    const matchesMax = maxPrice === '' || Number(price) <= Number(maxPrice);
    const matchesRarity = filterRarity === '' || carta.rarity === filterRarity;
    return matchesName && matchesMin && matchesMax && matchesRarity;
  });

  const horario: HorarioSemanal | null = tienda.horario || null;

  return (
    <div className="min-h-screen bg-blue-50 py-10 px-4">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center gap-6 bg-white p-8 rounded-2xl shadow-md border border-blue-200 mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-600 to-blue-500 text-white rounded-full flex items-center justify-center text-4xl font-bold shadow flex-shrink-0">
            {tienda.nombre.charAt(0).toUpperCase()}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-indigo-800">{tienda.nombre}</h1>

            <p className="inline-block bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-sm font-semibold mt-1">
              Tienda Verificada
            </p>

            <div className="flex items-center gap-2 mt-2">
              <div className="text-yellow-400 text-lg tracking-wider">
                {(stars => <>{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</>)(Math.min(5, Math.max(0, Math.round(average))))}
              </div>
              <span className="text-gray-600 font-medium">
                ({average.toFixed(1)}) • {reviews.length} valoraciones
              </span>
            </div>
          </div>
        </div>

        {/* CANCELACIÓN STATS */}
        <CancelacionStats actorTipo="tiendaRetiro" actorId={Number(id)} />

        {/* INFO PANEL */}
        <div className="bg-white border border-blue-200 rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-indigo-800 mb-4">Información de la Tienda</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm text-gray-700">
            {tienda.ciudad && (
              <div>
                <span className="font-semibold text-gray-500">Ciudad:</span>{' '}
                {tienda.ciudad}
              </div>
            )}
            {tienda.telefono && (
              <div>
                <span className="font-semibold text-gray-500">Teléfono:</span>{' '}
                {tienda.telefono}
              </div>
            )}
            {tienda.direccion && (
              <div className="sm:col-span-2">
                <span className="font-semibold text-gray-500">Dirección:</span>{' '}
                {tienda.direccion}
              </div>
            )}
            {tienda.descripcionCompra && (
              <div className="sm:col-span-2">
                <span className="font-semibold text-gray-500">Descripción:</span>{' '}
                <span className="whitespace-pre-wrap">{tienda.descripcionCompra}</span>
              </div>
            )}
          </div>

          {/* Horario table */}
          {horario && (
            <>
              <h3 className="text-md font-semibold text-indigo-700 mb-3">Horario</h3>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {DIAS_ORDER.map(dia => {
                    const diaData = horario[dia as keyof HorarioSemanal];
                    return (
                      <tr key={dia} className="border-b border-blue-50 last:border-0">
                        <td className="py-2 pr-4 font-medium text-gray-700 w-32">
                          {DIAS_LABELS[dia]}
                        </td>
                        <td className="py-2 text-gray-600">
                          {diaData?.cerrado
                            ? <span className="text-red-400">Cerrado</span>
                            : <span>{diaData?.abre} – {diaData?.cierra}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* GOOGLE MAPS EMBED */}
        {tienda.direccion && (
          <div className="bg-white border border-blue-200 rounded-2xl p-4 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-indigo-800 mb-3">Ubicación</h2>
            <iframe
              src={`https://maps.google.com/maps?q=${encodeURIComponent(tienda.direccion)}&output=embed`}
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              title="Ubicación de la tienda"
              className="rounded-lg"
            />
          </div>
        )}

        {/* PUBLICACIONES */}
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-indigo-800 border-b border-blue-200 pb-2 mb-5">
            Publicaciones de la Tienda
          </h2>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 flex-1 min-w-[160px]"
            />
            <input
              type="number"
              placeholder="Precio mínimo"
              value={minPrice}
              onChange={e => setMinPrice(e.target.value)}
              className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
            />
            <input
              type="number"
              placeholder="Precio máximo"
              value={maxPrice}
              onChange={e => setMaxPrice(e.target.value)}
              className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-36"
            />
            {uniqueRarities.length > 0 && (
              <select
                value={filterRarity}
                onChange={e => setFilterRarity(e.target.value)}
                className="border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 w-44"
              >
                <option value="">Todas las rarezas</option>
                {uniqueRarities.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>

          {filtered.length === 0 ? (
            <p className="text-center text-gray-500 italic py-10 bg-blue-50 rounded-xl">
              No hay publicaciones disponibles.
            </p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {filtered.map(carta => {
                  const activeItem = carta.items?.find(
                    item => item.estado !== 'pausado' && item.stock > 0
                  );
                  const displayPrice = activeItem?.price ?? carta.price ?? 0;
                  const totalStock = carta.items
                    ?.filter(item => item.estado !== 'pausado')
                    .reduce((sum, item) => sum + item.stock, 0) ?? 0;

                  return (
                    <div
                      key={carta.id}
                      className="bg-white border border-blue-200 rounded-xl p-3 shadow-sm hover:shadow-md transition flex flex-col"
                    >
                      {carta.image && (
                        <img
                          src={carta.image}
                          alt={carta.name}
                          className="w-full h-[150px] object-contain mb-2"
                        />
                      )}

                      <h4 className="font-semibold text-gray-800 text-sm leading-tight mb-1">
                        {carta.name}
                      </h4>

                      {carta.rarity && (
                        <p className="text-xs text-gray-400 mb-1">{carta.rarity}</p>
                      )}

                      <p className="text-indigo-600 font-bold mb-1">${displayPrice}</p>

                      <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full mb-3 w-fit">
                        Stock: {totalStock}
                      </span>

                      <button
                        onClick={() => navigate(`/card/${carta.id}`)}
                        className="mt-auto w-full bg-indigo-500 hover:bg-indigo-600 text-white py-1.5 rounded-md text-sm transition"
                      >
                        Ver Detalle
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* VALORACIONES */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-indigo-800 border-b border-blue-200 pb-2 mb-6">
            Valoraciones
          </h2>

          {reviews.length === 0 ? (
            <p className="text-center text-gray-500 italic py-10 bg-blue-50 rounded-xl">
              Esta tienda aún no tiene valoraciones.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {reviews.map((review: any) => (
                <div
                  key={review.id}
                  className="bg-white p-5 rounded-xl border border-blue-200 shadow-sm"
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

        {/* VOLVER */}
        <button
          className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold px-6 py-2 rounded-lg transition"
          onClick={() => navigate(-1)}
        >
          Volver
        </button>

      </div>
    </div>
  );
}
