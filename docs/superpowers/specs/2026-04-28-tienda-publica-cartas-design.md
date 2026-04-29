# Diseño: TiendaRetiro como vendedora directa de cartas

**Fecha:** 2026-04-28  
**Estado:** Aprobado

---

## Contexto

El sistema ya tiene dos flujos:

- **Flujo 3 actores:** Vendedor particular publica → Comprador reserva → TiendaRetiro recibe la carta del vendedor y se la entrega al comprador (`TiendaRetiroVentasPage.tsx`). Estados: `pendiente → entregado_a_tienda → en_tienda → finalizado`.
- **Flujo 2 actores (nuevo):** TiendaRetiro publica sus propias cartas → Comprador reserva → va a la tienda a pagar y retirar. Estados: `pendiente → finalizado`.

El schema ya soporta esto: `ItemCarta.uploaderTienda` existe, `Compra.tiendaRetiro` es nullable. No se requieren migraciones.

---

## Actores y roles

- `user` — comprador
- `tiendaRetiro` — puede publicar ItemCartas y gestionar sus ventas directas
- No interviene ningún `vendedor` en el flujo 2 actores

---

## Flujo completo (2 actores)

1. TiendaRetiro crea publicaciones (ItemCarta con `uploaderTienda`)
2. Comprador agrega ítems al carrito y va a Reservar
3. En Reservar, los ítems de tienda muestran un bloque fijo con la dirección de la tienda (sin selector)
4. Al confirmar, se crea una `Compra` con `tiendaRetiro = esa tienda`, estado `pendiente`, sin envío
5. El comprador ve la confirmación en pantalla (sin email)
6. La TiendaRetiro ve la orden en "Mis Ventas" dentro de su perfil
7. Cuando el comprador va, paga y retira → la tienda pulsa "Finalizar" → estado `finalizado`

---

## Cambios — Backend

### 1. Publicaciones CRUD (`tiendaRetiro.routes.ts` + `tiendaRetiro.controller.ts`)

Nuevas rutas (autenticadas con `tiendaRetiro` + `authorizeSelf`):

```
GET    /api/tiendas/:id/publicaciones
POST   /api/tiendas/:id/publicaciones
PATCH  /api/tiendas/:id/publicaciones/:itemId
DELETE /api/tiendas/:id/publicaciones/:itemId
```

- `POST`: crea `ItemCarta` con `uploaderTienda = tienda`. Campos: `description`, `stock`, `estado`, `precio` (price on ItemCarta), nombre de la carta.
- `PATCH`: actualiza campos permitidos. Solo si `uploaderTienda.id === tiendaId`.
- `DELETE`: elimina si stock == 0 o sin compras activas en estado pendiente.
- `GET`: devuelve todas las ItemCartas donde `uploaderTienda.id === tiendaId`, populando `cartas`.

Sanitize middleware: `sanitizePublicacionTiendaInput` — whitelist `description`, `stock`, `estado`, `precio`.

### 2. Creación de Compra (`compra.controler.ts`)

El `add` actual agrupa por `uploaderVendedor`. Agregar un segundo mapa `tiendaMap: Map<number, {itemCartas, items}>`:

- Al procesar un `itemCartaId`: si `itemCarta.uploaderTienda` está seteado, agregar al `tiendaMap` (key = `uploaderTienda.id`). Si tiene `uploaderVendedor`, va al `vendorMap` existente.
- Al crear Compras desde `tiendaMap`: cada grupo genera una `Compra` con `tiendaRetiro = esa tienda`, sin `envio`, sin `tiendaRetiroPorVendedor`.
- No se envía email al confirmar la reserva — solo respuesta HTTP exitosa.

### 3. Nueva ruta `finalizar-directo` (`tiendaRetiro.controller.ts`)

```
PATCH /api/tiendas/:id/ventas/:compraId/finalizar-directo
```

- Busca `Compra` donde `tiendaRetiro.id === tiendaId`
- Valida `estado === 'pendiente'` (no requiere pasar por `en_tienda`)
- Setea `estado = 'finalizado'`
- **No envía email**
- Devuelve la compra actualizada

