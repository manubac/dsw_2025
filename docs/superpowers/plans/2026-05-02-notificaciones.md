# Notificaciones In-App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar notificaciones persistentes en la web para cambios de estado en órdenes de compra y mensajes de chat, con badges en campanita e ícono de chat en el Header.

**Architecture:** Nueva entidad `Notificacion` en PostgreSQL via MikroORM. Un service de backend se encarga de crear filas y emitir socket events a rooms personales (`user-{userId}`) cada vez que cambia el estado de una compra o se envía un mensaje. El frontend usa un `NotificationContext` que fetchea al montar y escucha el socket; el Header muestra badges rojos con conteos separados para órdenes y mensajes.

**Tech Stack:** Express 5 + MikroORM 6 + Socket.io (backend), React 19 + TypeScript + Tailwind + socket.io-client (frontend)

---

## File Map

### Backend — New Files
- `backend/src/notificacion/notificacion.entity.ts` — MikroORM entity
- `backend/src/notificacion/notificacion.service.ts` — lógica de creación de notificaciones + emit socket
- `backend/src/notificacion/notificacion.controler.ts` — handlers GET/PATCH
- `backend/src/notificacion/notificacion.routes.ts` — router Express

### Backend — Modified Files
- `backend/src/socket/index.ts` — decodificar JWT y unir room personal `user-{userId}`
- `backend/src/app.ts` — registrar `notificacionRouter`
- `backend/src/vendedor/vendedor.controller.ts` — llamar al service en `finalizarVenta` y `marcarPagoConfirmado`
- `backend/src/tiendaRetiro/tiendaRetiro.controller.ts` — llamar al service en 4 funciones de estado
- `backend/src/compra/compra.controler.ts` — llamar al service en `update` y `cancelarCompra`
- `backend/src/mensaje/mensaje.routes.ts` — llamar al service al crear mensaje

### Frontend — New Files
- `vite-project/vite-project-ts/src/context/notifications.tsx` — NotificationContext + Provider + hook
- `vite-project/vite-project-ts/src/components/NotificationDropdown.tsx` — dropdown con lista de notificaciones

### Frontend — Modified Files
- `vite-project/vite-project-ts/src/App.tsx` — envolver con `NotificationProvider`
- `vite-project/vite-project-ts/src/components/Header.tsx` — badges + dropdown
- `vite-project/vite-project-ts/src/pages/Purchases.tsx` — `markAsRead` al abrir orden
- `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx` — `markAsRead` al abrir venta
- `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx` — `markAsRead` al abrir venta
- `vite-project/vite-project-ts/src/pages/ChatsPage.tsx` — `markAsRead` al seleccionar chat

---

## Task 1: Entidad Notificacion

**Files:**
- Create: `backend/src/notificacion/notificacion.entity.ts`

- [ ] **Step 1: Crear el archivo de entidad**

```typescript
// backend/src/notificacion/notificacion.entity.ts
import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../shared/db/baseEntity.js';

@Entity()
export class Notificacion extends BaseEntity {
  @Property({ type: 'number' })
  userId!: number;

  @Property({ type: 'string' })
  userRole!: string;

  @Property({ type: 'string', nullable: true })
  contexto?: 'compra' | 'venta' | 'gestion';

  @Property({ type: 'string' })
  tipo!: 'compra_estado' | 'nuevo_mensaje';

  @Property({ type: 'number' })
  compraId!: number;

  @Property({ type: 'text' })
  texto!: string;

  @Property({ type: 'boolean', default: false })
  leida: boolean = false;
}
```

- [ ] **Step 2: Registrar la entidad en el ORM config**

Abrir `backend/src/shared/db/orm.ts` y agregar `Notificacion` al array `entities`. Primero leer el archivo para ver la estructura exacta, luego agregar:

```typescript
import { Notificacion } from '../../notificacion/notificacion.entity.js';
// ...en el array entities: Notificacion
```

- [ ] **Step 3: Sincronizar esquema de DB**

