# CLAUDE.md — DSW 2025: Marketplace de Cartas Pokémon

## Project Overview
Academic marketplace for Pokémon card trading. Team: Manuel Bacolla (50214), Nicolás Volentiera (51824), Bruno Leo Santi (51950).

## Architecture
- **Backend:** `backend/` — Express 5 + TypeScript + MikroORM 6 + MySQL (port 3307)
- **Frontend:** `vite-project/vite-project-ts/` — React 19 + TypeScript + Vite 7
- **Package manager:** pnpm
- Frontend proxies `/api` → `http://localhost:3000` via Vite config
- **Styling:** Tailwind CSS (postcss.config.js + tailwind.config.js en el frontend)
- **HTTP client:** axios via `src/services/api.ts` — usar `api` (axios) o `fetchApi` (fetch), ambos adjuntan JWT automáticamente

## Backend Modules
- `carta/`, `user/`, `vendedor/`, `compra/` — originales
- `direccion/` — CRUD de direcciones de entrega del comprador
- `envio/` — gestión de envíos con estados (`EstadoEnvio` enum: planificado → entregado)
- `intermediario/` — actor logístico con dirección propia, panel `IntermediarioDashboard`
- `contact/` — envío de mensajes de contacto vía email (nodemailer)
- `valoracion/` — reseñas post-compra

## Dev Commands
- Backend: `cd backend && pnpm run dev` (tsc-watch)
- Frontend: `cd vite-project/vite-project-ts && pnpm run dev`
- DB: MySQL on `127.0.0.1:3307`, database `heroclash4geeks`, user/pass `dsw/dsw`

## Code Conventions
- Feature-based folders: `carta/`, `user/`, `vendedor/`, `compra/` — each has `.entity.ts`, `.routes.ts`, `.controler.ts` (note: intentional typo "controler", not "controller")
- Spanish names for domain entities (Carta, Vendedor, Compra); English for infrastructure
- All DB access via MikroORM `EntityManager` — no raw SQL

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
- **Mailer:** `backend/src/shared/mailer.ts` — nodemailer + Gmail, requiere `GMAIL_USER` y `GMAIL_APP_PASS` env vars; falla silenciosamente (no bloquea el flujo principal)

## Scripts de DB (`backend/src/scripts/`)
- `hash_passwords.ts` — hashea passwords planas existentes
- `cleanup_orphaned.ts` — limpia entidades huérfanas
- `reset_purchases.ts` / `deletePurchases.ts` — reset de compras en dev

## Known Tech Debt (do not "fix" without team discussion)
- Passwords are plain text (no bcrypt) — `hash_passwords.ts` existe pero no se ejecutó en prod; confirmar con el equipo antes de migrar
- ~~No authentication tokens (no JWT)~~ — JWT implementado, ya no aplica
- `User.password` tiene `hidden: true` en MikroORM (no se serializa), pero el token completo sigue en `localStorage`
- `debug: true` in MikroORM config (intentional for development)
- CORS allows all origins
