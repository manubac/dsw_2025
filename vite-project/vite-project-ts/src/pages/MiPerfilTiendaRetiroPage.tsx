import { useState, useEffect } from 'react';
import { useUser } from '../context/user';
import { fetchApi } from '../services/api';

export default function MiPerfilTiendaRetiroPage() {
  const { user } = useUser();

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

        {/* ── MIS PUBLICACIONES (placeholder) ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5">Mis Publicaciones</h2>
          <div className="text-center py-12">
            <div className="text-5xl mb-3 opacity-30">🃏</div>
            <p className="text-gray-400">Próximamente: publicaciones de la tienda.</p>
          </div>
        </div>

        {/* ── VALORACIONES (placeholder) ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5">Valoraciones recibidas</h2>
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2 opacity-40">⭐</div>
            <p>Próximamente: valoraciones de compradores.</p>
          </div>
        </div>

        {/* ── MIS VENTAS (placeholder) ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-5">Mis Ventas</h2>
          <div className="text-center py-12">
            <div className="text-5xl mb-3 opacity-30">🏪</div>
            <p className="text-gray-400">Próximamente: ventas de las publicaciones de esta tienda.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