```bash
cd backend && pnpm schema:update
```

Expected: "Schema updated" sin errores. Verificar que la tabla `notificacion` existe:
```bash
# En psql o pgAdmin: \dt notificacion
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/notificacion/notificacion.entity.ts backend/src/shared/db/orm.ts
git commit -m "feat: add Notificacion entity and sync schema"
```

---

## Task 2: Socket — rooms personales

**Files:**
- Modify: `backend/src/socket/index.ts`

- [ ] **Step 1: Actualizar el middleware para guardar userId y unir room personal**

Reemplazar todo el contenido de `backend/src/socket/index.ts` con:

```typescript
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
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as { userId: number; role: string };
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    if (socket.data.userId) {
      socket.join(`user-${socket.data.userId}`);
    }

    socket.on('join_compra', (compraId: number) => {
      socket.join(`compra-${compraId}`);
    });
  });

  return io;
}
```

- [ ] **Step 2: Compilar para verificar**

```bash
cd backend && pnpm tsc --noEmit
```

Expected: sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add backend/src/socket/index.ts
git commit -m "feat: join personal user room on socket connection"
```

---

## Task 3: Notification Service

**Files:**
- Create: `backend/src/notificacion/notificacion.service.ts`

- [ ] **Step 1: Crear el service**

```typescript
// backend/src/notificacion/notificacion.service.ts
import { orm } from '../shared/db/orm.js';
import { Notificacion } from './notificacion.entity.js';
import { Compra } from '../compra/compra.entity.js';
import { io } from '../socket/index.js';

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_tienda: 'En tienda',
  pago_confirmado: 'Pago confirmado',
  listo_para_retirar: 'Listo para retirar',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
};

interface NotifTarget {
  userId: number;
  userRole: 'user' | 'vendedor' | 'tiendaRetiro';
  contexto: 'compra' | 'venta' | 'gestion' | undefined;
  texto: string;
}

async function loadCompraConActores(compraId: number): Promise<Compra | null> {
  const em = orm.em.fork();
  return em.findOne(
    Compra,
    { id: compraId },
    {
      populate: [
        'comprador',
        'compradorTienda',
        'itemCartas',
        'itemCartas.uploaderVendedor',
        'itemCartas.uploaderVendedor.user',
        'itemCartas.uploaderTienda',
        'tiendaRetiro',
      ],
    }
  );
}

function resolveTargetsEstado(compra: Compra, estadoLabel: string): NotifTarget[] {
  const compraId = compra.id!;
  const targets: NotifTarget[] = [];

  if ((compra.comprador as any)?.id) {
    targets.push({
      userId: (compra.comprador as any).id,
      userRole: 'user',
      contexto: undefined,
      texto: `Tu orden #${compraId} pasó a: ${estadoLabel}`,
    });
  }

  if ((compra.compradorTienda as any)?.id) {
    targets.push({
      userId: (compra.compradorTienda as any).id,
      userRole: 'tiendaRetiro',
      contexto: 'compra',
      texto: `Tu compra #${compraId} pasó a: ${estadoLabel}`,
    });
  }

  const vendedoresYa = new Set<number>();
  const tiendasVentaYa = new Set<number>();

  for (const item of compra.itemCartas.getItems()) {
    const v = (item as any).uploaderVendedor;
    const t = (item as any).uploaderTienda;

    if (v?.id && v.user?.id && !vendedoresYa.has(v.id)) {
      vendedoresYa.add(v.id);
      targets.push({
        userId: v.user.id,
        userRole: 'vendedor',
        contexto: 'venta',
        texto: `Tu venta #${compraId} pasó a: ${estadoLabel}`,
      });
    }

    if (t?.id && !tiendasVentaYa.has(t.id)) {
      tiendasVentaYa.add(t.id);
      targets.push({
        userId: t.id,
        userRole: 'tiendaRetiro',
        contexto: 'venta',
        texto: `Tu venta #${compraId} pasó a: ${estadoLabel}`,
      });
    }
  }

  if ((compra.tiendaRetiro as any)?.id) {
    targets.push({
      userId: (compra.tiendaRetiro as any).id,
      userRole: 'tiendaRetiro',
      contexto: 'gestion',
      texto: `Pedido #${compraId} (gestión) pasó a: ${estadoLabel}`,
    });
  }

  return targets;
}

