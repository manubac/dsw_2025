# Mi Perfil Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar las páginas de perfil privado para vendedores, usuarios comunes y tiendas, agregando descripción de compra, filtros en publicaciones, edición inline y reestructuración de secciones.

**Architecture:** Enhancement incremental — cada página se modifica de forma independiente. Un solo cambio de backend (campo `descripcionCompra` en `Vendedor`). Sin componentes compartidos nuevos.

**Tech Stack:** React 19 + TypeScript + Tailwind CSS (frontend); Express 5 + MikroORM 6 + PostgreSQL (backend); Axios + fetchApi con JWT automático.

---

## File Map

| Archivo | Acción | Descripción del cambio |
|---------|--------|------------------------|
| `backend/src/vendedor/vendedores.entity.ts` | Modificar | Agregar propiedad `descripcionCompra` |
| `backend/src/vendedor/vendedor.controller.ts` | Modificar | Agregar `descripcionCompra` al sanitiser |
| `vite-project/vite-project-ts/src/pages/VendedorProfile.tsx` | Modificar | Mostrar `descripcionCompra` en vista pública |
| `vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx` | Modificar | Edit inline + sección descripción + filtros publicaciones |
| `vite-project/vite-project-ts/src/pages/MiPerfilUsuarioPage.tsx` | Modificar | Agregar `SellerOnboarding` |
| `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx` | Modificar | Reestructurar secciones (tienda, valoraciones, publicaciones) |

---

## Task 1: Backend — campo `descripcionCompra` en Vendedor

**Files:**
- Modify: `backend/src/vendedor/vendedores.entity.ts`
- Modify: `backend/src/vendedor/vendedor.controller.ts`

- [ ] **Step 1: Agregar la propiedad en la entidad**

  Archivo: `backend/src/vendedor/vendedores.entity.ts`

  Agregar después de la línea `cbu?: string`:

  ```typescript
  @Property({ type: 'text', nullable: true })
  descripcionCompra?: string
  ```

  El archivo debe quedar así en el bloque de propiedades:
  ```typescript
  @Property({ type: 'string', nullable: true })
  alias?: string

  @Property({ type: 'string', nullable: true })
  cbu?: string

  @Property({ type: 'text', nullable: true })
  descripcionCompra?: string

  @OneToMany(() => ItemCarta, (itemCarta) => itemCarta.uploaderVendedor)
  ```

- [ ] **Step 2: Agregar al sanitiser**

  Archivo: `backend/src/vendedor/vendedor.controller.ts`, función `sanitiseVendedorInput` (línea 16).

  Cambiar:
  ```typescript
  req.body.sanitisedInput = {
      nombre: req.body.nombre,
      telefono: req.body.telefono,
      ciudad: req.body.ciudad,
      alias: req.body.alias,
      cbu: req.body.cbu,
      items: req.body.items
  };
  ```
  Por:
  ```typescript
  req.body.sanitisedInput = {
      nombre: req.body.nombre,
      telefono: req.body.telefono,
      ciudad: req.body.ciudad,
      alias: req.body.alias,
      cbu: req.body.cbu,
      items: req.body.items,
      descripcionCompra: req.body.descripcionCompra,
  };
  ```

- [ ] **Step 3: Aplicar la migración de schema**

  ```bash
  cd backend
  pnpm schema:update
  ```

  Verificar que no hay errores. El ORM agrega la columna `descripcion_compra` como nullable.

- [ ] **Step 4: Probar manualmente con curl**

  Con un vendedor existente (reemplazar `<ID>` y `<TOKEN>`):

  ```bash
  curl -X PATCH http://localhost:3000/api/vendedores/<ID> \
    -H "Authorization: Bearer <TOKEN>" \
    -H "Content-Type: application/json" \
    -d '{"descripcionCompra": "Manga Couple Store voy los lunes y miercoles"}'
  ```

  Respuesta esperada:
  ```json
  { "message": "Vendedor updated", "data": { ..., "descripcionCompra": "Manga Couple Store voy los lunes y miercoles" } }
  ```

  Luego GET para confirmar persistencia:
  ```bash
  curl http://localhost:3000/api/vendedores/<ID>
  ```
  El campo `descripcionCompra` debe aparecer en el response.

