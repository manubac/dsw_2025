# Flujo de Órdenes de Compra — Spec
**Fecha:** 2026-04-29  
**Proyecto:** DSW 2025 — Marketplace de Cartas Pokémon

---

## Contexto

El sistema tiene tres tipos de actores vendedores (Vendedor particular, TiendaRetiro como vendedora) y tres tipos de compradores (User, Vendedor comprando, TiendaRetiro comprando). Las órdenes de compra deben reflejar correctamente el flujo según qué actores intervienen, con estados coherentes, emails en los momentos justos y valoraciones al finalizar.

---

## Actores

| Actor | Rol comprador | Rol vendedor | Rol retiro |
|---|---|---|---|
| User | ✓ | — | — |
| Vendedor | ✓ (via user vinculado) | ✓ | — |
| TiendaRetiro | ✓ (compradorTienda) | ✓ (uploaderTienda) | ✓ (tiendaRetiro) |

---

## Máquina de estados

### Estados válidos

| Estado DB | Descripción visible |
|---|---|
| `pendiente` | Orden creada, esperando acción |
| `en_tienda` | La carta llegó al local de retiro |
| `listo_para_retirar` | Carta lista para retirar (flujo tienda directa) |
| `finalizado` | Operación completada, habilita valoraciones |

**Estados eliminados:**
- `entregado_a_tienda` → reemplazado por `en_tienda` (la tienda confirma desde `pendiente`)
- `retirado` → absorbido por `finalizado`

**Migración SQL:**
```sql
UPDATE compra SET estado = 'en_tienda'   WHERE estado = 'entregado_a_tienda';
UPDATE compra SET estado = 'finalizado'  WHERE estado = 'retirado';
```

---

## Cuatro flujos

### Flujo 1 — Vendedor particular con tienda de retiro
**Owner de estados: TiendaRetiro**

```
pendiente  →  en_tienda  →  finalizado
              (tienda)       (tienda)
              email→comprador
```

- El comprador selecciona una de las tiendas habilitadas por el vendedor al reservar.
- El vendedor entrega físicamente la carta a la tienda; la tienda confirma en el sistema.
- El vendedor **no tiene botón de cambio de estado**.
- Al pasar a `en_tienda`: email al comprador ("Tu carta llegó a [tienda]").
- Al pasar a `finalizado`: se habilitan valoraciones. Sin email.
- La orden muestra alias/CBU del vendedor en ambos lados (comprador y tienda de retiro).

### Flujo 2 — Compra directa a tienda
**Owner de estados: TiendaRetiro (como vendedora)**

```
pendiente  →  listo_para_retirar  →  finalizado
              (tienda)                (tienda)
              email→comprador
```

- El lugar de retiro es la tienda misma (fijo, no seleccionable).
- Al pasar a `listo_para_retirar`: email al comprador ("Tu carta está lista para retirar en [tienda]").
- Al pasar a `finalizado`: se habilitan valoraciones. Sin email.
- La orden muestra alias/CBU de la tienda en ambos lados.

### Flujo 3 — Tienda comprando (TiendaRetiro como compradora)
**Owner de estados: Vendedor (particular o tienda vendedora)**

```
pendiente  →  finalizado
              (vendedor)
```

- El lugar de retiro es la tienda compradora (`compradorTienda` = `tiendaRetiro`).
- El vendedor ve la orden en Mis Ventas con botón "Marcar como finalizado".
- Al pasar a `finalizado`: se habilitan valoraciones. Sin email.
- La orden muestra alias/CBU del vendedor.

### Flujo 4 — Vendedor sin tienda de retiro
**Owner de estados: Vendedor**

```
pendiente  →  finalizado
              (vendedor)
```

- No hay tiendaRetiro en la orden (`tiendaRetiro = null`).
- Solo aparece el chat para coordinar la entrega.
- El vendedor ve botón "Marcar como finalizado" en Mis Ventas.
- Al pasar a `finalizado`: se habilitan valoraciones. Sin email.

---

## Backend

### TiendaRetiro controller

#### `PATCH /tiendas/:id/ventas/:compraId/en-tienda` (existente, ajustado)
- Precondición: `estado === 'pendiente'`
- Acción: `estado = 'en_tienda'`
- Email al comprador: "Tu carta llegó a [nombre tienda] — podés ir a retirarla."
- Incluye: nombre, dirección, horario de la tienda + alias/CBU del vendedor