function resolveTargetsMensaje(compra: Compra, senderRole: string, senderId: number): NotifTarget[] {
  const compraId = compra.id!;
  const texto = `Nuevo mensaje en la orden #${compraId}`;
  const targets: NotifTarget[] = [];

  if ((compra.comprador as any)?.id) {
    const uid = (compra.comprador as any).id;
    if (!(senderRole === 'user' && senderId === uid)) {
      targets.push({ userId: uid, userRole: 'user', contexto: undefined, texto });
    }
  }

  if ((compra.compradorTienda as any)?.id) {
    const uid = (compra.compradorTienda as any).id;
    if (!(senderRole === 'tiendaRetiro' && senderId === uid)) {
      targets.push({ userId: uid, userRole: 'tiendaRetiro', contexto: 'compra', texto });
    }
  }

  const vendedoresYa = new Set<number>();
  const tiendasVentaYa = new Set<number>();

  for (const item of compra.itemCartas.getItems()) {
    const v = (item as any).uploaderVendedor;
    const t = (item as any).uploaderTienda;

    if (v?.id && v.user?.id && !vendedoresYa.has(v.id)) {
      vendedoresYa.add(v.id);
      if (!(senderRole === 'vendedor' && senderId === v.id)) {
        targets.push({ userId: v.user.id, userRole: 'vendedor', contexto: 'venta', texto });
      }
    }

    if (t?.id && !tiendasVentaYa.has(t.id)) {
      tiendasVentaYa.add(t.id);
      if (!(senderRole === 'tiendaRetiro' && senderId === t.id)) {
        targets.push({ userId: t.id, userRole: 'tiendaRetiro', contexto: 'venta', texto });
      }
    }
  }

  if ((compra.tiendaRetiro as any)?.id) {
    const uid = (compra.tiendaRetiro as any).id;
    if (!(senderRole === 'tiendaRetiro' && senderId === uid)) {
      targets.push({ userId: uid, userRole: 'tiendaRetiro', contexto: 'gestion', texto });
    }
  }

  return targets;
}

async function persistirYEmitir(targets: NotifTarget[], tipo: 'compra_estado' | 'nuevo_mensaje', compraId: number): Promise<void> {
  const em = orm.em.fork();
  for (const target of targets) {
    const notif = em.create(Notificacion, {
      userId: target.userId,
      userRole: target.userRole,
      contexto: target.contexto,
      tipo,
      compraId,
      texto: target.texto,
      leida: false,
    });
    // Emit optimista antes del flush para latencia mínima
    io.to(`user-${target.userId}`).emit('nueva_notificacion', {
      userId: notif.userId,
      userRole: notif.userRole,
      contexto: notif.contexto,
      tipo: notif.tipo,
      compraId: notif.compraId,
      texto: notif.texto,
      leida: notif.leida,
      createdAt: new Date().toISOString(),
    });
  }
  await em.flush();
}

export async function crearNotificacionesEstado(compraId: number, nuevoEstado: string): Promise<void> {
  try {
    const compra = await loadCompraConActores(compraId);
    if (!compra) return;
    const estadoLabel = ESTADO_LABELS[nuevoEstado] ?? nuevoEstado;
    const targets = resolveTargetsEstado(compra, estadoLabel);
    await persistirYEmitir(targets, 'compra_estado', compraId);
  } catch (e) {
    console.error('[notificacion.service] crearNotificacionesEstado error:', e);
  }
}

