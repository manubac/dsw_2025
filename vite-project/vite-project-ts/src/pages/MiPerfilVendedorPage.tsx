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

interface Carta {
  id: number;
  name: string;
  price: string;
  image: string;
  rarity: string;
  setName: string;
}

interface Publication {
  id: number;
  name: string;
  description: string;
  stock: number;
  estado: string;
  cartas: Carta[];
}

interface Review {
  id: number;
  puntuacion: number;
  comentario?: string;
  createdAt?: string;
  usuario?: { username: string };
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

  // Edit perfil inline
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre: '', telefono: '', ciudad: '', alias: '', cbu: '', password: '********',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Descripción de compra
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descSaving, setDescSaving] = useState(false);
  const [descMsg, setDescMsg] = useState<string | null>(null);

  // Tiendas
  const [allTiendas, setAllTiendas] = useState<TiendaRetiro[]>([]);
  const [selectedTiendaIds, setSelectedTiendaIds] = useState<Set<number>>(new Set());
  const [savingTiendas, setSavingTiendas] = useState(false);

  // Filtros publicaciones
  const [searchName, setSearchName] = useState('');
  const [filterEstado, setFilterEstado] = useState<'all' | 'disponible' | 'pausado'>('all');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterRareza, setFilterRareza] = useState('');
  const [filterSet, setFilterSet] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    const fetchAll = async () => {
      try {
        const [vendedorRes, reviewsRes, avgRes, ventasRes, tiendasVendedorRes, todasTiendasRes] = await Promise.all([
          api.get(`/api/vendedores/${user.id}`),
          api.get(`/api/valoraciones/vendedor/${user.id}`),
          api.get(`/api/valoraciones/vendedor/${user.id}/average`),
          api.get(`/api/vendedores/${user.id}/ventas`),
          api.get(`/api/vendedores/${user.id}/tiendas`),
          fetchApi('/api/tiendas'),
        ]);

        const v = vendedorRes.data.data;
        setVendedor(v);
        setEditForm({
          nombre: v?.nombre || '',
          telefono: v?.telefono || '',
          ciudad: v?.ciudad || '',
          alias: v?.alias || '',
          cbu: v?.cbu || '',
          password: '********',
        });
        setDescDraft(v?.descripcionCompra || '');
        setPublicaciones(v?.itemCartas || []);

        const rawReviews = reviewsRes.data;
        setReviews(Array.isArray(rawReviews) ? rawReviews : (rawReviews.data || []));
        setAverage(Number(avgRes.data.average) || 0);
        setVentas(ventasRes.data.data || []);

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

  const saveEditForm = async () => {
    if (!user?.id) return;
    setEditSaving(true);
    setEditMsg(null);
    setEditError(null);
    try {
      const body: Record<string, any> = {
        nombre: editForm.nombre,
        telefono: editForm.telefono,
        ciudad: editForm.ciudad,
        alias: editForm.alias,
        cbu: editForm.cbu,
      };
      if (editForm.password !== '********' && editForm.password.trim() !== '') {
        body.password = editForm.password;
      }
      await api.patch(`/api/vendedores/${user.id}`, body);
      setVendedor((prev: any) => ({ ...prev, ...body }));
      setEditMsg('Datos actualizados correctamente.');
      setEditForm(prev => ({ ...prev, password: '********' }));
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Error al guardar.');
    } finally {
      setEditSaving(false);
    }
  };

  const saveDesc = async () => {
    if (!user?.id) return;
    setDescSaving(true);
    setDescMsg(null);
    try {
      await api.patch(`/api/vendedores/${user.id}`, { descripcionCompra: descDraft });
      setVendedor((prev: any) => ({ ...prev, descripcionCompra: descDraft }));
      setEditingDesc(false);
      setDescMsg('Descripción guardada.');
    } catch {
      setDescMsg('Error al guardar.');
    } finally {
      setDescSaving(false);
    }
  };

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

  // Filtros derivados
  const rarezasUnicas = [...new Set(
    publicaciones.flatMap(p => p.cartas.map(c => c.rarity)).filter(Boolean)
  )];
  const setsUnicos = [...new Set(
    publicaciones.flatMap(p => p.cartas.map(c => c.setName)).filter(Boolean)
  )];

  const publicacionesFiltradas = publicaciones.filter(p => {
    const carta = p.cartas?.[0];
    const precio = carta?.price ? parseFloat(String(carta.price).replace(/[^0-9.]/g, '')) : 0;
    const min = filterMinPrice !== '' ? parseFloat(filterMinPrice) : -Infinity;
    const max = filterMaxPrice !== '' ? parseFloat(filterMaxPrice) : Infinity;
    return (
      (searchName === '' || p.name?.toLowerCase().includes(searchName.toLowerCase()) ||
        carta?.name?.toLowerCase().includes(searchName.toLowerCase())) &&
      (filterEstado === 'all' || p.estado === filterEstado) &&
      precio >= min && precio <= max &&
      (filterRareza === '' || carta?.rarity === filterRareza) &&
      (filterSet === '' || carta?.setName === filterSet)
    );
  });

  const hayFiltrosActivos = searchName !== '' || filterEstado !== 'all' ||
    filterMinPrice !== '' || filterMaxPrice !== '' ||
    filterRareza !== '' || filterSet !== '';

  const limpiarFiltros = () => {
    setSearchName('');
    setFilterEstado('all');
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterRareza('');
    setFilterSet('');
  };

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
          <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300" />

          <div className="p-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-md ring-2 ring-orange-200">
                {vendedor.nombre?.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-800 leading-tight">{vendedor.nombre}</h1>
                  <button
                    onClick={() => { setEditOpen(o => !o); setEditMsg(null); setEditError(null); }}
                    className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-full transition-all"
                  >
                    <span>✏</span>
                    <span>{editOpen ? 'Cancelar edición' : 'Editar perfil'}</span>
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

            {/* ── INLINE EDIT PANEL ── */}
            {editOpen && (
              <div className="mt-6 pt-5 border-t border-orange-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Editar datos</h3>

                {editMsg && (
                  <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                    {editMsg}
                  </div>
                )}
                {editError && (
                  <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                    {editError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { name: 'nombre',   label: 'Nombre',        type: 'text' },
                    { name: 'telefono', label: 'Teléfono',       type: 'text' },
                    { name: 'ciudad',   label: 'Ciudad',         type: 'text' },
                    { name: 'alias',    label: 'Alias de pago',  type: 'text' },
                    { name: 'cbu',      label: 'CBU / CVU',      type: 'text' },
                  ] as const).map(field => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        value={editForm[field.name]}
                        onChange={e => setEditForm(prev => ({ ...prev, [field.name]: e.target.value }))}
                        disabled={editSaving}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                      />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={editForm.password}
                      onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                      disabled={editSaving}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                    />
                    <p className="text-xs text-gray-400 mt-1">Dejá sin cambios si no querés actualizar tu contraseña.</p>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={saveEditForm}
                    disabled={editSaving}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition shadow-sm shadow-orange-200"
                  >
                    {editSaving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => { setEditOpen(false); setEditMsg(null); setEditError(null); }}
                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── DESCRIPCIÓN DE COMPRA ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800">Descripción de compra</h2>
            {!editingDesc && (
              <button
                onClick={() => { setEditingDesc(true); setDescMsg(null); }}
                className="text-xs text-orange-500 hover:text-orange-600 border border-orange-200 hover:border-orange-300 px-3 py-1.5 rounded-full transition"
              >
                ✏ Editar
              </button>
            )}
          </div>

          <p className="text-xs text-gray-400 mb-3">
            Información que verán los compradores sobre tus lugares y días de retiro.
          </p>

          {descMsg && (
            <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              {descMsg}
            </div>
          )}

          {editingDesc ? (
            <>
              <textarea
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                rows={4}
                disabled={descSaving}
                placeholder={`Ej: Manga Couple Store voy los lunes y miércoles\nPuro Comic voy los miércoles y viernes`}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition resize-none disabled:opacity-60"
              />
              <div className="flex gap-3 mt-3">
                <button
                  onClick={saveDesc}
                  disabled={descSaving}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition"
                >
                  {descSaving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  onClick={() => { setEditingDesc(false); setDescDraft(vendedor?.descripcionCompra || ''); setDescMsg(null); }}
                  className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-1.5 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${vendedor?.descripcionCompra ? 'text-gray-700' : 'text-gray-400 italic'}`}>
              {vendedor?.descripcionCompra || 'Todavía no agregaste información de retiro para tus compradores.'}
            </p>
          )}
        </div>

        {/* ── PUBLICATIONS ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-gray-800">Mis Publicaciones</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
                {publicacionesFiltradas.length}{hayFiltrosActivos ? ` de ${publicaciones.length}` : ''}
              </span>
            </div>
            <button
              onClick={() => navigate('/publicar')}
              className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition shadow-sm shadow-orange-200"
            >
              + Nueva
            </button>
          </div>

          {/* Filtros */}
          <div className="space-y-3 mb-4">
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition"
            />

            <div className="flex flex-wrap gap-2 items-center">
              {(['all', 'disponible', 'pausado'] as const).map(estado => (
                <button
                  key={estado}
                  onClick={() => setFilterEstado(estado)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition ${
                    filterEstado === estado
                      ? 'bg-orange-500 border-orange-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-orange-300'
                  }`}
                >
                  {estado === 'all' ? 'Todas' : estado.charAt(0).toUpperCase() + estado.slice(1)}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  placeholder="$ min"
                  value={filterMinPrice}
                  onChange={e => setFilterMinPrice(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 transition"
                />
                <span className="text-gray-400 text-xs">—</span>
                <input
                  type="number"
                  placeholder="$ max"
                  value={filterMaxPrice}
                  onChange={e => setFilterMaxPrice(e.target.value)}
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-orange-400 transition"
                />
              </div>
            </div>

            <div className="flex gap-3 flex-wrap items-center">
              <select
                value={filterRareza}
                onChange={e => setFilterRareza(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-400 transition bg-white"
              >
                <option value="">Rareza: todas</option>
                {rarezasUnicas.map(r => <option key={r} value={r}>{r}</option>)}
              </select>

              <select
                value={filterSet}
                onChange={e => setFilterSet(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-400 transition bg-white"
              >
                <option value="">Set: todos</option>
                {setsUnicos.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {hayFiltrosActivos && (
                <button
                  onClick={limpiarFiltros}
                  className="text-xs text-orange-500 hover:text-orange-600 border border-orange-200 px-3 py-1.5 rounded-full transition"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          {/* Grilla */}
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
          ) : publicacionesFiltradas.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3 opacity-40">🔍</div>
              <p className="text-gray-400">No hay publicaciones que coincidan con los filtros.</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                {publicacionesFiltradas.map(pub => {
                  const carta = pub.cartas[0];
                  return (
                    <div
                      key={pub.id}
                      className="bg-amber-50 border border-orange-100 hover:border-orange-300 rounded-xl p-3 transition-all group cursor-pointer hover:shadow-md"
                      onClick={() => navigate('/editar-carta', { state: { carta: pub } })}
                    >
                      <div className="relative rounded-lg overflow-hidden mb-3 bg-white border border-orange-100" style={{ aspectRatio: '3/4' }}>
                        <img
                          src={carta?.image || '/placeholder-image.png'}
                          alt={pub.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.png'; }}
                        />
                      </div>
                      <p className="text-gray-800 text-sm font-semibold truncate leading-tight">{pub.name}</p>
                      {carta && <p className="text-orange-500 font-bold text-sm mt-0.5">${carta.price}</p>}
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full font-medium ${
                        pub.estado === 'disponible'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {pub.estado}
                      </span>
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
                  );
                })}
              </div>
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
                  <div key={review.id} className="bg-amber-50 border border-orange-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-700 text-sm font-medium">
                        {review.usuario?.username || 'Usuario'}
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
