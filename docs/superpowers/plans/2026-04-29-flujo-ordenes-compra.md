# Flujo Órdenes de Compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestructurar la máquina de estados de las órdenes de compra para que cada flujo tenga un owner claro de transiciones, estados coherentes con la UI, alias/CBU siempre visibles, valoraciones en todos los flujos, y la tienda de retiro maneje su flujo de manera completa.

**Architecture:** Cuatro flujos distintos (vendedor+tienda, tienda directa, tienda comprando, vendedor sin tienda) con estados `pendiente → en_tienda → finalizado` para flujo 1, `pendiente → listo_para_retirar → finalizado` para flujo 2, `pendiente → finalizado` para flujos 3 y 4. Se eliminan `entregado_a_tienda` y `retirado`. Los cambios de estado del vendedor en el flujo 1 (botón "Entregar a tienda") se eliminan; la tienda es el único actor que gestiona ese flujo.

**Tech Stack:** Express 5 + TypeScript + MikroORM 6 (backend), React 19 + TypeScript + Vite (frontend), Nodemailer (emails), Socket.IO (chat existente).

---

## Archivos modificados

### Backend
- `backend/src/compra/compra.controler.ts` — eliminar función `retirar`
- `backend/src/compra/compra.routes.ts` — eliminar ruta `PATCH /:id/retirar`
- `backend/src/vendedor/vendedor.controller.ts` — eliminar `entregarTienda`, agregar `finalizarVenta`, actualizar `getVentas`
- `backend/src/vendedor/vendedor.routes.ts` — eliminar ruta `entregar-tienda`, agregar `finalizar`
- `backend/src/tiendaRetiro/tiendaRetiro.controller.ts` — ajustar `marcarEnTienda` y `finalizarCompra`, agregar `marcarListoParaRetirar` y `finalizarVentaDirecta`, eliminar `finalizarDirecto`
- `backend/src/tiendaRetiro/tiendaRetiro.routes.ts` — agregar rutas flujo 2, eliminar `finalizar-directo`

### Frontend
- `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx` — nueva máquina de estados, chat, ReviewModal
- `vite-project/vite-project-ts/src/pages/Purchases.tsx` — alias/CBU siempre visible, badges actualizados, quitar "Retirar"
- `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx` — quitar "Entregar a tienda", agregar "Marcar finalizado" flujos 3/4
- `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx` — flujo 2 en ventas directas, tab "Mis Compras", ReviewModal
- `vite-project/vite-project-ts/src/pages/Reservar.tsx` — auto-asignar tiendaRetiro cuando comprador es tiendaRetiro

---

## Task 1: SQL migration — limpiar estados legacy

**Files:**
- DB directo (psql o DBeaver)

- [ ] **Step 1: Correr migración en la base de datos**

Conectarse a la DB y ejecutar:
```sql
UPDATE compra SET estado = 'en_tienda'  WHERE estado = 'entregado_a_tienda';
UPDATE compra SET estado = 'finalizado' WHERE estado = 'retirado';
```

- [ ] **Step 2: Verificar que no queden estados legacy**

```sql
SELECT estado, COUNT(*) FROM compra GROUP BY estado;
```

Esperado: ninguna fila con `entregado_a_tienda` ni `retirado`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: migrate legacy compra states to new state machine"
```

---

## Task 2: Backend — compra.controler.ts: eliminar `retirar`

**Files:**
- Modify: `backend/src/compra/compra.controler.ts`
- Modify: `backend/src/compra/compra.routes.ts`

- [ ] **Step 1: Eliminar la función `retirar` del controller**

En `backend/src/compra/compra.controler.ts`, localizar y eliminar completamente la función `retirar` (buscar `export async function retirar` o `async function retirar`).

- [ ] **Step 2: Actualizar compra.routes.ts**

Reemplazar el contenido de `backend/src/compra/compra.routes.ts`:

```typescript
import { Router } from "express";
import {
  sanitizeCompraInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  createPreference,
} from "./compra.controler.js";
import { authenticate, authorizeRoles } from "../shared/middleware/auth.js";

export const compraRouter = Router();

