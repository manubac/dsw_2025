# MainPage Cards Navigate to Group — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all clickable card thumbnails in MainPage (hero fan, NovedadesCarousel) and Header search suggestions navigate to the group page (`/group`) instead of the individual card page (`/card/:id`), only showing cards whose group exists in the current game's card listing.

**Architecture:** Extract the group-building logic from `CardsPage.tsx` into a shared utility (`src/utils/cardGroups.ts`). MainPage fetches all cartas to build a `cardIdToGroup` map, passes it to NovedadesCarousel as a prop, and uses it for hero card clicks. Header builds the same map from its existing `cartas` fetch via `useMemo`. No new React context required.

**Tech Stack:** React 19, TypeScript, React Router v6, Vite, `fetchApi` from `src/services/api.ts`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/utils/cardGroups.ts` | Create | `CardGroup` type, `buildCardGroups`, `buildCardIdToGroup`, `filterCartasByGame`, `navigateToGroup` |
| `src/pages/CardsPage.tsx` | Modify | Replace inline group logic with imports from utils |
| `src/pages/MainPage.tsx` | Modify | Fetch all cartas, build map, update hero cards, pass prop to carousel |
| `src/components/NovedadesCarousel.tsx` | Modify | Accept `cardIdToGroup` prop, filter cards, navigate to group |
| `src/components/Header.tsx` | Modify | Filter suggestions by game, build map via useMemo, navigate to group |

---

### Task 1: Create `src/utils/cardGroups.ts`

**Files:**
- Create: `src/utils/cardGroups.ts`

- [ ] **Step 1: Create the utility file with all exports**

Create `src/utils/cardGroups.ts` with this exact content:

```typescript
import type { NavigateFunction } from 'react-router-dom'

export interface CardGroup {
  groupKey: string
  name: string
  setName: string
  setCode: string | null
  cardNumber: string | null
  rarity: string | null
  thumbnail: string | null
  publications: any[]
  allCities: string[]
}

export function filterCartasByGame(cartas: any[], game: string): any[] {
  return cartas.filter(c => {
    const name = c.cartaClass?.name?.toLowerCase()
    if (name === game) return true
    if (!c.cartaClass && game === 'pokemon') return true
    return false
  })
}

export function buildCardGroups(cartas: any[]): CardGroup[] {
  const groupMap = new Map<string, CardGroup>()

  for (const carta of cartas) {
    const setCode = carta.setCode || null
    const cardNumber = carta.cardNumber || null
    const rarity = carta.rarity || null
    const name = carta.title || carta.name || ''

    const keyBase = setCode && cardNumber
      ? `${setCode.toLowerCase()}-${cardNumber.toLowerCase()}`
      : name.toLowerCase()
    const groupKey = `${keyBase}-${(rarity || '').toLowerCase()}`

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        groupKey,
        name,
        setName: carta.set || 'Unknown Set',
        setCode,
        cardNumber,
        rarity,
        thumbnail: carta.thumbnail || null,
        publications: [],
        allCities: [],
      })
    }

    const group = groupMap.get(groupKey)!
    group.publications.push(carta)
    if (!group.thumbnail && carta.thumbnail) group.thumbnail = carta.thumbnail

    const citiesFromThis: string[] = (carta.intermediarios || [])
      .map((i: any) => i.direccion?.ciudad)
      .filter(Boolean)
    for (const city of citiesFromThis) {
      if (!group.allCities.includes(city)) group.allCities.push(city)
    }
  }

  return Array.from(groupMap.values())
}

export function buildCardIdToGroup(groups: CardGroup[]): Map<number, CardGroup> {
  const map = new Map<number, CardGroup>()
  for (const group of groups) {
    for (const pub of group.publications) {
      map.set(pub.id, group)
    }
  }
  return map
}

