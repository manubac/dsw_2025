# CLAUDE.md — DSW 2025: Marketplace de Cartas Pokémon

## Project Overview
Peer-to-peer marketplace for buying and selling TCG cards
Team: Manuel Bacolla (50214), Nicolás Volentiera (51824), Bruno Leo Santi (51950).

## Architecture
- **Backend:** `backend/` — Express 5 + TypeScript + MikroORM 6 + **PostgreSQL** (port 5432)
- **Frontend:** `vite-project/vite-project-ts/` — React 19 + TypeScript + Vite 7
- **Package manager:** pnpm (workspaces)
- Frontend proxies `/api` → `http://localhost:3000` via Vite config
- **Styling:** Tailwind CSS (postcss.config.js + tailwind.config.js en el frontend)
- **HTTP client:** axios via `src/services/api.ts` — usar `api` (axios) o `fetchApi` (fetch), ambos adjuntan JWT automáticamente

## Base de Datos (PostgreSQL)

### Conexión
```
DB_CONNECTION_STRING=postgresql://postgres:post1234@localhost:5432/heroclash_dsw
```
El ORM usa `clientUrl` con esta URL; `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD` son obsoletos.

### Tablas gestionadas por MikroORM (entidades TypeScript)
`carta`, `carta_class`, `item_carta`, `compra`, `vendedor`, `user`, `direccion`, `intermediario`, `envio`, `valoracion`, `stage_pokemon`

### Tablas del catálogo TCG (gestionadas por scripts)
- **`pokemon_sets`** — 625 sets de TCGdex (id, abbr, name_en)
- **`card_translations`** — nombres de cartas en idiomas no-EN (card_id, set_id, lang_code, local_name)

### Vista clave
```sql
v_cards_unified  →  (set_abbr, set_name, card_number, lang_code, card_name)
```
Usada por `/api/scan` y `identify_from_photo.js` para búsqueda inversa (Nombre + Número → Colección/Idioma).

### Función SQL
```sql
get_card_name_en_safe(abbr TEXT, numero TEXT) RETURNS TEXT
```
Devuelve el nombre EN de la carta dado un código de set y número. Usada por `search_card.js` y `/api/scan`.

## Motor de Identificación de Cartas

El sistema tiene **dos rutas de OCR independientes**:

### `/api/scan` — Google Cloud Vision (texto completo)
- **Motor:** `@google-cloud/vision` (documentTextDetection)
- **Credenciales:** `GOOGLE_APPLICATION_CREDENTIALS=../google-key.json`
- **Flujo:** imagen base64 → Vision API → parse de texto → `extractSetInfo` + `extractNombre` → lookup en `v_cards_unified`
- **Lookup en cascada:** (1) sigla del pie tal cual, (2) variantes OCR, (3) reverse lookup por nombre+número
- **Uso:** Frontend `CardScanner.tsx` (carga de foto de carta)

### `/api/identify` — Tesseract.js + CLIP Embeddings (carga lazy)
- **Motor OCR:** Tesseract.js 5 (`eng.traineddata`)
- **Preprocessing:** Sharp (escala, CLAHE, binarización) + OpenCV4nodejs (detección de ancla)
- **Flujo:** multipart image → `cropService` (recorte 600×840 px) → `ocrService` (ROI_NAME, ROI_COLLECTION, ROI_NUMBER) → `lookupService` (MikroORM + `translationService`) → fallback `embeddingService` (CLIP cosine similarity)
- **Fallback visual:** `@xenova/transformers` (clip-vit-base-patch32) contra `src/identify/data/embeddings.json` (~95 MB, generado con `pnpm generate-embeddings`)
- **Carga:** dinámica en `app.ts` — si OpenCV no está disponible, devuelve 503 sin tirar el servidor

### Lógica de búsqueda inversa (Nombre + Número → Colección/Idioma)
1. **Exact match:** `cardNumber + setCode` via MikroORM
2. **Traducción local:** `translationService` busca en `card_translations` para resolver nombre local → número EN
3. **Fuzzy match:** `$like` sobre `Carta.name` con scoring por palabras en común + bonus de setCode
4. **Fallback visual:** CLIP cosine similarity > 0.75 contra `embeddings.json`