compraRouter.get("/", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), findAll);
compraRouter.get("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), findOne);
compraRouter.post("/", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, add);
compraRouter.post("/preference", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, createPreference);
compraRouter.put("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, update);
compraRouter.patch("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, update);
compraRouter.delete("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), remove);
```

- [ ] **Step 3: Verificar que el backend compila sin errores**

```bash
cd backend && pnpm start:dev
```

Esperado: no hay errores de TypeScript relacionados con `retirar`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/compra/compra.controler.ts backend/src/compra/compra.routes.ts
git commit -m "feat: remove retirar endpoint — state absorbed into finalizado"
```

---

## Task 3: Backend — tiendaRetiro controller: nueva máquina de estados

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`

- [ ] **Step 1: Ajustar `marcarEnTienda` — precondición desde `pendiente`**

Reemplazar el bloque completo de `marcarEnTienda` (líneas 179–224):

```typescript
export async function marcarEnTienda(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'tiendaRetiro', 'itemCartas', 'itemCartas.uploaderVendedor'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'en_tienda';
    await orm.em.flush();

    const tienda = compra.tiendaRetiro;
    const destinatario = (compra.comprador as any)?.email || compra.email;
    const nombreComprador = (compra.comprador as any)?.username || compra.nombre || 'comprador';

    const vendedor = compra.itemCartas.getItems().find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor as any;
    const aliasInfo = vendedor?.alias ? `\n<p><strong>Alias para pagar:</strong> ${vendedor.alias}</p>` : '';
    const cbuInfo   = vendedor?.cbu   ? `<p><strong>CBU:</strong> ${vendedor.cbu}</p>` : '';

    if (destinatario && tienda) {
      const html = `
        <h2>¡Tu carta llegó al local, ${nombreComprador}!</h2>
        <p>La orden <strong>#${compra.id}</strong> está disponible en:</p>
        <p><strong>${tienda.nombre}</strong><br/>
        ${tienda.direccion}<br/>
        ${tienda.horario ? `🕐 ${tienda.horario}` : ''}</p>
        ${aliasInfo}${cbuInfo}
        <p>No olvides transferir al vendedor antes de retirar y mostrá el comprobante en la tienda.</p>
      `;
      sendEmail(
        destinatario,
        `Tu carta #${compra.id} llegó al local`,
        `Tu carta llegó a ${tienda.nombre}`,
        html
      );
    }

    res.json({ message: 'Compra marcada como en tienda', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 2: Ajustar `finalizarCompra` — quitar emails**

Reemplazar el bloque completo de `finalizarCompra` (líneas 226–283):

```typescript
export async function finalizarCompra(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'tiendaRetiro', 'itemCartas', 'itemCartas.uploaderVendedor'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    if (compra.estado !== 'en_tienda') {
      return res.status(400).json({ message: 'La compra no está en estado en_tienda' });
    }

    compra.estado = 'finalizado';
    await orm.em.flush();

    res.json({ message: 'Compra finalizada', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 3: Agregar `marcarListoParaRetirar` (flujo 2: pendiente → listo_para_retirar)**

Añadir después de `finalizarCompra`, antes de `getPublicaciones`:

```typescript
export async function marcarListoParaRetirar(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'tiendaRetiro', 'itemCartas', 'itemCartas.uploaderTienda'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    const esDirect = compra.itemCartas.getItems().some((ic: any) => ic.uploaderTienda?.id === tiendaId);
    if (!esDirect) return res.status(400).json({ message: 'Esta compra no es una venta directa de la tienda' });

    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'listo_para_retirar';
    await orm.em.flush();

    const tienda = compra.tiendaRetiro;
    const destinatario = (compra.comprador as any)?.email || compra.email;
    const nombreComprador = (compra.comprador as any)?.username || compra.nombre || 'comprador';

    if (destinatario && tienda) {
      const html = `
        <h2>¡Tu carta está lista para retirar, ${nombreComprador}!</h2>
        <p>La orden <strong>#${compra.id}</strong> ya está disponible en:</p>
        <p><strong>${tienda.nombre}</strong><br/>
        ${tienda.direccion}<br/>
        ${tienda.horario ? `🕐 ${tienda.horario}` : ''}</p>
        <p>Cuando vayas a retirarla, llevá el número de orden y completá el pago en la tienda.</p>
      `;
      sendEmail(
        destinatario,
        `Tu carta #${compra.id} está lista para retirar`,
        `Tu carta está lista en ${tienda.nombre}`,
        html
      );
    }

    res.json({ message: 'Compra marcada como lista para retirar', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 4: Agregar `finalizarVentaDirecta` (flujo 2: listo_para_retirar → finalizado)**

Añadir después de `marcarListoParaRetirar`:

```typescript
export async function finalizarVentaDirecta(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'itemCartas', 'itemCartas.uploaderTienda'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    const esDirect = compra.itemCartas.getItems().some((ic: any) => ic.uploaderTienda?.id === tiendaId);
    if (!esDirect) return res.status(400).json({ message: 'Esta compra no es una venta directa de la tienda' });

    if (compra.estado !== 'listo_para_retirar') {
      return res.status(400).json({ message: 'La compra no está en estado listo_para_retirar' });
    }

    compra.estado = 'finalizado';
    await orm.em.flush();

    res.json({ message: 'Venta directa finalizada', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 5: Eliminar `finalizarDirecto`**

Localizar y eliminar completamente la función `finalizarDirecto` (líneas 437–462 aprox). Verificar que el compilador no arroje errores por el export.

- [ ] **Step 6: Actualizar el export al final del archivo**

Buscar la línea `export {` o verificar que todas las funciones nuevas tienen `export` en su declaración. Las cuatro funciones nuevas/modificadas ya tienen `export` en su declaración directa, así que no hay cambio necesario al final.

- [ ] **Step 7: Verificar compilación**

```bash
cd backend && pnpm start:dev
```

Esperado: sin errores de TypeScript.

- [ ] **Step 8: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.controller.ts
git commit -m "feat(tienda): new state machine — marcarEnTienda from pendiente, add marcarListoParaRetirar and finalizarVentaDirecta"
```

---

## Task 4: Backend — tiendaRetiro.routes.ts: actualizar rutas

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.routes.ts`

- [ ] **Step 1: Reemplazar el archivo completo**

```typescript
import { Router } from "express";
import {
  sanitizeTiendaRetiroInput,
  sanitizePublicacionTiendaInput,
  findAll,
  findOne,
  add,
  login,
  update,
  getVentas,
  marcarEnTienda,
  finalizarCompra,
  getPublicaciones,
  addPublicacion,
  updatePublicacion,
  removePublicacion,
  getVentasDirectas,
  marcarListoParaRetirar,
  finalizarVentaDirecta,
} from "./tiendaRetiro.controller.js";
import { authenticate, authorizeRoles, authorizeSelf } from "../shared/middleware/auth.js";

export const tiendaRouter = Router();

tiendaRouter.get("/", findAll);
tiendaRouter.post("/", sanitizeTiendaRetiroInput, add);
tiendaRouter.post("/login", login);
tiendaRouter.get("/:id", findOne);
tiendaRouter.patch("/:id", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizeTiendaRetiroInput, update);

// Flujo 1: vendedor + tienda de retiro (3 actores)
tiendaRouter.get("/:id/ventas", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getVentas);
tiendaRouter.patch("/:id/ventas/:compraId/en-tienda", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, marcarEnTienda);
tiendaRouter.patch("/:id/ventas/:compraId/finalizar", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, finalizarCompra);

// Publicaciones propias de la tienda
tiendaRouter.get("/:id/publicaciones", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getPublicaciones);
tiendaRouter.post("/:id/publicaciones", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizePublicacionTiendaInput, addPublicacion);
tiendaRouter.patch("/:id/publicaciones/:cartaId", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizePublicacionTiendaInput, updatePublicacion);
tiendaRouter.delete("/:id/publicaciones/:cartaId", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, removePublicacion);

// Flujo 2: tienda vende directamente (2 actores)
tiendaRouter.get("/:id/ventas-directas", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getVentasDirectas);
tiendaRouter.patch("/:id/ventas-directas/:compraId/listo", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, marcarListoParaRetirar);
tiendaRouter.patch("/:id/ventas-directas/:compraId/finalizar", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, finalizarVentaDirecta);
```

- [ ] **Step 2: Verificar compilación**

```bash
cd backend && pnpm start:dev
```

Esperado: sin errores. Confirmar en los logs que el servidor arranca en puerto 3000.

- [ ] **Step 3: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.routes.ts
git commit -m "feat(tienda): update routes for flujo 1 and flujo 2 state machine"
```

---

## Task 5: Backend — vendedor controller: eliminar `entregarTienda`, agregar `finalizarVenta`

**Files:**
- Modify: `backend/src/vendedor/vendedor.controller.ts`

- [ ] **Step 1: Eliminar la función `entregarTienda`**

Localizar y eliminar completamente la función `entregarTienda` (líneas 184–233 aprox). Es la función que cambia estado a `entregado_a_tienda`.

- [ ] **Step 2: Agregar `finalizarVenta` (flujos 3 y 4)**

Añadir antes del bloque `export {` al final del archivo:

```typescript
async function finalizarVenta(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const vendedorId = Number(req.params.id);

    const compra = await em.findOne(
      Compra,
      { id: compraId },
      { populate: ['itemCartas', 'itemCartas.uploaderVendedor', 'tiendaRetiro', 'compradorTienda'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

    const isVendor = compra.itemCartas.getItems().some(item =>
      item.uploaderVendedor?.id === vendedorId
    );
    if (!isVendor) return res.status(403).json({ message: 'No sos vendedor en esta compra' });

    // Flujo 1: tiene tienda de retiro Y el comprador NO es una tienda → la tienda gestiona el estado
    const tieneRetiroTercero = compra.tiendaRetiro && !(compra as any).compradorTienda;
    if (tieneRetiroTercero) {
      return res.status(400).json({ message: 'Esta compra tiene tienda de retiro — el estado lo gestiona la tienda' });
    }

    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'finalizado';
    await em.flush();

    res.json({ message: 'Venta finalizada', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 3: Agregar `compradorTienda` al populate de `getVentas` y al response**

En `getVentas` (línea 108 aprox), actualizar el populate:

```typescript
populate: ['itemCartas', 'itemCartas.cartas', 'itemCartas.uploaderVendedor', 'comprador', 'envio', 'envio.intermediario', 'envio.intermediario.direccion', 'tiendaRetiro', 'compradorTienda']
```

En el `return` dentro del `.map()` (donde se construye el objeto de respuesta), agregar la propiedad `esTiendaCompradora` justo después de `estado`:

```typescript
estado: c.estado,
esTiendaCompradora: !!(c as any).compradorTienda,
```

- [ ] **Step 4: Actualizar el export al final del archivo**

Cambiar la línea `export {` para quitar `entregarTienda` y agregar `finalizarVenta`:

```typescript
export { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent, finalizarVenta, getTiendasRetiro, updateTiendasRetiro };
```

- [ ] **Step 5: Verificar compilación**

```bash
cd backend && pnpm start:dev
```

Esperado: sin errores de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add backend/src/vendedor/vendedor.controller.ts
git commit -m "feat(vendedor): remove entregarTienda, add finalizarVenta for flujos 3 and 4"
```

---

## Task 6: Backend — vendedor.routes.ts: actualizar rutas

**Files:**
- Modify: `backend/src/vendedor/vendedor.routes.ts`

- [ ] **Step 1: Reemplazar el archivo completo**

```typescript
import { Router } from 'express';
import { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent, finalizarVenta, getTiendasRetiro, updateTiendasRetiro } from './vendedor.controller.js';
import { authenticate, authorizeRoles, authorizeSelf } from '../shared/middleware/auth.js';

export const vendedorRouter = Router();

// Rutas públicas
vendedorRouter.post('/login', login);
vendedorRouter.post('/', sanitiseVendedorInput, add);
vendedorRouter.get('/', findAll);
vendedorRouter.get('/:id', findOne);

// Autenticado
vendedorRouter.post('/logout', authenticate, logout);

// Solo el propio vendedor
vendedorRouter.get('/:id/ventas', authenticate, authorizeRoles('vendedor'), authorizeSelf, getVentas);
vendedorRouter.post('/:id/ventas/:compraId/enviar', authenticate, authorizeRoles('vendedor'), authorizeSelf, markSent);
vendedorRouter.patch('/:id/ventas/:compraId/finalizar', authenticate, authorizeRoles('vendedor'), authorizeSelf, finalizarVenta);

// Tiendas de retiro del vendedor
vendedorRouter.get('/:id/tiendas', getTiendasRetiro);
vendedorRouter.put('/:id/tiendas', authenticate, authorizeRoles('vendedor'), authorizeSelf, updateTiendasRetiro);

// Perfil
vendedorRouter.put('/:id', authenticate, authorizeRoles('vendedor'), authorizeSelf, sanitiseVendedorInput, update);
vendedorRouter.patch('/:id', authenticate, authorizeRoles('vendedor'), authorizeSelf, sanitiseVendedorInput, update);
vendedorRouter.delete('/:id', authenticate, authorizeRoles('vendedor'), authorizeSelf, remove);
```

- [ ] **Step 2: Verificar compilación y reinicio**

```bash
cd backend && pnpm start:dev
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/vendedor/vendedor.routes.ts
git commit -m "feat(vendedor): replace entregar-tienda route with finalizar"
```

---

## Task 7: Frontend — TiendaRetiroVentasPage.tsx: nueva máquina de estados + chat + ReviewModal

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
import { useEffect, useState } from "react";
import { useUser } from "../context/user";
import { fetchApi } from "../services/api";
import { Chat } from "../components/Chat";
import { ReviewModal } from "../components/ReviewModal";

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
  pendiente:           { label: "Pendiente",           color: "bg-yellow-100 text-yellow-800" },
  en_tienda:           { label: "Llegó al local",       color: "bg-blue-100 text-blue-800" },
  listo_para_retirar:  { label: "Listo para retirar",   color: "bg-orange-100 text-orange-800" },
  finalizado:          { label: "Finalizado",           color: "bg-green-100 text-green-800" },
};

export default function TiendaRetiroVentasPage() {
  const { user } = useUser();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [chatAbierto, setChatAbierto] = useState<number | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string; type: 'user'; compraId: number } | null>(null);
  const [reviewedMap, setReviewedMap] = useState<Record<string, number>>({});

  const fetchVentas = () => {
    if (!user?.id) return;
    Promise.all([
      fetchApi(`/api/tiendas/${user.id}/ventas`).then(r => r.json()),
      fetchApi('/api/valoraciones/mias').then(r => r.json()),
    ]).then(([ventasJson, reviewsJson]) => {
      setVentas(ventasJson.data ?? []);
      const map: Record<string, number> = {};
      for (const v of (reviewsJson.data || [])) {
        if (v.compra?.id != null) map[`${v.compra.id}_${v.tipoObjeto}_${v.objetoId}`] = v.puntuacion;
      }
      setReviewedMap(map);
      setLoading(false);
    }).catch(() => {
      setError("Error al cargar las ventas");
      setLoading(false);
    });
  };

  useEffect(() => { fetchVentas(); }, [user?.id]);

  const handleMarcarEnTienda = async (ventaId: number) => {
    if (!confirm("¿Confirmás que recibiste este pedido en la tienda?")) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/en-tienda`, { method: "PATCH" });
      fetchVentas();
    } catch { alert("Error al actualizar el estado"); }
    finally { setActionLoading(null); }
  };

  const handleFinalizar = async (ventaId: number) => {
    if (!confirm("¿Confirmás que el comprador retiró el pedido y completó el pago?")) return;
    setActionLoading(ventaId);
    try {
      await fetchApi(`/api/tiendas/${user!.id}/ventas/${ventaId}/finalizar`, { method: "PATCH" });
      fetchVentas();
    } catch { alert("Error al finalizar la orden"); }
    finally { setActionLoading(null); }
  };

  const renderReviewButton = (compraId: number, compradorId: number, compradorNombre: string) => {
    const key = `${compraId}_user_${compradorId}`;
    const puntuacion = reviewedMap[key];
    if (puntuacion != null) {
      return (
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-100 px-3 py-1 rounded-lg">
          <span className="text-orange-300">{'★'.repeat(puntuacion)}{'☆'.repeat(5 - puntuacion)}</span>
          <span>{compradorNombre} — ya valorado</span>
        </div>
      );
    }
    return (
      <button
        className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1 rounded-lg transition"
        onClick={() => { setReviewTarget({ id: compradorId, name: compradorNombre, type: 'user', compraId }); setReviewModalOpen(true); }}
      >
        ★ Valorar comprador: {compradorNombre}
      </button>
    );
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando ventas...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (ventas.length === 0)
    return <div className="p-8 text-center text-gray-500">No hay ventas asociadas a esta tienda todavía.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Ventas en mi tienda</h1>
      <div className="space-y-4">
        {ventas.map((venta) => {
          const badge = ESTADO_BADGE[venta.estado] ?? { label: venta.estado, color: "bg-gray-100 text-gray-700" };
          return (
            <div key={venta.id} className="border rounded-xl p-5 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">Compra #{venta.id}</span>
                  <span className="text-sm text-gray-400">{new Date(venta.createdAt).toLocaleDateString("es-AR")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.color}`}>{badge.label}</span>
                  <button
                    onClick={() => setChatAbierto(chatAbierto === venta.id ? null : venta.id)}
                    className="bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1 rounded-full text-sm transition"
                  >
                    {chatAbierto === venta.id ? 'Cerrar chat' : '💬 Chat'}
                  </button>
                </div>
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
                        {v.alias && <p className="text-gray-500 text-xs">Alias: <span className="font-mono font-semibold">{v.alias}</span></p>}
                        {v.cbu   && <p className="text-gray-500 text-xs">CBU: <span className="font-mono">{v.cbu}</span></p>}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mb-4">
                <p className="font-semibold text-gray-600 text-sm mb-2">Artículos</p>
                {venta.items.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">Sin detalle de artículos</p>
                ) : (
                  <div className="space-y-1">
                    {venta.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.cartaNombre} × {item.cantidad}</span>
                        <span className="text-gray-600 font-medium">${item.precio.toLocaleString("es-AR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t flex items-center justify-between gap-2 flex-wrap">
                <span className="font-bold text-gray-900">Total: ${venta.total.toLocaleString("es-AR")}</span>

                <div className="flex items-center gap-2 flex-wrap">
                  {venta.estado === "pendiente" && (
                    <button
                      disabled={actionLoading === venta.id}
                      onClick={() => handleMarcarEnTienda(venta.id)}
                      className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {actionLoading === venta.id ? "Procesando..." : "Confirmar llegada al local"}
                    </button>
                  )}

                  {venta.estado === "en_tienda" && (
                    <button
                      disabled={actionLoading === venta.id}
                      onClick={() => handleFinalizar(venta.id)}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                    >
                      {actionLoading === venta.id ? "Procesando..." : "Finalizar orden"}
                    </button>
                  )}

                  {venta.estado === "finalizado" && renderReviewButton(venta.id, 0, venta.comprador.nombre)}
                </div>
              </div>

              {chatAbierto === venta.id && (
                <div className="mt-4 pt-4 border-t">
                  <Chat compraId={venta.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>

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
  );
}
```

> **Nota:** El `renderReviewButton` usa `compradorId: 0` como placeholder porque el backend no devuelve el `id` del comprador en `/ventas`. En el Step 2 se corrige.

- [ ] **Step 2: Corregir el backend — agregar `compradorId` en `getVentas` de tiendaRetiro**

En `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`, dentro de `getVentas`, buscar el bloque `comprador: {` en el map y agregar el `id`:

```typescript
comprador: {
  id:     (compra.comprador as any)?.id || null,
  nombre: (compra.comprador as any)?.username || compra.nombre || "Comprador",
  email:  (compra.comprador as any)?.email    || compra.email  || "",
},
```

Y en el type de `TiendaRetiroVentasPage.tsx`, actualizar el type `Venta`:

```typescript
type Venta = {
  id: number;
  estado: string;
  total: number;
  createdAt: string;
  comprador: { id: number | null; nombre: string; email: string };
  vendedores: Vendedor[];
  items: VentaItem[];
};
```

Y en el `renderReviewButton` call, reemplazar `0` por `venta.comprador.id ?? 0`.

- [ ] **Step 3: Verificar en el navegador**

Con backend corriendo y frontend en dev:
1. Loguearse como tiendaRetiro y navegar a `/tienda-retiro/ventas`
2. Verificar que las órdenes pendientes muestran botón "Confirmar llegada al local"
3. Confirmar llegada → badge cambia a "Llegó al local"
4. "Finalizar orden" → badge cambia a "Finalizado" + aparece botón de review del comprador
5. Verificar que el chat abre/cierra por orden

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx backend/src/tiendaRetiro/tiendaRetiro.controller.ts
git commit -m "feat(tiendaRetiro): update Ventas page — new state machine, chat, ReviewModal"
```

---

## Task 8: Frontend — Purchases.tsx: alias/CBU siempre visible, badges actualizados

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/Purchases.tsx`

- [ ] **Step 1: Actualizar el bloque de badge de estado (líneas 139–153)**

Reemplazar:
```tsx
<span className={`px-2 py-1 rounded text-xs font-medium ${
  comp.estado === 'finalizado' || comp.estado === 'retirado'
    ? 'bg-green-100 text-green-800'
    : comp.estado === 'en_tienda'
    ? 'bg-blue-100 text-blue-800'
    : comp.estado === 'entregado_a_tienda'
    ? 'bg-yellow-100 text-yellow-800'
    : 'bg-gray-100 text-gray-700'
}`}>
  {comp.estado === 'finalizado' ? 'Finalizado'
    : comp.estado === 'retirado' ? 'Retirado'
    : comp.estado === 'en_tienda' ? 'En tienda'
    : comp.estado === 'entregado_a_tienda' ? 'Esperando tienda'
    : comp.estado}
</span>
```

Con:
```tsx
<span className={`px-2 py-1 rounded text-xs font-medium ${
  comp.estado === 'finalizado'
    ? 'bg-green-100 text-green-800'
    : comp.estado === 'en_tienda'
    ? 'bg-blue-100 text-blue-800'
    : comp.estado === 'listo_para_retirar'
    ? 'bg-orange-100 text-orange-700'
    : 'bg-gray-100 text-gray-700'
}`}>
  {comp.estado === 'finalizado'          ? 'Finalizado ✓'
    : comp.estado === 'en_tienda'        ? 'Llegó al local 📦'
    : comp.estado === 'listo_para_retirar' ? 'Listo para retirar 🟠'
    : 'Pendiente'}
</span>
```

- [ ] **Step 2: Reestructurar el bloque de tiendaRetiro para mostrar alias/CBU siempre**

Reemplazar el bloque completo de `{comp.tiendaRetiro ? (` hasta el `</div>` de cierre que le sigue (líneas 179–258) con:

```tsx
{comp.tiendaRetiro ? (
  <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.5rem', padding: '0.6rem 0.9rem', marginBottom: '0.5rem' }}>
    <p style={{ fontWeight: 600, margin: 0, color: '#92400e' }}>
      📍 Retiro en tienda: {comp.tiendaRetiro.nombre}
    </p>
    <p style={{ fontSize: '0.85rem', color: '#78350f', margin: '0.15rem 0 0' }}>
      {comp.tiendaRetiro.direccion}
    </p>
    {comp.tiendaRetiro.horario && (
      <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0.1rem 0 0' }}>
        🕐 {comp.tiendaRetiro.horario}
      </p>
    )}

    {/* Alias/CBU — siempre visible */}
    {(() => {
      const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor?.alias || ic.uploaderVendedor?.cbu)?.uploaderVendedor
                    ?? comp.itemCartas?.find((ic: any) => ic.uploaderTienda?.alias || ic.uploaderTienda?.cbu)?.uploaderTienda;
      return (vendedor?.alias || vendedor?.cbu) ? (
        <div style={{ marginTop: '0.5rem', background: '#fef3c7', borderRadius: '0.35rem', padding: '0.5rem 0.75rem', border: '1px solid #fcd34d' }}>
          <p style={{ fontWeight: 600, margin: 0, color: '#92400e', fontSize: '0.82rem' }}>
            💸 Datos de pago al vendedor
          </p>
          {vendedor.alias && <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#78350f' }}><strong>Alias:</strong> {vendedor.alias}</p>}
          {vendedor.cbu   && <p style={{ margin: '0.15rem 0 0', fontSize: '0.82rem', color: '#78350f' }}><strong>CBU:</strong> {vendedor.cbu}</p>}
        </div>
      ) : null;
    })()}

    {comp.estado === 'en_tienda' && (
      <p style={{ marginTop: '0.5rem', fontWeight: 600, color: '#1d4ed8', fontSize: '0.85rem' }}>
        ✅ ¡Tu carta llegó al local! Podés ir a buscarla.
      </p>
    )}

    {comp.estado === 'listo_para_retirar' && (
      <p style={{ marginTop: '0.5rem', fontWeight: 600, color: '#c2410c', fontSize: '0.85rem' }}>
        🟠 Tu carta está lista para retirar. Presentate en la tienda con el número de orden.
      </p>
    )}

    {comp.estado === 'finalizado' && (() => {
      const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor;
      return (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={{ fontWeight: 600, color: '#15803d', marginBottom: '0.5rem' }}>✓ Compra finalizada</p>
          <p style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.4rem' }}>¿Cómo fue la experiencia?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {comp.tiendaRetiro && renderReviewButton(comp.id, 'tiendaRetiro', comp.tiendaRetiro.id, comp.tiendaRetiro.nombre, { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '0.4rem', padding: '0.4rem 0.6rem', fontWeight: 500, fontSize: '0.82rem', cursor: 'pointer', color: '#92400e' }, `★ Valorar tienda: ${comp.tiendaRetiro.nombre}`)}
            {vendedor && renderReviewButton(comp.id, 'vendedor', vendedor.id, vendedor.nombre, { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.4rem', padding: '0.4rem 0.6rem', fontWeight: 500, fontSize: '0.82rem', cursor: 'pointer', color: '#15803d' }, `★ Valorar vendedor: ${vendedor.nombre}`)}
          </div>
        </div>
      );
    })()}
  </div>
) : (
  <div>
    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
      💬 Entrega a coordinar con el vendedor via chat
    </p>
    {comp.estado === 'finalizado' && (() => {
      const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor;
      return vendedor ? (
        <div style={{ marginTop: '0.5rem' }}>
          <p style={{ fontSize: '0.82rem', color: '#374151', marginBottom: '0.4rem' }}>¿Cómo fue la experiencia?</p>
          {renderReviewButton(comp.id, 'vendedor', vendedor.id, vendedor.nombre, { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.4rem', padding: '0.4rem 0.6rem', fontWeight: 500, fontSize: '0.82rem', cursor: 'pointer', color: '#15803d' }, `★ Valorar vendedor: ${vendedor.nombre}`)}
        </div>
      ) : null;
    })()}
  </div>
)}
```

- [ ] **Step 3: Verificar en el navegador**

1. Loguearse como comprador y navegar a `/purchases`
2. Verificar que el alias/CBU aparece desde el estado `pendiente` cuando hay tiendaRetiro
3. Verificar badges correctos para cada estado
4. Verificar ReviewModal aparece al finalizar (con y sin tiendaRetiro)

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/Purchases.tsx
git commit -m "feat(purchases): show alias/CBU always, updated state badges, review on all flows"
```

---

## Task 9: Frontend — MisVentasPage.tsx: quitar "Entregar a tienda", agregar "Marcar finalizado"

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx`

- [ ] **Step 1: Eliminar `handleEntregarTienda` y agregar `handleFinalizar`**

Eliminar la función `handleEntregarTienda` completa (líneas 95–104).

Agregar `handleFinalizar` después de `handleMarkSent`:

```typescript
const handleFinalizar = async (compraId: number) => {
  try {
    if (!confirm('¿Confirmás que la entrega fue completada?')) return;
    await api.patch(`/api/vendedores/${user?.id}/ventas/${compraId}/finalizar`);
    await fetchVentas();
  } catch (err: any) {
    alert('Error: ' + (err.response?.data?.message || err.message));
  }
};
```

- [ ] **Step 2: Actualizar el badge de estado (líneas 136–148)**

Reemplazar:
```tsx
<span className={`px-3 py-1 text-sm rounded-full font-medium ${
  venta.estado === 'finalizado' ? 'bg-green-100 text-green-800'
  : venta.estado === 'en_tienda' ? 'bg-blue-100 text-blue-800'
  : venta.estado === 'entregado_a_tienda' ? 'bg-yellow-100 text-yellow-800'
  : 'bg-orange-100 text-orange-700'
}`}>
  {venta.estado === 'ENVIADO_A_INTERMEDIARIO' ? 'Enviado a Intermediario'
    : venta.estado === 'ENTREGADO' ? 'Entregado'
    : venta.estado === 'entregado_a_tienda' ? 'Notificado a tienda ✓'
    : venta.estado === 'en_tienda' ? 'En tienda ✓'
    : venta.estado === 'finalizado' ? 'Finalizado ✓'
    : (venta.envio?.estado || venta.estado)}
</span>
```

Con:
```tsx
<span className={`px-3 py-1 text-sm rounded-full font-medium ${
  venta.estado === 'finalizado'         ? 'bg-green-100 text-green-800'
  : venta.estado === 'en_tienda'        ? 'bg-blue-100 text-blue-800'
  : venta.estado === 'listo_para_retirar' ? 'bg-orange-100 text-orange-800'
  : 'bg-gray-100 text-gray-600'
}`}>
  {venta.estado === 'finalizado'           ? 'Finalizado ✓'
    : venta.estado === 'en_tienda'         ? 'Llegó al local ✓'
    : venta.estado === 'listo_para_retirar' ? 'Listo para retirar'
    : venta.estado === 'ENVIADO_A_INTERMEDIARIO' ? 'Enviado a Intermediario'
    : 'Pendiente'}
</span>
```

- [ ] **Step 3: Reemplazar el bloque de botones de acción (líneas 226–253)**

Localizar el bloque que contiene `handleEntregarTienda` y el bloque de `markSent`, y reemplazar con:

```tsx
{/* Botón finalizar — flujos 3 y 4 (sin tienda de retiro, o comprador es tienda) */}
{venta.estado === 'pendiente' && (!venta.tiendaRetiro || venta.esTiendaCompradora) && (
  <button
    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
    onClick={() => handleFinalizar(venta.id)}
  >
    Marcar como finalizado
  </button>
)}

{/* Flujo intermediario */}
{venta.envio &&
  venta.estado !== 'ENVIADO_A_INTERMEDIARIO' &&
  venta.estado !== 'ENTREGADO' &&
  venta.estado !== 'entregado' && (
    <button
      className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
      onClick={() => handleMarkSent(venta.id)}
    >
      Ya envié el paquete al Intermediario
    </button>
  )}
```

- [ ] **Step 4: Verificar en el navegador**

1. Loguearse como vendedor y navegar a `/mis-ventas`
2. Para una venta sin tienda de retiro (flujo 4): debe aparecer "Marcar como finalizado"
3. Para una venta con tienda de retiro (flujo 1): NO debe aparecer ningún botón de cambio de estado
4. Al marcar finalizado → badge verde "Finalizado ✓" + ReviewModal disponible
5. Verificar que la valoración al comprador funciona desde el ReviewModal

- [ ] **Step 5: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/MisVentasPage.tsx
git commit -m "feat(misVentas): remove entregar-tienda, add finalizar for flujos 3 and 4"
```

---

## Task 10: Frontend — MiPerfilTiendaRetiroPage.tsx: flujo 2 + tab Mis Compras + ReviewModal

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`

- [ ] **Step 1: Agregar estado para tab activo y Mis Compras**

Al inicio del componente, después de las declaraciones de estado existentes (línea 62 aprox), agregar:

```typescript
// Tab activo del panel
const [activeTab, setActiveTab] = useState<'publicaciones' | 'ventas' | 'compras'>('publicaciones');

// Mis Compras (tienda comprando)
const [misCompras, setMisCompras]   = useState<any[]>([]);
const [comprasLoading, setComprasLoading] = useState(false);
const [chatAbierto, setChatAbierto] = useState<number | null>(null);
const [reviewModalOpen, setReviewModalOpen] = useState(false);
const [reviewTarget, setReviewTarget] = useState<{ id: number; name: string; type: 'vendedor' | 'tiendaRetiro' | 'user'; compraId: number } | null>(null);
const [reviewedMap, setReviewedMap] = useState<Record<string, number>>({});
```

- [ ] **Step 2: Cargar Mis Compras en el `useEffect` existente**

En `fetchAll()`, dentro del bloque `try`, después de las llamadas a `pubRes` y `ventasRes`, agregar:

```typescript
setComprasLoading(true);
const [misReviewsRes, comprasRes] = await Promise.all([
  fetchApi('/api/valoraciones/mias'),
  fetchApi('/api/compras'),
]);
const comprasJson   = await comprasRes.json();
const reviewsJson   = await misReviewsRes.json();
setMisCompras(comprasJson.data ?? []);
const map: Record<string, number> = {};
for (const v of (reviewsJson.data || [])) {
  if (v.compra?.id != null) map[`${v.compra.id}_${v.tipoObjeto}_${v.objetoId}`] = v.puntuacion;
}
setReviewedMap(map);
setComprasLoading(false);
```

- [ ] **Step 3: Agregar función para "listo para retirar" y refactorizar `handleFinalizarVenta`**

Reemplazar `handleFinalizarVenta` (líneas 267–282):

```typescript
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
```

- [ ] **Step 4: Actualizar la sección "Mis Ventas" en el JSX — flujo 2 con dos pasos + ReviewModal**

Localizar el bloque del badge de estado en Mis Ventas (línea ~849):

```tsx
<span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
  venta.estado === 'finalizado'
    ? 'bg-green-100 text-green-700 border-green-200'
    : 'bg-yellow-100 text-yellow-800 border-yellow-200'
}`}>
  {venta.estado === 'finalizado' ? 'Finalizado' : 'Pendiente'}
</span>
```

Reemplazar con:

```tsx
<span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
  venta.estado === 'finalizado'          ? 'bg-green-100 text-green-700 border-green-200'
  : venta.estado === 'listo_para_retirar' ? 'bg-orange-100 text-orange-700 border-orange-200'
  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
}`}>
  {venta.estado === 'finalizado'           ? 'Finalizado'
    : venta.estado === 'listo_para_retirar' ? 'Listo para retirar'
    : 'Pendiente'}
</span>
```

Y reemplazar el botón de acción en Mis Ventas (línea ~856):

```tsx
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
      setReviewTarget({ id: 0, name: venta.nombre, type: 'user', compraId: venta.id });
      setReviewModalOpen(true);
    }}
  >
    ★ Valorar comprador
  </button>
)}
```

- [ ] **Step 5: Agregar tab "Mis Compras" con sección de compras embebida**

Localizar la sección `{/* ── MIS VENTAS (ventas directas) ── */}` (línea ~820). Justo ANTES de esa sección, agregar el selector de tabs y la sección de Mis Compras:

```tsx
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
```

Y envolver las secciones de publicaciones y ventas en condicionales, y agregar la sección de compras. Localizar el div de "Mis publicaciones" y agregar `{activeTab === 'publicaciones' && (` antes y `)}` después. Lo mismo para "Mis Ventas". Luego agregar la sección de compras:

```tsx
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
                  <p key={idx} className="text-xs text-gray-600">{it.title || `Carta #${it.cartaId}`} × {it.quantity} — ${Number(it.price || 0).toFixed(2)}</p>
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
                      onClick={() => { setReviewTarget({ id: vendedor.id, name: vendedor.nombre, type: 'vendedor', compraId: comp.id }); setReviewModalOpen(true); }}
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
```

- [ ] **Step 6: Agregar imports de Chat y ReviewModal al archivo**

Al inicio del archivo, asegurarse de que los imports incluyan:

```typescript
import { Chat } from '../components/Chat';
import { ReviewModal } from '../components/ReviewModal';
```

Y al final del JSX (antes del `</div>` de cierre del componente), agregar el ReviewModal:

```tsx
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
```

- [ ] **Step 7: Verificar en el navegador**

1. Loguearse como tiendaRetiro y navegar a `/tienda-retiro/perfil`
2. Verificar que aparecen los tabs: Publicaciones, Mis Ventas, Mis Compras
3. En Mis Ventas: venta pendiente → botón "Listo para retirar" → estado cambia → botón "Finalizar"
4. En Mis Compras: deben aparecer las órdenes donde esta tienda es compradora
5. Verificar ReviewModal al finalizar desde ambas secciones

- [ ] **Step 8: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx
git commit -m "feat(tiendaPerfil): flujo 2 en ventas, tab Mis Compras, ReviewModal"
```

---

## Task 11: Frontend — Reservar.tsx: tiendaRetiro compradora auto-asigna su propia tienda

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/Reservar.tsx`

- [ ] **Step 1: Detectar rol tiendaRetiro en la lógica de submisión**

En `Reservar.tsx`, localizar la función `handleReservar` (buscar el submit del form). Dentro de esa función, localizar donde se construye el objeto `tiendaRetiroPorVendedor` (que mapea vendedorId → tiendaId). 

Si el usuario es tiendaRetiro, auto-asignar su propio id para todos los vendedores. Agregar este bloque ANTES de la construcción del body del POST:

```typescript
// Si el comprador es una tiendaRetiro, ella misma es el punto de retiro
let tiendaRetiroPorVendedorFinal = tiendaRetiroPorVendedor;
if (user?.role === 'tiendaRetiro') {
  tiendaRetiroPorVendedorFinal = Object.fromEntries(
    Object.keys(itemsPorVendedor).map(vendedorId => [vendedorId, user.id])
  );
}
```

Y en la llamada al POST, usar `tiendaRetiroPorVendedorFinal` en vez de `tiendaRetiroPorVendedor`.

- [ ] **Step 2: Ocultar el selector de tienda cuando el comprador es tiendaRetiro**

Localizar el bloque del selector de tiendas por vendedor (`{Object.entries(itemsPorVendedor).map(...)}`). Envolver el contenido del selector (los radio buttons de tiendas) en:

```tsx
{user?.role !== 'tiendaRetiro' ? (
  // ... todo el selector de radio buttons existente ...
) : (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
    📍 El retiro será en tu tienda automáticamente.
  </div>
)}
```

- [ ] **Step 3: Verificar en el navegador**

1. Loguearse como tiendaRetiro y agregar cartas de un vendedor particular al carrito
2. Ir a `/reservar` — verificar que NO aparece el selector de tiendas (reemplazado por el mensaje)
3. Confirmar la reserva — verificar en `/tienda-retiro/perfil > Mis Compras` que aparece la orden
4. Verificar que el vendedor ve la orden en Mis Ventas con `esTiendaCompradora: true` y botón "Marcar como finalizado"

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/Reservar.tsx
git commit -m "feat(reservar): auto-assign tiendaRetiro compradora as pickup point"
```

---

## Verificación final end-to-end

- [ ] **Flujo 1 — Vendedor + tienda de retiro:**
  1. User compra carta de un Vendedor, selecciona TiendaA como retiro
  2. En `/purchases`: alias/CBU del vendedor visible desde el inicio
  3. TiendaA (en `/tienda-retiro/ventas`) ve orden pendiente → "Confirmar llegada al local" → email enviado al comprador
  4. Badge cambia a "Llegó al local 📦"
  5. TiendaA → "Finalizar orden" → badge verde
  6. ReviewModal disponible: comprador valora vendedor + tienda, tienda valora comprador, vendedor valora comprador (en `/mis-ventas`)

- [ ] **Flujo 2 — Compra directa a tienda:**
  1. User compra carta de TiendaA (uploaderTienda)
  2. TiendaA (en `/tienda-retiro/perfil > Mis Ventas`) ve orden pendiente → "Listo para retirar" → email enviado
  3. Badge cambia a "Listo para retirar 🟠" en `/purchases`
  4. TiendaA → "Finalizar" → badge verde + ReviewModal

- [ ] **Flujo 3 — Tienda comprando:**
  1. TiendaB compra carta de Vendedor (desde `/reservar` como tiendaRetiro)
  2. Vendedor ve en `/mis-ventas` con badge "Pendiente" y botón "Marcar como finalizado"
  3. Al finalizar → badge verde + ReviewModal

- [ ] **Flujo 4 — Vendedor sin tienda:**
  1. User compra carta de Vendedor sin tienda de retiro (modo chat)
  2. Vendedor ve en `/mis-ventas` con badge "Pendiente" y botón "Marcar como finalizado"
  3. Al finalizar → badge verde + ReviewModal en ambos lados

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat: complete purchase order flow restructure — 4 flows, clean state machine"
```