export function navigateToGroup(
  navigate: NavigateFunction,
  group: CardGroup,
  activeCity: string
): void {
  navigate('/group', {
    state: {
      group: {
        name: group.name,
        setName: group.setName,
        setCode: group.setCode,
        cardNumber: group.cardNumber,
        rarity: group.rarity,
        thumbnail: group.thumbnail,
      },
      publications: group.publications,
      bundles: [],
      activeCity,
    },
  })
}
```

- [ ] **Step 2: Verify types compile**

```bash
cd vite-project/vite-project-ts
pnpm tsc --noEmit
```

Expected: no errors related to `src/utils/cardGroups.ts`

- [ ] **Step 3: Commit**

```bash
git add src/utils/cardGroups.ts
git commit -m "feat: add shared cardGroups utility (types + build/navigate helpers)"
```

---

### Task 2: Refactor `CardsPage.tsx` to use the shared utility

**Files:**
- Modify: `src/pages/CardsPage.tsx`

- [ ] **Step 1: Replace inline `CardGroup` interface and group-building logic**

In `src/pages/CardsPage.tsx`:

1. Remove the `CardGroup` interface (lines 8–18).
2. Add an import at the top of the file (after the existing imports):

```typescript
import { CardGroup, buildCardGroups, filterCartasByGame } from '../utils/cardGroups'
```

3. Replace the `gameCartas` useMemo:

```typescript
  const gameCartas = useMemo(
    () => filterCartasByGame(cartas, filters.game),
    [cartas, filters.game]
  )
```

4. Replace the `groups` useMemo body (keep the `useMemo<CardGroup[]>` wrapper):

```typescript
  const groups = useMemo<CardGroup[]>(
    () => buildCardGroups(gameCartas),
    [gameCartas]
  )