## Backend Modules
- `carta/` — entidad Carta + CartaClass + ItemCarta (publicaciones del vendedor)
- `user/` — CRU de compradores
- `vendedor/` — CRUD de vendedores
- `intermediario/` — actor logístico con dirección propia, panel `IntermediarioDashboard`
- `compra/` — flujo de compra (pendiente → pagado → entregado)
- `envio/` — gestión de envíos con `EstadoEnvio` enum (9 estados: planificado → entregado/cancelado)
- `direccion/` — CRUD de direcciones de entrega del comprador
- `valoracion/` — reseñas post-compra
- `contact/` — envío de mensajes vía email (nodemailer)
- `scan/` — OCR con Google Cloud Vision (`/api/scan`)
- `identify/` — identificación por Tesseract + CLIP (`/api/identify`, carga lazy)

## Dev Commands

```bash
# Backend (Express en :3000)
cd backend
pnpm start:dev           # tsc-watch → compila y reinicia en dist/server.js

# Frontend (Vite en :5173, proxy /api → :3000)
cd vite-project/vite-project-ts
pnpm run dev

# Scripts de DB y catálogo
cd backend
pnpm sync-tcg            # Sincroniza traducciones desde TCGdex API (card_translations)
pnpm generate-embeddings # Genera embeddings CLIP para búsqueda visual
pnpm seed-stages         # Seed de etapas Pokémon en DB
pnpm seed-en-names       # Seed de nombres EN desde TCGdex
pnpm update-card-numbers # Actualiza números de cartas en DB
pnpm schema:update       # Actualiza esquema MikroORM (safe, no borra datos)
pnpm schema:refresh      # Refresh completo del esquema
pnpm migration:generate  # Genera nueva migración MikroORM
pnpm test                # Jest

# Scripts CLI
node search_card.js <SIGLA> <NUMERO>        # Busca carta por sigla+número en DB
node identify_from_photo.js <imagen>        # OCR+identificación desde CLI (Vision o Tesseract)
node identify_from_photo.js <img> --debug   # Muestra texto OCR completo
node sync_db.mjs                            # Reconstruye tablas TCG desde cero
node sync_db.mjs --dry-run                  # Simula sin escribir
node setup_indexes.mjs                      # Crea índices PostgreSQL
```