#### `PATCH /tiendas/:id/ventas/:compraId/finalizar` (existente, ajustado)
- Precondición: `estado === 'en_tienda'`
- Acción: `estado = 'finalizado'`
- Sin email
- Habilita valoraciones en frontend

#### `PATCH /tiendas/:id/ventas-directas/:compraId/listo` (nuevo — reemplaza finalizar-directo)
- Precondición: `estado === 'pendiente'` y compra tiene `uploaderTienda === tienda`
- Acción: `estado = 'listo_para_retirar'`
- Email al comprador: "Tu carta está lista para retirar en [tienda]."

#### `PATCH /tiendas/:id/ventas-directas/:compraId/finalizar` (nuevo)
- Precondición: `estado === 'listo_para_retirar'`
- Acción: `estado = 'finalizado'`
- Sin email
- Habilita valoraciones en frontend

### Vendedor controller

#### `PATCH /vendedores/:id/ventas/:compraId/finalizar` (nuevo)
- Precondición: `estado === 'pendiente'` y (`tiendaRetiro === null` [flujo 4] o `compradorTienda !== null` [flujo 3])
- Flujo 3: `compradorTienda` está seteado → la tienda compradora ES el retiro, el vendedor confirma entrega
- Flujo 4: sin tiendaRetiro → coordinación por chat, el vendedor marca finalizado al acordar
- Acción: `estado = 'finalizado'`
- Sin email
- Habilita valoraciones en frontend

#### `PATCH /vendedores/:id/ventas/:compraId/entregar-tienda` (eliminar del flujo)
- Este endpoint deja de usarse. Se puede dejar en backend sin ruta activa o eliminar.

### Compra controller

#### `PATCH /compras/:id/retirar` (eliminar)
- Ya no existe el estado `retirado`. Eliminar endpoint y ruta.

---

## Emails

| Evento | Destinatario | Asunto | Contenido clave |
|---|---|---|---|
| `pendiente → en_tienda` | Comprador | "Tu carta llegó a [tienda]" | Nombre, dirección, horario de tienda + alias/CBU del vendedor |
| `pendiente → listo_para_retirar` | Comprador | "Tu carta está lista para retirar" | Nombre, dirección, horario de tienda |

Sin emails al llegar a `finalizado`.

---

## Frontend

### Orden de compra — qué muestra cada actor

La tarjeta de orden de compra debe mostrar siempre:
- Número de orden, fecha, total
- Lista de ítems (nombre, cantidad, precio)
- Estado con badge de color
- Alias y CBU del vendedor/tienda vendedora
- Chat (en todos los flujos)
- ReviewModal cuando `estado === 'finalizado'` (ambos lados)

#### Badges de estado

| Estado | Color | Label comprador | Label vendedor/tienda |
|---|---|---|---|
| `pendiente` | Gris | Pendiente | Pendiente |
| `en_tienda` | Azul | Llegó al local 📦 | Llegó al local |
| `listo_para_retirar` | Naranja | Listo para retirar 🟠 | Listo para retirar |
| `finalizado` | Verde | Finalizado ✓ | Finalizado ✓ |

#### Botones de acción por flujo y vista

| Flujo | Vista | Estado | Botón |
|---|---|---|---|
| 1 | TiendaRetiroVentasPage | `pendiente` | "Confirmar llegada al local" |
| 1 | TiendaRetiroVentasPage | `en_tienda` | "Finalizar orden" |
| 2 | MiPerfilTiendaRetiroPage > Mis Ventas | `pendiente` | "Marcar listo para retirar" |
| 2 | MiPerfilTiendaRetiroPage > Mis Ventas | `listo_para_retirar` | "Finalizar orden" |
| 3 | MisVentasPage | `pendiente` | "Marcar como finalizado" |
| 4 | MisVentasPage | `pendiente` | "Marcar como finalizado" |

---

### Vistas por actor

#### Mis Compras — `/purchases` (User y Vendedor comprando)
- Lista de órdenes filtradas por `comprador.id === user.id`
- Alias/CBU del vendedor/tienda vendedora visible **siempre** (desde `pendiente`)
- Chat por orden (ya existe, mantener)
- ReviewModal al finalizar: puede valorar al vendedor y/o tienda de retiro