- [ ] **Step 5: Commit**

  ```bash
  cd backend
  git add src/vendedor/vendedores.entity.ts src/vendedor/vendedor.controller.ts
  git commit -m "feat(vendedor): add descripcionCompra field"
  ```

---

## Task 2: VendedorProfile — mostrar `descripcionCompra` en vista pública

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/VendedorProfile.tsx`

- [ ] **Step 1: Agregar sección descripcionCompra entre el header y publicaciones**

  Archivo: `VendedorProfile.tsx`, después del cierre del div `HEADER PERFIL` (línea ~74) y antes del div `PUBLICACIONES`.

  Agregar:
  ```tsx
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
  ```

- [ ] **Step 2: Probar manualmente**

  - Abrir `/vendedor/<id>` de un vendedor que tenga `descripcionCompra` → debe verse la sección.
  - Abrir `/vendedor/<id>` de uno que no tenga → la sección no debe aparecer.

- [ ] **Step 3: Commit**

  ```bash
  git add vite-project/vite-project-ts/src/pages/VendedorProfile.tsx
  git commit -m "feat(VendedorProfile): show descripcionCompra for buyers"
  ```

---

## Task 3: MiPerfilVendedorPage — reemplazar link a /profile con edit inline

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx`

- [ ] **Step 1: Agregar estado para el panel de edición**

  Al inicio del componente, después de los estados existentes (línea ~45), agregar:

  ```tsx
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre: '',
    telefono: '',
    ciudad: '',
    alias: '',
    cbu: '',
    password: '********',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  ```

- [ ] **Step 2: Inicializar el formulario cuando carga el vendedor**

  En el `useEffect`, después de `setVendedor(vendedorRes.data.data)` (línea ~62), agregar:

  ```tsx
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
  ```

  Eliminar la línea `setVendedor(vendedorRes.data.data)` original que queda duplicada.

- [ ] **Step 3: Agregar handler de guardado del perfil**

  Después de la función `saveTiendas` (línea ~112), agregar:

  ```tsx
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
  ```

- [ ] **Step 4: Reemplazar el botón "Editar perfil" y agregar el panel inline**

  En el JSX del header, reemplazar el botón que navega a `/profile` (líneas ~163-169):

  ```tsx
  // ANTES:
  <button
    onClick={() => navigate('/profile')}
    className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-full transition-all"
  >
    <span>✏</span>
    <span>Editar perfil</span>
  </button>
  ```

  Por:

  ```tsx
  <button
    onClick={() => { setEditOpen(o => !o); setEditMsg(null); setEditError(null); }}
    className="flex items-center gap-1.5 text-xs bg-amber-50 hover:bg-orange-100 border border-orange-200 hover:border-orange-300 text-orange-600 hover:text-orange-700 px-3 py-1.5 rounded-full transition-all"
  >
    <span>✏</span>
    <span>{editOpen ? 'Cancelar edición' : 'Editar perfil'}</span>
  </button>
  ```

- [ ] **Step 5: Agregar el panel de edición inline en el header**

  Después del div del "Rating row" (cierre del bloque de evaluación, ~línea 208) y antes del cierre del `<div className="p-6">`, agregar el panel:

  ```tsx
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
          { name: 'nombre',   label: 'Nombre',        type: 'text'     },
          { name: 'telefono', label: 'Teléfono',       type: 'text'     },
          { name: 'ciudad',   label: 'Ciudad',         type: 'text'     },
          { name: 'alias',    label: 'Alias de pago',  type: 'text'     },
          { name: 'cbu',      label: 'CBU / CVU',      type: 'text'     },
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
  ```

