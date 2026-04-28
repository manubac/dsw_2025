# Diseño: Rediseño de /mi-perfil por rol

**Fecha:** 2026-04-28  
**Enfoque:** Enhancement incremental (A) — cada página se toca por separado sin extraer componentes compartidos.

---

## Contexto

El proyecto tiene tres páginas de perfil privado separadas por rol:
- `/mi-perfil` → `MiPerfilVendedorPage.tsx` (role: vendedor)
- `/mi-perfil-usuario` → `MiPerfilUsuarioPage.tsx` (role: user)
- `/tienda-retiro/perfil` → `MiPerfilTiendaRetiroPage.tsx` (role: tiendaRetiro)

Existe además `/profile` → `UserProfilePage.tsx` (legacy, todos los roles). Se mantiene como está.

---

## 1. Backend

### Campo nuevo: `descripcionCompra` en Vendedor

- Entidad: `backend/src/vendedor/vendedores.entity.ts`
- Tipo: `@Property({ type: 'text', nullable: true })` 
- Nombre: `descripcionCompra`
- Se agrega al sanitizer `sanitizeVendedorInput` en `vendedor.controller.ts`
- Se incluye en la respuesta de `GET /api/vendedores/:id` (ya incluido por defecto con MikroORM)
- Aplicar con `pnpm schema:update`

---

## 2. MiPerfilVendedorPage (`/mi-perfil`)

### 2.1 Editar perfil inline

- El botón "Editar perfil" deja de navegar a `/profile`
- Abre/cierra un panel colapsable debajo del header (mismo patrón que `MiPerfilTiendaRetiroPage`)
- Campos: nombre, teléfono, ciudad, alias, CBU, contraseña (campo nuevo respecto a tienda)
- Guarda con `PATCH /api/vendedores/:id`
- Feedback de éxito/error inline en el panel

### 2.2 Descripción de compra (sección nueva)

- Posición: entre el header y Mis Publicaciones
- Vista: tarjeta blanca con título "Descripción de compra", muestra el texto en un `<p>`. Si `descripcionCompra` es null/vacío muestra placeholder gris "Todavía no agregaste información de retiro para tus compradores."
- Edición: botón "Editar" convierte el texto en `<textarea>` con botón "Guardar" y "Cancelar"
- Guarda con `PATCH /api/vendedores/:id` enviando solo `{ descripcionCompra }`
- Estado local: `editingDesc: boolean`, `descDraft: string`

### 2.3 Mis Publicaciones — filtros y scroll propio

**Controles (encima de la grilla):**
- Input de búsqueda por nombre (filtrado en cliente, debounce no necesario por volumen bajo)
- Chips de estado: "Todas | Disponible | Pausada" (filtro sobre campo `estado` de la publicación)
- Inputs min/max precio
- Select de rareza (opciones únicas de `pub.rarity` entre las publicaciones del vendedor)
- Select de set (opciones únicas de `pub.setName`)
- Botón "Limpiar filtros"

**Grilla:**
- `max-h-[600px] overflow-y-auto` con scroll interno — no hace scroll toda la página
- Muestra publicaciones filtradas, misma card visual que hoy
- Si no hay resultados con los filtros activos: mensaje "No hay publicaciones que coincidan"

**Carga de datos:**
- Sigue igual: `fetchApi('/api/cartas')` filtrado client-side por `uploader.id === user.id`
- Los selects de rareza y set se populan con `[...new Set(publicaciones.map(p => p.rarity))]` etc.

### 2.4 Sin cambios

- Tiendas de retiro: igual
- Valoraciones recibidas: igual

---

## 3. MiPerfilUsuarioPage (`/mi-perfil-usuario`)

### 3.1 SellerOnboarding

- Importar `SellerOnboarding` desde `../components/SellerOnboarding`
- Renderizar al final de la página, antes de la zona de eliminar cuenta
- El componente ya maneja su propio estado y flujo completo (EMAIL_GATE → PHONE_INPUT → OTP_INPUT → SUCCESS)
- No se modifica el componente — funciona exactamente igual que en `/profile`
- El componente en `/profile` se deja como está (duplicado intencional)

---

## 4. MiPerfilTiendaRetiroPage (`/tienda-retiro/perfil`)

Reestructuración para que quede con la misma organización de secciones que el perfil vendedor.

### 4.1 Header + Editar inline

Sin cambios. Ya tiene el panel de edición inline con todos los campos de la tienda (nombre, email, dirección, horario, ciudad, activo).

### 4.2 Sección "Mi tienda de retiro" (reemplaza el multi-select del vendedor)

- Muestra una sola card con los datos de la propia tienda: nombre, dirección, ciudad
- Campo `horario` editable inline: input de texto con botón "Guardar horario"
- Guarda con `PATCH /api/tiendas/:id` enviando solo `{ horario }`
- Sin checkbox, sin selección de otras tiendas
- Estado local: `editingHorario: boolean`, `horarioDraft: string`

> Nota: el horario también es editable desde el panel "Editar perfil" del header. Ambos caminos coexisten — el del header edita todos los datos, el de esta sección es un acceso rápido solo al horario.

### 4.3 Mis Publicaciones (placeholder)

- Sección con tarjeta blanca, título "Mis Publicaciones"
- Placeholder visual: ícono 🃏 + texto "Próximamente: publicaciones de la tienda."
- Sin lógica de carga

### 4.4 Stats expandibles

- Quitar el botón "Mostrar más/menos" hasta que haya datos reales para mostrar (o dejar el botón pero vaciar el panel expandido con un mensaje "Sin estadísticas disponibles aún")

### 4.5 Valoraciones recibidas (placeholder)

- Sección con tarjeta blanca, título "Valoraciones recibidas"
- Placeholder: ícono ⭐ + texto "Próximamente: valoraciones de compradores."
- Sin lógica de carga (el endpoint de valoraciones no cubre tiendas actualmente)

### 4.6 Mis Ventas (placeholder)

- Igual que hoy: placeholder con ícono 🏪 + texto existente

---

## 5. VendedorProfile (vista pública `/vendedor/:id`)

- Agregar sección "Descripción de compra" visible para compradores
- Posición: entre el header del vendedor y la sección de publicaciones
- Solo se muestra si `descripcionCompra` no es null/vacío
- Vista de solo lectura: ícono 📋 + título + texto del campo

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `backend/src/vendedor/vendedores.entity.ts` | Agregar campo `descripcionCompra` |
| `backend/src/vendedor/vendedor.controller.ts` | Agregar `descripcionCompra` al sanitizer |
| `src/pages/MiPerfilVendedorPage.tsx` | Editar inline, sección descripción, filtros/scroll publicaciones |
| `src/pages/MiPerfilUsuarioPage.tsx` | Agregar `SellerOnboarding` |
| `src/pages/MiPerfilTiendaRetiroPage.tsx` | Reestructurar con secciones nuevas |
| `src/pages/VendedorProfile.tsx` | Mostrar `descripcionCompra` en vista pública |

**No se toca:** `UserProfilePage.tsx`, `App.tsx`, `user.tsx` context, `SellerOnboarding.tsx`