#### Mis Compras — tab en `/tienda-retiro/perfil` (TiendaRetiro comprando)
- Nueva pestaña "Mis Compras" en `MiPerfilTiendaRetiroPage`
- Lista de órdenes filtradas por `compradorTienda.id === tienda.id`
- Misma estructura que Purchases.tsx pero embebida en el perfil de tienda
- Chat por orden
- ReviewModal al finalizar: puede valorar al vendedor o tienda vendedora

#### Mis Ventas — `/mis-ventas` (Vendedor)
- Lista de ventas del vendedor
- Flujo 1 (con tiendaRetiro): muestra tienda asignada, sin botón de estado — solo info y chat
- Flujo 3/4 (sin tiendaRetiro asignada, o compradorTienda): botón "Marcar como finalizado"
- ReviewModal al finalizar: puede valorar al comprador (user, vendedor o tienda compradora)
- **Eliminar** botón "Entregar a tienda"

#### Mis Ventas — tab en `/tienda-retiro/perfil` (TiendaRetiro vendiendo directamente)
- Ya existe en `MiPerfilTiendaRetiroPage`
- Reemplazar "Finalizar Directo" por flujo 2: botón "Marcar listo para retirar" → luego "Finalizar"
- ReviewModal al finalizar: puede valorar al comprador

#### Ventas de Retiro — `/tienda-retiro/ventas` (TiendaRetiro como punto de retiro)
- Ya existe en `TiendaRetiroVentasPage`
- Flujo 1: mostrar botón "Confirmar llegada al local" (pendiente → en_tienda) y "Finalizar orden" (en_tienda → finalizado)
- Mostrar siempre: alias/CBU del vendedor, datos del comprador, ítems, total
- Chat por orden (agregar si no está)
- ReviewModal al finalizar: puede valorar al comprador

---

## Valoraciones

El `ReviewModal` se habilita cuando `estado === 'finalizado'` en cualquier vista. Targets por flujo:

| Flujo | Desde comprador | Desde vendedor/tienda |
|---|---|---|
| 1 | Vendedor + TiendaRetiro | Comprador |
| 2 | TiendaRetiro | Comprador |
| 3 | Vendedor o TiendaRetiro vendedora | Tienda compradora |
| 4 | Vendedor | Comprador |

El componente `ReviewModal` ya existe. Hay que asegurarse de que aparezca correctamente en **todas** las vistas listadas arriba.

---

## Resumen de cambios por archivo

### Backend
| Archivo | Cambio |
|---|---|
| `compra/compra.controler.ts` | Eliminar endpoint `retirar` |
| `compra/compra.routes.ts` | Eliminar ruta `PATCH /:id/retirar` |
| `vendedor/vendedor.controller.ts` | Eliminar `entregar-tienda`, agregar `finalizar` (flujos 3 y 4) |
| `vendedor/vendedores.routes.ts` | Actualizar rutas vendedor |
| `tiendaRetiro/tiendaRetiro.controller.ts` | Ajustar `en-tienda` y `finalizar`, agregar `listo` y `finalizar` para ventas directas |
| `tiendaRetiro/tiendaRetiro.routes.ts` | Actualizar rutas tienda |

### Frontend
| Archivo | Cambio |
|---|---|
| `pages/Purchases.tsx` | Actualizar badges, eliminar botón "Retirar", agregar ReviewModal en todos los flujos |
| `pages/MisVentasPage.tsx` | Eliminar "Entregar a tienda", agregar "Marcar como finalizado" (flujos 3 y 4), info tienda sin botón (flujo 1), ReviewModal |
| `pages/TiendaRetiroVentasPage.tsx` | Renombrar botones a "Confirmar llegada" y "Finalizar", agregar chat, ReviewModal |
| `pages/MiPerfilTiendaRetiroPage.tsx` | Tab "Mis Compras" nueva, ajustar Mis Ventas a flujo 2 (listo → finalizar), ReviewModal |
| `pages/Reservar.tsx` | Detectar `role === 'tiendaRetiro'` en el comprador: auto-asignar `tiendaRetiro = compradorTienda` (la tienda compradora misma), sin mostrar selector de tiendas de retiro |

### Base de datos
```sql
UPDATE compra SET estado = 'en_tienda'  WHERE estado = 'entregado_a_tienda';
UPDATE compra SET estado = 'finalizado' WHERE estado = 'retirado';
```
