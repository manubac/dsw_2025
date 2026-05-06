# Design: MainPage & Header Cards Navigate to Group

**Date:** 2026-05-06  
**Status:** Approved

## Problem

Three places in the app show clickable card thumbnails that navigate to the individual card detail page (`/card/:id`):
1. Hero fan cards (top 3 populares) in `MainPage.tsx`
2. NovedadesCarousel (top 12 populares) in `NovedadesCarousel.tsx`
3. Search autocomplete suggestions in `Header.tsx`

This is inconsistent with `CardsPage.tsx`, which groups cards by name/set/number and navigates to `/group` with the full group state. The goal is to make all these entry points navigate to the group page instead, respecting the active game filter.

## Approach

Approach B: extract group-building logic into a shared utility and use it in all three locations. No new React context required.

## Architecture

### New file: `src/utils/cardGroups.ts`

Exports:
- `CardGroup` — interface (moved from `CardsPage.tsx`)
- `buildCardGroups(cartas: any[]): CardGroup[]` — same grouping logic currently inlined in `CardsPage`
- `buildCardIdToGroup(groups: CardGroup[]): Map<number, CardGroup>` — maps each publication ID to its group for O(1) lookup
- `navigateToGroup(navigate, group: CardGroup, activeCity: string): void` — builds the `location.state` expected by `CardGroupPage` and calls `navigate('/group', { state })`. Passes `bundles: []` since non-CardsPage contexts don't load bundle data; `CardGroupPage` already handles an empty bundles array correctly.

### `CardsPage.tsx`

Replace the inline `CardGroup` interface and the grouping `useMemo` body with imports from `cardGroups.ts`. No behavioral change.

### `MainPage.tsx`

**New state:**
- `allCartas: any[]` — fetched from `/api/cartas` when `filters.game` changes (same trigger as the populares fetch)
- `cardIdToGroup: Map<number, CardGroup>` — derived via `useMemo` from `buildCardGroups(allCartas filtered by game)` then `buildCardIdToGroup(...)`

**Hero fan cards (`c1`, `c2`, `c3`):**
- Compute `g1 = cardIdToGroup.get(c1.id)` etc.
- Only render a fan card if its group exists in the map (filter at the `[c1, c2, c3] = topCards` destructuring level)
- `onClick`: call `navigateToGroup(navigate, g1, filters.city)` instead of `navigate('/card/:id')`

**NovedadesCarousel:**
- Pass `cardIdToGroup` as new optional prop.

### `NovedadesCarousel.tsx`

**New optional prop:** `cardIdToGroup?: Map<number, CardGroup>`

**Effect when prop is provided:**
- Filter displayed `cards` to only those present in the map
- `handleCardClick`: call `navigateToGroup(navigate, group, 'all')` instead of `navigate('/card/:id')`. Uses `'all'` as activeCity since MainPage has no city filter.
- The existing view-count POST (`/api/cartas/:id/view`) is kept before navigation.

**When prop is absent:** existing behavior unchanged (backward compatible).

### `Header.tsx`

**Search suggestion filtering:**
- Currently `results` is not filtered by `filters.game` — fix this: filter `cartas` by `cartaClass?.name === filters.game` (with the same pokemon fallback used in CardsPage) before running the title match.

**Group lookup:**
- Add `useMemo` over `[cartas, filters.game]` that builds `cardIdToGroup` from the already-fetched `cartas` filtered by game.
- `handleResultClick(card)`: look up group in `cardIdToGroup`; if found, call `navigateToGroup`; if not found (card from a different game that slipped through), fall back to `navigate('/card/:id')`.

## Data Flow

```
/api/cartas ─────────────────────────────────────────┐
                                                      │
Header (already fetches)  ──► buildCardIdToGroup ──► handleResultClick ──► /group
                                                      │
MainPage (new fetch)       ──► buildCardIdToGroup ──► hero onClick       ──► /group
                          │                      └──► NovedadesCarousel  ──► /group
                          └──► filter topCards (hide if no group)
```

## Error Handling

- If `/api/cartas` fetch fails in MainPage, `allCartas` stays `[]`, `cardIdToGroup` is empty. Hero cards and carousel fall back to hiding cards with no matching group. This is acceptable (edge case, same behavior as if there are no publications).
- If a popular card has no matching group (e.g., its publication was deleted between the two fetches), it is silently hidden from the hero fan and carousel.

## Files Changed

| File | Change |
|------|--------|
| `src/utils/cardGroups.ts` | New — shared types + utilities |
| `src/pages/CardsPage.tsx` | Import `CardGroup` + `buildCardGroups` from utils |
| `src/pages/MainPage.tsx` | Fetch all cartas, build groups, update hero + pass prop |
| `src/components/NovedadesCarousel.tsx` | New optional prop, filter + navigate to group |
| `src/components/Header.tsx` | Filter suggestions by game, navigate to group |

## Out of Scope

- Refactoring `CardGroupPage` to load its own data (it still uses `location.state`)
- Showing bundles when navigating from MainPage or Header (passes `bundles: []`)
- Adding a shared React context for cartas data (Approach C — deferred)
