import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import { fetchApi } from '../services/api';
import { Chat } from '../components/Chat';
import { ReviewModal } from '../components/ReviewModal';

export default function MiPerfilTiendaRetiroPage() {
  const { user } = useUser();
  const navigate = useNavigate();

  const [tienda, setTienda]     = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const [formData, setFormData] = useState({
    nombre:    '',
    email:     '',
    direccion: '',
    horario:   '',
    ciudad:    '',
    activo:    true,
  });
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edición rápida de horario
  const [editingHorario, setEditingHorario] = useState(false);
  const [horarioDraft, setHorarioDraft]     = useState('');
  const [horarioSaving, setHorarioSaving]   = useState(false);
  const [horarioMsg, setHorarioMsg]         = useState<string | null>(null);

  // Publicaciones
  const [publicaciones, setPublicaciones] = useState<any[]>([])
  const [pubLoading, setPubLoading]       = useState(false)
  const [showPubForm, setShowPubForm]     = useState(false)
  const [editingPub, setEditingPub]       = useState<any | null>(null)
  const [pubForm, setPubForm]             = useState({
    name: '', price: '', rarity: '', setName: '', description: '', stock: '1', estado: 'disponible',
  })
  const [pubSaving, setPubSaving]   = useState(false)
  const [pubMsg, setPubMsg]         = useState<string | null>(null)
  const [pubError, setPubError]     = useState<string | null>(null)

  // Descripción de compra
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft]     = useState('');
  const [descSaving, setDescSaving]   = useState(false);
  const [descMsg, setDescMsg]         = useState<string | null>(null);

  // Filtros publicaciones
  const [searchName, setSearchName]         = useState('');
  const [filterEstado, setFilterEstado]     = useState<'all' | 'disponible' | 'pausado'>('all');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterRareza, setFilterRareza]     = useState('');
  const [filterSet, setFilterSet]           = useState('');

  // Ventas directas
  const [ventas, setVentas]               = useState<any[]>([])
  const [ventasLoading, setVentasLoading] = useState(false)
  const [finalizando, setFinalizando]     = useState<number | null>(null)
  const [ventaMsg, setVentaMsg]           = useState<string | null>(null)

  // Tab activo del panel
  const [activeTab, setActiveTab] = useState<'publicaciones' | 'ventas' | 'compras'>('publicaciones');

  // Mis Compras (tienda comprando)
  const [misCompras, setMisCompras]         = useState<any[]>([]);
  const [comprasLoading, setComprasLoading] = useState(false);
  const [chatAbierto, setChatAbierto]       = useState<number | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget]     = useState<{ id: number; name: string; type: 'vendedor' | 'tiendaRetiro' | 'user'; compraId: number } | null>(null);
  const [reviewedMap, setReviewedMap]       = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user?.id) return;

    const fetchAll = async () => {
      try {
        const tiendaRes = await fetchApi(`/api/tiendas/${user.id}`);
        const json = await tiendaRes.json();
        const t = json.data;
        setTienda(t);
        setFormData({
          nombre:    t?.nombre    ?? '',
          email:     t?.email     ?? '',
          direccion: t?.direccion ?? '',
          horario:   t?.horario   ?? '',
          ciudad:    t?.ciudad    ?? '',
          activo:    t?.activo    ?? true,
        });
        setHorarioDraft(t?.horario ?? '');
        setDescDraft(t?.descripcionCompra ?? '');

        // Cargar publicaciones, ventas directas, compras y reviews en paralelo
        setPubLoading(true)
        setVentasLoading(true)
        setComprasLoading(true)
        const [pubRes, ventasRes, comprasRes, misReviewsRes] = await Promise.all([
          fetchApi(`/api/tiendas/${user.id}/publicaciones`),
          fetchApi(`/api/tiendas/${user.id}/ventas-directas`),
          fetchApi('/api/compras'),
          fetchApi('/api/valoraciones/mias'),
        ])
        const pubJson     = await pubRes.json()
        const ventasJson  = await ventasRes.json()
        const comprasJson = await comprasRes.json()
        const reviewsJson = await misReviewsRes.json()
        setPublicaciones(pubJson.data ?? [])
        setVentas(ventasJson.data ?? [])
        setMisCompras(comprasJson.data ?? [])
        const map: Record<string, number> = {};
        for (const v of (reviewsJson.data || [])) {
          if (v.compra?.id != null) map[`${v.compra.id}_${v.tipoObjeto}_${v.objetoId}`] = v.puntuacion;
        }
        setReviewedMap(map)
        setPubLoading(false)
        setVentasLoading(false)
        setComprasLoading(false)
      } catch (err) {
        console.error('Error loading tienda profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const memberYear = tienda?.createdAt
    ? new Date(tienda.createdAt).getFullYear()
    : new Date().getFullYear();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const response = await fetchApi(`/api/tiendas/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Error al actualizar.');
      setTienda((prev: any) => ({ ...prev, ...formData }));
      setHorarioDraft(formData.horario);
      setSaveMsg('Datos actualizados correctamente.');
    } catch (err: any) {
      setSaveError(err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const saveHorario = async () => {
    if (!user?.id) return;
    setHorarioSaving(true);
    setHorarioMsg(null);
    try {
      const response = await fetchApi(`/api/tiendas/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horario: horarioDraft }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Error al actualizar.');
      setTienda((prev: any) => ({ ...prev, horario: horarioDraft }));
      setFormData(prev => ({ ...prev, horario: horarioDraft }));
      setEditingHorario(false);
      setHorarioMsg('Horario actualizado.');
    } catch (err: any) {
      setHorarioMsg(`Error: ${err.message}`);
    } finally {
      setHorarioSaving(false);
    }
  };

  const saveDesc = async () => {
    if (!user?.id) return;
    setDescSaving(true);
    setDescMsg(null);
    try {
      const res = await fetchApi(`/api/tiendas/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descripcionCompra: descDraft }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setTienda((prev: any) => ({ ...prev, descripcionCompra: descDraft }));
      setEditingDesc(false);
      setDescMsg('Descripción guardada.');
    } catch {
      setDescMsg('Error al guardar.');
    } finally {
      setDescSaving(false);
    }
  };

  const resetPubForm = () => {
    setPubForm({ name: '', price: '', rarity: '', setName: '', description: '', stock: '1', estado: 'disponible' })
    setEditingPub(null)
    setShowPubForm(false)
    setPubMsg(null)
    setPubError(null)
  }

  const handlePubChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setPubForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSavePub = async () => {
    if (!user?.id) return
    setPubSaving(true)
    setPubMsg(null)
    setPubError(null)
    try {
      const body = {
        name:        pubForm.name,
        price:       Number(pubForm.price),
        rarity:      pubForm.rarity || undefined,
        setName:     pubForm.setName || undefined,
        description: pubForm.description,
        stock:       Number(pubForm.stock),
        estado:      pubForm.estado,
      }
      if (editingPub) {
        const res = await fetchApi(`/api/tiendas/${user.id}/publicaciones/${editingPub.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error((await res.json()).message)
        setPublicaciones(prev => prev.map(p => p.id === editingPub.id ? { ...p, ...body } : p))
      } else {
        const res = await fetchApi(`/api/tiendas/${user.id}/publicaciones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.message)
        setPublicaciones(prev => [json.data, ...prev])
      }
      setPubMsg(editingPub ? 'Publicación actualizada.' : 'Publicación creada.')
      resetPubForm()
    } catch (err: any) {
      setPubError(err.message || 'Error al guardar.')
    } finally {
      setPubSaving(false)
    }
  }

  const handleEditPub = (pub: any) => {
    const item = pub.items?.[0]
    setPubForm({
      name:        pub.name        ?? '',
      price:       pub.price       ?? '',
      rarity:      pub.rarity      ?? '',
      setName:     pub.setName     ?? '',
      description: item?.description ?? '',
      stock:       String(item?.stock ?? 1),
      estado:      item?.estado    ?? 'disponible',
    })
    setEditingPub(pub)
    setShowPubForm(true)
    setPubMsg(null)
    setPubError(null)
  }

  const handleDeletePub = async (cartaId: number) => {
    if (!user?.id) return
    if (!confirm('¿Eliminar esta publicación?')) return
    try {
      const res = await fetchApi(`/api/tiendas/${user.id}/publicaciones/${cartaId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).message)
      setPublicaciones(prev => prev.filter(p => p.id !== cartaId))
    } catch (err: any) {
      alert(err.message || 'Error al eliminar')
    }
  }

  const handleMarcarListo = async (compraId: number) => {
    if (!user?.id) return;
    if (!confirm('¿Confirmás que la carta está lista para que el comprador la retire?')) return;
    setFinalizando(compraId);
    setVentaMsg(null);
    try {
      const res = await fetchApi(`/api/tiendas/${user.id}/ventas-directas/${compraId}/listo`, { method: 'PATCH' });
      if (!res.ok) throw new Error((await res.json()).message);
      setVentas(prev => prev.map(v => v.id === compraId ? { ...v, estado: 'listo_para_retirar' } : v));
      setVentaMsg(`Orden #${compraId} marcada como lista para retirar.`);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar');
    } finally {
      setFinalizando(null);
    }
  };

  const handleFinalizarVenta = async (compraId: number) => {
    if (!user?.id) return;
    if (!confirm('¿Confirmás que el comprador pagó y retiró el pedido?')) return;
    setFinalizando(compraId);
    setVentaMsg(null);
    try {
      const res = await fetchApi(`/api/tiendas/${user.id}/ventas-directas/${compraId}/finalizar`, { method: 'PATCH' });
      if (!res.ok) throw new Error((await res.json()).message);
      setVentas(prev => prev.map(v => v.id === compraId ? { ...v, estado: 'finalizado' } : v));
      setVentaMsg(`Orden #${compraId} finalizada.`);
    } catch (err: any) {
      alert(err.message || 'Error al finalizar');
    } finally {
      setFinalizando(null);
    }
  };

  const rarezasUnicas = [...new Set(publicaciones.map((p: any) => p.rarity).filter(Boolean))];
  const setsUnicos    = [...new Set(publicaciones.map((p: any) => p.setName).filter(Boolean))];

  const publicacionesFiltradas = publicaciones.filter((p: any) => {
    const precio = p.price ? parseFloat(String(p.price).replace(/[^0-9.]/g, '')) : 0;
    const min = filterMinPrice !== '' ? parseFloat(filterMinPrice) : -Infinity;
    const max = filterMaxPrice !== '' ? parseFloat(filterMaxPrice) : Infinity;
    const item = p.items?.[0];
    return (
      (searchName === '' || p.name?.toLowerCase().includes(searchName.toLowerCase())) &&
      (filterEstado === 'all' || item?.estado === filterEstado) &&
      precio >= min && precio <= max &&
      (filterRareza === '' || p.rarity === filterRareza) &&
      (filterSet === '' || p.setName === filterSet)
    );
  });

  const hayFiltrosActivos = searchName !== '' || filterEstado !== 'all' ||
    filterMinPrice !== '' || filterMaxPrice !== '' ||
    filterRareza !== '' || filterSet !== '';

  const limpiarFiltros = () => {
    setSearchName(''); setFilterEstado('all');
    setFilterMinPrice(''); setFilterMaxPrice('');
    setFilterRareza(''); setFilterSet('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Cargando perfil...</span>
        </div>
      </div>
    );
  }

  if (!tienda) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center text-gray-500">
        No se pudo cargar el perfil.
      </div>
    );
  }

  const initial = tienda.nombre?.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── PROFILE HEADER ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300" />

          <div className="p-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-md ring-2 ring-orange-200">
                {initial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-800 leading-tight">{tienda.nombre}</h1>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                    tienda.activo
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}>
                    {tienda.activo ? 'Activa' : 'Inactiva'}
                  </span>
                  <button
                    onClick={() => { setEditOpen(o => !o); setSaveMsg(null); setSaveError(null); }}
                    className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-full transition-all"
                  >
                    <span>✏</span>
                    <span>{editOpen ? 'Cancelar edición' : 'Editar perfil'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
                  <span className="text-xs bg-orange-100 text-orange-600 border border-orange-200 px-2.5 py-0.5 rounded-full font-medium">
                    Tienda de Retiro
                  </span>
                  <span className="text-gray-300">·</span>
                  <span>Miembro desde {memberYear}</span>
                  {tienda.ciudad && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>📍 {tienda.ciudad}</span>
                    </>
                  )}
                  {tienda.direccion && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>{tienda.direccion}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ── INLINE EDIT PANEL ── */}
            {editOpen && (
              <div className="mt-6 pt-5 border-t border-orange-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wider">Editar datos</h3>

                {saveMsg && (
                  <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                    {saveMsg}
                  </div>
                )}
                {saveError && (
                  <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                    {saveError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {([
                    { name: 'nombre',    label: 'Nombre de la tienda', type: 'text'  },
                    { name: 'email',     label: 'Email',               type: 'email' },
                    { name: 'direccion', label: 'Dirección',           type: 'text'  },
                    { name: 'horario',   label: 'Horario',             type: 'text'  },
                    { name: 'ciudad',    label: 'Ciudad',              type: 'text'  },
                  ] as const).map(field => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={formData[field.name] as string}
                        onChange={handleChange}
                        disabled={saving}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                      />
                    </div>
                  ))}

                  <div className="flex items-center gap-3 pt-5">
                    <input
                      type="checkbox"
                      id="activo"
                      name="activo"
                      checked={formData.activo}
                      onChange={handleChange}
                      disabled={saving}
                      className="accent-orange-500 w-4 h-4"
                    />
                    <label htmlFor="activo" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Tienda activa (visible para compradores)
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition shadow-sm shadow-orange-200"
                  >
                    {saving ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => { setEditOpen(false); setSaveMsg(null); setSaveError(null); }}
                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── MI TIENDA DE RETIRO ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Mi tienda de retiro</h2>

          <div className="bg-amber-50 border border-orange-100 rounded-lg p-4">
            <p className="text-sm font-semibold text-gray-800">📍 {tienda.nombre}</p>
            {tienda.direccion && <p className="text-xs text-gray-500 mt-1">{tienda.direccion}</p>}
            {tienda.ciudad && <p className="text-xs text-gray-400 mt-0.5">{tienda.ciudad}</p>}

            <div className="mt-3 pt-3 border-t border-orange-100">
              <p className="text-xs font-medium text-gray-600 mb-2">Horario de atención</p>

              {horarioMsg && (
                <div className="mb-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1.5">
                  {horarioMsg}
                </div>
              )}

              {editingHorario ? (
                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="text"
                    value={horarioDraft}
                    onChange={e => setHorarioDraft(e.target.value)}
                    disabled={horarioSaving}
                    placeholder="Ej: Lun-Vie 10-20hs, Sáb 10-14hs"
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                  />
                  <button
                    onClick={saveHorario}
                    disabled={horarioSaving}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    {horarioSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => { setEditingHorario(false); setHorarioDraft(tienda.horario || ''); setHorarioMsg(null); }}
                    className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">
                    {tienda.horario
                      ? `🕐 ${tienda.horario}`
                      : <span className="text-gray-400 italic text-xs">Sin horario cargado</span>}
                  </span>
                  <button
                    onClick={() => { setEditingHorario(true); setHorarioMsg(null); }}
                    className="text-xs text-orange-500 hover:text-orange-600 border border-orange-200 px-2 py-1 rounded-full transition"
                  >
                    ✏ Editar
                  </button>
                </div>
              )}
            </div>
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
            <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{descMsg}</div>
          )}

          {editingDesc ? (
            <>
              <textarea
                value={descDraft}
                onChange={e => setDescDraft(e.target.value)}
                rows={4}
                disabled={descSaving}
                placeholder={`Ej: Podés retirar tu pedido en la tienda de Lunes a Viernes de 10 a 20hs.`}
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
                  onClick={() => { setEditingDesc(false); setDescDraft(tienda?.descripcionCompra || ''); setDescMsg(null); }}
                  className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium px-4 py-1.5 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </>
          ) : (
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${tienda?.descripcionCompra ? 'text-gray-700' : 'text-gray-400 italic'}`}>
              {tienda?.descripcionCompra || 'Todavía no agregaste información de retiro para tus compradores.'}
            </p>
          )}
        </div>

        {/* ── TAB SELECTOR ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-4">
          <div className="flex gap-2">
            {(['publicaciones', 'ventas', 'compras'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === tab
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab === 'publicaciones' ? 'Publicaciones' : tab === 'ventas' ? 'Mis Ventas' : 'Mis Compras'}
              </button>
            ))}
          </div>
        </div>

        {/* ── MIS PUBLICACIONES ── */}
        {activeTab === 'publicaciones' && (<>
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

          {pubMsg && (
            <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{pubMsg}</div>
          )}

          {/* Formulario inline solo para editar */}
          {showPubForm && editingPub && (
            <div className="mb-6 p-4 bg-amber-50 border border-orange-100 rounded-xl">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Editar publicación</h3>
              {pubError && (
                <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{pubError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'name',    label: 'Nombre de la carta *', type: 'text'   },
                  { name: 'price',   label: 'Precio ($) *',         type: 'number' },
                  { name: 'stock',   label: 'Stock *',              type: 'number' },
                  { name: 'rarity',  label: 'Rareza',               type: 'text'   },
                  { name: 'setName', label: 'Set',                  type: 'text'   },
                ].map(f => (
                  <div key={f.name}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                    <input
                      type={f.type}
                      name={f.name}
                      value={(pubForm as any)[f.name]}
                      onChange={handlePubChange}
                      disabled={pubSaving}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                  <select
                    name="estado"
                    value={pubForm.estado}
                    onChange={handlePubChange}
                    disabled={pubSaving}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                  >
                    <option value="disponible">Disponible</option>
                    <option value="pausado">Pausado</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                  <textarea
                    name="description"
                    value={pubForm.description}
                    onChange={handlePubChange}
                    disabled={pubSaving}
                    rows={2}
                    placeholder="Estado de la carta, condición, etc."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={handleSavePub}
                  disabled={pubSaving}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
                >
                  {pubSaving ? 'Guardando...' : 'Actualizar'}
                </button>
                <button
                  onClick={resetPubForm}
                  className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

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
                {rarezasUnicas.map((r: string) => <option key={r} value={r}>{r}</option>)}
              </select>

              <select
                value={filterSet}
                onChange={e => setFilterSet(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-orange-400 transition bg-white"
              >
                <option value="">Set: todos</option>
                {setsUnicos.map((s: string) => <option key={s} value={s}>{s}</option>)}
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
          {pubLoading ? (
            <p className="text-sm text-gray-400">Cargando...</p>
          ) : publicaciones.length === 0 ? (
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
                {publicacionesFiltradas.map((pub: any) => {
                  const item = pub.items?.[0];
                  return (
                    <div
                      key={pub.id}
                      className="bg-amber-50 border border-orange-100 hover:border-orange-300 rounded-xl p-3 transition-all group cursor-pointer hover:shadow-md"
                      onClick={() => handleEditPub(pub)}
                    >
                      <div className="relative rounded-lg overflow-hidden mb-3 bg-white border border-orange-100" style={{ aspectRatio: '3/4' }}>
                        <img
                          src={pub.image || '/placeholder-image.png'}
                          alt={pub.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-image.png'; }}
                        />
                      </div>
                      <p className="text-gray-800 text-sm font-semibold truncate leading-tight">{pub.name}</p>
                      <p className="text-orange-500 font-bold text-sm mt-0.5">${pub.price}</p>
                      <span className={`text-xs mt-1 inline-block px-2 py-0.5 rounded-full font-medium ${
                        item?.estado === 'disponible'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {item?.estado ?? '—'}
                      </span>
                      <div className="flex gap-1.5 mt-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditPub(pub); }}
                          className="flex-1 bg-white hover:bg-orange-500 border border-orange-200 hover:border-orange-500 text-gray-600 hover:text-white text-xs font-medium py-1.5 rounded-lg transition-all"
                        >
                          ✏ Editar
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePub(pub.id); }}
                          className="bg-white hover:bg-red-50 border border-red-200 text-red-400 hover:text-red-600 text-xs px-2 py-1.5 rounded-lg transition-all"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── VALORACIONES (placeholder) ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5">Valoraciones recibidas</h2>
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2 opacity-40">⭐</div>
            <p>Próximamente: valoraciones de compradores.</p>
          </div>
        </div>
        </>)}

        {/* ── MIS VENTAS (ventas directas) ── */}
        {activeTab === 'ventas' && (
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5">Mis Ventas</h2>
          {ventaMsg && (
            <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{ventaMsg}</div>
          )}
          {ventasLoading ? (
            <p className="text-sm text-gray-400">Cargando...</p>
          ) : ventas.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-2 opacity-30">🏪</div>
              <p className="text-gray-400 text-sm">No tenés ventas directas aún.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ventas.map((venta: any) => (
                <div key={venta.id} className="p-4 border border-gray-100 rounded-xl hover:border-orange-200 transition">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Orden #{venta.id}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {venta.nombre} · {venta.email}
                        {venta.telefono && ` · ${venta.telefono}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(venta.createdAt).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                        venta.estado === 'finalizado'           ? 'bg-green-100 text-green-700 border-green-200'
                        : venta.estado === 'listo_para_retirar' ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      }`}>
                        {venta.estado === 'finalizado'            ? 'Finalizado'
                          : venta.estado === 'listo_para_retirar' ? 'Listo para retirar'
                          : 'Pendiente'}
                      </span>
                      {venta.estado === 'pendiente' && (
                        <button
                          onClick={() => handleMarcarListo(venta.id)}
                          disabled={finalizando === venta.id}
                          className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold px-3 py-1 rounded-lg transition"
                        >
                          {finalizando === venta.id ? '...' : 'Listo para retirar'}
                        </button>
                      )}
                      {venta.estado === 'listo_para_retirar' && (
                        <button
                          onClick={() => handleFinalizarVenta(venta.id)}
                          disabled={finalizando === venta.id}
                          className="text-xs bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-3 py-1 rounded-lg transition"
                        >
                          {finalizando === venta.id ? '...' : 'Finalizar'}
                        </button>
                      )}
                      {venta.estado === 'finalizado' && (
                        <button
                          className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1 rounded-lg transition"
                          onClick={() => {
                            setReviewTarget({ id: venta.compradorId ?? 0, name: venta.nombre, type: 'user', compraId: venta.id });
                            setReviewModalOpen(true);
                          }}
                        >
                          ★ Valorar comprador
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {(venta.items ?? []).map((it: any, i: number) => (
                      <p key={i} className="text-xs text-gray-600">
                        {it.cartaNombre} × {it.cantidad} — ${it.precio}
                      </p>
                    ))}
                    <p className="text-sm font-semibold text-gray-800 mt-1">Total: ${venta.total}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {/* ── MIS COMPRAS (tienda comprando) ── */}
        {activeTab === 'compras' && (
          <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-5">Mis Compras</h2>
            {comprasLoading ? (
              <p className="text-sm text-gray-400">Cargando...</p>
            ) : misCompras.length === 0 ? (
              <div className="text-center py-10">
                <div className="text-4xl mb-2 opacity-30">🛒</div>
                <p className="text-gray-400 text-sm">No tenés compras realizadas aún.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {misCompras.map((comp: any) => (
                  <div key={comp.id} className="border border-gray-100 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-gray-800">Orden #{comp.id}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          comp.estado === 'finalizado'           ? 'bg-green-100 text-green-700'
                          : comp.estado === 'en_tienda'          ? 'bg-blue-100 text-blue-700'
                          : comp.estado === 'listo_para_retirar' ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                        }`}>
                          {comp.estado === 'finalizado'            ? 'Finalizado ✓'
                            : comp.estado === 'en_tienda'          ? 'Llegó al local 📦'
                            : comp.estado === 'listo_para_retirar' ? 'Listo para retirar 🟠'
                            : 'Pendiente'}
                        </span>
                        <button
                          onClick={() => setChatAbierto(chatAbierto === comp.id ? null : comp.id)}
                          className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-full text-xs transition"
                        >
                          {chatAbierto === comp.id ? 'Cerrar chat' : '💬 Chat'}
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600"><strong>Total:</strong> ${Number(comp.total || 0).toFixed(2)}</p>

                    {comp.tiendaRetiro && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                        <p className="font-semibold text-amber-800">📍 {comp.tiendaRetiro.nombre}</p>
                        <p className="text-amber-700">{comp.tiendaRetiro.direccion}</p>
                      </div>
                    )}

                    {(comp.items || []).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-500 mb-1">Ítems:</p>
                        {(comp.items || []).map((it: any, idx: number) => (
                          <p key={idx} className="text-xs text-gray-600">
                            {it.title || `Carta #${it.cartaId}`} × {it.quantity} — ${Number(it.price || 0).toFixed(2)}
                          </p>
                        ))}
                      </div>
                    )}

                    {comp.estado === 'finalizado' && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs text-gray-500 mb-2">¿Cómo fue la experiencia?</p>
                        {(() => {
                          const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor;
                          const key = `${comp.id}_vendedor_${vendedor?.id}`;
                          if (!vendedor) return null;
                          return reviewedMap[key] != null ? (
                            <p className="text-xs text-gray-400">★ Vendedor ya valorado</p>
                          ) : (
                            <button
                              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-3 py-1 rounded-lg transition"
                              onClick={() => {
                                setReviewTarget({ id: vendedor.id, name: vendedor.nombre, type: 'vendedor', compraId: comp.id });
                                setReviewModalOpen(true);
                              }}
                            >
                              ★ Valorar vendedor: {vendedor.nombre}
                            </button>
                          );
                        })()}
                      </div>
                    )}

                    {chatAbierto === comp.id && (
                      <div className="mt-3 pt-3 border-t">
                        <Chat compraId={comp.id} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {reviewTarget && (
          <ReviewModal
            isOpen={reviewModalOpen}
            onClose={() => setReviewModalOpen(false)}
            targetId={reviewTarget.id}
            targetType={reviewTarget.type}
            targetName={reviewTarget.name}
            compraId={reviewTarget.compraId}
            onSuccess={(puntuacion) => {
              const key = `${reviewTarget.compraId}_${reviewTarget.type}_${reviewTarget.id}`;
              setReviewedMap(prev => ({ ...prev, [key]: puntuacion }));
              setReviewModalOpen(false);
            }}
          />
        )}

      </div>
    </div>
  );
}