export async function crearNotificacionesMensaje(compraId: number, senderRole: string, senderId: number): Promise<void> {
  try {
    const compra = await loadCompraConActores(compraId);
    if (!compra) return;
    const targets = resolveTargetsMensaje(compra, senderRole, senderId);
    await persistirYEmitir(targets, 'nuevo_mensaje', compraId);
  } catch (e) {
    console.error('[notificacion.service] crearNotificacionesMensaje error:', e);
  }
}
```

- [ ] **Step 2: Compilar**

```bash
cd backend && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add backend/src/notificacion/notificacion.service.ts
git commit -m "feat: add notification service (create + socket emit)"
```

---

## Task 4: Notificacion Controller + Routes + app.ts

**Files:**
- Create: `backend/src/notificacion/notificacion.controler.ts`
- Create: `backend/src/notificacion/notificacion.routes.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Crear el controller**

```typescript
// backend/src/notificacion/notificacion.controler.ts
import { Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { Notificacion } from './notificacion.entity.js';
import { AuthRequest } from '../shared/middleware/auth.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';

function resolveUserId(req: AuthRequest): number | null {
  if (req.actorRole === 'vendedor') {
    return (req.actor as Vendedor & { user?: { id?: number } }).user?.id ?? null;
  }
  return req.actor?.id ?? null;
}

export async function getUnread(req: AuthRequest, res: Response) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const em = orm.em.fork();
    const notifs = await em.find(
      Notificacion,
      { userId, leida: false },
      { orderBy: { createdAt: 'DESC' } }
    );
    res.json({ data: notifs });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function getCount(req: AuthRequest, res: Response) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const em = orm.em.fork();
    const count = await em.count(Notificacion, { userId, leida: false });
    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function marcarLeidas(req: AuthRequest, res: Response) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const compraId = Number(req.body.compraId);
    if (!compraId) return res.status(400).json({ message: 'compraId requerido' });
    const em = orm.em.fork();
    const notifs = await em.find(Notificacion, { userId, compraId, leida: false });
    notifs.forEach((n) => { n.leida = true; });
    await em.flush();
    res.json({ updated: notifs.length });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 2: Crear las rutas**

```typescript
// backend/src/notificacion/notificacion.routes.ts
import { Router } from 'express';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';
import { getUnread, getCount, marcarLeidas } from './notificacion.controler.js';

export const notificacionRouter = Router();

notificacionRouter.get('/', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), getUnread);
notificacionRouter.get('/count', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), getCount);
notificacionRouter.patch('/marcar-leidas', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), marcarLeidas);
```

- [ ] **Step 3: Registrar en app.ts**

En `backend/src/app.ts`, agregar el import y la ruta. Después de la línea `import { adminRouter }`:

```typescript
import { notificacionRouter } from './notificacion/notificacion.routes.js';
```

Y en la sección de rutas (después de `app.use("/api/admin", adminRouter);`):

```typescript
app.use("/api/notificaciones", notificacionRouter);
```

- [ ] **Step 4: Compilar**

```bash
cd backend && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add backend/src/notificacion/ backend/src/app.ts
git commit -m "feat: add notificacion routes and controller"
```

---

## Task 5: Hook en vendedor.controller.ts

**Files:**
- Modify: `backend/src/vendedor/vendedor.controller.ts`

- [ ] **Step 1: Importar el service**

Al principio de `backend/src/vendedor/vendedor.controller.ts`, después de los imports existentes, agregar:

```typescript
import { crearNotificacionesEstado } from '../notificacion/notificacion.service.js';
```

- [ ] **Step 2: Llamar al service en `finalizarVenta`**

En la función `finalizarVenta`, después de `await em.flush();` (línea ~217) y antes del `res.json(...)`:

```typescript
    await em.flush();
    crearNotificacionesEstado(compraId, 'finalizado').catch(() => {});
    res.json({ message: 'Venta finalizada', data: compra });