```

- [ ] **Step 2: Verify types compile and behavior is unchanged**

```bash
cd vite-project/vite-project-ts
pnpm tsc --noEmit
```

Expected: no errors. The page behavior is identical — only the source of truth moved to the utility.

- [ ] **Step 3: Commit**

```bash
git add src/pages/CardsPage.tsx
git commit -m "refactor: CardsPage uses shared cardGroups utility"
```

---

### Task 3: Update `NovedadesCarousel.tsx` to accept group map and navigate to group

**Files:**
- Modify: `src/components/NovedadesCarousel.tsx`

- [ ] **Step 1: Add import and prop type**

At the top of `src/components/NovedadesCarousel.tsx`, add to the existing imports:

```typescript
import type { CardGroup } from '../utils/cardGroups'
import { navigateToGroup } from '../utils/cardGroups'
```

Replace the function signature. Currently it is:

```typescript
export function NovedadesCarousel() {
```

Change to:

```typescript
interface NovedadesCarouselProps {
  cardIdToGroup?: Map<number, CardGroup>
}

export function NovedadesCarousel({ cardIdToGroup }: NovedadesCarouselProps = {}) {
```

- [ ] **Step 2: Add `displayCards` derived from the prop**

After the existing `useEffect` that checks scroll state (around line 48), add:

```typescript
  const displayCards = useMemo(() => {
    if (!cardIdToGroup) return cards
    return cards.filter(c => cardIdToGroup.has(c.id))
  }, [cards, cardIdToGroup])
```

Add `useMemo` to the existing imports from React at the top of the file:

```typescript
import { useEffect, useRef, useState, useMemo } from 'react'
```

- [ ] **Step 3: Update `handleCardClick` to navigate to group**

Replace the existing `handleCardClick` function:

```typescript
  function handleCardClick(card: PopularCard) {
    fetchApi(`/api/cartas/${card.id}/view`, { method: 'POST' }).catch(() => {})
    if (cardIdToGroup) {
      const group = cardIdToGroup.get(card.id)
      if (group) {
        navigateToGroup(navigate, group, 'all')
        return
      }
    }
    navigate(`/card/${card.id}`)
  }
```

- [ ] **Step 4: Replace `cards` with `displayCards` in the JSX**

In the carousel section, replace the map over `cards` with `displayCards`. Find:

```tsx
        ) : (
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none' }}
          >
            {cards.map(card => (
```

Change `{cards.map(card => (` to `{displayCards.map(card => (`.

Also update the empty-state check. Find:

```tsx
        ) : cards.length === 0 ? (
```

Change to:

```tsx
        ) : displayCards.length === 0 ? (
```

- [ ] **Step 5: Verify types compile**

```bash
cd vite-project/vite-project-ts
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/NovedadesCarousel.tsx
git commit -m "feat: NovedadesCarousel navigates to group page when cardIdToGroup prop is provided"
```

---

### Task 4: Update `MainPage.tsx` — fetch all cartas, build map, update hero cards, pass prop

**Files:**
- Modify: `src/pages/MainPage.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports in `src/pages/MainPage.tsx`:

```typescript
import type { CardGroup } from '../utils/cardGroups'
import { buildCardGroups, buildCardIdToGroup, filterCartasByGame, navigateToGroup } from '../utils/cardGroups'
```

- [ ] **Step 2: Add `allCartas` state and fetch**

After the existing `const [topCards, setTopCards] = useState<TopCard[]>([])` line, add:

```typescript
  const [allCartas, setAllCartas] = useState<any[]>([])
```

After the existing `useEffect` that fetches `populares` (the one that depends on `filters.game`), add a new effect:

```typescript
  useEffect(() => {
    fetchApi('/api/cartas')
      .then(r => r.json())
      .then(d => setAllCartas(d.data ?? []))
      .catch(() => {})
  }, [])
```

- [ ] **Step 3: Add `cardIdToGroup` derived state**

After the `allCartas` state declaration, add (this needs `useMemo` which is already imported):

```typescript
  const cardIdToGroup = useMemo<Map<number, CardGroup>>(() => {
    const gameCartas = filterCartasByGame(allCartas, filters.game)
    const groups = buildCardGroups(gameCartas)
    return buildCardIdToGroup(groups)
  }, [allCartas, filters.game])
```

- [ ] **Step 4: Replace hero card destructuring and add `heroCards`**

Find and remove this line:

```typescript
  const [c1, c2, c3] = topCards
```

Replace with:

```typescript
  const heroCards = useMemo(() =>
    topCards
      .map(card => ({ card, group: cardIdToGroup.get(card.id) ?? null }))
      .filter((item): item is { card: TopCard; group: CardGroup } => item.group !== null)
  , [topCards, cardIdToGroup])

  const h1 = heroCards[0]
  const h2 = heroCards[1]
  const h3 = heroCards[2]
```

- [ ] **Step 5: Update hero fan card JSX**

Replace the entire `{/* FAN DE CARTAS — top 3 del juego seleccionado */}` section (inside `<div className="mp-hero-right">`). Find the section starting at `<div className="mp-card-fan">` and replace its three card divs and the label below:

```tsx
        <div className="mp-card-fan">
            <div className="mp-fan-glow" />

            {/* Carta izquierda */}
            <div
              className="mp-fan-card mp-fc1"
              onClick={() => h1 && navigateToGroup(navigate, h1.group, filters.city)}
              title={h1?.card.title}
            >
              {h1?.card.thumbnail
                ? <img src={h1.card.thumbnail} alt={h1.card.title} className="mp-fc-img" />
                : <span className="mp-fc-sym">◆</span>
              }
              {h1 && (
                <div className="mp-fc-overlay">
                  <span className="mp-fc-name">{h1.card.title}</span>
                  <span className="mp-fc-price">${h1.card.price.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Carta central */}
            <div
              className="mp-fan-card mp-fc2 mp-hero-card-main"
              onClick={() => h2 && navigateToGroup(navigate, h2.group, filters.city)}
              title={h2?.card.title}
            >
              {h2?.card.thumbnail
                ? <img src={h2.card.thumbnail} alt={h2.card.title} className="mp-fc-img" />
                : (
                  <>
                    <div className="mp-pokeball">
                      <div className="mp-pb-top" />
                      <div className="mp-pb-bot" />
                      <div className="mp-pb-line" />
                      <div className="mp-pb-dot" />
                    </div>
                    <div className="mp-fc2-txt">TCG</div>
                  </>
                )
              }
              {h2 && (
                <div className="mp-fc-overlay">
                  <span className="mp-fc-name">{h2.card.title}</span>
                  <span className="mp-fc-price">${h2.card.price.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Carta derecha */}
            <div
              className="mp-fan-card mp-fc3"
              onClick={() => h3 && navigateToGroup(navigate, h3.group, filters.city)}
              title={h3?.card.title}
            >
              {h3?.card.thumbnail
                ? <img src={h3.card.thumbnail} alt={h3.card.title} className="mp-fc-img" />
                : <span className="mp-fc-sym">♠</span>
              }
              {h3 && (
                <div className="mp-fc-overlay">
                  <span className="mp-fc-name">{h3.card.title}</span>
                  <span className="mp-fc-price">${h3.card.price.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>
          {heroCards.length > 0 && (
            <p className="mp-fan-label">🔥 Top cartas de la semana</p>
          )}
```

Note: the label condition changes from `topCards.length > 0` to `heroCards.length > 0`.

- [ ] **Step 6: Pass `cardIdToGroup` to `NovedadesCarousel`**

Find:

```tsx
        <NovedadesCarousel />
```

Replace with:

```tsx
        <NovedadesCarousel cardIdToGroup={cardIdToGroup} />
```

- [ ] **Step 7: Verify types compile**

```bash
cd vite-project/vite-project-ts
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/MainPage.tsx
git commit -m "feat: MainPage hero cards and carousel navigate to group page"
```

---

### Task 5: Update `Header.tsx` — filter suggestions by game, navigate to group

**Files:**
- Modify: `src/components/Header.tsx`

- [ ] **Step 1: Add imports**

Add to the existing imports in `src/components/Header.tsx`:

```typescript
import type { CardGroup } from '../utils/cardGroups'
import { buildCardGroups, buildCardIdToGroup, filterCartasByGame, navigateToGroup } from '../utils/cardGroups'
```

- [ ] **Step 2: Add `cardIdToGroup` derived from `cartas` and game filter**

In the component body, after the `cartas` state declaration (`const [cartas, setCartas] = useState<any[]>([])`), add:

```typescript
  const cardIdToGroup = useMemo<Map<number, CardGroup>>(() => {
    const gameCartas = filterCartasByGame(cartas, filters.game)
    return buildCardIdToGroup(buildCardGroups(gameCartas))
  }, [cartas, filters.game])
```

`useMemo` is already imported from React in `Header.tsx` — if not, add it to the React import line.

- [ ] **Step 3: Fix `handleSearch` to filter suggestions by game**

Find the `handleSearch` function's results-building block:

```typescript
      if (!isCardsPage) {
        const filtered = cartas.filter((carta) =>
          carta.title.toLowerCase().includes(value.toLowerCase())
        );
        setResults(filtered.slice(0, 5));
      }
```

Replace with:

```typescript
      if (!isCardsPage) {
        const gameCartas = filterCartasByGame(cartas, filters.game)
        const filtered = gameCartas.filter((carta: any) =>
          carta.title.toLowerCase().includes(value.toLowerCase())
        )
        setResults(filtered.slice(0, 5))
      }
```

- [ ] **Step 4: Update `handleResultClick` to navigate to group**

Replace the existing `handleResultClick` function:

```typescript
  const handleResultClick = (card: any) => {
    setResults([]);
    setQuery(card.title);
    const group = cardIdToGroup.get(card.id)
    if (group) {
      navigateToGroup(navigate, group, filters.city)
    } else {
      navigate(`/card/${card.id}`)
    }
  };
```

- [ ] **Step 5: Verify types compile**

```bash
cd vite-project/vite-project-ts
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Header.tsx
git commit -m "feat: header search suggestions filter by game and navigate to group page"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| Hero fan cards navigate to group | Task 4 step 5 |
| NovedadesCarousel navigates to group | Task 3 step 3 |
| Search suggestions navigate to group | Task 5 step 4 |
| Only show cards whose group exists | Task 3 step 2 (carousel), Task 4 step 4 (hero hidden if no group) |
| Respect game filter | Task 5 step 3 (suggestions), Task 4 step 3 (map scoped to game) |
| Extract shared utility | Task 1 |
| CardsPage backward compat | Task 2 |
| `navigateToGroup` passes `bundles: []` | Task 1 step 1 |

### Type consistency

- `CardGroup` defined once in `src/utils/cardGroups.ts`, imported everywhere — no duplicates.
- `buildCardIdToGroup` returns `Map<number, CardGroup>`, consumed as `Map<number, CardGroup>` in all three call sites (Tasks 3, 4, 5).
- `navigateToGroup(navigate, group, activeCity)` signature used consistently.
- `filterCartasByGame(cartas, game)` signature used consistently in Tasks 2, 4, 5.
