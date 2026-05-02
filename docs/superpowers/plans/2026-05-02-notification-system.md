# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement persistent real-time notifications (bell badge + dropdown) and unread chat badges for buyers, sellers, and stores in the TCG marketplace.

**Architecture:** Two new MikroORM entities (`Notificacion`, `ChatLeido`) + new field on `Compra` (`compradorActorId`/`compradorActorRole`) for buyer socket routing. Socket.IO user rooms (`user-{id}-{role}`) deliver events `nueva_notificacion` and `chat_badge_update` in real time. Frontend `NotificacionesContext` fetches initial state and maintains it live; `NotificacionesDropdown` renders the bell panel.

**Tech Stack:** MikroORM 6 (PostgreSQL), Socket.IO, Express 5, React 19, TypeScript, Tailwind CSS, lucide-react.

---

## File Map

### Create
| File | Responsibility |
|------|---------------|
| `backend/src/notificacion/notificacion.entity.ts` | Notificacion ORM entity |
| `backend/src/notificacion/notificacion.service.ts` | Helper to persist + emit notifications |
| `backend/src/notificacion/notificacion.routes.ts` | REST: GET unread, PATCH read, PATCH read-all, PATCH read-by-compra |
| `backend/src/chatLeido/chatLeido.entity.ts` | ChatLeido ORM entity (last-seen timestamp per user per chat) |
| `backend/src/chatLeido/chatLeido.routes.ts` | REST: GET unread counts, POST mark-read |
| `vite-project/vite-project-ts/src/context/notificaciones.tsx` | React context: state + socket + API calls |
| `vite-project/vite-project-ts/src/components/NotificacionesDropdown.tsx` | Bell dropdown UI |

### Modify
| File | Change |
|------|--------|
| `backend/src/compra/compra.entity.ts` | Add `compradorActorId` + `compradorActorRole` |
| `backend/src/shared/db/orm.ts` | Register `Notificacion` + `ChatLeido` |
| `backend/src/app.ts` | Mount `notificacionRouter` + `chatLeidoRouter` |
| `backend/src/socket/index.ts` | Store decoded token on socket; join `user-{id}-{role}` room |
| `backend/src/compra/compra.controler.ts` | Emit notifications in `add`, `update`, `cancelarCompra` |
| `backend/src/mensaje/mensaje.routes.ts` | Emit `chat_badge_update` to other party's user room |
| `backend/src/vendedor/vendedor.controller.ts` | Emit notifications in `finalizarVenta`, `marcarPagoConfirmado` |
| `backend/src/tiendaRetiro/tiendaRetiro.controller.ts` | Emit notifications in `marcarEnTienda`, `finalizarCompra`, `marcarListoParaRetirar`, `finalizarVentaDirecta` |
| `vite-project/vite-project-ts/src/App.tsx` | Wrap routes with `NotificacionesProvider` |
| `vite-project/vite-project-ts/src/components/Header.tsx` | Red badges on Bell + MessageSquare; open dropdown |
| `vite-project/vite-project-ts/src/pages/ChatsPage.tsx` | Call `marcarChatLeido` on conversation select |
| `vite-project/vite-project-ts/src/components/Chat.tsx` | Call `marcarChatLeido` on mount |

---

## Task 1: Notificacion and ChatLeido entities

**Files:**
- Create: `backend/src/notificacion/notificacion.entity.ts`
- Create: `backend/src/chatLeido/chatLeido.entity.ts`

- [ ] **Step 1: Create Notificacion entity**

```typescript
// backend/src/notificacion/notificacion.entity.ts
import { Entity, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
export class Notificacion extends BaseEntity {
  @Property({ type: 'number' })
  recipientId!: number;

  @Property({ type: 'string' })
  recipientRole!: string; // 'user' | 'vendedor' | 'tiendaRetiro'

  @Property({ type: 'number' })
  compraId!: number;

  @Property({ type: 'string' })
  tipo!: string; // 'nueva_compra' | 'cambio_estado' | 'cancelacion'

  @Property({ type: 'text' })
  mensaje!: string;

  @Property({ type: 'boolean', default: false })
  leida: boolean = false;
}
```

- [ ] **Step 2: Create ChatLeido entity**

```typescript
// backend/src/chatLeido/chatLeido.entity.ts
import { Entity, Property, Unique } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

@Entity()
@Unique({ properties: ['userId', 'userRole', 'compraId'] })
export class ChatLeido extends BaseEntity {
  @Property({ type: 'number' })
  userId!: number;

  @Property({ type: 'string' })
  userRole!: string;

  @Property({ type: 'number' })
  compraId!: number;

  @Property({ type: 'datetime', nullable: true })
  ultimoVisto?: Date;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 2: Add compradorActorId/Role to Compra entity

**Files:**
- Modify: `backend/src/compra/compra.entity.ts`

These two fields let every state-change handler notify the buyer without extra DB lookups, regardless of whether the buyer is a `user`, `vendedor`, or `tiendaRetiro`.

- [ ] **Step 1: Add fields to Compra entity**

Open `backend/src/compra/compra.entity.ts`. After the `compradorTienda` property, add:

```typescript
  @Property({ type: 'number', nullable: true })
  compradorActorId?: number;

  @Property({ type: 'string', nullable: true })
  compradorActorRole?: string;