```

- [ ] **Step 3: Llamar al service en `marcarPagoConfirmado`**

En la función `marcarPagoConfirmado`, después de `await em.flush();` (línea ~252):

```typescript
    await em.flush();
    crearNotificacionesEstado(compraId, 'pago_confirmado').catch(() => {});
    res.json({ message: 'Pago confirmado exitosamente', data: compra });
```

- [ ] **Step 4: Compilar**

```bash
cd backend && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add backend/src/vendedor/vendedor.controller.ts
git commit -m "feat: emit notifications on vendor status changes"
```

---

## Task 6: Hook en tiendaRetiro.controller.ts

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`

- [ ] **Step 1: Importar el service**

Al principio del archivo, agregar:

```typescript
import { crearNotificacionesEstado } from '../notificacion/notificacion.service.js';
```

- [ ] **Step 2: Hook en `marcarEnTienda`**

Después de `await orm.em.flush();` en `marcarEnTienda` (antes del bloque de email):

```typescript
    await orm.em.flush();
    crearNotificacionesEstado(compraId, 'en_tienda').catch(() => {});

    // (bloque de email existente continúa igual...)
```

- [ ] **Step 3: Hook en `finalizarCompra`**

Después de `await orm.em.flush();` en `finalizarCompra`:

```typescript
    await orm.em.flush();
    crearNotificacionesEstado(compraId, 'finalizado').catch(() => {});
    res.json({ message: 'Compra finalizada', data: compra });
```

- [ ] **Step 4: Hook en `marcarListoParaRetirar`**

Después de `await orm.em.flush();` en `marcarListoParaRetirar` (antes del bloque de email):

```typescript
    await orm.em.flush();
    crearNotificacionesEstado(compraId, 'listo_para_retirar').catch(() => {});

    // (bloque de email existente continúa igual...)
```

- [ ] **Step 5: Hook en `finalizarVentaDirecta`**

Después de `await orm.em.flush();` en `finalizarVentaDirecta`:

```typescript
    await orm.em.flush();
    crearNotificacionesEstado(compraId, 'finalizado').catch(() => {});
    res.json({ message: 'Venta directa finalizada', data: compra });
```

- [ ] **Step 6: Compilar**

```bash
cd backend && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.controller.ts
git commit -m "feat: emit notifications on tiendaRetiro status changes"
```

---

## Task 7: Hook en compra.controler.ts

**Files:**
- Modify: `backend/src/compra/compra.controler.ts`

- [ ] **Step 1: Importar el service**

Después de los imports existentes en `compra.controler.ts`:

```typescript
import { crearNotificacionesEstado } from '../notificacion/notificacion.service.js';
```

- [ ] **Step 2: Hook en `update`**

En la función `update`, el estado se actualiza en la línea `compra.estado = input.estado ?? compra.estado;`. Necesito detectar si cambió. Reemplazar la lógica de update de estado y el flush así:

```typescript
    const estadoAnterior = compra.estado;
    compra.total = input.total ?? compra.total;
    compra.estado = input.estado ?? compra.estado;
    compra.nombre = input.nombre ?? compra.nombre;
    compra.email = input.email ?? compra.email;
    compra.telefono = input.telefono ?? compra.telefono;
    if (input.direccionEntregaId) compra.direccionEntrega = em.getReference(Direccion, input.direccionEntregaId);
    compra.metodoPago = input.metodoPago ?? compra.metodoPago;

    await em.flush();

    if (input.estado && input.estado !== estadoAnterior) {
      crearNotificacionesEstado(id, compra.estado).catch(() => {});
    }

    res.status(200).json({ message: "Compra actualizada con éxito", data: compra });
```

- [ ] **Step 3: Hook en `cancelarCompra`**

En `cancelarCompra`, después de `await emFork.flush();`:

```typescript
    await emFork.flush();
    crearNotificacionesEstado(id, 'cancelado').catch(() => {});
    res.json({ message: 'Compra cancelada exitosamente', data: compra });
```

- [ ] **Step 4: Compilar**

```bash
cd backend && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add backend/src/compra/compra.controler.ts
git commit -m "feat: emit notifications on compra update and cancel"
```