- [ ] **Step 6: Remover el import de useNavigate si ya no se usa en otro lado**

  Verificar si `navigate` se sigue usando en otro lugar de la página (botón "+ Nueva", editar carta). Si se usa, no quitar el import.

- [ ] **Step 7: Probar manualmente**

  - Click "Editar perfil" → abre panel con datos prellenados.
  - Modificar nombre → Guardar → el nombre en el header se actualiza.
  - Escribir nueva contraseña → Guardar → confirmar con logout + login.
  - Click "Cancelar" → cierra el panel.

- [ ] **Step 8: Commit**

  ```bash
  git add vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx
  git commit -m "feat(MiPerfilVendedor): inline edit panel, remove /profile redirect"
  ```

---

## Task 4: MiPerfilVendedorPage — sección Descripción de compra

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx`

- [ ] **Step 1: Agregar estado para la descripción**

  Al inicio del componente, después de los estados del Task 3, agregar:

  ```tsx
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [descSaving, setDescSaving] = useState(false);
  const [descMsg, setDescMsg] = useState<string | null>(null);
  ```

- [ ] **Step 2: Inicializar descDraft cuando carga vendedor**

  En el `useEffect`, después de donde se inicializa `editForm`, agregar:

  ```tsx
  setDescDraft(v?.descripcionCompra || '');
  ```

- [ ] **Step 3: Agregar handler de guardado de descripción**

  Después de `saveEditForm`, agregar:

  ```tsx
  const saveDesc = async () => {
    if (!user?.id) return;
    setDescSaving(true);
    setDescMsg(null);
    try {
      await api.patch(`/api/vendedores/${user.id}`, { descripcionCompra: descDraft });
      setVendedor((prev: any) => ({ ...prev, descripcionCompra: descDraft }));
      setEditingDesc(false);
      setDescMsg('Descripción guardada.');
    } catch (err: any) {
      setDescMsg('Error al guardar.');
    } finally {
      setDescSaving(false);
    }
  };
  ```

- [ ] **Step 4: Insertar la sección en el JSX**

  Agregar después del bloque de header (cierre del primer `</div>` con `bg-white border border-orange-100`) y antes del bloque de publicaciones:

  ```tsx
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
  ```

- [ ] **Step 5: Probar manualmente**

  - Con `descripcionCompra` vacío: ver placeholder gris.
  - Click "Editar" → escribe texto → Guardar → se muestra el texto sin textarea.
  - Click "Editar" → modificar → Cancelar → vuelve al texto anterior.
  - Recargar página → el texto persiste (viene del backend).

- [ ] **Step 6: Commit**

  ```bash
  git add vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx
  git commit -m "feat(MiPerfilVendedor): add descripcionCompra editable section"
  ```

---

## Task 5: MiPerfilVendedorPage — filtros y scroll en Mis Publicaciones

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx`

- [ ] **Step 1: Extender la interfaz Publication**

  Reemplazar la interfaz `Publication` actual (líneas ~13-20) por:

  ```tsx
  interface Publication {
    id: number;
    name: string;
    description: string;
    stock: number;
    estado: string;
    uploaderVendedor: { id: number; nombre: string };
    cartas: Array<{
      id: number;
      name: string;
      price: string;
      image: string;
      rarity: string;
      setName: string;
    }>;
  }
  ```

- [ ] **Step 2: Agregar estados de filtro**

  Después de `const [publicaciones, setPublicaciones] = useState<Publication[]>([])`, agregar:

  ```tsx
  const [searchName, setSearchName] = useState('');
  const [filterEstado, setFilterEstado] = useState<'all' | 'disponible' | 'pausado'>('all');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterRareza, setFilterRareza] = useState('');
  const [filterSet, setFilterSet] = useState('');
  ```