```

- [ ] **Step 2: Set the fields in add()**

In `backend/src/compra/compra.controler.ts`, inside `add()`, in both `em.create(Compra, {...})` calls (vendorMap loop and tiendaMap loop), add:

```typescript
compradorActorId: req.actor!.id,
compradorActorRole: req.actorRole,
```

Full updated first em.create call (vendorMap loop):
```typescript
const compra = em.create(Compra, {
  ...(compradorUser ? { comprador: compradorUser } : {}),
  ...(compradorTienda ? { compradorTienda } : {}),
  itemCartas: group.itemCartas,
  total: vendorTotal,
  estado: input.estado || 'pendiente',
  nombre: input.nombre,
  email: input.email,
  telefono: input.telefono,
  direccionEntrega,
  envio,
  tiendaRetiro: tiendaRetiro ?? undefined,
  metodoPago: input.metodoPago,
  items: group.items,
  compradorActorId: req.actor!.id,
  compradorActorRole: req.actorRole,
});
```

Full updated second em.create call (tiendaMap loop):
```typescript
const compra = em.create(Compra, {
  ...(compradorUser   ? { comprador: compradorUser }   : {}),
  ...(compradorTienda ? { compradorTienda }            : {}),
  itemCartas:   tGroup.itemCartas,
  total:        tiendaTotal,
  estado:       'pendiente',
  nombre:       input.nombre,
  email:        input.email,
  telefono:     input.telefono,
  tiendaRetiro: tGroup.tienda,
  metodoPago:   input.metodoPago,
  items:        tGroup.items,
  compradorActorId: req.actor!.id,
  compradorActorRole: req.actorRole,
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 3: Register entities + update DB schema

**Files:**
- Modify: `backend/src/shared/db/orm.ts`

- [ ] **Step 1: Import the new entities**

At the top of `backend/src/shared/db/orm.ts`, add these two imports alongside the existing ones:

```typescript
import { Notificacion } from "../../notificacion/notificacion.entity.js";
import { ChatLeido } from "../../chatLeido/chatLeido.entity.js";
```

- [ ] **Step 2: Add entities to the MikroORM config array**

Find the `entities: [...]` array and append `Notificacion, ChatLeido`:

```typescript
entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, User, Direccion, Intermediario, Envio, Valoracion, StagePokemon, Mensaje, Wishlist, VerificationCode, StoreInvite, Notificacion, ChatLeido],
```

- [ ] **Step 3: Apply schema update**

```bash
cd backend && pnpm schema:update
```
Expected: MikroORM creates `notificacion` and `chat_leido` tables, and adds `comprador_actor_id` + `comprador_actor_role` columns to `compra`. No existing data is dropped.

---

## Task 4: notificacion.service.ts

**Files:**
- Create: `backend/src/notificacion/notificacion.service.ts`

This module is the single entry point for creating persistent notifications and emitting them over Socket.IO. All controllers import this service instead of duplicating logic.

- [ ] **Step 1: Create the service**

```typescript
// backend/src/notificacion/notificacion.service.ts
import { orm } from "../shared/db/orm.js";
import { io } from "../socket/index.js";
import { Notificacion } from "./notificacion.entity.js";

export interface NotificacionInput {
  recipientId: number;
  recipientRole: string;
  compraId: number;
  tipo: string;
  mensaje: string;
}

export const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_tienda: 'En tienda',
  pago_confirmado: 'Pago confirmado',
  listo_para_retirar: 'Listo para retirar',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

export async function crearNotificaciones(inputs: NotificacionInput[]): Promise<void> {
  if (!inputs.length) return;
  try {
    const em = orm.em.fork();
    const notifs = inputs.map(n => em.create(Notificacion, { ...n, leida: false }));
    await em.flush();
    notifs.forEach(n => {
      io.to(`user-${n.recipientId}-${n.recipientRole}`).emit('nueva_notificacion', n);
    });
  } catch (err) {
    // notifications are non-critical; log and continue
    console.error('[notificacion.service] error:', err);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 5: notificacion.routes.ts

**Files:**
- Create: `backend/src/notificacion/notificacion.routes.ts`

- [ ] **Step 1: Create the routes file**

```typescript
// backend/src/notificacion/notificacion.routes.ts
import { Router, Response } from "express";
import { orm } from "../shared/db/orm.js";
import { Notificacion } from "./notificacion.entity.js";
import { authenticate, AuthRequest } from "../shared/middleware/auth.js";

export const notificacionRouter = Router();

// GET /api/notificaciones  — unread notifications for the authenticated user
notificacionRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actorId = req.actor!.id!;
    const actorRole = req.actorRole!;
    const notificaciones = await em.find(
      Notificacion,
      { recipientId: actorId, recipientRole: actorRole, leida: false },
      { orderBy: { createdAt: 'DESC' }, limit: 50 }
    );
    res.json({ data: notificaciones });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/notificaciones/leer-todas  — mark all as read for current user
notificacionRouter.patch("/leer-todas", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    await em.nativeUpdate(
      Notificacion,
      { recipientId: req.actor!.id!, recipientRole: req.actorRole!, leida: false },
      { leida: true }
    );
    res.json({ message: "Todas las notificaciones marcadas como leídas" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/notificaciones/compra/:compraId/leer  — mark all for a compra as read
notificacionRouter.patch("/compra/:compraId/leer", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    await em.nativeUpdate(
      Notificacion,
      {
        recipientId: req.actor!.id!,
        recipientRole: req.actorRole!,
        compraId: Number(req.params.compraId),
        leida: false,
      },
      { leida: true }
    );
    res.json({ message: "Notificaciones de la compra marcadas como leídas" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /api/notificaciones/:id/leer  — mark one as read
notificacionRouter.patch("/:id/leer", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const notif = await em.findOne(Notificacion, {
      id: Number(req.params.id),
      recipientId: req.actor!.id!,
      recipientRole: req.actorRole!,
    });
    if (!notif) return res.status(404).json({ message: "Notificación no encontrada" });
    notif.leida = true;
    await em.flush();
    res.json({ data: notif });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 6: chatLeido.routes.ts

**Files:**
- Create: `backend/src/chatLeido/chatLeido.routes.ts`

- [ ] **Step 1: Create the routes file**

```typescript
// backend/src/chatLeido/chatLeido.routes.ts
import { Router, Response } from "express";
import { orm } from "../shared/db/orm.js";
import { ChatLeido } from "./chatLeido.entity.js";
import { Compra } from "../compra/compra.entity.js";
import { Mensaje } from "../mensaje/mensaje.entity.js";
import { authenticate, AuthRequest } from "../shared/middleware/auth.js";

export const chatLeidoRouter = Router();

function getCompradorWhere(req: AuthRequest): Record<string, any> {
  if (req.actorRole === 'tiendaRetiro') {
    return { compradorTienda: { id: req.actor!.id } };
  }
  if (req.actorRole === 'vendedor') {
    const vendedor = req.actor as any;
    return { comprador: { id: (vendedor.user as any)?.id } };
  }
  return { comprador: { id: req.actor!.id } };
}

// GET /api/chat-leido/unread-counts
// Returns { data: { totalUnreadChats: number, porCompra: Record<number, number> } }
chatLeidoRouter.get("/unread-counts", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actorId = req.actor!.id!;
    const actorRole = req.actorRole!;
    // normalize so senderRole comparison works ('usuario' is stored as 'user' in Mensaje)
    const normalizedRole = actorRole === 'usuario' ? 'user' : actorRole;

    // Compras where actor is buyer
    const buyerCompras = await em.find(Compra, getCompradorWhere(req), { fields: ['id'] });

    // Compras where actor is seller
    let sellerIds: number[] = [];
    if (actorRole === 'vendedor') {
      const sc = await em.find(Compra, { itemCartas: { uploaderVendedor: { id: actorId } } }, { fields: ['id'] });
      sellerIds = sc.map(c => c.id!);
    } else if (actorRole === 'tiendaRetiro') {
      const sc1 = await em.find(Compra, { itemCartas: { uploaderTienda: { id: actorId } } }, { fields: ['id'] });
      const sc2 = await em.find(Compra, { tiendaRetiro: { id: actorId } }, { fields: ['id'] });
      sellerIds = [...sc1.map(c => c.id!), ...sc2.map(c => c.id!)];
    }

    const allIds = [...new Set([...buyerCompras.map(c => c.id!), ...sellerIds])];

    const porCompra: Record<number, number> = {};
    let totalUnreadChats = 0;

    await Promise.all(allIds.map(async (compraId) => {
      const leido = await em.findOne(ChatLeido, { userId: actorId, userRole: actorRole, compraId });
      const since = leido?.ultimoVisto ?? new Date(0);
      const count = await em.count(Mensaje, {
        compra: { id: compraId },
        createdAt: { $gt: since },
        $or: [
          { senderId: { $ne: actorId } },
          { senderRole: { $ne: normalizedRole } },
        ],
      });
      if (count > 0) {
        porCompra[compraId] = count;
        totalUnreadChats++;
      }
    }));

    res.json({ data: { totalUnreadChats, porCompra } });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// POST /api/chat-leido/:compraId/marcar-leido
chatLeidoRouter.post("/:compraId/marcar-leido", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const compraId = Number(req.params.compraId);
    const actorId = req.actor!.id!;
    const actorRole = req.actorRole!;

    let registro = await em.findOne(ChatLeido, { userId: actorId, userRole: actorRole, compraId });
    if (registro) {
      registro.ultimoVisto = new Date();
    } else {
      registro = em.create(ChatLeido, { userId: actorId, userRole: actorRole, compraId, ultimoVisto: new Date() });
    }
    await em.flush();
    res.json({ message: "Chat marcado como leído" });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 7: Mount routes in app.ts

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Add imports near the other router imports**

```typescript
import { notificacionRouter } from "./notificacion/notificacion.routes.js";
import { chatLeidoRouter } from "./chatLeido/chatLeido.routes.js";
```

- [ ] **Step 2: Mount the routers**

In the section where routes are mounted (near `app.use("/api/mensajes", mensajeRouter)`), add:

```typescript
app.use("/api/notificaciones", notificacionRouter);
app.use("/api/chat-leido", chatLeidoRouter);
```

- [ ] **Step 3: Verify TypeScript compiles and backend starts**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors. Then start the backend and verify:
```bash
cd backend && pnpm start:dev
```
Expected: server starts on port 3000 with no errors.

---

## Task 8: Socket.IO user rooms

**Files:**
- Modify: `backend/src/socket/index.ts`

Socket must join each connected user to their personal room `user-{id}-{role}` so that targeted events can be emitted from anywhere in the backend.

- [ ] **Step 1: Replace the full content of socket/index.ts**

```typescript
// backend/src/socket/index.ts
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

export let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as any;
      socket.data.userId = decoded.id;
      socket.data.userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room for targeted notifications
    if (socket.data.userId && socket.data.userRole) {
      socket.join(`user-${socket.data.userId}-${socket.data.userRole}`);
    }

    socket.on('join_compra', (compraId: number) => {
      socket.join(`compra-${compraId}`);
    });
  });

  return io;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 9: mensaje.routes.ts — emit chat_badge_update

**Files:**
- Modify: `backend/src/mensaje/mensaje.routes.ts`

When a message is sent, emit `chat_badge_update` to every participant's personal room EXCEPT the sender, so their badge count updates in real time without polling.

- [ ] **Step 1: Add Compra import and helper at the top of mensaje.routes.ts**

Add these imports at the top:

```typescript
import { Compra } from "../compra/compra.entity.js";
```

(Keep all existing imports.)

- [ ] **Step 2: Replace the POST handler body**

Replace the existing `mensajeRouter.post("/:compraId", ...)` handler with:

```typescript
mensajeRouter.post("/:compraId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const compraId = Number(req.params.compraId);
    const { texto } = req.body;

    if (!texto?.trim()) {
      return res.status(400).json({ message: "El mensaje no puede estar vacío" });
    }

    const compra = await em.findOne(Compra, { id: compraId });
    if (!compra) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const actor = req.actor as any;
    const senderNombre = actor.username || actor.nombre || "Usuario";
    const actorRole = req.actorRole ?? 'user';

    const mensaje = em.create(Mensaje, {
      compra,
      senderId: actor.id,
      senderRole: actorRole,
      senderNombre,
      texto: texto.trim(),
    });

    await em.flush();

    // Emit message to the compra room (existing behavior)
    io.to(`compra-${compraId}`).emit('nuevo_mensaje', { ...mensaje, compraId });

    // Emit badge update to other participants' personal rooms (non-blocking)
    notifyParticipants(compraId, actor.id, actorRole).catch(() => {});

    res.status(201).json({ data: mensaje });
  } catch (error: any) {
    res.status(500).json({ message: "Error al enviar mensaje", error: error.message });
  }
});
```

- [ ] **Step 3: Add the notifyParticipants helper at the bottom of mensaje.routes.ts (before the export)**

```typescript
async function notifyParticipants(compraId: number, senderId: number, senderRole: string): Promise<void> {
  const em2 = orm.em.fork();
  const normalizedSenderRole = senderRole === 'usuario' ? 'user' : senderRole;

  const compraFull = await em2.findOne(Compra, { id: compraId }, {
    populate: ['itemCartas', 'itemCartas.uploaderVendedor', 'itemCartas.uploaderTienda'],
  });
  if (!compraFull) return;

  const recipients: Array<{ id: number; role: string }> = [];

  // Buyer participant
  if (compraFull.compradorActorId && compraFull.compradorActorRole) {
    if (!(compraFull.compradorActorId === senderId && compraFull.compradorActorRole === normalizedSenderRole)) {
      recipients.push({ id: compraFull.compradorActorId, role: compraFull.compradorActorRole });
    }
  }

  // Seller participants (deduplicated)
  const seen = new Set<string>();
  for (const item of compraFull.itemCartas.getItems()) {
    const vid = (item as any).uploaderVendedor?.id;
    const tid = (item as any).uploaderTienda?.id;
    if (vid) {
      const k = `${vid}-vendedor`;
      if (!seen.has(k)) {
        seen.add(k);
        if (!(vid === senderId && normalizedSenderRole === 'vendedor')) {
          recipients.push({ id: vid, role: 'vendedor' });
        }
      }
    }
    if (tid) {
      const k = `${tid}-tiendaRetiro`;
      if (!seen.has(k)) {
        seen.add(k);
        if (!(tid === senderId && normalizedSenderRole === 'tiendaRetiro')) {
          recipients.push({ id: tid, role: 'tiendaRetiro' });
        }
      }
    }
  }

  recipients.forEach(r => {
    io.to(`user-${r.id}-${r.role}`).emit('chat_badge_update', { compraId });
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 10: compra.controler.ts — notifications on add / update / cancelarCompra

**Files:**
- Modify: `backend/src/compra/compra.controler.ts`

- [ ] **Step 1: Add import at the top**

```typescript
import { crearNotificaciones, NotificacionInput, ESTADO_LABELS } from "../notificacion/notificacion.service.js";
```

- [ ] **Step 2: Add notifications to add()**

In `add()`, just after `await em.flush();` (before the `res.status(201)...` line), add:

```typescript
    // Notify each seller about the new purchase
    const notifInputs: NotificacionInput[] = [];
    for (const compra of compras) {
      // Collect seller IDs from the pre-built maps
    }
    // Use the vendor/tienda maps which are already keyed by seller ID
    for (const [vendorId, _group] of vendorMap) {
      const vendorCompra = compras.find(c =>
        c.itemCartas.getItems().some(ic => (ic as any).uploaderVendedor?.id === vendorId)
      ) ?? compras[0];
      notifInputs.push({
        recipientId: vendorId,
        recipientRole: 'vendedor',
        compraId: vendorCompra.id!,
        tipo: 'nueva_compra',
        mensaje: `Nueva venta - Orden #${vendorCompra.id}`,
      });
    }
    for (const [tiendaId, _tGroup] of tiendaMap) {
      const tiendaCompra = compras.find((c, idx) => idx >= vendorMap.size) ?? compras[compras.length - 1];
      notifInputs.push({
        recipientId: tiendaId,
        recipientRole: 'tiendaRetiro',
        compraId: tiendaCompra.id!,
        tipo: 'nueva_compra',
        mensaje: `Nuevo pedido - Orden #${tiendaCompra.id}`,
      });
    }
    await crearNotificaciones(notifInputs);
```

**Note:** The `compras` array is built in order: first vendorMap entries, then tiendaMap entries. The `find()` per vendorId is reliable because itemCartas are associated correctly.

- [ ] **Step 3: Add notifications to update()**

In `update()`, BEFORE `await em.flush()`, capture the old state:

```typescript
    const oldEstado = compra.estado;
```

Then, AFTER `await em.flush()`, add:

```typescript
    if (input.estado && input.estado !== oldEstado && compra.compradorActorId && compra.compradorActorRole) {
      const label = ESTADO_LABELS[input.estado] || input.estado;
      await crearNotificaciones([{
        recipientId: compra.compradorActorId,
        recipientRole: compra.compradorActorRole,
        compraId: compra.id!,
        tipo: 'cambio_estado',
        mensaje: `Tu orden #${compra.id} cambió a: ${label}`,
      }]);
    }
```

- [ ] **Step 4: Add notifications to cancelarCompra()**

In `cancelarCompra()`, AFTER `await emFork.flush();` (before the `res.json(...)` line), add:

```typescript
    const notifsCancelar: NotificacionInput[] = [];

    if (canceladoPorRol === 'comprador') {
      // Notify each seller
      const seen = new Set<string>();
      for (const ic of compra.itemCartas.getItems()) {
        const vid = (ic as any).uploaderVendedor?.id;
        const tid = (ic as any).uploaderTienda?.id;
        if (vid) {
          const k = `${vid}-vendedor`;
          if (!seen.has(k)) {
            seen.add(k);
            notifsCancelar.push({
              recipientId: vid,
              recipientRole: 'vendedor',
              compraId: compra.id!,
              tipo: 'cancelacion',
              mensaje: `Orden de venta #${compra.id} fue cancelada por el comprador`,
            });
          }
        }
        if (tid) {
          const k = `${tid}-tiendaRetiro`;
          if (!seen.has(k)) {
            seen.add(k);
            notifsCancelar.push({
              recipientId: tid,
              recipientRole: 'tiendaRetiro',
              compraId: compra.id!,
              tipo: 'cancelacion',
              mensaje: `Pedido #${compra.id} fue cancelado por el comprador`,
            });
          }
        }
      }
    } else {
      // Notify buyer
      if (compra.compradorActorId && compra.compradorActorRole) {
        notifsCancelar.push({
          recipientId: compra.compradorActorId,
          recipientRole: compra.compradorActorRole,
          compraId: compra.id!,
          tipo: 'cancelacion',
          mensaje: `Tu orden #${compra.id} fue cancelada`,
        });
      }
    }

    await crearNotificaciones(notifsCancelar);
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 11: vendedor.controller.ts — notifications

**Files:**
- Modify: `backend/src/vendedor/vendedor.controller.ts`

- [ ] **Step 1: Add import**

At the top, add:

```typescript
import { crearNotificaciones, NotificacionInput, ESTADO_LABELS } from "../notificacion/notificacion.service.js";
```

- [ ] **Step 2: Add notification to finalizarVenta()**

In `finalizarVenta()`, AFTER `await em.flush();` (before `res.json(...)`), add:

```typescript
    if (compra.compradorActorId && compra.compradorActorRole) {
      await crearNotificaciones([{
        recipientId: compra.compradorActorId,
        recipientRole: compra.compradorActorRole,
        compraId: compra.id!,
        tipo: 'cambio_estado',
        mensaje: `Tu orden #${compra.id} fue finalizada`,
      }]);
    }
```

- [ ] **Step 3: Add notification to marcarPagoConfirmado()**

In `marcarPagoConfirmado()`, AFTER `await em.flush();` (before `res.json(...)`), add:

```typescript
    if (compra.compradorActorId && compra.compradorActorRole) {
      await crearNotificaciones([{
        recipientId: compra.compradorActorId,
        recipientRole: compra.compradorActorRole,
        compraId: compra.id!,
        tipo: 'cambio_estado',
        mensaje: `Tu orden #${compra.id}: pago confirmado`,
      }]);
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors.

---

## Task 12: tiendaRetiro.controller.ts — notifications

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`

- [ ] **Step 1: Add import**

At the top, add:

```typescript
import { crearNotificaciones, NotificacionInput } from "../notificacion/notificacion.service.js";
```

- [ ] **Step 2: Add notification to marcarEnTienda()**

In `marcarEnTienda()`, AFTER `await orm.em.flush();` (before the email block / `res.json(...)`), add:

```typescript
    const notifsMet: NotificacionInput[] = [];
    // Notify buyer
    if (compra.compradorActorId && compra.compradorActorRole) {
      notifsMet.push({
        recipientId: compra.compradorActorId,
        recipientRole: compra.compradorActorRole,
        compraId: compra.id!,
        tipo: 'cambio_estado',
        mensaje: `Tu orden #${compra.id} ya está en la tienda`,
      });
    }
    // Notify seller(s)
    const seenMet = new Set<string>();
    for (const ic of compra.itemCartas.getItems()) {
      const vid = (ic as any).uploaderVendedor?.id;
      if (vid) {
        const k = `${vid}-vendedor`;
        if (!seenMet.has(k)) {
          seenMet.add(k);
          notifsMet.push({
            recipientId: vid,
            recipientRole: 'vendedor',
            compraId: compra.id!,
            tipo: 'cambio_estado',
            mensaje: `Venta #${compra.id}: la carta llegó a la tienda`,
          });
        }
      }
    }
    await crearNotificaciones(notifsMet);
```

- [ ] **Step 3: Add notification to finalizarCompra()**

In `finalizarCompra()`, AFTER `await orm.em.flush();`, add:

```typescript
    const notifsFC: NotificacionInput[] = [];
    if (compra.compradorActorId && compra.compradorActorRole) {
      notifsFC.push({
        recipientId: compra.compradorActorId,
        recipientRole: compra.compradorActorRole,
        compraId: compra.id!,
        tipo: 'cambio_estado',
        mensaje: `Tu orden #${compra.id} fue finalizada`,
      });
    }
    const seenFC = new Set<string>();
    for (const ic of compra.itemCartas.getItems()) {
      const vid = (ic as any).uploaderVendedor?.id;
      if (vid) {
        const k = `${vid}-vendedor`;
        if (!seenFC.has(k)) {
          seenFC.add(k);
          notifsFC.push({
            recipientId: vid,
            recipientRole: 'vendedor',
            compraId: compra.id!,
            tipo: 'cambio_estado',
            mensaje: `Venta #${compra.id} finalizada en tienda`,
          });
        }
      }
    }
    await crearNotificaciones(notifsFC);
```

- [ ] **Step 4: Add notification to marcarListoParaRetirar()**

In `marcarListoParaRetirar()`, AFTER `await orm.em.flush();` (before email / res.json), add:

```typescript
    if (compra.compradorActorId && compra.compradorActorRole) {
      await crearNotificaciones([{
        recipientId: compra.compradorActorId,
        recipientRole: compra.compradorActorRole,
        compraId: compra.id!,
        tipo: 'cambio_estado',
        mensaje: `Tu orden #${compra.id} está lista para retirar`,
      }]);
    }
```

- [ ] **Step 5: Add notification to finalizarVentaDirecta()**

In `finalizarVentaDirecta()`, AFTER `await orm.em.flush();`, add:

```typescript
    if (compra.compradorActorId && compra.compradorActorRole) {
      await crearNotificaciones([{
        recipientId: compra.compradorActorId,
        recipientRole: compra.compradorActorRole,
        compraId: compra.id!,
        tipo: 'cambio_estado',
        mensaje: `Tu orden #${compra.id} fue finalizada`,
      }]);
    }
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```
Expected: no errors. Then restart and verify backend starts cleanly.

---

## Task 13: Frontend — NotificacionesContext

**Files:**
- Create: `vite-project/vite-project-ts/src/context/notificaciones.tsx`

- [ ] **Step 1: Create the context file**

```tsx
// vite-project/vite-project-ts/src/context/notificaciones.tsx
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { io as socketIO, Socket } from 'socket.io-client'
import { useUser } from './user'
import { fetchApi } from '../services/api'

export interface Notificacion {
  id: number
  recipientId: number
  recipientRole: string
  compraId: number
  tipo: string
  mensaje: string
  leida: boolean
  createdAt: string
}

interface NotificacionesContextType {
  notificaciones: Notificacion[]
  unreadChatCounts: Record<number, number>
  totalUnreadChats: number
  marcarLeida: (id: number) => Promise<void>
  marcarTodasLeidas: () => Promise<void>
  marcarChatLeido: (compraId: number) => Promise<void>
  marcarCompraNotificacionesLeidas: (compraId: number) => Promise<void>
}

const NotificacionesContext = createContext<NotificacionesContextType>({
  notificaciones: [],
  unreadChatCounts: {},
  totalUnreadChats: 0,
  marcarLeida: async () => {},
  marcarTodasLeidas: async () => {},
  marcarChatLeido: async () => {},
  marcarCompraNotificacionesLeidas: async () => {},
})

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [unreadChatCounts, setUnreadChatCounts] = useState<Record<number, number>>({})
  const socketRef = useRef<Socket | null>(null)

  const totalUnreadChats = Object.keys(unreadChatCounts).length

  const fetchInitial = useCallback(async () => {
    if (!user) return
    try {
      const [nRes, cRes] = await Promise.all([
        fetchApi('/api/notificaciones'),
        fetchApi('/api/chat-leido/unread-counts'),
      ])
      const nJson = await nRes.json()
      const cJson = await cRes.json()
      setNotificaciones(nJson.data || [])
      setUnreadChatCounts(cJson.data?.porCompra || {})
    } catch {}
  }, [user])

  useEffect(() => {
    fetchInitial()
  }, [fetchInitial])

  // Socket connection for real-time updates
  useEffect(() => {
    if (!user) return
    const stored = localStorage.getItem('user')
    const token = stored ? JSON.parse(stored)?.token : undefined
    if (!token) return

    const socket = socketIO('http://localhost:3000', { auth: { token } })
    socketRef.current = socket

    socket.on('nueva_notificacion', (notif: Notificacion) => {
      setNotificaciones(prev => [notif, ...prev])
    })

    socket.on('chat_badge_update', ({ compraId }: { compraId: number }) => {
      setUnreadChatCounts(prev => ({
        ...prev,
        [compraId]: (prev[compraId] || 0) + 1,
      }))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user])

  const marcarLeida = useCallback(async (id: number) => {
    try {
      await fetchApi(`/api/notificaciones/${id}/leer`, { method: 'PATCH' })
      setNotificaciones(prev => prev.filter(n => n.id !== id))
    } catch {}
  }, [])

  const marcarTodasLeidas = useCallback(async () => {
    try {
      await fetchApi('/api/notificaciones/leer-todas', { method: 'PATCH' })
      setNotificaciones([])
    } catch {}
  }, [])

  const marcarChatLeido = useCallback(async (compraId: number) => {
    try {
      await fetchApi(`/api/chat-leido/${compraId}/marcar-leido`, { method: 'POST' })
      setUnreadChatCounts(prev => {
        const next = { ...prev }
        delete next[compraId]
        return next
      })
    } catch {}
  }, [])

  const marcarCompraNotificacionesLeidas = useCallback(async (compraId: number) => {
    try {
      await fetchApi(`/api/notificaciones/compra/${compraId}/leer`, { method: 'PATCH' })
      setNotificaciones(prev => prev.filter(n => n.compraId !== compraId))
    } catch {}
  }, [])

  return (
    <NotificacionesContext.Provider value={{
      notificaciones,
      unreadChatCounts,
      totalUnreadChats,
      marcarLeida,
      marcarTodasLeidas,
      marcarChatLeido,
      marcarCompraNotificacionesLeidas,
    }}>
      {children}
    </NotificacionesContext.Provider>
  )
}

export function useNotificaciones() {
  return useContext(NotificacionesContext)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd vite-project/vite-project-ts && npx tsc --noEmit
```
Expected: no errors.

---

## Task 14: NotificacionesDropdown component

**Files:**
- Create: `vite-project/vite-project-ts/src/components/NotificacionesDropdown.tsx`

- [ ] **Step 1: Create the component**

```tsx
// vite-project/vite-project-ts/src/components/NotificacionesDropdown.tsx
import { useNavigate } from 'react-router-dom'
import { useUser } from '../context/user'
import { useNotificaciones, Notificacion } from '../context/notificaciones'
import { Bell, Package, ShoppingBag, Store, X } from 'lucide-react'

const TIPO_ICON: Record<string, React.ReactNode> = {
  nueva_compra: <ShoppingBag size={14} className="text-blue-500" />,
  cambio_estado: <Package size={14} className="text-violet-500" />,
  cancelacion: <X size={14} className="text-red-500" />,
}

const TIPO_LABEL: Record<string, string> = {
  nueva_compra: 'Nueva venta',
  cambio_estado: 'Cambio de estado',
  cancelacion: 'Cancelación',
}

function ordersLink(role: string | undefined, compraId: number): string {
  if (role === 'vendedor') return `/mis-ventas?compraId=${compraId}`
  if (role === 'tiendaRetiro') return `/tienda-retiro/ventas?compraId=${compraId}`
  return `/purchases?compraId=${compraId}`
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hs = Math.floor(mins / 60)
  if (hs < 24) return `hace ${hs}h`
  return `hace ${Math.floor(hs / 24)}d`
}

interface Props {
  onClose: () => void
}

export function NotificacionesDropdown({ onClose }: Props) {
  const { user } = useUser()
  const { notificaciones, marcarLeida, marcarTodasLeidas } = useNotificaciones()
  const navigate = useNavigate()

  const handleClick = async (n: Notificacion) => {
    await marcarLeida(n.id)
    onClose()
    navigate(ordersLink(user?.role, n.compraId))
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-[80] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
          {notificaciones.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {notificaciones.length}
            </span>
          )}
        </div>
        {notificaciones.length > 0 && (
          <button
            onClick={marcarTodasLeidas}
            className="text-xs text-gray-400 hover:text-gray-600 transition"
          >
            Limpiar todo
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-80 overflow-y-auto">
        {notificaciones.length === 0 ? (
          <div className="py-10 text-center">
            <Bell size={28} className="mx-auto text-gray-200 mb-2" />
            <p className="text-sm text-gray-400">Sin notificaciones</p>
          </div>
        ) : (
          notificaciones.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 last:border-0 flex items-start gap-3"
            >
              <span className="mt-0.5 shrink-0">
                {TIPO_ICON[n.tipo] ?? <Bell size={14} className="text-gray-400" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                  {TIPO_LABEL[n.tipo] ?? n.tipo}
                </p>
                <p className="text-sm text-gray-800 leading-snug">{n.mensaje}</p>
                <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd vite-project/vite-project-ts && npx tsc --noEmit
```
Expected: no errors.

---

## Task 15: Header.tsx — badges + dropdown

**Files:**
- Modify: `vite-project/vite-project-ts/src/components/Header.tsx`

- [ ] **Step 1: Add imports to Header.tsx**

At the top, add:

```typescript
import { useNotificaciones } from '../context/notificaciones'
import { NotificacionesDropdown } from './NotificacionesDropdown'
```

- [ ] **Step 2: Add state and hook in the Header function body**

After the existing `useState` declarations, add:

```typescript
  const { notificaciones, totalUnreadChats } = useNotificaciones()
  const [notifOpen, setNotifOpen] = useState(false)
```

- [ ] **Step 3: Add click-outside handler for the notification dropdown**

In the existing `useEffect` that handles click outside (the one with `handleClickOutside`), extend the `if` condition and body:

Replace:
```typescript
    if (userMenuOpen || results.length > 0 || resolveError) {
      document.addEventListener("mousedown", handleClickOutside);
    }
```

With:
```typescript
    if (userMenuOpen || results.length > 0 || resolveError || notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
```

And in `handleClickOutside`, add before the closing brace:
```typescript
      if (!target.closest(".notif-dropdown-container")) {
        setNotifOpen(false);
      }
```

- [ ] **Step 4: Replace the Bell button in the JSX**

Find the existing Bell button:
```tsx
              <button
                className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
                title="Notificaciones"
              >
                <Bell size={20} />
              </button>
```

Replace with:
```tsx
              <div className="relative notif-dropdown-container">
                <button
                  onClick={() => setNotifOpen(o => !o)}
                  className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
                  title="Notificaciones"
                >
                  <Bell size={20} />
                  {notificaciones.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 pointer-events-none">
                      {notificaciones.length > 99 ? '99+' : notificaciones.length}
                    </span>
                  )}
                </button>
                {notifOpen && <NotificacionesDropdown onClose={() => setNotifOpen(false)} />}
              </div>
```

- [ ] **Step 5: Add unread badge to the MessageSquare button**

Find the existing MessageSquare button:
```tsx
              <button
                onClick={() => navigate('/chats')}
                className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
                title="Mis chats"
              >
                <MessageSquare size={20} />
              </button>
```

Replace with:
```tsx
              <button
                onClick={() => navigate('/chats')}
                className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
                title="Mis chats"
              >
                <MessageSquare size={20} />
                {totalUnreadChats > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 pointer-events-none">
                    {totalUnreadChats > 99 ? '99+' : totalUnreadChats}
                  </span>
                )}
              </button>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd vite-project/vite-project-ts && npx tsc --noEmit
```
Expected: no errors.

---

## Task 16: App.tsx + ChatsPage.tsx + Chat.tsx — wire up context

**Files:**
- Modify: `vite-project/vite-project-ts/src/App.tsx`
- Modify: `vite-project/vite-project-ts/src/pages/ChatsPage.tsx`
- Modify: `vite-project/vite-project-ts/src/components/Chat.tsx`

- [ ] **Step 1: Wrap App.tsx with NotificacionesProvider**

In `App.tsx`, add the import:

```typescript
import { NotificacionesProvider } from './context/notificaciones'
```

Then find the JSX where routes/providers are rendered. Wrap the existing router/provider tree so that `NotificacionesProvider` is inside `UserProvider` (so `useUser()` works inside it):

```tsx
<UserProvider>
  <NotificacionesProvider>
    {/* existing children */}
  </NotificacionesProvider>
</UserProvider>
```

The exact wrapping depends on the current App.tsx structure. Add `<NotificacionesProvider>` as the innermost wrapper inside `<UserProvider>` but outside `<CartProvider>` (or wherever the routes are). The key constraint: `NotificacionesProvider` must be a descendant of `UserProvider`.

- [ ] **Step 2: Mark chat as read in ChatsPage.tsx**

In `ChatsPage.tsx`, add the import:

```typescript
import { useNotificaciones } from '../context/notificaciones'
```

In the component body, after the existing hooks, add:

```typescript
  const { marcarChatLeido } = useNotificaciones()
```

Find the handler that sets the selected conversation. Currently it is called from the `onClick` of the conversation list buttons:

```tsx
onClick={() => setSelectedCompraId(c.id)}
```

Replace with:

```tsx
onClick={() => {
  setSelectedCompraId(c.id)
  marcarChatLeido(c.id)
}}
```

- [ ] **Step 3: Mark chat as read in Chat.tsx (embedded chat)**

In `Chat.tsx`, add the import:

```typescript
import { useNotificaciones } from '../context/notificaciones'
```

In the component body, add:

```typescript
  const { marcarChatLeido } = useNotificaciones()
```

In the existing `useEffect` that runs on `[compraId]` (the one with `fetchApi(...mensajes...)`), add `marcarChatLeido(compraId)` call when the component mounts:

```typescript
  useEffect(() => {
    const stored = localStorage.getItem('user')
    const token = stored ? JSON.parse(stored)?.token : undefined

    const socket = socketIO('http://localhost:3000', {
      auth: { token },
    })

    socket.on('connect', () => {
      socket.emit('join_compra', compraId)
    })

    socket.on('nuevo_mensaje', (msg: Mensaje) => {
      setMensajes((prev) => [...prev, msg])
    })

    fetchApi(`/api/mensajes/${compraId}`)
      .then((res) => res.json())
      .then((json) => setMensajes(json.data || []))
      .catch(() => {})

    // Mark this chat as read when the component mounts
    marcarChatLeido(compraId)

    return () => {
      socket.disconnect()
    }
  }, [compraId])
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd vite-project/vite-project-ts && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Start both servers and do end-to-end verification**

```bash
# Terminal 1
cd backend && pnpm start:dev

# Terminal 2
cd vite-project/vite-project-ts && pnpm run dev
```

Verify the following manually:

1. **Bell badge:** Log in as a buyer. Open another session as a vendedor. Vendor marks an order as finalizado → bell on buyer's header shows red badge with count 1.
2. **Bell dropdown:** Buyer clicks bell → dropdown shows "Tu orden #X fue finalizada". Clicking it navigates to the order page.
3. **Mark as read:** After clicking the notification, badge count decreases. Refreshing the page shows 0 notifications.
4. **Chat badge:** In the MessageSquare, verify badge shows count of chats with unread messages.
5. **Chat read:** Opening a chat (in ChatsPage or embedded Chat) reduces the MessageSquare badge for that conversation.
6. **New message badge:** Send a message from vendor to buyer. The buyer's MessageSquare badge increments without page reload.
7. **Mark all:** Bell dropdown "Limpiar todo" clears all notifications.

- [ ] **Step 6: Commit**

```bash
git add \
  backend/src/notificacion/ \
  backend/src/chatLeido/ \
  backend/src/compra/compra.entity.ts \
  backend/src/shared/db/orm.ts \
  backend/src/app.ts \
  backend/src/socket/index.ts \
  backend/src/compra/compra.controler.ts \
  backend/src/mensaje/mensaje.routes.ts \
  backend/src/vendedor/vendedor.controller.ts \
  backend/src/tiendaRetiro/tiendaRetiro.controller.ts \
  vite-project/vite-project-ts/src/context/notificaciones.tsx \
  vite-project/vite-project-ts/src/components/NotificacionesDropdown.tsx \
  vite-project/vite-project-ts/src/components/Header.tsx \
  vite-project/vite-project-ts/src/components/Chat.tsx \
  vite-project/vite-project-ts/src/pages/ChatsPage.tsx \
  vite-project/vite-project-ts/src/App.tsx

git commit -m "feat: persistent notifications + unread chat badges"
```