---

## Task 8: Hook en mensaje.routes.ts

**Files:**
- Modify: `backend/src/mensaje/mensaje.routes.ts`

- [ ] **Step 1: Importar el service**

Después de los imports existentes en `mensaje.routes.ts`:

```typescript
import { crearNotificacionesMensaje } from '../notificacion/notificacion.service.js';
```

- [ ] **Step 2: Llamar al service al crear mensaje**

En el handler POST, después de `await em.flush();` y antes/después del emit de socket existente:

```typescript
    await em.flush();

    io.to(`compra-${compraId}`).emit('nuevo_mensaje', mensaje);

    const actor = req.actor as any;
    crearNotificacionesMensaje(compraId, req.actorRole ?? 'user', actor.id).catch(() => {});

    res.status(201).json({ data: mensaje });
```

- [ ] **Step 3: Compilar**

```bash
cd backend && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/mensaje/mensaje.routes.ts
git commit -m "feat: emit notifications on new message"
```

---

## Task 9: NotificationContext (Frontend)

**Files:**
- Create: `vite-project/vite-project-ts/src/context/notifications.tsx`

- [ ] **Step 1: Crear el contexto**

```typescript
// vite-project/vite-project-ts/src/context/notifications.tsx
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser } from './user';
import { api } from '../services/api';
import { io as socketIO } from 'socket.io-client';

export interface Notificacion {
  id?: number;
  userId: number;
  userRole: string;
  contexto: 'compra' | 'venta' | 'gestion' | null;
  tipo: 'compra_estado' | 'nuevo_mensaje';
  compraId: number;
  texto: string;
  leida: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notificacion[];
  unreadOrderCount: number;
  unreadChatCount: number;
  markAsRead: (compraId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notificacion[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await api.get('/api/notificaciones');
      setNotifications(res.data.data ?? []);
    } catch {
      // silencioso: no bloquear la app si falla
    }
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
  }, [fetchNotifications, user?.token]);

  useEffect(() => {
    if (!user?.token) return;

    const socket = socketIO('http://localhost:3000', {
      auth: { token: user.token },
    });

    socket.on('nueva_notificacion', (notif: Notificacion) => {
      setNotifications((prev) => [notif, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.token]);

  const markAsRead = useCallback(async (compraId: number) => {
    if (!user?.token) return;
    try {
      await api.patch('/api/notificaciones/marcar-leidas', { compraId });
      setNotifications((prev) =>
        prev.map((n) => (n.compraId === compraId ? { ...n, leida: true } : n))
      );
    } catch {
      // silencioso
    }
  }, [user?.token]);

  const unreadOrderCount = notifications.filter((n) => !n.leida && n.tipo === 'compra_estado').length;
  const unreadChatCount = notifications.filter((n) => !n.leida && n.tipo === 'nuevo_mensaje').length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadOrderCount, unreadChatCount, markAsRead, refresh: fetchNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
```

- [ ] **Step 2: Verificar tipos**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vite-project/vite-project-ts/src/context/notifications.tsx
git commit -m "feat: add NotificationContext with socket listener"
```

---

## Task 10: NotificationDropdown component

**Files:**
- Create: `vite-project/vite-project-ts/src/components/NotificationDropdown.tsx`

- [ ] **Step 1: Crear el componente**

```typescript
// vite-project/vite-project-ts/src/components/NotificationDropdown.tsx
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, MessageSquare, X } from 'lucide-react';
import { useNotifications, Notificacion } from '../context/notifications';
import { useUser } from '../context/user';

