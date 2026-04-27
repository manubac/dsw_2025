# TiendaRetiro Auth + Ventas Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email/password auth to TiendaRetiro stores, expose a ventas endpoint, and wire up the frontend with login option, protected route, dropdown, and read-only Ventas page.

**Architecture:** Follow the `intermediario` module pattern — extract a dedicated controller from the current inline route file, expand routes with login + ventas, update shared auth middleware to recognise `'tiendaRetiro'`, then add frontend route guard, dropdown items, and Ventas page.

**Tech Stack:** Express 5 + MikroORM 6 + bcryptjs + jsonwebtoken; React 19 + TypeScript + Tailwind CSS + React Router v6

---

## File Map

**Created:**
- `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`
- `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx`

**Modified:**
- `backend/src/tiendaRetiro/tiendaRetiro.entity.ts`
- `backend/src/tiendaRetiro/tiendaRetiro.routes.ts`
- `backend/src/shared/middleware/auth.ts`
- `vite-project/vite-project-ts/src/pages/LoginPage.tsx`
- `vite-project/vite-project-ts/src/components/Header.tsx`
- `vite-project/vite-project-ts/src/App.tsx`

---

### Task 1: Update TiendaRetiro entity and sync DB schema

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.entity.ts`

- [ ] **Step 1: Replace the entity file**

Full content of `backend/src/tiendaRetiro/tiendaRetiro.entity.ts`:

```typescript
import { Entity, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
export class TiendaRetiro extends BaseEntity {
  @Property({ type: 'string' })
  nombre!: string;

  @Property({ type: 'string' })
  direccion!: string;

  @Property({ type: 'string', nullable: true })
  horario?: string;

  @Property({ type: 'boolean', default: true })
  activo!: boolean;

  @Property({ type: 'string', nullable: false, unique: true })
  email!: string;

  @Property({ type: 'string', hidden: true, nullable: false })
  password!: string;

  @Property({ type: 'string', nullable: true })
  ciudad?: string;
}
```

- [ ] **Step 2: Sync DB schema**

```bash
cd backend
pnpm schema:update
```

Expected output includes lines like:
```
alter table "tienda_retiro" add column "email" varchar(255) not null;
alter table "tienda_retiro" add column "password" varchar(255) not null;
alter table "tienda_retiro" add column "ciudad" varchar(255) null;
```

If it says "No changes", the compiled output is stale. Stop the backend dev server, wait for `tsc-watch` to recompile, then retry.

- [ ] **Step 3: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.entity.ts
git commit -m "feat: add email, password, ciudad to TiendaRetiro entity"
```

---

### Task 2: Create tiendaRetiro.controller.ts

**Files:**
- Create: `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`

- [ ] **Step 1: Create the file**

Full content of `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`:

```typescript
import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { wrap } from "@mikro-orm/core";
import { TiendaRetiro } from "./tiendaRetiro.entity.js";
import { Compra } from "../compra/compra.entity.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const em = orm.em;

export function sanitizeTiendaRetiroInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nombre: req.body.nombre,
    email: req.body.email,
    password: req.body.password,
    direccion: req.body.direccion,
    horario: req.body.horario,
    ciudad: req.body.ciudad,
    activo: req.body.activo,
  };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

export async function findAll(_req: Request, res: Response) {
  try {
    const tiendas = await em.find(TiendaRetiro, { activo: true }, { orderBy: { nombre: "ASC" } });
    res.json({ data: tiendas });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tienda = await em.findOne(TiendaRetiro, { id });
    if (!tienda) return res.status(404).json({ message: "Tienda not found" });
    res.json({ data: tienda });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;
    if (!input.nombre || !input.email || !input.password || !input.direccion) {
      return res.status(400).json({ message: "nombre, email, password y direccion son obligatorios" });
    }
    const existing = await em.findOne(TiendaRetiro, { email: input.email });
    if (existing) return res.status(400).json({ message: "El email ya está registrado" });

    input.password = await bcrypt.hash(input.password, 10);
    const tienda = em.create(TiendaRetiro, input);
    await em.flush();
    res.status(201).json({ message: "TiendaRetiro creada", data: tienda });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const tienda = await em.findOne(TiendaRetiro, { email });
    if (!tienda) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, tienda.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: tienda.id, role: "tiendaRetiro" },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "7d" }
    );
    const tiendaData = { ...(wrap(tienda).toJSON() as any), role: "tiendaRetiro" };
    res.json({ message: "Login successful", data: tiendaData, token });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tienda = await em.findOne(TiendaRetiro, { id });
    if (!tienda) return res.status(404).json({ message: "Tienda not found" });
    em.assign(tienda, req.body.sanitizedInput);
    await em.flush();
    res.json({ message: "Tienda actualizada", data: tienda });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function getVentas(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const compras = await em.find(
      Compra,
      { tiendaRetiro: { id } },
      {
        populate: ["comprador", "itemCartas", "itemCartas.cartas", "itemCartas.cartas.uploader"],
        orderBy: { createdAt: "DESC" },
      }
    );

    const data = compras.map((compra) => {
      const vendedoresMap = new Map<number, { nombre: string; alias: string | null; cbu: string | null }>();
      for (const itemCarta of compra.itemCartas) {
        for (const carta of (itemCarta as any).cartas) {
          const v = (carta as any).uploader;
          if (v && !vendedoresMap.has(v.id)) {
            vendedoresMap.set(v.id, { nombre: v.nombre, alias: v.alias ?? null, cbu: v.cbu ?? null });
          }
        }
      }

      const items = (compra.items ?? []).map((i) => ({
        cartaNombre: i.title ?? `Carta #${i.cartaId}`,
        cantidad: i.quantity,
        precio: i.price ?? 0,
      }));

      return {
        id: compra.id,
        estado: compra.estado,
        total: compra.total,
        createdAt: compra.createdAt,
        comprador: {
          nombre: (compra.comprador as any)?.username || compra.nombre || "Comprador",
          email: (compra.comprador as any)?.email || compra.email || "",
        },
        vendedores: Array.from(vendedoresMap.values()),
        items,
      };
    });

    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors. If "Cannot find module" appears, verify imports end in `.js`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.controller.ts
