# Diseño: Sistema de Notificaciones In-App

## Resumen

Sistema de notificaciones persistentes para cambios de estado en órdenes de compra y mensajes de chat. Badge rojo en campanita y en ícono de chat en el Header, dropdown al hacer click, y se marcan como leídas al entrar a la orden o chat correspondiente.

## Actores

Compradores (`user`/`usuario`), vendedores (`vendedor`) y tiendas (`tiendaRetiro`). Sin intermediario por ahora.

## Entidad `Notificacion` (nueva tabla DB)

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | number PK | auto |
| `userId` | number | ID del receptor |
| `userRole` | string | `'user'` \| `'vendedor'` \| `'tiendaRetiro'` |
| `contexto` | string \| null | `'compra'` \| `'venta'` \| `'gestion'` \| null |
| `tipo` | string | `'compra_estado'` \| `'nuevo_mensaje'` |
| `compraId` | number | Orden referida |
| `texto` | string | Mensaje legible |
| `leida` | boolean | false por defecto |
| `createdAt` | Date | timestamp auto |

## Backend

### Archivos nuevos
- `notificacion/notificacion.entity.ts` — entidad MikroORM
- `notificacion/notificacion.routes.ts` — endpoints REST
- `notificacion/notificacion.controler.ts` — lógica de negocio

### Endpoints
- `GET /api/notificaciones` — no leídas del usuario logueado
- `GET /api/notificaciones/count` — conteo de no leídas
- `PATCH /api/notificaciones/marcar-leidas` — body `{ compraId }`, marca como leídas

### Triggers de creación

**Cambio de estado en compra** (`compra.controler.ts` → `update()` y `cancelarCompra()`):
- Comprador → texto: `"Tu orden #N pasó a: {estado}"`
- Vendedor (uploaderVendedor en itemCartas) → `"Tu venta #N pasó a: {estado}"`, contexto: `'venta'`
- TiendaRetiro vendedor (uploaderTienda en itemCartas) → `"Tu venta #N pasó a: {estado}"`, contexto: `'venta'`
- TiendaRetiro comprador (compradorTienda) → `"Tu compra #N pasó a: {estado}"`, contexto: `'compra'`
- TiendaRetiro gestión (compra.tiendaRetiro) → `"Pedido #N (gestión) pasó a: {estado}"`, contexto: `'gestion'`
- Emite socket `nueva_notificacion` al room personal `user-{userId}` de cada receptor

**Nuevo mensaje** (`mensaje.routes.ts`):
- Crea Notificacion para todos los participantes de la compra excepto el emisor
- texto: `"Nuevo mensaje en la orden #N"`
- El emit `nuevo_mensaje` ya existe; agregar emit `nueva_notificacion` al room personal

### Socket (`socket/index.ts`)
- Al conectar, usuario entra a room `user-{socket.data.userId}` (el JWT middleware ya decodifica el userId)

## Frontend

### Archivos nuevos
- `context/notifications.tsx` — NotificationContext con estado, fetch inicial, listener socket, `markAsRead(compraId)`
- `components/NotificationDropdown.tsx` — dropdown lista de notificaciones con ícono por tipo, texto, tiempo relativo, y dot de no leída

### Cambios en archivos existentes
- `context/user.tsx` o `App.tsx` — envuelve con `NotificationProvider`
- `components/Header.tsx` — badge rojo en Bell con `unreadOrderCount`, badge en MessageSquare con `unreadChatCount`, click en Bell abre dropdown
- `pages/Purchases.tsx` — al abrir detalle de orden llama `markAsRead(compraId)`
- `pages/MisVentasPage.tsx` — ídem
- `pages/TiendaRetiroVentasPage.tsx` — ídem
- `pages/ChatsPage.tsx` — al seleccionar conversación llama `markAsRead(compraId)`

### NotificationContext API
```ts
unreadOrderCount: number       // tipo === 'compra_estado' no leídas
unreadChatCount: number        // tipo === 'nuevo_mensaje' no leídas
notifications: Notificacion[]  // todas las no leídas
markAsRead(compraId: number): Promise<void>
```

### Badge visual
- Círculo rojo absoluto sobre el ícono, número dentro
- Si count > 9 muestra "9+"
- Se oculta si count === 0

### Dropdown (al click en Bell)
- Lista de notificaciones ordenadas por `createdAt` desc
- Cada item: ícono (📦 compra_estado, 💬 mensaje), texto, label de contexto (Venta/Compra/Gestión), tiempo relativo
- Click en item → navega a `/purchases`, `/mis-ventas`, o `/chats` según `userRole` + `contexto`, llama `markAsRead`
- "No hay notificaciones" si está vacío
- Cierra al hacer click fuera

## Migración DB
`pnpm schema:update` — safe, no borra datos.