## Variables de Entorno (backend/.env)

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `DB_CONNECTION_STRING` | Sí | URL PostgreSQL completa |
| `JWT_SECRET` | Sí | Secreto para firmar JWT (default inseguro: `'default_secret'`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Sí | Ruta a `google-key.json` para Cloud Vision |
| `GMAIL_USER` | Para email | Cuenta Gmail (nodemailer) |
| `GMAIL_APP_PASS` | Para email | Contraseña de aplicación Google |
| `MP_ACCESS_TOKEN` | Para pagos | Token MercadoPago (sandbox en dev) |
| `NODE_ENV` | No | `development` / `production` |

## Code Conventions
- Feature-based folders: cada módulo tiene `.entity.ts`, `.routes.ts`, `.controler.ts`
  - **NOTA:** el typo "controler" (un solo `l`) es intencional — no "corrijas" esto
- Spanish names for domain entities (Carta, Vendedor, Compra); English for infrastructure
- All MikroORM DB access via `em.find()`, `em.findOne()`, `em.create()`, etc.
- Los dos pools `pg` directos (`translationService` y `scan.routes`) se conectan a la misma `DB_CONNECTION_STRING`

## Security & Sanitization Standard
Every mutating route (POST/PUT/PATCH) **must** use a `sanitizeXxxInput` middleware that:
1. Whitelists only expected fields into `req.body.sanitizedInput`
2. Deletes `undefined` keys before calling `next()`
3. Controllers read exclusively from `req.body.sanitizedInput`, never from `req.body` directly

```typescript
function sanitizeCartaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    price: req.body.price,
    // ...only expected fields
  };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}
```

- **SQL injection:** Prevented by ORM — always use `em.find()`, `em.findOne()`, `em.create()`, etc.
- **Ownership check:** Verify `entity.uploader.id === requesterId` before destructive operations
- **Passwords:** Currently stored/compared as plain text — do NOT add bcrypt without team agreement (known tech debt)
- **Auth:** JWT implementado. `authenticate` verifica el token; `authorizeRoles('vendedor'|'user'|'intermediario')` restringe por rol; `authorizeSelf` verifica que el actor sea el mismo que el `:id` de la URL. Usar en ese orden.
  - Login devuelve `{ token, role, ...userData }` — frontend persiste en `localStorage` bajo clave `'user'`
  - `JWT_SECRET` se lee de `process.env.JWT_SECRET` (default inseguro `'default_secret'` en dev)
- **CORS:** Permissive `cors()` with no origin restriction — intentional for dev environment

## Integraciones externas
- **MercadoPago:** `backend/src/shared/mercadopago.ts` — usa `MP_ACCESS_TOKEN` env var; usar `sandbox_init_point` en modo test
- **Mailer:** `backend/src/shared/mailer.ts` — nodemailer + Gmail, requiere `GMAIL_USER` y `GMAIL_APP_PASS`; falla silenciosamente (no bloquea el flujo principal)
- **Google Cloud Vision:** `@google-cloud/vision` — requiere `GOOGLE_APPLICATION_CREDENTIALS` apuntando a `google-key.json` en la raíz del repo
- **TCGdex API:** `https://api.tcgdex.net/v2/{lang}/sets/{setId}` — usado por scripts de sincronización con delay de 300-350ms entre llamadas

## Búsqueda de Cartas (vista /publicar)

Las llamadas a APIs TCG se hacen **desde el frontend directamente** — no pasan por Express.

### Servicio TCG (`src/services/tcg/`)

```
index.ts       ← searchCards(), getCardRarities(), resolveCard()
types.ts       ← GameSlug, ExternalCard, RarityVariant, SearchOptions
pokemon.ts     ← Pokémon TCG — TCGDex API (api.tcgdex.net/v2)
scryfall.ts    ← Magic: The Gathering (api.scryfall.com) — filtra idiomas asiáticos
ygoprodeck.ts  ← Yu-Gi-Oh! (db.ygoprodeck.com)
digimon.ts     ← Digimon TCG — apitcg.com/api/digimon (requiere x-api-key header)
riftbound.ts   ← Riftbound LoL TCG — apitcg.com/api/riftbound (requiere x-api-key header)
```

**`ExternalCard`** tiene `imageUrl?: string` para display únicamente — **no se guarda en BD**.  
Al publicar (`POST /api/cartas`) solo se envían: `name`, `rarity`, `setName`, `setCode`, `cardNumber`.  
Idiomas soportados: `en | es | pt | fr | de | it | ru` (no japonés, chino ni coreano).

**API key de apitcg.com:** apitcg.com tiene restricciones CORS, por lo que Digimon y Riftbound se proxean a través del backend Express:
- Ruta proxy: `GET /api/tcg/digimon` y `GET /api/tcg/riftbound` → `tcgproxy/tcgproxy.routes.ts`
- La key vive en `backend/.env` como `APITCG_KEY`, nunca expuesta al browser
- Los servicios frontend usan `/api/tcg/{game}` (vía Vite proxy → Express)

### Scrapers de precio (backend — solo para /publicar)

`GET /api/cartas/precio-coolstuff` y `GET /api/cartas/precios-pokemon` — solo precios, sin imágenes.  
Implementados con axios + regex en `carta.controler.ts`. Tiendas: CoolStuffInc, TCGPlayer, Cardmarket, eBay, PriceCharting, Troll & Toad.

## Scripts de DB (`backend/src/scripts/`)
- `sync_tcg_translations.ts` — sincroniza `card_translations` desde TCGdex (11 idiomas × 625 sets)
- `generate-embeddings.ts` — genera `embeddings.json` con CLIP para búsqueda visual
- `seed_en_names.ts` — pobla nombres EN en la tabla `cards`
- `seed_stages.ts` — inserta keywords de etapas en `stage_pokemon`
- `update_card_numbers.ts` — actualiza `Carta.cardNumber` desde la DB del catálogo
- `hash_passwords.ts` — migración one-shot: hashea passwords planas con bcrypt
- `cleanup_orphaned.ts` — elimina entidades huérfanas
- `reset_purchases.ts` / `deletePurchases.ts` — utilidades de reset en dev

## Known Tech Debt (do not "fix" without team discussion)
- Passwords are plain text (no bcrypt) — `hash_passwords.ts` existe pero no se ejecutó en prod; confirmar con el equipo antes de migrar
- `User.password` tiene `hidden: true` en MikroORM (no se serializa), pero el token completo sigue en `localStorage`
- `debug: true` in MikroORM config (intentional for development)
- CORS allows all origins
- `eng.traineddata` en `backend/` — archivo de modelo Tesseract; tesseract.js lo descarga por CDN pero conviene tenerlo local para entornos offline
- `embeddings.json` (~95 MB) no está en el repo — regenerar con `pnpm generate-embeddings` si falta
- `google-key.json` en la raíz contiene credenciales sensibles — no commitear en repos públicos