interface Props {
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function contextoLabel(notif: Notificacion): string | null {
  if (notif.contexto === 'venta') return 'Venta';
  if (notif.contexto === 'compra') return 'Compra';
  if (notif.contexto === 'gestion') return 'Gestión';
  return null;
}

function destinoPath(notif: Notificacion, userRole: string): string {
  if (notif.tipo === 'nuevo_mensaje') {
    return `/chats?compraId=${notif.compraId}`;
  }
  if (notif.contexto === 'gestion') return '/tienda-retiro/ventas';
  if (notif.contexto === 'venta') return '/mis-ventas';
  return '/purchases';
}

export function NotificationDropdown({ onClose }: Props) {
  const { notifications, markAsRead } = useNotifications();
  const { user } = useUser();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const unread = notifications.filter((n) => !n.leida);

  async function handleClick(notif: Notificacion) {
    await markAsRead(notif.compraId);
    navigate(destinoPath(notif, user?.role ?? ''));
    onClose();
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-[80] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {unread.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          No tenés notificaciones nuevas
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {unread.map((notif, i) => {
            const ctxLabel = contextoLabel(notif);
            return (
              <li key={notif.id ?? i}>
                <button
                  onClick={() => handleClick(notif)}
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 transition flex gap-3 items-start"
                >
                  <span className="mt-0.5 flex-shrink-0 text-orange-500">
                    {notif.tipo === 'nuevo_mensaje' ? (
                      <MessageSquare size={16} />
                    ) : (
                      <Package size={16} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {ctxLabel && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">
                          {ctxLabel}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">{notif.texto}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Compilar**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vite-project/vite-project-ts/src/components/NotificationDropdown.tsx
git commit -m "feat: add NotificationDropdown component"
```

---

## Task 11: Header — badges y dropdown

**Files:**
- Modify: `vite-project/vite-project-ts/src/components/Header.tsx`

- [ ] **Step 1: Agregar imports**

Al principio de `Header.tsx`, después de los imports existentes, agregar:

```typescript
import { useNotifications } from '../context/notifications';
import { NotificationDropdown } from './NotificationDropdown';
```

- [ ] **Step 2: Agregar estado y lógica del dropdown**

Dentro de la función `Header`, después de los estados existentes (línea ~43):

```typescript
  const { unreadOrderCount, unreadChatCount } = useNotifications();
  const [notifOpen, setNotifOpen] = useState(false);
```

- [ ] **Step 3: Reemplazar los botones de Bell y MessageSquare**

Localizar el bloque entre `{user && (` y `)}` que contiene los botones de Bell y MessageSquare (líneas ~344-360) y reemplazarlo con:

```tsx
          {user && (
            <>
              <div className="relative">
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
                  title="Notificaciones"
                >
                  <Bell size={20} />
                  {unreadOrderCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {unreadOrderCount > 9 ? '9+' : unreadOrderCount}
                    </span>
                  )}
                </button>
                {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
              </div>
              <div className="relative">
                <button
                  onClick={() => navigate('/chats')}
                  className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
                  title="Mis chats"
                >
                  <MessageSquare size={20} />
                  {unreadChatCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                      {unreadChatCount > 9 ? '9+' : unreadChatCount}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
```

- [ ] **Step 4: Compilar**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add vite-project/vite-project-ts/src/components/Header.tsx
git commit -m "feat: add notification badges and dropdown to header"
```

---

## Task 12: Envolver App con NotificationProvider

**Files:**
- Modify: `vite-project/vite-project-ts/src/App.tsx`

- [ ] **Step 1: Importar el provider**

En `App.tsx`, después de `import { UserProvider, useUser } from "./context/user";`:

```typescript
import { NotificationProvider } from './context/notifications';
```

- [ ] **Step 2: Envolver el árbol**

Encontrar donde está `<UserProvider>` en el JSX del componente principal (función `App` o el export default). `NotificationProvider` debe ir **adentro** de `UserProvider` ya que usa `useUser`. El árbol debe quedar:

```tsx
<UserProvider>
  <NotificationProvider>
    <CartProvider>
      {/* ... resto del árbol */}
    </CartProvider>
  </NotificationProvider>
</UserProvider>
```

Leer el archivo completo primero para identificar la estructura exacta antes de editar.

- [ ] **Step 3: Compilar**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/App.tsx
git commit -m "feat: wrap app with NotificationProvider"
```

---

## Task 13: markAsRead en páginas de órdenes

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/Purchases.tsx`
- Modify: `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx`
- Modify: `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx`

### Purchases.tsx

- [ ] **Step 1: Importar y usar el hook**

En `Purchases.tsx`, agregar import:

```typescript
import { useNotifications } from '../context/notifications';
```

Dentro del componente, después de los estados existentes:

```typescript
  const { markAsRead } = useNotifications();
```

- [ ] **Step 2: Llamar markAsRead al seleccionar una orden**

Agregar un `useEffect` que se dispara cuando `selectedCompraId` cambia:

```typescript
  useEffect(() => {
    if (selectedCompraId) markAsRead(selectedCompraId);
  }, [selectedCompraId, markAsRead]);
```

Colocar después del `useEffect` de `fetchCompras`.

### MisVentasPage.tsx

- [ ] **Step 3: Importar y usar el hook en MisVentasPage**

```typescript
import { useNotifications } from '../context/notifications';
```

Dentro del componente:

```typescript
  const { markAsRead } = useNotifications();

  useEffect(() => {
    if (selectedVentaId) markAsRead(selectedVentaId);
  }, [selectedVentaId, markAsRead]);
```

### TiendaRetiroVentasPage.tsx

- [ ] **Step 4: Importar y usar el hook en TiendaRetiroVentasPage**

```typescript
import { useNotifications } from '../context/notifications';
```

Dentro del componente:

```typescript
  const { markAsRead } = useNotifications();

  useEffect(() => {
    if (selectedVentaId) markAsRead(selectedVentaId);
  }, [selectedVentaId, markAsRead]);
```

- [ ] **Step 5: Compilar**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/Purchases.tsx vite-project/vite-project-ts/src/pages/MisVentasPage.tsx vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx
git commit -m "feat: mark order notifications as read on open"
```

---

## Task 14: markAsRead en ChatsPage

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/ChatsPage.tsx`

- [ ] **Step 1: Importar y usar el hook**

En `ChatsPage.tsx`, agregar import:

```typescript
import { useNotifications } from '../context/notifications';
```

Dentro del componente, después de los estados:

```typescript
  const { markAsRead } = useNotifications();
```

- [ ] **Step 2: Llamar markAsRead al seleccionar conversación**

`ChatsPage.tsx` usa `selectedCompraId` (línea 83). Agregar:

```typescript
  useEffect(() => {
    if (selectedCompraId) markAsRead(selectedCompraId);
  }, [selectedCompraId, markAsRead]);
```

- [ ] **Step 3: Compilar y arrancar**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/ChatsPage.tsx
git commit -m "feat: mark chat notifications as read on conversation open"
```

---

## Verificación final

- [ ] **Arrancar backend y frontend**

```bash
# Terminal 1
cd backend && pnpm start:dev

# Terminal 2
cd vite-project/vite-project-ts && pnpm run dev
```

- [ ] **Test manual: cambio de estado**

1. Loguear como vendedor en un tab y como comprador en otro.
2. El vendedor finaliza una venta via `/mis-ventas`.
3. Verificar que el comprador ve el badge rojo en la campanita.
4. Hacer click en la campanita → ver el dropdown con "Tu orden #X pasó a: Finalizado".
5. Hacer click en la notificación → navega a `/purchases`, badge desaparece.

- [ ] **Test manual: mensaje**

1. Loguear como comprador en un tab.
2. Desde otro tab (vendedor), enviar un mensaje en la orden.
3. Verificar badge rojo en el ícono de MessageSquare del comprador.
4. Ir a `/chats` y seleccionar la conversación → badge desaparece.

- [ ] **Test manual: TiendaRetiro gestión**

1. Loguear como tiendaRetiro.
2. Desde otro tab, cambiar el estado de una compra donde la tienda es gestora.
3. Verificar notificación con etiqueta "Gestión" en el dropdown.
