# Wishlist (Favoritos) — Design Spec
**Date:** 2026-04-18

## Overview

Allow users (role: `user`) to save `CartaClass` entries to a wishlist, then view all vendor listings per card to compare prices. If CartaClass is deleted, the entry stays but shows "no disponible". No commits — dev only.

## Backend

### Entity: `Wishlist` (`backend/src/wishlist/wishlist.entity.ts`)
- `id` (PrimaryKey, from BaseEntity)
- `userId: number` — ID of the User
- `cartaClass: ManyToOne(CartaClass, { nullable: true })` — nullable so deleted CartaClass doesn't cascade-delete wishlist entries
- `createdAt` (from BaseEntity)
- Unique constraint: `(userId, cartaClass)` — no duplicate entries

### Endpoints (`backend/src/wishlist/wishlist.routes.ts`)

**GET /api/wishlist**
- Auth: `authenticate` (role: user only)
- Returns all wishlist entries for the authenticated user
- For each entry: CartaClass `{ id, name, description }` + all Cartas of that class with `{ id, name, price, rarity, setName, image, stock (sum of items), uploader: { id, nombre, rating, reviewsCount } }`
- If `cartaClass` is null: `{ disponible: false, cartaClassId: null }`

**POST /api/wishlist**
- Auth: `authenticate`
- Body: `{ cartaClassId: number }`
- Idempotent: if already exists, returns 200 with existing entry
- Returns 201 on create

**DELETE /api/wishlist/:cartaClassId**
- Auth: `authenticate`
- Removes the entry for (userId, cartaClassId)
- Returns 200 on success, 404 if not found

### Registration in `app.ts`
```
app.use("/api/wishlist", wishlistRouter);
```

## Frontend

### New page: `WishlistPage.tsx` (`vite-project/vite-project-ts/src/pages/WishlistPage.tsx`)
- Route: `/wishlist` (protected, user role only)
- Fetches `GET /api/wishlist` on mount
- Layout: full-page with orange/white theme consistent with existing pages
- Grid of "favorito cards", each showing:
  - Card image (first carta's image or placeholder)
  - CartaClass name
  - Availability badge: green "X publicaciones", yellow "Sin stock", gray "No disponible"
  - Heart button to remove from wishlist
  - Expandable section showing vendor comparison table:
    - Columns: Vendedor | Precio | Stock | Rareza | Rating | Botón "Ver publicación"
    - Sorted by price ascending
    - Empty state: "Ningún vendedor tiene esta carta publicada actualmente"

### Modified: `CardDetail.tsx`
- Add heart button near the price/add-to-cart area
- Only visible for `user.role === 'user'`
- On mount: check if `card.cartaClass?.id` is in wishlist (fetch GET /api/wishlist, check locally)
- Toggle: POST to add, DELETE to remove
- Visual: filled red heart if in wishlist, outline if not

### Modified: `Header.tsx`
- Add "Mis Favoritos ♥" option in user dropdown
- Visible only when `user.role === 'user'`
- Positioned between "Mi Perfil" and "Mis Compras"
- Navigates to `/wishlist`

### Modified: `App.tsx`
- Add route: `<Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />`

## Availability Logic

| Condition | Badge |
|---|---|
| `cartaClass === null` | "No disponible" (gray) |
| `cartas.length === 0` | "Sin publicaciones" (gray) |
| `all cartas have stock === 0` | "Sin stock" (yellow) |
| `some carta has stock > 0` | "X publicaciones activas" (green) |