git commit -m "feat: TiendaRetiro controller (findAll, findOne, add, login, update, getVentas)"
```

---

### Task 3: Update tiendaRetiro.routes.ts

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.routes.ts`

- [ ] **Step 1: Replace routes file**

> Note: `authorizeRoles('tiendaRetiro')` will show a TypeScript type error until Task 4 adds the role to the `Role` type. The runtime behaviour is correct; the type error is fixed in Task 4.

Full content of `backend/src/tiendaRetiro/tiendaRetiro.routes.ts`:

```typescript
import { Router } from "express";
import {
  sanitizeTiendaRetiroInput,
  findAll,
  findOne,
  add,
  login,
  update,
  getVentas,
} from "./tiendaRetiro.controller.js";
import { authenticate, authorizeRoles, authorizeSelf } from "../shared/middleware/auth.js";

export const tiendaRouter = Router();

tiendaRouter.get("/", findAll);
tiendaRouter.post("/", sanitizeTiendaRetiroInput, add);
tiendaRouter.post("/login", login);
tiendaRouter.get("/:id", findOne);
tiendaRouter.patch("/:id", authenticate, authorizeRoles("tiendaRetiro" as any), authorizeSelf, sanitizeTiendaRetiroInput, update);
tiendaRouter.get("/:id/ventas", authenticate, authorizeRoles("tiendaRetiro" as any), authorizeSelf, getVentas);
```

- [ ] **Step 2: Smoke test (backend running)**

```bash
# Create a test store
curl -X POST http://localhost:3000/api/tiendas \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Tienda Test","email":"test@tienda.com","password":"pass123","direccion":"Av. Test 123","ciudad":"Rosario"}'
```

Expected: `{"message":"TiendaRetiro creada","data":{...}}` with an `id`.

```bash
# Login
curl -X POST http://localhost:3000/api/tiendas/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@tienda.com","password":"pass123"}'
```

Expected: `{"message":"Login successful","data":{...,"role":"tiendaRetiro"},"token":"..."}`. Save the `id` and `token` for the next step.

- [ ] **Step 3: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.routes.ts
git commit -m "feat: expand TiendaRetiro routes (login, ventas, CRUD)"
```

---

### Task 4: Update auth middleware to handle tiendaRetiro role

**Files:**
- Modify: `backend/src/shared/middleware/auth.ts`

- [ ] **Step 1: Add TiendaRetiro import**

At the top of `backend/src/shared/middleware/auth.ts`, after the Intermediario import, add:

```typescript
import { TiendaRetiro } from '../../tiendaRetiro/tiendaRetiro.entity.js';
```

- [ ] **Step 2: Expand Role type and ActorEntity**

Replace:
```typescript
export type Role = 'user' | 'vendedor' | 'intermediario';
export type ActorEntity = User | Vendedor | Intermediario;
```

With:
```typescript
export type Role = 'user' | 'vendedor' | 'intermediario' | 'tiendaRetiro';
export type ActorEntity = User | Vendedor | Intermediario | TiendaRetiro;
```

- [ ] **Step 3: Add tiendaRetiro branch in authenticate**

Find the role-switch block inside `authenticate` and add the tiendaRetiro branch before the `else`:

```typescript
if (decoded.role === 'vendedor') {
  actor = await em.findOne(Vendedor, { id: decoded.userId });
} else if (decoded.role === 'intermediario') {
  actor = await em.findOne(Intermediario, { id: decoded.userId });
} else if (decoded.role === 'tiendaRetiro') {
  actor = await em.findOne(TiendaRetiro, { id: decoded.userId });
} else {
  actor = await em.findOne(User, { id: decoded.userId });
}
```

- [ ] **Step 4: Remove the `as any` casts from routes file**

Now that `Role` includes `'tiendaRetiro'`, open `backend/src/tiendaRetiro/tiendaRetiro.routes.ts` and remove the `as any` casts:

```typescript
tiendaRouter.patch("/:id", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizeTiendaRetiroInput, update);
tiendaRouter.get("/:id/ventas", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getVentas);
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Smoke test protected route**

