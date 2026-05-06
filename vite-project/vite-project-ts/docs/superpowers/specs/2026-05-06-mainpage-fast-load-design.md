# Design: MainPage Fast Load — Slim Group Endpoints

**Date:** 2026-05-06  
**Status:** Approved

## Problem

`MainPage.tsx` currently fetches `GET /api/cartas` (all cartas, all games, with full populate chain: `cartaClass, items, items.cartas, items.intermediarios.direccion, uploader, uploaderTienda` + bulk ratings query + `getSetAbbreviations`) only to build a `cardIdToGroup` map for displaying three hero fan cards and filtering the NovedadesCarousel. This makes MainPage load noticeably slower.

Goal: make MainPage load fast with no visual changes.

## Approach

Two new backend endpoints:
1. `GET /api/cartas/grupos?game=X` — slim, game-filtered, fast
2. `GET /api/cartas/by-group?ids=1,2,3` — full data, PK-keyed, fast

MainPage uses the slim endpoint. When a hero card is clicked, CardGroupPage uses the by-group endpoint to fetch full publication data on mount (fast, PK lookup). No visual change: CardGroupPage shows the group header instantly from `state.group` and the publications list loads in < 200ms.

## Architecture

### New endpoint: `GET /api/cartas/grupos?game=X`

**Location:** `backend/src/carta/carta.controler.ts` + `carta.routes.ts`

**Query:** `em.fork().find(Carta, buildGameFilter(game), { populate: ['cartaClass'] })`

No `items`, no `uploader`, no `uploaderTienda`, no ratings, no bundle filtering.

Applies `getSetAbbreviations` for the `setCode` field (same as `findAll`) so group display is consistent.

**Response shape:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Pikachu",
      "thumbnail": "https://...",
      "setCode": "PAR",
      "cardNumber": "047",
      "rarity": "Common",
      "set": "Paradox Rift",
      "cartaClass": { "name": "pokemon" }
    }
  ]
}
```

**Route:** `cartaRouter.get('/grupos', getGrupos)` — registered **before** `/:id`.

### New endpoint: `GET /api/cartas/by-group?ids=1,2,3`

**Location:** `backend/src/carta/carta.controler.ts` + `carta.routes.ts`

**Query:** Same as `findAll` but filtered to specific ids: `em.fork().find(Carta, { id: { $in: ids } }, { populate: ['cartaClass', 'items', 'items.cartas', 'items.intermediarios.direccion', 'uploader', 'uploaderTienda'] })`. Same mapping (abbrMap, ratings, intermediarios, stock). Since it queries by PK on a small set (typically 1–10 publications), it is fast.

**Query param:** `ids` — comma-separated list of publication ids, max 100.

**Response shape:** identical to `findAll` item shape (title, thumbnail, price, priceStr, set, setCode, cardNumber, rarity, cartaClass, intermediarios, uploader, uploaderTienda, stock, lang).

**Route:** `cartaRouter.get('/by-group', getByGroup)` — registered before `/:id`.

---

### `cardGroups.ts` — update `navigateToGroup`

Add optional third parameter:
```typescript
export function navigateToGroup(
  navigate: NavigateFunction,
  group: CardGroup,
  activeCity: string,
  publicationIds?: number[]
): void
```

When `publicationIds` is provided:
- Pass `publications: []` in state
- Pass `needsFetch: true` in state
- Pass `publicationIds` in state

When `publicationIds` is absent (current CardsPage behavior):
- Pass `publications: group.publications` as before (backward compatible)

### `MainPage.tsx` — use slim endpoint

- Change fetch from `/api/cartas` → `/api/cartas/grupos?game=${filters.game}`
- Add `filters.game` to the useEffect dependency array (was `[]`, now `[filters.game]`)
- On hero card click: call `navigateToGroup(navigate, group, 'all', group.publications.map(p => p.id))`
- Since `buildCardGroups` still works with slim publications (same `id, title, setCode, cardNumber, rarity, thumbnail, set, cartaClass` fields needed for grouping), no other changes.

### `Header.tsx` — use slim endpoint

- Change fetch from `/api/cartas` → `/api/cartas/grupos?game=${filters.game}`
- Add `filters.game` to useEffect dependency array (was `[]`, now `[filters.game]`)
- On suggestion click: call `navigateToGroup(navigate, group, 'all', group.publications.map(p => p.id))`
- `cardIdToGroup` useMemo still works: slim publications have `id`, which is all that's needed for the id→group map.

### `CardGroupPage.tsx` — fetch own data when needed

When `location.state.needsFetch === true`:
1. On mount, fetch `GET /api/cartas/by-group?ids=${state.publicationIds.join(',')}`
2. Show existing header (from `state.group`) while fetching — no loading spinner on the header
3. Publications list: show loading skeleton while fetching, then render full data
4. On fetch complete: render normally (same as current behavior when navigated from CardsPage)

State shape extension:
```typescript
const state = location.state as {
  group: { name, setName, setCode, cardNumber, rarity, thumbnail }
  publications: any[]
  bundles: any[]
  activeCity: string
  needsFetch?: boolean
  publicationIds?: number[]
} | null
```

Loading state: use existing `useState<boolean>(false)` pattern already present in the component (check for any existing loading states). If none, add `const [loadingPubs, setLoadingPubs] = useState(state?.needsFetch ?? false)`.

## Data Flow

```
MainPage mount
  └── GET /api/cartas/grupos?game=X   (slim, fast ~50ms)
        └── buildCardIdToGroup
              └── hero cards visible quickly

hero card click
  └── navigateToGroup(navigate, group, 'all', [id1, id2, ...])
        └── navigate('/group', { state: { group, publications: [], needsFetch: true, publicationIds: [...] } })
              └── CardGroupPage mounts
                    ├── Header renders from state.group (instant)
                    └── GET /api/cartas/by-group?ids=1,2,3  (full, PK-fast ~50ms)
                          └── publications rendered
```

## Error Handling

- `getGrupos`: if `game` param missing, return 400. If DB error, 500.
- `getByGroup`: if `ids` param missing or malformed, return 400. If no ids match, return `{ data: [] }`. Max 100 ids enforced.
- `CardGroupPage` fetch failure: show error message in publications area, keep header visible.

## Files Changed

| File | Change |
|------|--------|
| `backend/src/carta/carta.controler.ts` | Add `getGrupos`, `getByGroup` functions |
| `backend/src/carta/carta.routes.ts` | Register `/grupos` and `/by-group` routes |
| `src/utils/cardGroups.ts` | Update `navigateToGroup` signature with optional `publicationIds` |
| `src/pages/MainPage.tsx` | Use `/api/cartas/grupos`, pass publicationIds on click |
| `src/components/Header.tsx` | Use `/api/cartas/grupos`, pass publicationIds on click |
| `src/pages/CardGroupPage.tsx` | Detect `needsFetch`, fetch from `by-group`, show brief loading on publications list only |

## Out of Scope

- Adding bundles to `by-group` response (bundles remain `[]` when navigating from hero/header)
- Caching or React Query (future improvement)
- Changing CardsPage behavior (still uses full `/api/cartas` and passes all data via state)