- [ ] **Step 3: Cambiar el fetch de publicaciones a /api/itemsCarta/**

  En el `useEffect`, reemplazar la línea del fetch de publicaciones:

  ```tsx
  // ANTES:
  fetchApi('/api/cartas'),
  ```

  Por:

  ```tsx
  fetchApi('/api/itemsCarta/'),
  ```

  Y reemplazar el bloque de procesamiento de publicaciones:

  ```tsx
  // ANTES:
  const allPubs = (await pubsRes.json()).data || [];
  setPublicaciones(
    allPubs.filter((p: Publication) => p.uploader?.id === user.id)
  );
  ```

  Por:

  ```tsx
  const allPubs = (await pubsRes.json()).data || [];
  setPublicaciones(
    allPubs.filter((p: Publication) => p.uploaderVendedor?.id === user.id)
  );
  ```

- [ ] **Step 4: Calcular publicaciones filtradas y opciones de selects**

  Después de las líneas de cálculos existentes (`totalVentas`, `ventasNoEnviadas`, `memberYear`), agregar:

  ```tsx
  const rarezasUnicas = [...new Set(
    publicaciones.flatMap(p => p.cartas.map(c => c.rarity)).filter(Boolean)
  )];
  const setsUnicos = [...new Set(
    publicaciones.flatMap(p => p.cartas.map(c => c.setName)).filter(Boolean)
  )];

  const publicacionesFiltradas = publicaciones.filter(p => {
    const carta = p.cartas[0];
    const precio = carta ? parseFloat(carta.price) : 0;
    const min = filterMinPrice !== '' ? parseFloat(filterMinPrice) : -Infinity;
    const max = filterMaxPrice !== '' ? parseFloat(filterMaxPrice) : Infinity;

    return (
      (searchName === '' || p.name.toLowerCase().includes(searchName.toLowerCase()) ||
        (carta?.name.toLowerCase().includes(searchName.toLowerCase()))) &&
      (filterEstado === 'all' || p.estado === filterEstado) &&
      precio >= min &&
      precio <= max &&
      (filterRareza === '' || carta?.rarity === filterRareza) &&
      (filterSet === '' || carta?.setName === filterSet)
    );
  });

  const hayFiltrosActivos = searchName !== '' || filterEstado !== 'all' ||
    filterMinPrice !== '' || filterMaxPrice !== '' ||
    filterRareza !== '' || filterSet !== '';
  ```

- [ ] **Step 5: Reemplazar la sección Mis Publicaciones en el JSX**

  Reemplazar todo el bloque `{/* ── PUBLICATIONS ── */}` por:

  ```tsx
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
        {/* Estado chips */}
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

        {/* Precio */}
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

      <div className="flex gap-3 flex-wrap">
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
            onClick={() => {
              setSearchName('');
              setFilterEstado('all');
              setFilterMinPrice('');
              setFilterMaxPrice('');
              setFilterRareza('');
              setFilterSet('');
            }}
            className="text-xs text-orange-500 hover:text-orange-600 border border-orange-200 px-3 py-1.5 rounded-full transition"
          >
            Limpiar filtros
          </button>
        )}
      </div>
    </div>

    {/* Grilla con scroll propio */}
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
  ```

- [ ] **Step 6: Probar manualmente**

  - Con publicaciones existentes: los filtros de nombre/estado/precio/rareza/set deben funcionar.
  - Con más de ~6-8 publicaciones: el scroll interno debe aparecer.
  - "Limpiar filtros" debe resetear todo.
  - El chip de estado activo debe verse resaltado en naranja.

- [ ] **Step 7: Commit**

  ```bash
  git add vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx
  git commit -m "feat(MiPerfilVendedor): add search/filter/scroll to Mis Publicaciones"
  ```

---

## Task 6: MiPerfilUsuarioPage — agregar SellerOnboarding

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilUsuarioPage.tsx`

- [ ] **Step 1: Importar SellerOnboarding**

  Al inicio del archivo, después de los imports existentes, agregar:

  ```tsx
  import SellerOnboarding from '../components/SellerOnboarding';
  ```

