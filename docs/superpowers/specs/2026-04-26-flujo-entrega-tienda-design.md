# Flujo de entrega a tienda — Spec

**Fecha:** 2026-04-26  
**Proyecto:** DSW 2025 — Marketplace de Cartas Pokémon

---

## Problema

Cuando un comprador elige retiro en tienda al hacer una reserva, el vendedor necesita poder notificar que dejó el pedido en la tienda, y el comprador necesita poder confirmar que lo retiró. Actualmente no existe este flujo; el estado se queda en `pendiente` indefinidamente.

---

## Estados de Compra (tienda retiro)

```
pendiente  →  entregado_a_tienda  →  retirado
              (acción: vendedor)      (acción: comprador)
```

La lógica de intermediario (`ENVIADO_A_INTERMEDIARIO`, `markSent`) se preserva sin cambios — es trabajo futuro.

---

## Backend

### Endpoint 1 — Vendedor entrega a tienda

```
PATCH /api/vendedores/:id/ventas/:compraId/entregar-tienda
```

- **Auth:** `authenticate` — verifica que al menos un `ItemCarta` de la compra pertenezca al vendedor `:id`
- **Precondición:** `compra.estado === 'pendiente'` → si no, `400 "La compra no está en estado pendiente"`
- **Acción:** `compra.estado = 'entregado_a_tienda'` + `em.flush()`
- **Email:** enviado al `compra.comprador.email` (fallback a `compra.email`) con asunto _"Tu pedido #X está listo para retirar"_ e incluye nombre, dirección y horario de `compra.tiendaRetiro`
- **Respuesta:** `200 { message, data: compra }`
- **Ubicación:** `vendedor.controller.ts` + `vendedor.routes.ts`

### Endpoint 2 — Comprador confirma retiro

```
PATCH /api/compras/:id/retirar
```

- **Auth:** `authenticate` — verifica `compra.comprador.id === req.actor.id`
- **Precondición:** `compra.estado === 'entregado_a_tienda'` → si no, `400 "El pedido aún no fue entregado a la tienda"`
- **Acción:** `compra.estado = 'retirado'` + `em.flush()`
- **Respuesta:** `200 { message, data: compra }`
- **Ubicación:** `compra.controler.ts` + `compra.routes.ts`

---

## Email al comprador

Disparado en el endpoint 1, sin bloquear la respuesta (fire-and-forget via `sendEmail`).

```
Asunto: Tu pedido #<id> está listo para retirar

Cuerpo HTML:
  ¡Buenas noticias, <nombre>!
  Tu pedido ya está disponible en:
    [nombre tienda]
    [dirección]
    [horario]
  Cuando vayas a retirarlo, marcalo como completado desde "Mis Compras" en la web.
```

---

## Frontend — MisVentasPage (vendedor)

### Botón de acción (reemplaza lógica de `markSent` para el caso tienda)

| Estado | Qué muestra el vendedor |
|--------|------------------------|
| `pendiente` + tiene `tiendaRetiro` | Botón naranja **"Entregar a tienda"** |
| `entregado_a_tienda` | Badge azul "Entregado a tienda ✓" (sin botón) |
| `retirado` | Badge verde "Retirado ✓" (sin botón) |

El botón llama a `PATCH /api/vendedores/:id/ventas/:compraId/entregar-tienda` y recarga la lista.  
El botón existente de intermediario ("Ya envié al intermediario") solo se muestra si `venta.envio` existe (sin cambios).

---

## Frontend — Purchases (comprador)

### Botón de acción

| Estado | Qué muestra el comprador |
|--------|--------------------------|
| `pendiente` + tiene `tiendaRetiro` | Bloque naranja con datos de tienda (sin botón) |
| `entregado_a_tienda` + tiene `tiendaRetiro` | Bloque naranja + botón verde **"Confirmar retiro"** |
| `retirado` | Badge verde "✓ Retirado" |

El botón llama a `PATCH /api/compras/:id/retirar` y recarga las compras.

---

## Qué NO cambia

- Entidad `Compra` — no requiere nuevas columnas
- Lógica de intermediario (`markSent`, `ENVIADO_A_INTERMEDIARIO`)
- Flujo de "coordinar via chat" (sin tiendaRetiro) — sin cambios por ahora
