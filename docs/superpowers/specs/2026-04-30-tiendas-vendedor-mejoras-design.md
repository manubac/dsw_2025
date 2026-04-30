# Spec: Tiendas y Vendedor — Mejoras de registro, perfiles y página pública

**Fecha:** 2026-04-30  
**Estado:** Aprobado

---

## Resumen

Cuatro mejoras relacionadas al registro de tiendas, el upgrade a vendedor y los perfiles públicos:

1. Horarios estructurados y obligatorios al registrar una tienda
2. CBU y alias obligatorios al convertirse en vendedor (paso inmediato post-OTP)
3. Nueva página pública de tienda `/tienda/:id` con mapa, publicaciones y valoraciones
4. Scrolling propio y filtros en la página pública del vendedor `/vendedor/:id`

---

## Feature 1: Horarios obligatorios en tiendas (JSON estructurado)

### Modelo de datos

`TiendaRetiro.horario` cambia de `string | null` a `jsonb NOT NULL` con la siguiente forma:

```ts
type HorarioSemanal = {
  [dia in 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo']: {
    abre: string;    // "09:00"
    cierra: string;  // "18:00"
    cerrado: boolean;
  };
};
```

Ejemplo:
```json
{
  "lunes":    { "abre": "09:00", "cierra": "18:00", "cerrado": false },
  "martes":   { "abre": "09:00", "cierra": "18:00", "cerrado": false },
  "miercoles":{ "abre": "09:00", "cierra": "18:00", "cerrado": false },
  "jueves":   { "abre": "09:00", "cierra": "18:00", "cerrado": false },
  "viernes":  { "abre": "09:00", "cierra": "18:00", "cerrado": false },
  "sabado":   { "abre": "10:00", "cierra": "14:00", "cerrado": false },
  "domingo":  { "abre": "00:00", "cierra": "00:00", "cerrado": true  }
}
```

### Backend

- **`tiendaRetiro/tiendaRetiro.entity.ts`:** cambiar `@Property({ type: 'string', nullable: true }) horario?: string` a `@Property({ type: 'json', nullable: false }) horario!: HorarioSemanal`
- **`storeRegister/storeRegister.controller.ts`:** `sanitizeCompleteInput` incluye `horario`; validación: campo requerido, debe tener los 7 días con la estructura correcta
- **`tiendaRetiro/tiendaRetiro.controller.ts`:** el PATCH de perfil acepta `horario` en `sanitizeTiendaInput` y lo persiste
- **Migración:** correr `pnpm schema:update`. Las filas existentes con `horario = null` requieren un script de seed previo que asigne un horario default antes de aplicar el NOT NULL constraint

### Frontend

- **`StoreRegistrationPage.tsx`:** agregar grilla de 7 días en el formulario de registro. Cada fila: nombre del día, checkbox "Cerrado", inputs `type="time"` para abre y cierra (deshabilitados si "Cerrado" está chequeado)
- **`MiPerfilTiendaRetiroPage.tsx`:** reemplazar el input de texto libre de horario por la misma grilla editable con guardado inline

---

## Feature 2: CBU y alias obligatorios al convertirse en vendedor

### Flujo completo (3 pasos)

1. **Paso 1 (sin cambios):** el usuario ingresa su teléfono → `POST /api/seller/request-otp` → recibe OTP por WhatsApp
2. **Paso 2 (sin cambios):** ingresa el código OTP → `POST /api/seller/verify-otp` → Vendedor creado, se recibe JWT
3. **Paso 3 (nuevo):** inmediatamente después del paso 2, sin navegar, aparece un segundo formulario en el mismo modal/sección con campos CBU y alias → `PATCH /api/vendedores/:id` con esos datos → solo al éxito se cierra el flujo

### Validaciones

- **CBU:** exactamente 22 dígitos numéricos
- **Alias:** entre 6 y 20 caracteres, solo letras, números y puntos (`.`) — formato estándar Coelsa/Banelco

### Backend

- `verifyOtp` no cambia
- `PATCH /api/vendedores/:id` ya existe; asegurarse de que `sanitizeVendedorInput` incluya `cbu` y `alias`, y que el controlador retorne 400 si vienen vacíos en ese contexto de completar perfil
- No se requiere endpoint nuevo

### Frontend

- **`src/components/SellerOnboarding.tsx`** es el componente que contiene el flujo; agregar un estado de paso: `'phone' | 'otp' | 'payment'`
- En el estado `'payment'`: formulario con campos CBU (maxLength 22, solo números) y alias, botón "Guardar y continuar"
- Al éxito: cerrar flujo / redirigir a mi perfil de vendedor

