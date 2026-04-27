# Spec: TiendaRetiro Auth + Ventas Dashboard

**Date:** 2026-04-26  
**Status:** Approved

---

## Overview

Add authentication to the `TiendaRetiro` entity so pickup stores can log in via the existing login page and access a Ventas dashboard showing all purchases routed through their store. Account creation is admin-only (via Postman/curl to an unprotected POST endpoint — only the team knows the backend URL). Self-registration is intentionally excluded.

---

## Backend

### 1. Entity changes — `tiendaRetiro.entity.ts`

Add fields to the existing entity:

| Field | Type | Constraints |
|---|---|---|
| `email` | string | unique, required |
| `password` | string | hidden, required |
| `ciudad` | string | nullable |

Existing fields (`nombre`, `direccion`, `horario`, `activo`, timestamps) remain unchanged.

### 2. Routes — `/api/tiendas-retiro`

New module following the same pattern as `intermediario`:

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/` | None | Create store account (admin use via Postman) |
| `POST` | `/login` | None | Login — returns JWT with `role: 'tiendaRetiro'` |
| `GET` | `/` | None | List active stores (used by Reservar page) |
| `GET` | `/:id` | None | Get one store (public) |
| `PATCH` | `/:id` | tiendaRetiro + self | Update own profile |
| `GET` | `/:id/ventas` | tiendaRetiro + self | All compras where `tiendaRetiro.id === :id` |

### 3. Auth middleware

Update `authorizeRoles` calls and the `authenticate` middleware to recognize `'tiendaRetiro'` as a valid role. The JWT payload follows the same shape: `{ id, role: 'tiendaRetiro' }`.

Password hashing uses bcryptjs, same as `vendedor` and `intermediario`.

### 4. Ventas endpoint — `GET /:id/ventas`

Query: all `Compra` where `tiendaRetiro.id === :id`, ordered by `createdAt DESC`.

Populate:
- `comprador` (User) → `nombre`, `email`
- `itemCartas` → `carta` → `name`, `cardNumber`, `price`, `vendedor` → `nombre`, `alias`, `cbu`
- `tiendaRetiro` (for self-reference / confirmation)

Response shape per compra:
```json
{
  "id": "...",
  "estado": "entregado_a_tienda",
  "total": 1500,
  "createdAt": "...",
  "comprador": { "nombre": "...", "email": "..." },
  "vendedores": [
    { "nombre": "...", "alias": "...", "cbu": "..." }
  ],
  "items": [
    { "cartaNombre": "...", "cantidad": 1, "precio": 1500 }
  ]
}
```

### 5. Sanitize middleware

`sanitizeTiendaRetiroInput` whitelist: `nombre`, `email`, `password`, `direccion`, `horario`, `ciudad`, `activo`.

---

## Frontend

### 1. Login page

The existing `LoginPage` already detects `role` from the JWT response and stores the full user object in `localStorage` under key `'user'`. No changes needed to the login form itself — just ensure `tiendaRetiro` role is handled in the post-login redirect logic (redirect to `/tienda-retiro/ventas`).

### 2. Navbar / profile dropdown

When `user.role === 'tiendaRetiro'`, the top-right dropdown shows:
- **Mi perfil** → `/tienda-retiro/perfil` (placeholder route, UI coded later)
- **Ventas** → `/tienda-retiro/ventas`
- **Cerrar sesión**

The existing dropdown for other roles is unchanged.

### 3. Route guard — `TiendaRetiroRoute`

New component analogous to `VendedorRoute` and `IntermediarioRoute`:
```tsx
// Redirects to / if role !== 'tiendaRetiro'
<TiendaRetiroRoute> ... </TiendaRetiroRoute>
```

### 4. New routes in `App.tsx`

| Path | Component | Guard |
|---|---|---|
| `/tienda-retiro/ventas` | `TiendaRetiroVentasPage` | `TiendaRetiroRoute` |
| `/tienda-retiro/perfil` | Placeholder div | `TiendaRetiroRoute` |

### 5. Access restrictions for `tiendaRetiro` role

The following actions are hidden/disabled when the logged-in role is `tiendaRetiro`:

| Feature | Behavior |
|---|---|
| Botón "Reservar" / "Comprar" | Hidden |
| Route `/reservar` | Redirects to `/` |
| Route `/publicar` | Redirects to `/` |
| Route `/checkout` | Already redirects to `/` |
| Route `/purchases` | Redirects to `/` |
| Route `/mis-ventas` | Redirects to `/` |

Can still access: `/cards`, `/card/:id`, `/bundle/:id`, `/vendedor/:id`, `/contact`.

### 6. TiendaRetiroVentasPage

Located at `src/pages/TiendaRetiroVentasPage.tsx`.

Fetches: `GET /api/tiendas-retiro/{user.id}/ventas`

Displays a list of purchase cards, each showing:
- **Estado** badge (color-coded: `pendiente`, `entregado_a_tienda`, `retirado`)
- **Fecha** (`createdAt`)
- **Comprador**: nombre + email
- **Vendedor(es)**: nombre + alias (for buyer payment reference)
- **Artículos**: carta nombre, cantidad, precio unitario
- **Total**

No actions/buttons needed for the store — this is a read-only view.

### 7. Fix Reservar page

`Reservar.tsx` currently loads tiendas from the DB. After this change, the `GET /api/tiendas-retiro` endpoint returns only stores with `activo: true`. The pre-loaded manual entries in the DB should be deleted — going forward, only stores created via the new `POST /api/tiendas-retiro` endpoint appear in the picker.

No frontend change needed for this; the fix is on the data side (delete old rows, create new ones with auth fields).

---

## Data Migration

Existing `tiendaRetiro` rows in the DB (created manually without email/password) must be removed. New stores are created via `POST /api/tiendas-retiro` with all required fields. This is a one-time cleanup done by the team.

---

## Out of Scope

- Admin UI for managing stores
- Self-registration for stores
- TiendaRetiro profile edit UI (placeholder route only, coded in a future task)
- Password reset flow for tiendaRetiro