- [ ] **Step 2: Agregar el componente al final de la página**

  En el JSX, después del bloque `{/* ── VALORACIONES ── */}` y antes del cierre del `<div className="max-w-5xl mx-auto space-y-5">`, agregar:

  ```tsx
  {/* ── CONVERTIRSE EN VENDEDOR ── */}
  <SellerOnboarding />
  ```

- [ ] **Step 3: Probar manualmente**

  - Loguearse como usuario con role `user`.
  - Ir a `/mi-perfil-usuario`.
  - Al final de la página debe verse el botón/sección de SellerOnboarding.
  - El flujo completo (email verificado → OTP WhatsApp → upgrade) debe funcionar igual que en `/profile`.

- [ ] **Step 4: Commit**

  ```bash
  git add vite-project/vite-project-ts/src/pages/MiPerfilUsuarioPage.tsx
  git commit -m "feat(MiPerfilUsuario): add SellerOnboarding to become a seller"
  ```

---

## Task 7: MiPerfilTiendaRetiroPage — reestructurar secciones

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`

- [ ] **Step 1: Agregar estado para edición de horario rápido**

  Después de los estados existentes (después de `setSaveError`), agregar:

  ```tsx
  const [editingHorario, setEditingHorario] = useState(false);
  const [horarioDraft, setHorarioDraft] = useState('');
  const [horarioSaving, setHorarioSaving] = useState(false);
  const [horarioMsg, setHorarioMsg] = useState<string | null>(null);
  ```

- [ ] **Step 2: Inicializar horarioDraft cuando carga la tienda**

  En el `useEffect`, después de `setTienda(t)`, agregar:

  ```tsx
  setHorarioDraft(t?.horario || '');
  ```

- [ ] **Step 3: Agregar handler de guardado de horario**

  Después de `handleSave`, agregar:

  ```tsx
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
  ```

- [ ] **Step 4: Reemplazar el bloque "Mis Ventas" y agregar secciones nuevas**

  Reemplazar todo el bloque `{/* ── MIS VENTAS (próximamente) ── */}` por las siguientes secciones:

  ```tsx
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
              {tienda.horario ? `🕐 ${tienda.horario}` : <span className="text-gray-400 italic text-xs">Sin horario cargado</span>}
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
  ```

- [ ] **Step 5: Quitar el botón "Mostrar más/menos" de stats sin datos**

  Eliminar el bloque `{/* ── STATS ── */}` que solo tiene el botón (líneas ~237-244 del original):

  ```tsx
  {/* ── STATS ── */}
  <div className="mt-4">
    <button
      onClick={() => setStatsExpanded(o => !o)}
      ...
    >
      {statsExpanded ? 'Mostrar menos ▲' : 'Mostrar más ▼'}
    </button>
  </div>
  ```

  Y quitar el estado `statsExpanded` que ya no se usa.

- [ ] **Step 6: Probar manualmente**

  - Loguearse como tiendaRetiro.
  - Ir a `/tienda-retiro/perfil`.
  - Sección "Mi tienda de retiro" muestra nombre, dirección, ciudad y horario actual.
  - Click "Editar" en horario → escribir nuevo horario → Guardar → se muestra actualizado.
  - Los placeholders de publicaciones, valoraciones y ventas deben verse.

- [ ] **Step 7: Commit**

  ```bash
  git add vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx
  git commit -m "feat(MiPerfilTienda): restructure sections, add horario quick edit"
  ```

---

## Self-Review checklist

- [x] **descripcionCompra** cubierta en: entity (Task 1), sanitiser (Task 1), vista pública (Task 2), edición (Task 4)
- [x] **Edit inline vendedor** cubierta en Task 3 (reemplaza link a /profile)
- [x] **Filtros publicaciones** cubiertos en Task 5 (nombre, estado, precio, rareza, set + limpiar + scroll)
- [x] **SellerOnboarding en usuario** cubierto en Task 6
- [x] **Tienda reestructurada** cubierta en Task 7 (sección tienda propia, horario editable, placeholders)
- [x] Todos los commits son atómicos y dejan la app funcional
- [x] No hay TBDs ni placeholders de código en el plan
