# TiendaRetiro Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/tienda-retiro/perfil` placeholder with a full styled dashboard for the tiendaRetiro role, matching the amber/orange visual language of MiPerfilVendedorPage.

**Architecture:** Single new page `MiPerfilTiendaRetiroPage.tsx` with profile header (inline edit), expandable stats, and embedded ventas list with action buttons. App.tsx updated to swap the placeholder div. No Header changes needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, React Router v6, `fetchApi`, `useUser` context.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx` | Full tienda profile dashboard |
| Modify | `vite-project/vite-project-ts/src/App.tsx` | Replace placeholder with `MiPerfilTiendaRetiroPage` |

---

### Task 1: Create MiPerfilTiendaRetiroPage.tsx

**Files:**
- Create: `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
import { useState, useEffect } from 'react';
import { useUser } from '../context/user';
import { fetchApi } from '../services/api';

type VentaItem = { cartaNombre: string; cantidad: number; precio: number };
type Vendedor = { nombre: string; alias: string | null; cbu: string | null };
type Venta = {
  id: number;
  estado: string;
  total: number;
  createdAt: string;
  comprador: { nombre: string; email: string };
  vendedores: Vendedor[];
  items: VentaItem[];
};

const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  pendiente:           { label: 'Pendiente',    color: 'bg-yellow-100 text-yellow-800' },
  entregado_a_tienda:  { label: 'Por llegar',   color: 'bg-orange-100 text-orange-800' },
  en_tienda:           { label: 'En tienda',    color: 'bg-blue-100 text-blue-800' },
  finalizado:          { label: 'Finalizado',   color: 'bg-green-100 text-green-800' },
  retirado:            { label: 'Retirado',     color: 'bg-green-100 text-green-800' },
};

