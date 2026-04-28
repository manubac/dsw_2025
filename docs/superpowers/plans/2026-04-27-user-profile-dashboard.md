# User Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dashboard-style profile page for regular users (role: 'user') matching the amber/orange visual language of MiPerfilVendedorPage, replacing the old CSS-based form.

**Architecture:** New page `MiPerfilUsuarioPage.tsx` at `/mi-perfil-usuario`, with an inline edit panel (toggleable), quick-access cards for Wishlist/Purchases, and a valoraciones section. Header and App routing updated to redirect `'user'` roles to the new page.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, React Router v6, axios (`api`), `fetchApi`, `useUser` context.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `vite-project/vite-project-ts/src/pages/MiPerfilUsuarioPage.tsx` | Full user profile dashboard |
| Modify | `vite-project/vite-project-ts/src/App.tsx` | Add `/mi-perfil-usuario` route + `UserRoute` guard |
| Modify | `vite-project/vite-project-ts/src/components/Header.tsx` | Update `handleProfileClick` for 'user'/'usuario' |

---

### Task 1: Create MiPerfilUsuarioPage.tsx

**Files:**
- Create: `vite-project/vite-project-ts/src/pages/MiPerfilUsuarioPage.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import { api, fetchApi } from '../services/api';

interface Valoracion {
  id: number;
  puntuacion: number;
  comentario?: string;
  createdAt?: string;
  tipoObjeto: string;
  objetoId: number;
}

export default function MiPerfilUsuarioPage() {
  const { user, updateUser, logout } = useUser();
  const navigate = useNavigate();

  const [userData, setUserData] = useState<any>(null);
  const [valoraciones, setValoraciones] = useState<Valoracion[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [showAllValoraciones, setShowAllValoraciones] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '********',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const fetchAll = async () => {
      try {
        const [userRes, valoracionesRes] = await Promise.all([
          api.get(`/api/users/${user.id}`),
          api.get('/api/valoraciones/mias'),
        ]);

        const u = userRes.data.data;
        setUserData(u);
        setFormData({
          username: u?.username || user.name || '',
          email: u?.email || user.email || '',
          password: '********',
        });

        const raw = valoracionesRes.data;
        setValoraciones(Array.isArray(raw) ? raw : (raw.data || []));
      } catch (err) {
        console.error('Error loading user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user?.id]);

  const memberYear = userData?.createdAt
    ? new Date(userData.createdAt).getFullYear()
    : new Date().getFullYear();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);

    try {
      const updateData: Record<string, any> = {
        username: formData.username,
        email: formData.email,
      };
      if (formData.password !== '********' && formData.password.trim() !== '') {
        updateData.password = formData.password;
      }

      const response = await fetchApi(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Error al actualizar.');

      updateUser({ name: formData.username, email: formData.email });
      setSaveMsg('Datos actualizados correctamente.');
      setFormData(prev => ({ ...prev, password: '********' }));
    } catch (err: any) {
      setSaveError(err.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;
    if (!confirm('¿Estás seguro de que querés eliminar tu cuenta? Esta acción no se puede deshacer.')) return;

    setDeleteLoading(true);
    try {
      const response = await fetchApi(`/api/users/${user.id}`, { method: 'DELETE' });
      if (response.ok) {
        logout();
        navigate('/');
      } else {
        alert('Error al eliminar la cuenta.');
      }
    } catch {
      alert('Error al eliminar la cuenta.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const visibleValoraciones = showAllValoraciones ? valoraciones : valoraciones.slice(0, 3);

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

  if (!user) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center text-gray-500">
        No se pudo cargar el perfil.
      </div>
    );
  }

  const displayName = userData?.username || user.name || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-amber-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── PROFILE HEADER ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-300" />

          <div className="p-6">
            {/* Avatar + Name row */}
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 flex-shrink-0 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-md ring-2 ring-orange-200">
                {initial}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-800 leading-tight">{displayName}</h1>
                  <button
                    onClick={() => { setEditOpen(o => !o); setSaveMsg(null); setSaveError(null); }}
                    className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-full transition-all"
                  >
                    <span>✏</span>
                    <span>{editOpen ? 'Cancelar edición' : 'Editar perfil'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs bg-blue-100 text-blue-600 border border-blue-200 px-2.5 py-0.5 rounded-full font-medium">
                    Comprador
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500 text-sm">Miembro desde {memberYear}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-gray-500 text-sm">{userData?.email || user.email}</span>
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
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre de usuario</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      disabled={saving}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={saving}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={saving}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
                    />
                    <p className="text-xs text-gray-400 mt-1">Dejá este campo sin cambios si no querés actualizar tu contraseña.</p>
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

                {/* Danger zone */}
                <div className="mt-6 pt-5 border-t border-red-100">
                  <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">Zona de peligro</p>
                  <p className="text-xs text-gray-500 mb-3">
                    Una vez que eliminás tu cuenta, todos tus datos serán borrados de forma permanente. Esta acción no se puede deshacer.
                  </p>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteLoading}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
                  >
                    {deleteLoading ? 'Eliminando...' : 'Eliminar mi cuenta'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── QUICK ACCESS ── */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/wishlist')}
            className="bg-white border border-orange-100 hover:border-orange-300 rounded-xl shadow-sm p-5 flex items-center gap-4 group transition-all hover:shadow-md text-left"
          >
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform flex-shrink-0">
              ♥
            </div>
            <div>
              <p className="text-gray-800 font-semibold text-sm">Mis Favoritos</p>
              <p className="text-gray-400 text-xs mt-0.5">Cartas guardadas</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/purchases')}
            className="bg-white border border-orange-100 hover:border-orange-300 rounded-xl shadow-sm p-5 flex items-center gap-4 group transition-all hover:shadow-md text-left"
          >
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform flex-shrink-0">
              🛍
            </div>
            <div>
              <p className="text-gray-800 font-semibold text-sm">Mis Compras</p>
              <p className="text-gray-400 text-xs mt-0.5">Historial de pedidos</p>
            </div>
          </button>
        </div>

        {/* ── VALORACIONES ── */}
        <div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold text-gray-800">Mis Valoraciones</h2>
            <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-medium">
              {valoraciones.length}
            </span>
          </div>

          {valoraciones.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2 opacity-40">⭐</div>
              <p>Aún no dejaste ninguna valoración.</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {visibleValoraciones.map(v => (
                  <div key={v.id} className="bg-amber-50 border border-orange-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-600 text-xs font-medium uppercase tracking-wider">
                        {v.tipoObjeto} #{v.objetoId}
                      </span>
                      <span className="text-amber-400 text-sm">
                        {'★'.repeat(v.puntuacion)}{'☆'.repeat(5 - v.puntuacion)}
                      </span>
                    </div>
                    {v.comentario && (
                      <p className="text-gray-500 text-sm italic mt-1">"{v.comentario}"</p>
                    )}
                    {v.createdAt && (
                      <p className="text-gray-400 text-xs mt-2">
                        {new Date(v.createdAt).toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {valoraciones.length > 3 && (
                <button
                  onClick={() => setShowAllValoraciones(o => !o)}
                  className="mt-4 w-full py-2 text-orange-500 hover:text-orange-600 text-sm font-medium border border-orange-200 hover:border-orange-300 hover:bg-orange-50 rounded-lg transition"
                >
                  {showAllValoraciones
                    ? 'Mostrar menos ▲'
                    : `Ver todas las valoraciones (${valoraciones.length}) ▼`}
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the file was created**

Check the file exists at `vite-project/vite-project-ts/src/pages/MiPerfilUsuarioPage.tsx`.

---

### Task 2: Add route in App.tsx

**Files:**
- Modify: `vite-project/vite-project-ts/src/App.tsx`

- [ ] **Step 1: Add the UserRoute guard and import**

In `App.tsx`, after the existing `VendedorRoute` function (around line 74), add:

```tsx
/**
 * RUTA PROTEGIDA PARA USUARIOS
 */
function UserRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'user' && user.role !== 'usuario') return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 2: Add the import for MiPerfilUsuarioPage**

At the top of `App.tsx`, after the existing `MiPerfilVendedorPage` import, add:

```tsx
import MiPerfilUsuarioPage from './pages/MiPerfilUsuarioPage';
```

- [ ] **Step 3: Add the route inside the Routes tree**

Inside the `<Route path="/" element={<Layout />}>` block, after the `/mi-perfil` route, add:

```tsx
{/* Perfil unificado del usuario */}
<Route
  path="mi-perfil-usuario"
  element={
    <UserRoute>
      <MiPerfilUsuarioPage />
    </UserRoute>
  }
/>
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

Run from `vite-project/vite-project-ts/`:
```bash
pnpm run build 2>&1 | head -30
```
Expected: no TypeScript errors related to the new files.

---

### Task 3: Update Header.tsx navigation

**Files:**
- Modify: `vite-project/vite-project-ts/src/components/Header.tsx`

- [ ] **Step 1: Update handleProfileClick**

Find the current `handleProfileClick` function (around line 190):

```tsx
const handleProfileClick = () => {
  setUserMenuOpen(false);
  if (user?.role === 'vendedor') {
    navigate("/mi-perfil");
  } else {
    navigate("/profile");
  }
};
```

Replace it with:

```tsx
const handleProfileClick = () => {
  setUserMenuOpen(false);
  if (user?.role === 'vendedor') {
    navigate("/mi-perfil");
  } else if (user?.role === 'user' || user?.role === 'usuario') {
    navigate("/mi-perfil-usuario");
  } else {
    navigate("/profile");
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

Run from `vite-project/vite-project-ts/`:
```bash
pnpm run build 2>&1 | head -30
```
Expected: clean build.

---

### Task 4: Manual smoke test

- [ ] **Step 1: Start dev servers and verify**

```bash
# Terminal 1 — backend
cd backend && pnpm start:dev

# Terminal 2 — frontend
cd vite-project/vite-project-ts && pnpm run dev
```

- [ ] **Step 2: Verify profile header loads**

Log in as a `role: 'user'` account, click "Mi Perfil" in the header dropdown. Should navigate to `/mi-perfil-usuario` and show the profile dashboard.

- [ ] **Step 3: Verify edit panel toggles**

Click "✏ Editar perfil" — the inline form should expand. Verify fields are pre-populated with current username/email.

- [ ] **Step 4: Verify save works**

Change the username, click "Guardar cambios". Should see success message and updated name in header.

- [ ] **Step 5: Verify quick-access cards navigate correctly**

Click "Mis Favoritos" → should go to `/wishlist`.
Click "Mis Compras" → should go to `/purchases`.

- [ ] **Step 6: Verify danger zone is inside the edit panel**

Open "Editar perfil", scroll to bottom of panel. "Zona de peligro" with "Eliminar mi cuenta" should be visible.

- [ ] **Step 7: Verify intermediario still goes to /profile**

Log in as `role: 'intermediario'` and click "Mi Perfil" — should still go to `/profile`.
