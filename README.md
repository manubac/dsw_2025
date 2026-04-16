# Propuesta TP DSW

## Integrantes

- **Manuel Bacolla** - 50214
- **Volentiera Nicolás** - 51824
- **Bruno Leo Santi** - 51950

---

## Tema

**Marketplace de Cartas de Pokémon**

---

## Descripción

Es un marketplace especializado en la compra y distribución de cartas de Pokémon, donde tiendas oficiales agrupan pedidos de varios vendedores para enviarlos a otra tienda oficial.  
La plataforma optimiza la distribución de cartas, permitiendo a los minoristas obtener mejores precios y reducir costos de envío.

## Modelo de Negocio

<img width="818" height="618" alt="ModeloDominioDSW drawio" src="https://github.com/user-attachments/assets/c13ba1ba-07a0-40d0-853b-0df19f87b6a1" />

---

## Setup e Instalación (guía completa)

### Requisitos previos

| Herramienta | Versión mínima | Notas |
|-------------|---------------|-------|
| Node.js | **18.x** | El repo tiene `.nvmrc` — con nvm: `nvm use` |
| pnpm | **8+** | `npm install -g pnpm` |
| PostgreSQL | **14+** | Debe estar corriendo en `localhost:5432` |
| Git | cualquiera | — |

> **Windows:** se recomienda instalar OpenCV4nodejs a través de WSL2 o saltearlo (el servidor arranca igual con `/api/identify` en modo degradado si OpenCV no está disponible).

---

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd dsw_2025

# Instala dependencias de todos los workspaces (backend + frontend)
pnpm install

# Instala dependencias del backend por separado (por si pnpm install raíz no las resuelve)
cd backend && pnpm install && cd ..
cd vite-project/vite-project-ts && pnpm install && cd ../..
```

---

### 2. Crear la base de datos PostgreSQL

Conectarse a PostgreSQL (con el usuario `postgres` u otro con permisos) y ejecutar:

```sql
CREATE DATABASE heroclash_dsw;
```

Con psql desde terminal:
```bash
psql -U postgres -c "CREATE DATABASE heroclash_dsw;"
```

---

### 3. Configurar variables de entorno

Crear el archivo `backend/.env` con el siguiente contenido (ajustar valores según el entorno):

```env
# Conexión PostgreSQL
DB_CONNECTION_STRING=postgresql://postgres:TU_PASSWORD@localhost:5432/heroclash_dsw

# JWT (cambiar por un string seguro)
JWT_SECRET=cambia_esto_por_algo_secreto

# Google Cloud Vision (ver sección más abajo)
GOOGLE_APPLICATION_CREDENTIALS=../google-key.json

# Email — solo necesario para la funcionalidad de contacto / reset de password
GMAIL_USER=tu_cuenta@gmail.com
GMAIL_APP_PASS=contraseña_de_aplicacion_gmail

# MercadoPago — solo necesario para el flujo de pago
MP_ACCESS_TOKEN=tu_token_mercadopago_sandbox
```

> `GMAIL_APP_PASS` no es tu contraseña de Gmail. Es una contraseña de aplicación generada en: Cuenta Google → Seguridad → Verificación en dos pasos → Contraseñas de aplicaciones.

---

### 4. Configurar Google Cloud Vision API

Esta API permite escanear cartas Pokémon desde foto (endpoint `/api/scan`).

#### Pasos:

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un proyecto nuevo (o usar uno existente)
3. Activar la API: **APIs y Servicios → Biblioteca → buscar "Cloud Vision API" → Habilitar**
4. Crear credenciales de cuenta de servicio:
   - **APIs y Servicios → Credenciales → Crear credenciales → Cuenta de servicio**
   - Nombre: cualquiera (ej. `dsw-vision`)
   - Rol: `Visor` (o sin rol, alcanza para Vision)
   - Confirmar y abrir la cuenta de servicio creada
5. Descargar la clave JSON:
   - Pestaña **Claves → Agregar clave → Crear clave nueva → JSON → Crear**
   - Se descarga un archivo `.json`
6. Mover ese archivo a la **raíz del repo** (`dsw_2025/`) y renombrarlo a `google-key.json`
7. Verificar que `.env` tenga:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=../google-key.json
   ```