> El `finalizarCompra` existente (que requiere `en_tienda`) no se modifica — sigue siendo para el flujo 3 actores.

### 4. Nuevo endpoint `GET /api/tiendas/:id/ventas-directas`

El endpoint existente `GET /api/tiendas/:id/ventas` se deja **sin cambios** — sigue devolviendo solo las compras del flujo 3 actores (donde los ítems tienen `uploaderVendedor`). Así `TiendaRetiroVentasPage.tsx` no se toca.

Se agrega un nuevo endpoint:
```
GET /api/tiendas/:id/ventas-directas
```
Devuelve compras donde `tiendaRetiro.id === tiendaId` Y al menos un ítem tiene `uploaderTienda.id === tiendaId`. Popula `comprador`, `itemCartas`. El panel "Mis Ventas" del perfil llama a este endpoint.

---

## Cambios — Frontend

### 5. `Reservar.tsx`

Los items del carrito deben llevar `uploaderTienda?: {id, nombre, direccion, horario}` (la API de ItemCarta ya puede populear este campo).

Lógica:
- Separar items: si `item.uploaderTienda` existe → `itemsPorTienda: Record<string, {tienda, items[]}>`; si no → `itemsPorVendedor` (lógica existente sin cambios).
- Para cada grupo de tienda, renderizar un bloque fijo (no un selector):

```
📍 Retiro en [Nombre Tienda]
   [Dirección] · 🕐 [Horario]
   Pagás y retirás en el local.
```

- La validación antes del submit ya no requiere selección para ítems de tienda.
- En el POST a `/api/compras`, los ítems de tienda se envían sin `tiendaRetiroPorVendedor` para ese grupo (el backend los detecta por `uploaderTienda`).

**Mensaje de confirmación:** reemplazar el texto actual "Desde Mis Compras podés chatear con el vendedor..." por uno adaptado cuando hay compras de tienda:

> "Tu reserva está confirmada. Podés ir a retirar tus cartas a [nombre tienda], [dirección]. Llevá este número de orden: #XXXX."

### 6. `MiPerfilTiendaRetiroPage.tsx`

Reemplazar los dos placeholders:

#### "Mis Publicaciones"
- Carga `GET /api/tiendas/:id/publicaciones`
- Lista tarjetas con: nombre carta, descripción, precio, stock, estado
- Botón "Nueva publicación" → formulario inline (nombre, descripción, precio, stock, estado)
- Edición inline por publicación (click editar → campos editables in-place)
- Eliminar con confirmación

#### "Mis Ventas" (ventas directas)
- Carga `GET /api/tiendas/:id/ventas-directas`
- Lista ordenada por fecha, mostrando: nro de orden, comprador (nombre, email, teléfono), items, total, estado
- Badge de estado: `pendiente` → amarillo, `finalizado` → verde
- Botón "Marcar como finalizado" (solo en pendiente) → llama a `finalizar-directo`

> **NO tocar `TiendaRetiroVentasPage.tsx`** — sigue llamando a `GET /api/tiendas/:id/ventas` sin cambios, ese endpoint solo devuelve flujo 3 actores.

---

## Invariantes y restricciones

- Un `ItemCarta` tiene `uploaderTienda` OR `uploaderVendedor`, nunca ambos
- Una `Compra` de venta directa tiene `tiendaRetiro` seteado y ningún `envio`
- Solo la tienda dueña puede finalizar una compra directa suya (`authorizeSelf`)
- El comprador no puede finalizar — solo la tienda
- `TiendaRetiroVentasPage` no se modifica; sigue llamando a `GET /api/tiendas/:id/ventas` que no devuelve ventas directas

---

## Lo que NO cambia

- `TiendaRetiroVentasPage.tsx` — flujo 3 actores intacto
- `marcarEnTienda` y `finalizarCompra` existentes — intactos
- Schema de BD — sin migraciones
- Flujo de vendedor particular — intacto
- Checkout con MercadoPago — intacto