export default function MiPerfilTiendaRetiroPage() {
  const { user } = useUser();

  const [tienda, setTienda]             = useState<any>(null);
  const [ventas, setVentas]             = useState<Venta[]>([]);
  const [loading, setLoading]           = useState(true);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const [editOpen, setEditOpen]         = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    nombre:    '',
    email:     '',
    direccion: '',
    horario:   '',
    ciudad:    '',
    activo:    true,
  });
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fetchVentas = async () => {
    if (!user?.id) return;
    try {
      const r = await fetchApi(`/api/tiendas/${user.id}/ventas`);
      const json = await r.json();
      setVentas(json.data ?? []);
    } catch {
      /* silently fail — ventas shown empty */
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const fetchAll = async () => {
      try {
        const [tiendaRes] = await Promise.all([
          fetchApi(`/api/tiendas/${user.id}`),
          fetchVentas(),
        ]);
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
      setSaveMsg('Datos actualizados correctamente.');
    } catch (err: any) {
      setSaveError(err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleMarcarEnTienda = async (ventaId: number) => {
    if (!confirm('¿Confirmás que recibiste este pedido en la tienda?')) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/en-tienda`, { method: 'PATCH' });
      await fetchVentas();
    } catch {
      alert('Error al actualizar el estado');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalizar = async (ventaId: number) => {
    if (!confirm('¿Confirmás que el comprador retiró el pedido y completó el pago?')) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/finalizar`, { method: 'PATCH' });
      await fetchVentas();
    } catch {
      alert('Error al finalizar la orden');
    } finally {
      setActionLoading(null);
    }
  };

  // Stats
  const totalVentas      = ventas.length;
  const porLlegar        = ventas.filter(v => v.estado === 'entregado_a_tienda').length;
  const enTienda         = ventas.filter(v => v.estado === 'en_tienda').length;
  const finalizados      = ventas.filter(v => v.estado === 'finalizado' || v.estado === 'retirado').length;

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
            {/* Avatar + info row */}
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
                  {tienda.horario && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span>🕐 {tienda.horario}</span>
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
                  {[
                    { name: 'nombre',    label: 'Nombre de la tienda', type: 'text' },
                    { name: 'email',     label: 'Email',               type: 'email' },
                    { name: 'direccion', label: 'Dirección',           type: 'text' },
                    { name: 'horario',   label: 'Horario',             type: 'text' },
                    { name: 'ciudad',    label: 'Ciudad',              type: 'text' },
                  ].map(field => (
                    <div key={field.name}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                      <input
                        type={field.type}
                        name={field.name}
                        value={(formData as any)[field.name]}
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

            {/* ── STATS ── */}
            <div className="mt-4">
              <button
                onClick={() => setStatsExpanded(o => !o)}
                className="flex items-center gap-1.5 text-orange-500 hover:text-orange-600 text-xs font-semibold uppercase tracking-wider transition"
              >
                {statsExpanded ? 'Mostrar menos ▲' : 'Mostrar más ▼'}
              </button>

              {statsExpanded && (
                <div className="mt-4 grid grid-cols-2 gap-x-12 text-sm">
                  <div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Total pedidos</span>
                      <span className="text-gray-800 font-semibold">{totalVentas}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Por llegar</span>
                      <span className={`font-semibold ${porLlegar > 0 ? 'text-orange-500' : 'text-gray-800'}`}>
                        {porLlegar}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">En tienda</span>
                      <span className={`font-semibold ${enTienda > 0 ? 'text-blue-500' : 'text-gray-800'}`}>
                        {enTienda}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-orange-100">
                      <span className="text-gray-500">Finalizados</span>
                      <span className="text-green-600 font-semibold">{finalizados}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── VENTAS ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold text-gray-800">Mis Ventas</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
              {totalVentas}
            </span>
            {(porLlegar > 0 || enTienda > 0) && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2.5 py-0.5 rounded-full font-medium">
                {porLlegar + enTienda} requieren acción
              </span>
            )}
          </div>

          {ventas.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-3 opacity-40">🏪</div>
              <p className="text-gray-400">No hay pedidos asociados a esta tienda todavía.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ventas.map(venta => {
                const badge = ESTADO_BADGE[venta.estado] ?? { label: venta.estado, color: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={venta.id} className="bg-amber-50 border border-orange-100 rounded-xl p-5">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-gray-800">Compra #{venta.id}</span>
                        <span className="text-sm text-gray-400">
                          {new Date(venta.createdAt).toLocaleDateString('es-AR')}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">Comprador</p>
                        <p className="text-gray-800">{venta.comprador.nombre}</p>
                        <p className="text-gray-500 text-xs">{venta.comprador.email}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-gray-600 mb-1">Vendedor(es)</p>
                        {venta.vendedores.length === 0 ? (
                          <p className="text-gray-400 italic text-xs">Sin datos</p>
                        ) : (
                          venta.vendedores.map((v, i) => (
                            <div key={i} className="mb-1">
                              <p className="text-gray-800">{v.nombre}</p>
                              {v.alias && <p className="text-gray-500 text-xs">Alias: {v.alias}</p>}
                              {v.cbu   && <p className="text-gray-500 text-xs">CBU: {v.cbu}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {venta.items.length > 0 && (
                      <div className="mb-4">
                        <p className="font-semibold text-gray-600 text-sm mb-2">Artículos</p>
                        <div className="space-y-1">
                          {venta.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-700">{item.cartaNombre} × {item.cantidad}</span>
                              <span className="text-gray-600 font-medium">${item.precio.toLocaleString('es-AR')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-3 border-t border-orange-100 flex items-center justify-between">
                      <span className="font-bold text-gray-900">
                        Total: ${venta.total.toLocaleString('es-AR')}
                      </span>

                      {venta.estado === 'entregado_a_tienda' && (
                        <button
                          disabled={actionLoading === venta.id}
                          onClick={() => handleMarcarEnTienda(venta.id)}
                          className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                        >
                          {actionLoading === venta.id ? 'Procesando...' : 'Confirmar recepción'}
                        </button>
                      )}

                      {venta.estado === 'en_tienda' && (
                        <button
                          disabled={actionLoading === venta.id}
                          onClick={() => handleFinalizar(venta.id)}
                          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                        >
                          {actionLoading === venta.id ? 'Procesando...' : 'Finalizar orden'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file was created**

Check that `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx` exists.

---

### Task 2: Wire up route in App.tsx

**Files:**
- Modify: `vite-project/vite-project-ts/src/App.tsx`

- [ ] **Step 1: Add the import**

After the existing `TiendaRetiroVentasPage` import (around line 30), add:

```tsx
import MiPerfilTiendaRetiroPage from "./pages/MiPerfilTiendaRetiroPage";
```

- [ ] **Step 2: Replace the placeholder route**

Find this block (around line 245):

```tsx
                <Route
                  path="tienda-retiro/perfil"
                  element={
                    <TiendaRetiroRoute>
                      <div className="p-8 text-center text-gray-500">Perfil de tienda — próximamente</div>
                    </TiendaRetiroRoute>
                  }
                />
```

Replace it with:

```tsx
                <Route
                  path="tienda-retiro/perfil"
                  element={
                    <TiendaRetiroRoute>
                      <MiPerfilTiendaRetiroPage />
                    </TiendaRetiroRoute>
                  }
                />
```

- [ ] **Step 3: Verify TypeScript build is clean**

Run from `vite-project/vite-project-ts/`:
```bash
pnpm run build 2>&1 | head -30
```
Expected: `✓ built in X.XXs` with no TypeScript errors.

---

### Task 3: Manual smoke test

- [ ] **Step 1: Start dev servers**

```bash
# Terminal 1 — backend
cd backend && pnpm start:dev

# Terminal 2 — frontend
cd vite-project/vite-project-ts && pnpm run dev
```

- [ ] **Step 2: Verify profile loads**

Log in as a `tiendaRetiro` account, click "Mi Perfil". Should navigate to `/tienda-retiro/perfil` and show the dashboard with store name, badge, address, hours.

- [ ] **Step 3: Verify active/inactive badge**

Check that the "Activa"/"Inactiva" badge reflects the `activo` field of the tienda.

- [ ] **Step 4: Verify edit panel toggles and saves**

Click "✏ Editar perfil", change the horario field, click "Guardar cambios". Should see success message. Reload and confirm the change persisted.

- [ ] **Step 5: Verify stats expand**

Click "Mostrar más" — should reveal the 4 stats: Total pedidos, Por llegar, En tienda, Finalizados.

- [ ] **Step 6: Verify ventas section**

Confirm the ventas list renders with correct estado badges and action buttons matching each state (`entregado_a_tienda` → "Confirmar recepción", `en_tienda` → "Finalizar orden").

- [ ] **Step 7: Verify action buttons work**

If a venta in state `entregado_a_tienda` exists, click "Confirmar recepción" and confirm the card updates to `en_tienda` without page reload.
