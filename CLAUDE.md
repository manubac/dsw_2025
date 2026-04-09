# CLAUDE.md — DSW 2025: Marketplace de Cartas Pokémon

## Project Overview
Academic marketplace for Pokémon card trading. Team: Manuel Bacolla (50214), Nicolás Volentiera (51824), Bruno Leo Santi (51950).

## Architecture
- **Backend:** `backend/` — Express 5 + TypeScript + MikroORM 6 + MySQL (port 3307)
- **Frontend:** `vite-project/vite-project-ts/` — React 19 + TypeScript + Vite 7
- **Package manager:** pnpm
- Frontend proxies `/api` → `http://localhost:3000` via Vite config

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
- **Auth:** No JWT/session middleware yet — protected routes rely on frontend guards only (known limitation)
- **CORS:** Permissive `cors()` with no origin restriction — intentional for dev environment

## Known Tech Debt (do not "fix" without team discussion)
- Passwords are plain text (no bcrypt)
- No authentication tokens (no JWT)
- User object (including password) persisted to `localStorage`
- `debug: true` in MikroORM config (intentional for development)
- CORS allows all origins