---

## Feature 3: Página pública de tienda `/tienda/:id`

### Backend

- **`tiendaRetiro/tiendaRetiro.routes.ts`:** el `GET /:id/publicaciones` está protegido con `authenticate + authorizeRoles("tiendaRetiro") + authorizeSelf`. Extraer esa ruta a una versión pública sin middleware de auth (solo `GET /:id/publicaciones` sin guards). El controlador `getPublicaciones` ya no usa `req.actor`, por lo que el cambio es solo en el archivo de rutas.
- **`GET /api/tiendas/:id`** no necesita cambios para publicaciones; la página pública las obtiene del nuevo endpoint público mencionado arriba.
- **`GET /api/valoraciones/tiendaRetiro/:id`** y **`GET /api/valoraciones/tiendaRetiro/:id/average`** — las rutas de valoraciones ya son públicas y genéricas (`/:tipoObjeto/:objetoId`). El string `'tiendaRetiro'` funciona como `tipoObjeto` sin cambios en backend.

### Frontend — `TiendaProfile.tsx` en `/tienda/:id`

Estructura de la página (estilo visual verde, consistente con `VendedorProfile`):

1. **Header:** nombre de la tienda, badge "Tienda Verificada", estrellas + promedio + cantidad de valoraciones
2. **Info de la tienda:** ciudad, teléfono, descripción de retiro, tabla de horarios (7 días: día | abre | cierra, o "Cerrado")
3. **Google Maps embed:** `<iframe>` con `https://maps.google.com/maps?q=<direccion_url_encoded>&output=embed`, ancho completo, altura fija (~300px)
4. **Publicaciones (con scroll propio):**
   - Filtros: buscar por nombre, estado (todos/disponible/pausado), precio mín/máx, rareza, set — aplicados localmente
   - Grilla de cartas en contenedor `max-h-[600px] overflow-y-auto`
5. **Valoraciones:** lista de reseñas idéntica a `VendedorProfile`

### Rutas

- **`App.tsx`:** agregar `<Route path="/tienda/:id" element={<TiendaProfile />} />` como ruta pública (sin `ProtectedRoute`)

---

## Feature 4: Scrolling propio y filtros en página pública del vendedor

### Frontend — `VendedorProfile.tsx`

Sin cambios en backend ni rutas.

- **Filtros locales** (mismos que `MiPerfilVendedorPage`):
  - Búsqueda por nombre (input texto)
  - Estado: todos / disponible / pausado (select)
  - Precio mínimo y máximo (inputs numéricos)
  - Rareza (input texto)
  - Set (input texto)
  - Los filtros se aplican sobre `vendedor.itemCartas` en el render, sin llamadas adicionales al backend

- **Scroll propio:** el contenedor de la grilla de publicaciones pasa a `max-h-[600px] overflow-y-auto` con padding interno

---

## Orden de implementación recomendado

1. Feature 1 — Horarios (cambio de entidad y migración primero para no bloquear el resto)
2. Feature 2 — CBU/alias (solo frontend + validación leve en backend)
3. Feature 3 — Página pública de tienda (más extensa, depende del backend de Feature 1 para mostrar horarios)
4. Feature 4 — Scrolling y filtros en VendedorProfile (puramente frontend, independiente)

---

## Archivos principales afectados

| Archivo | Feature |
|---|---|
| `backend/src/tiendaRetiro/tiendaRetiro.entity.ts` | 1 |
| `backend/src/tiendaRetiro/tiendaRetiro.entity.ts` | 1 |
| `backend/src/storeRegister/storeRegister.controller.ts` | 1 |
| `backend/src/tiendaRetiro/tiendaRetiro.controller.ts` | 1, 3 |
| `backend/src/tiendaRetiro/tiendaRetiro.routes.ts` | 3 |
| `backend/src/vendedor/vendedor.controller.ts` | 2 |
| `vite-project/.../pages/StoreRegistrationPage.tsx` | 1 |
| `vite-project/.../pages/MiPerfilTiendaRetiroPage.tsx` | 1 |
| `vite-project/.../pages/VendedorProfile.tsx` | 4 |
| `vite-project/.../pages/TiendaProfile.tsx` | 3 (nuevo) |
| `vite-project/.../App.tsx` | 3 |
| `vite-project/.../components/SellerOnboarding.tsx` | 2 |
