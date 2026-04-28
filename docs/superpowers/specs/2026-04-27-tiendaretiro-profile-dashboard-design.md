# Design: MiPerfilTiendaRetiroPage

**Date:** 2026-04-27  
**Status:** Approved

## Overview

Replace the `/tienda-retiro/perfil` placeholder with a full dashboard for the `tiendaRetiro` role, matching the amber/orange visual language of MiPerfilVendedorPage. No Header changes needed — it already routes tiendaRetiro to `/tienda-retiro/perfil`.

## Routes & Navigation

- **Modify route:** `/tienda-retiro/perfil` → `MiPerfilTiendaRetiroPage` (was a placeholder div)
- No changes to Header.tsx or App.tsx routing guards

## Page Layout

### 1. Profile Header Card
- Amber gradient banner (top strip)
- Avatar: orange gradient circle with store name initial
- Nombre, badge "Tienda de Retiro", ciudad
- Dirección + horario as subtitle
- Status badge: "Activa" (green) / "Inactiva" (gray) based on `activo`
- Member-since year from `createdAt`
- "✏ Editar perfil" toggles inline edit panel

**Inline Edit Panel:**
- Fields: `nombre`, `email`, `direccion`, `horario`, `ciudad`
- Toggle checkbox for `activo`
- Save / Cancel buttons
- Calls `PATCH /api/tiendas/:id`

### 2. Stats (expandable, same pattern as MiPerfilVendedorPage)
- Total pedidos | Por llegar (`entregado_a_tienda`) | En tienda (`en_tienda`) | Finalizados

### 3. Mis Ventas (embedded)
- Fetches from `GET /api/tiendas/:id/ventas`
- Same card layout as TiendaRetiroVentasPage but restyled with amber/orange theme
- Action buttons: "Confirmar recepción" (entregado_a_tienda) / "Finalizar orden" (en_tienda)
- Empty state with icon if no ventas

## Data
- Tienda data from `GET /api/tiendas/:id`
- Ventas from `GET /api/tiendas/:id/ventas`
- Edit: `PATCH /api/tiendas/:id` with `{ nombre, email, direccion, horario, ciudad, activo }`

## Files to Create/Modify
- **Create:** `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`
- **Modify:** `vite-project/vite-project-ts/src/App.tsx` (replace placeholder with component)