Using the `id` and `token` from Task 3 Step 2:

```bash
curl http://localhost:3000/api/tiendas/<ID>/ventas \
  -H "Authorization: Bearer <TOKEN>"
```

Expected: `{"data":[]}` — empty array, 200 OK.

- [ ] **Step 7: Commit**

```bash
git add backend/src/shared/middleware/auth.ts backend/src/tiendaRetiro/tiendaRetiro.routes.ts
git commit -m "feat: add tiendaRetiro to auth middleware Role type and authenticate"
```

---

### Task 5: Update LoginPage.tsx

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/LoginPage.tsx`

- [ ] **Step 1: Add tiendaRetiro option to the role selector**

Find the `<select>` element and add the option after `intermediario`:

```tsx
<option value="vendedor">Vendedor</option>
<option value="usuario">Usuario regular</option>
<option value="intermediario">Intermediario</option>
<option value="tiendaRetiro">Tienda de retiro</option>
```

- [ ] **Step 2: Add tiendaRetiro endpoint in handleSubmit**

Find the endpoint selection block and add the new branch:

```typescript
if (formData.rol === "vendedor") {
  endpoint = "/api/vendedores/login";
} else if (formData.rol === "usuario") {
  endpoint = "/api/users/login";
} else if (formData.rol === "intermediario") {
  endpoint = "/api/intermediarios/login";
} else if (formData.rol === "tiendaRetiro") {
  endpoint = "/api/tiendas/login";
} else {
  throw new Error("Rol de usuario no válido.");
}
```

- [ ] **Step 3: Redirect tiendaRetiro to /tienda-retiro/ventas**

Replace the `setTimeout` redirect:

```typescript
setTimeout(() => {
  if (formData.rol === 'tiendaRetiro') {
    navigate("/tienda-retiro/ventas");
  } else {
    navigate("/");
  }
}, 1200);
```

- [ ] **Step 4: Verify in browser**

1. Go to `http://localhost:5173/login`
2. Confirm "Tienda de retiro" appears in the dropdown
3. Log in with `test@tienda.com` / `pass123`
4. Confirm redirect to `/tienda-retiro/ventas` (will show 404 until Task 7 — that's expected)

- [ ] **Step 5: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/LoginPage.tsx
git commit -m "feat: add tiendaRetiro login option and post-login redirect"
```

---

### Task 6: Update Header.tsx — tiendaRetiro dropdown

**Files:**
- Modify: `vite-project/vite-project-ts/src/components/Header.tsx`

- [ ] **Step 1: Replace the dropdown div**

Find the `{user && userMenuOpen && (...)}` block (starts around line 269) and replace the entire inner `<div className="absolute right-0 mt-2 w-48 ...">` with:

```tsx
{user && userMenuOpen && (
  <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-[70]">
    {user.role === 'tiendaRetiro' ? (
      <>
        <button
          onClick={() => { setUserMenuOpen(false); navigate('/tienda-retiro/perfil'); }}
          className="block w-full text-left px-4 py-2 hover:bg-orange-100"
        >
          Mi Perfil
        </button>
        <button
          onClick={() => { setUserMenuOpen(false); navigate('/tienda-retiro/ventas'); }}
          className="block w-full text-left px-4 py-2 hover:bg-orange-100"
        >
          Ventas
        </button>
        <button
          onClick={handleLogout}
          className="block w-full text-left px-4 py-2 hover:bg-orange-100"
        >
          Cerrar Sesión
        </button>
      </>
    ) : (
      <>
        <button onClick={handleProfileClick} className="block w-full text-left px-4 py-2 hover:bg-orange-100">
          Mi Perfil
        </button>

        {(user.role === 'user' || user.role === 'usuario') && (
          <button
            onClick={() => { setUserMenuOpen(false); navigate('/wishlist'); }}
            className="block w-full text-left px-4 py-2 hover:bg-orange-100 text-red-500 font-medium"
          >
            ♥ Mis Favoritos
          </button>
        )}

        {user.role === 'user' && (
          <button
            onClick={() => { setUserMenuOpen(false); navigate('/purchases'); }}
            className="block w-full text-left px-4 py-2 hover:bg-orange-100"
          >
            Mis Compras
          </button>
        )}

        {user.role === 'vendedor' && (
          <button
            onClick={() => { setUserMenuOpen(false); navigate('/mis-publicaciones'); }}
            className="block w-full text-left px-4 py-2 hover:bg-orange-100"
          >
            Mis Publicaciones
          </button>
        )}

        {user.role === 'vendedor' && (
          <button
            onClick={() => { setUserMenuOpen(false); navigate('/mis-ventas'); }}
            className="block w-full text-left px-4 py-2 hover:bg-orange-100"
          >
            Mis Ventas
          </button>
        )}

        {user.role === 'usuario' && (
          <button
            onClick={() => { setUserMenuOpen(false); navigate('/purchases'); }}
            className="block w-full text-left px-4 py-2 hover:bg-orange-100"
          >
            Mis Compras
          </button>
        )}

        {user.role === 'intermediario' && (
          <button
            onClick={() => { setUserMenuOpen(false); navigate('/intermediario'); }}
            className="block w-full text-left px-4 py-2 hover:bg-orange-100"
          >
            Panel de Intermediario
          </button>
        )}

        <button
          onClick={handleDeleteAccount}
          className="block w-full text-left px-4 py-2 text-red-500 hover:bg-orange-100"
        >
          Eliminar Cuenta
        </button>

        <button
          onClick={handleLogout}
          className="block w-full text-left px-4 py-2 hover:bg-orange-100"
        >
          Cerrar Sesión
        </button>
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Verify in browser**

Logged in as the test tienda:
1. Click the username top-right
2. Dropdown shows only: Mi Perfil | Ventas | Cerrar Sesión
3. Log out, log in as vendedor — original dropdown unchanged

- [ ] **Step 3: Commit**

```bash
git add vite-project/vite-project-ts/src/components/Header.tsx
git commit -m "feat: tiendaRetiro dropdown in Header (Mi Perfil, Ventas, Cerrar Sesión)"
```

---

### Task 7: Update App.tsx — route guard, new routes, restrict ProtectedRoute

**Files:**
- Modify: `vite-project/vite-project-ts/src/App.tsx`

- [ ] **Step 1: Add TiendaRetiroVentasPage import**

At the top of `App.tsx`, after the last import:

```tsx
import TiendaRetiroVentasPage from "./pages/TiendaRetiroVentasPage";
```

- [ ] **Step 2: Replace ProtectedRoute and add TiendaRetiroRoute**

Find the `ProtectedRoute` function and replace it, then add `TiendaRetiroRoute` right after:

```tsx
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'tiendaRetiro') return <Navigate to="/" replace />;
  return children;
}

function TiendaRetiroRoute({ children }: { children: JSX.Element }) {
  const { user } = useUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'tiendaRetiro') return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 3: Add tienda-retiro routes**

After the intermediario route block and before `{/* ✅ RUTAS MERCADOPAGO */}`, add:

```tsx
{/* Panel tienda retiro */}
<Route
  path="tienda-retiro/ventas"
  element={
    <TiendaRetiroRoute>
      <TiendaRetiroVentasPage />
    </TiendaRetiroRoute>
  }
/>
<Route
  path="tienda-retiro/perfil"
  element={
    <TiendaRetiroRoute>
      <div className="p-8 text-center text-gray-500">Perfil de tienda — próximamente</div>
    </TiendaRetiroRoute>
  }
/>
```

- [ ] **Step 4: Verify in browser (logged in as tienda)**

| URL | Expected result |
|---|---|
| `/reservar` | Redirect to `/` |
| `/publicar` | Redirect to `/` |
| `/purchases` | Redirect to `/` |
| `/tienda-retiro/ventas` | Page loads (empty state) |
| `/tienda-retiro/perfil` | "Perfil de tienda — próximamente" |
| `/cards` | Page loads normally |

- [ ] **Step 5: Verify vendedor routes still work**

Log in as a vendedor. Confirm `/mis-ventas` and `/publicar` load correctly.

- [ ] **Step 6: Commit**

```bash
git add vite-project/vite-project-ts/src/App.tsx
git commit -m "feat: TiendaRetiroRoute guard, tienda-retiro routes, block tiendaRetiro from buyer/seller pages"
```

---

### Task 8: Create TiendaRetiroVentasPage.tsx

**Files:**
- Create: `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx`

- [ ] **Step 1: Create the file**

Full content of `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useUser } from "../context/user";
import { fetchApi } from "../services/api";

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
  pendiente: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800" },
  entregado_a_tienda: { label: "En tienda", color: "bg-blue-100 text-blue-800" },
  retirado: { label: "Retirado", color: "bg-green-100 text-green-800" },
};

export default function TiendaRetiroVentasPage() {
  const { user } = useUser();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    fetchApi(`/api/tiendas/${user.id}/ventas`)
      .then((r) => r.json())
      .then((json) => {
        setVentas(json.data ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Error al cargar las ventas");
        setLoading(false);
      });
  }, [user?.id]);

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando ventas...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (ventas.length === 0)
    return (
      <div className="p-8 text-center text-gray-500">
        No hay ventas asociadas a esta tienda todavía.
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Ventas en mi tienda</h1>
      <div className="space-y-4">
        {ventas.map((venta) => {
          const badge = ESTADO_BADGE[venta.estado] ?? {
            label: venta.estado,
            color: "bg-gray-100 text-gray-700",
          };
          return (
            <div key={venta.id} className="border rounded-xl p-5 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">Compra #{venta.id}</span>
                  <span className="text-sm text-gray-400">
                    {new Date(venta.createdAt).toLocaleDateString("es-AR")}
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
                  <p className="text-gray-500">{venta.comprador.email}</p>
                </div>
                <div>
                  <p className="font-semibold text-gray-600 mb-1">Vendedor(es)</p>
                  {venta.vendedores.length === 0 ? (
                    <p className="text-gray-400 italic">Sin datos</p>
                  ) : (
                    venta.vendedores.map((v, i) => (
                      <div key={i} className="mb-1">
                        <p className="text-gray-800">{v.nombre}</p>
                        {v.alias && (
                          <p className="text-gray-500 text-xs">Alias: {v.alias}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="font-semibold text-gray-600 text-sm mb-2">Artículos</p>
                {venta.items.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Sin detalle de artículos</p>
                ) : (
                  <div className="space-y-1">
                    {venta.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          {item.cartaNombre} × {item.cantidad}
                        </span>
                        <span className="text-gray-600 font-medium">
                          ${item.precio.toLocaleString("es-AR")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t flex justify-end">
                <span className="font-bold text-gray-900">
                  Total: ${venta.total.toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

1. Log in as the test tienda (`test@tienda.com` / `pass123`)
2. Navigate to `/tienda-retiro/ventas`
3. Confirm the page loads with "No hay ventas asociadas a esta tienda todavía."
4. Open DevTools → Network: confirm `GET /api/tiendas/<id>/ventas` returns 200 with `{"data":[]}`

- [ ] **Step 3: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx
git commit -m "feat: TiendaRetiroVentasPage — read-only ventas dashboard"
```

---

### Task 9: Data migration — remove old manual tiendaRetiro rows and create real stores

**Files:** none (DB + curl only)

- [ ] **Step 1: Delete old manual rows**

Connect to PostgreSQL and delete the pre-existing rows that have no email/password:

```sql
DELETE FROM tienda_retiro;
```

Via psql: `psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw -c "DELETE FROM tienda_retiro;"`

- [ ] **Step 2: Create real stores via POST**

For each real pickup store, send a POST to the backend:

```bash
curl -X POST http://localhost:3000/api/tiendas \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Nombre real de la tienda",
    "email": "tienda@ejemplo.com",
    "password": "contraseña_segura",
    "direccion": "Dirección completa",
    "ciudad": "Ciudad",
    "horario": "Lun-Vie 9-18hs"
  }'
```

Save the returned `id` — it's the login identifier for the store.

- [ ] **Step 3: Verify Reservar page shows new stores**

1. Log in as a regular user
2. Navigate to `/reservar`
3. Confirm only the newly created stores appear in the pickup store picker

- [ ] **Step 4: Final integration smoke test**

| Action | Expected |
|---|---|
| Log in as tienda | Redirects to `/tienda-retiro/ventas` |
| Header dropdown | Mi Perfil, Ventas, Cerrar Sesión |
| `/reservar` (as tienda) | Redirects to `/` |
| `/publicar` (as tienda) | Redirects to `/` |
| `/tienda-retiro/ventas` | Loads, shows empty state or real ventas |
| Log in as vendedor | `/mis-ventas` still works |
| Log in as user | `/purchases` still works |
