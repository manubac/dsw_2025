# Design: MiPerfilUsuarioPage

**Date:** 2026-04-27  
**Status:** Approved

## Overview

Create a dashboard-style profile page for regular users (role: 'user'), matching the visual language of `MiPerfilVendedorPage`. Replace the old CSS-based `/profile` form for users.

## Routes & Navigation

- New route: `/mi-perfil-usuario` → `MiPerfilUsuarioPage` (protected, user-only)
- `Header.tsx` `handleProfileClick`: navigate to `/mi-perfil-usuario` for roles `'user'`/`'usuario'`
- `App.tsx`: add `UserRoute` guard and the new route
- `/profile` remains as-is for intermediarios and as fallback

## Page Layout

### 1. Profile Header Card
- Amber gradient banner (top strip)
- Avatar: orange gradient circle with username initial
- Username, "Comprador" badge, member-since year
- "✏ Editar perfil" button toggles an inline edit panel

**Inline Edit Panel (toggled):**
- Fields: `username`, `email`, `password` (same pattern as old UserProfilePage)
- Save / Cancel buttons
- Separator + Danger zone: "Eliminar cuenta" in red (same logic as current handleDeleteAccount)
- Calls `PUT /api/users/:id` on save

### 2. Quick-Access Cards (2 side-by-side)
- ♥ Mis Favoritos → `/wishlist`
- 🛍 Mis Compras → `/purchases`

### 3. Mis Valoraciones
- Endpoint: `GET /api/valoraciones/mias` (returns reviews the user authored)
- Show 3 initially, "Ver todas" toggle
- Each card: stars, comment, date

## Data
- User fields from context: `user.name`, `user.email`, `user.id`, `user.role`
- `createdAt` fetched from `GET /api/users/:id`
- Edit: `PUT /api/users/:id` with `{ username, email, [password] }`
- Delete: `DELETE /api/users/:id`

## Files to Create/Modify
- **Create:** `vite-project/vite-project-ts/src/pages/MiPerfilUsuarioPage.tsx`
- **Modify:** `vite-project/vite-project-ts/src/App.tsx` (add route)
- **Modify:** `vite-project/vite-project-ts/src/components/Header.tsx` (update handleProfileClick)