> **Importante:** `google-key.json` está en `.gitignore`. Nunca lo subas al repositorio.

---

### 5. Inicializar el esquema de la base de datos

El ORM (MikroORM) crea automáticamente las tablas de la aplicación al arrancar el servidor en modo `development`. Pero las tablas del catálogo TCG (sets, cartas, traducciones, vista e índices) requieren correr los scripts en orden:

```bash
cd backend

# Paso A: Crear tablas del catálogo TCG + poblar cartas en inglés (~5-10 min)
node sync_db.mjs

# Paso B: Crear índices + vista v_cards_unified (necesaria para el scan)
node setup_indexes.mjs

# Paso C: Sincronizar traducciones en otros idiomas (es, pt, fr, de, it, ja, ko, zh...)
# ADVERTENCIA: tarda ~30-60 min por primera vez (rate-limit de TCGdex API)
pnpm sync-tcg
```

> `sync_db.mjs` y `pnpm sync-tcg` hacen llamadas a la API pública de TCGdex con un delay de 300ms entre requests. Se pueden interrumpir y reanudar.

---

### 6. Levantar el proyecto

Abrir **dos terminales** en paralelo:

```bash
# Terminal 1 — Backend (Express en http://localhost:3000)
cd backend
pnpm start:dev

# Terminal 2 — Frontend (Vite en http://localhost:5173)
cd vite-project/vite-project-ts
pnpm run dev
```

El frontend proxea `/api/*` hacia `http://localhost:3000` automáticamente (configurado en `vite.config.ts`).

---

### 7. Verificar que todo funciona

```bash
# Desde backend/, probar que la DB y la vista están ok
node search_card.js SVI 001
# Debería imprimir: "Nombre EN : Sprigatito"

# Probar identificación por foto (con Google Vision)
node identify_from_photo.js ruta/a/tu/carta.jpg --debug

# Probar identificación sin Vision (solo Tesseract.js)
node identify_from_photo.js ruta/a/tu/carta.jpg --no-vision
```

---

### Resumen de comandos frecuentes

```bash
# Arrancar
cd backend && pnpm start:dev
cd vite-project/vite-project-ts && pnpm run dev

# Actualizar esquema de entidades (MikroORM, safe — no borra datos)
cd backend && pnpm schema:update

# Regenerar embeddings visuales CLIP (necesario solo si se agregan muchas cartas nuevas)
cd backend && pnpm generate-embeddings

# Correr tests
cd backend && pnpm test
```

---

## Alcance Funcional

### Alcance Minimo

| Requerimiento     | Detalle                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| CRUD simple       | 1. CRUD Usuario <br> 2. CRUD Carta <br> 3. CRUD Vendedor <br>                                                |
| CRUD dependiente  | 1. CRUD Compra (depende de usuario y cartas)Reserva (depende de Usuario y Carta) <br>                        |
| Listado + detalle | 1. Listado de cartas filtrado por nombre, código, etc. <br> 2. Detalle de reservas realizadas de un usuario  |
| CUU/Epic          | 1. Publicación de carta por parte del vendedor <br> 2. Reserva y compra de una carta por parte de un usuario |

---

### Adicionales para Aprobación

| Requerimiento    | Detalle                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRUD simple      | 1. Dirección 2. CRUD Intermediario                                                                                                                          |
| CRUD dependiente | 1. CRUD Valoración 2. Envío (depende de compras e intermediario)                                                                                            |
| CUU / Epic       | 1. Valorar un vendedor después de la compra<br>2. Marcar que el vendedor envió los items al intermediario<br>3. Pago y envío <br>4.Enviar email de contacto |
