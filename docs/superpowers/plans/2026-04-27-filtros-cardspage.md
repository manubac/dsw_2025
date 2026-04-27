# Filtros CardsPage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar selector de juego inline en la búsqueda y filtros dinámicos de colección, rareza y ordenamiento en `/cards`, inspirado en preciostcg.com.

**Architecture:** Se extiende `FiltersContext` con tres campos nuevos (`game`, `collection`, `rarity`). En `CardsPage` el memo `filteredGroups` se refactoriza en una cadena de memos (`baseGroups → collectionGroups → filteredGroups`) que derivar opciones dinámicas en cada paso. `ProductFilters` recibe dos props nuevas (`collections`, `rarities`) y renderiza los selects correspondientes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vite 7. No hay cambios de backend.

---

## File Map

| Archivo | Acción | Qué cambia |
|---|---|---|
| `vite-project/vite-project-ts/src/context/filters.tsx` | Modificar | Agregar `game`, `collection`, `rarity` al estado inicial |
| `vite-project/vite-project-ts/src/pages/CardsPage.tsx` | Modificar | Constantes JUEGOS/PLACEHOLDERS, `gameCartas` memo, cascade de memos, `handleGameChange`, selector de juego en JSX, hint condicional, guard en `handleSearch` |
| `vite-project/vite-project-ts/src/components/ProductFilters.tsx` | Modificar | Props `collections`/`rarities`, handlers y selects de colección y rareza, wiring del llamado en CardsPage |

---

## Task 1: Extender FiltersContext

**Files:**
- Modify: `vite-project/vite-project-ts/src/context/filters.tsx`

- [ ] **Step 1: Reemplazar el estado inicial con los tres campos nuevos**

Abrir `src/context/filters.tsx`. Reemplazar la línea del `useState` completa:

```tsx
// ANTES (línea 6):
const [filters, setFilters] = useState({ city: 'all', minPrice: 0, query: '', sort: 'default', queryAliases: [] as string[] })

// DESPUÉS:
const [filters, setFilters] = useState({
  city: 'all',
  minPrice: 0,
  query: '',
  sort: 'default',
  queryAliases: [] as string[],
  game: 'pokemon',
  collection: 'all',
  rarity: 'all',
})
```

- [ ] **Step 2: Verificar que TypeScript no se queja**

```bash
cd dsw_2025/vite-project/vite-project-ts
pnpm tsc --noEmit
```

Salida esperada: sin errores (puede haber advertencias existentes no relacionadas).

- [ ] **Step 3: Commit**

```bash
git add vite-project/vite-project-ts/src/context/filters.tsx
git commit -m "feat: extend FiltersContext with game, collection, rarity"
```

---

## Task 2: Lógica de filtrado en cascada en CardsPage

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/CardsPage.tsx`

El objetivo es reemplazar el memo `filteredGroups` único con una cadena de memos que permite derivar las opciones disponibles de colección y rareza en tiempo real.

- [ ] **Step 1: Agregar `gameCartas` memo después de los estados (antes del memo `groups`)**

Localizar la línea `const groups = useMemo<CardGroup[]>(() => {` (~línea 76). Insertar **antes** de ella:

```tsx
const gameCartas = useMemo(() =>
  cartas.filter(c => c.cartaClass?.name?.toLowerCase() === filters.game)
, [cartas, filters.game])
```

- [ ] **Step 2: Cambiar `groups` memo para usar `gameCartas` en lugar de `cartas`**

Dentro del memo `groups`, reemplazar `for (const carta of cartas)` por `for (const carta of gameCartas)` y cambiar la dependencia `[cartas]` por `[gameCartas]`:

```tsx
// ANTES:
const groups = useMemo<CardGroup[]>(() => {
  const groupMap = new Map<string, CardGroup>();

  for (const carta of cartas) {
    // ...
  }

  return Array.from(groupMap.values());
}, [cartas]);

// DESPUÉS (solo cambian cartas → gameCartas en dos lugares):
const groups = useMemo<CardGroup[]>(() => {
  const groupMap = new Map<string, CardGroup>();

  for (const carta of gameCartas) {
    // ... (resto idéntico) ...
  }

  return Array.from(groupMap.values());
}, [gameCartas]);
```

- [ ] **Step 3: Reemplazar el memo `filteredGroups` completo con la cadena de cuatro memos**

Localizar el bloque `const filteredGroups = useMemo(() => {` (~línea 124). Borrarlo por completo y sustituirlo con:

```tsx
const baseGroups = useMemo(() => {
  const queryLower = filters.query.toLowerCase()
  const aliases: string[] = (filters.queryAliases as string[]) || []

  return groups.filter(group => {
    const inCity = filters.city === 'all' || group.allCities.includes(filters.city)
    if (!inCity) return false
    const minPrice = getMinPrice(group, filters.city)
    if (minPrice < filters.minPrice) return false
    if (filters.query) {
      const titleLower = group.name.toLowerCase()
      const titleMatch = titleLower.includes(queryLower)
      const aliasMatch = aliases.some(alias => titleLower.includes(alias.toLowerCase()))
      if (!titleMatch && !aliasMatch) return false
    }
    return true
  })
}, [groups, filters.query, filters.queryAliases, filters.city, filters.minPrice])

const availableCollections = useMemo(() =>
  Array.from(new Set(baseGroups.map(g => g.setName).filter(Boolean))).sort() as string[]
, [baseGroups])

const collectionGroups = useMemo(() =>
  filters.collection === 'all'
    ? baseGroups
    : baseGroups.filter(g => g.setName === filters.collection)
, [baseGroups, filters.collection])

const availableRarities = useMemo(() =>
  Array.from(new Set(collectionGroups.map(g => g.rarity).filter(Boolean))).sort() as string[]
, [collectionGroups])

const filteredGroups = useMemo(() => {
  let result = filters.rarity === 'all'
    ? collectionGroups
    : collectionGroups.filter(g => g.rarity === filters.rarity)

  if (filters.sort === 'name-asc') {
    result = [...result].sort((a, b) => a.name.localeCompare(b.name))
  } else if (filters.sort === 'name-desc') {
    result = [...result].sort((a, b) => b.name.localeCompare(a.name))
  } else if (filters.sort === 'price-asc') {
    result = [...result].sort((a, b) => getMinPrice(a, filters.city) - getMinPrice(b, filters.city))
  } else if (filters.sort === 'price-desc') {
    result = [...result].sort((a, b) => getMinPrice(b, filters.city) - getMinPrice(a, filters.city))
  }

  return result
}, [collectionGroups, filters.rarity, filters.sort, filters.city])
```

- [ ] **Step 4: Envolver el guard de POKEMON_CODE_RE en `handleSearch` con `if (filters.game === 'pokemon')`**

Localizar `handleSearch` (~línea 175). El bloque `const m = text.match(POKEMON_CODE_RE); if (m) { ... }` debe quedar dentro de un guard:

```tsx
const handleSearch = async (raw: string) => {
  const text = raw.trim()
  setResolveError(null)
  if (!text) {
    setFilters((prev: any) => ({ ...prev, query: '', queryAliases: [] }))
    return
  }
  if (filters.game === 'pokemon') {
    const m = text.match(POKEMON_CODE_RE)
    if (m) {
      setResolving(true)
      try {
        const params = new URLSearchParams({ set: m[2], number: m[3] })
        if (m[1]) params.set('name', m[1])
        const res = await fetchApi(`/api/cartas/resolve/pokemon?${params}`)
        const data = await res.json()
        if (res.ok && data.data?.name) {
          applyQueryWithAliases(data.data.name)
          setResolving(false)
          return
        }
        setResolveError(`No se encontró la carta ${m[2]} #${m[3]}`)
      } catch {
        setResolveError('No se pudo conectar con el servidor.')
      }
      setResolving(false)
    }
  }
  applyQueryWithAliases(text)
}
```

- [ ] **Step 5: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Sin errores nuevos.

- [ ] **Step 6: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/CardsPage.tsx
git commit -m "feat: cascade filter logic in CardsPage (game, collection, rarity)"
```

---

## Task 3: Selector de juego en la UI de CardsPage

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/CardsPage.tsx`

- [ ] **Step 1: Agregar constantes JUEGOS y PLACEHOLDERS antes del componente**

Localizar la línea `const POKEMON_CODE_RE = /^(.+?)\s+...$/` (~línea 7). Agregar debajo de ella:

```tsx
const JUEGOS = [
  { value: 'pokemon',   label: '🎮 Pokémon' },
  { value: 'magic',     label: '⚔️ Magic' },
  { value: 'yugioh',    label: '👁️ Yu-Gi-Oh!' },
  { value: 'digimon',   label: '🦕 Digimon' },
  { value: 'riftbound', label: '⚡ Riftbound' },
] as const

const PLACEHOLDERS: Record<string, string> = {
  pokemon:   'Ej: Pikachu, Charizard PAR 4, Pikachu ex SV3 123',
  magic:     'Ej: Black Lotus, Lightning Bolt',
  yugioh:    'Ej: Dark Magician, Blue-Eyes White Dragon',
  digimon:   'Ej: Agumon, Omnimon',
  riftbound: 'Ej: Jinx, Jinx 001',
}
```

- [ ] **Step 2: Agregar `handleGameChange` junto a los otros handlers**

Cerca de `handleClear` (~línea 208), agregar:

```tsx
const handleGameChange = (value: string) => {
  setSearchText('')
  setResolveError(null)
  setFilters((prev: any) => ({
    ...prev,
    game: value,
    query: '',
    queryAliases: [],
    collection: 'all',
    rarity: 'all',
  }))
}
```

- [ ] **Step 3: Agregar el `<select>` de juego al JSX**

Localizar `<div className="flex gap-2">` (~línea 249) que contiene el input y el botón. Insertar el `<select>` como **primer hijo** de ese div:

```tsx
<div className="flex gap-2">
  <select
    value={filters.game}
    onChange={e => handleGameChange(e.target.value)}
    className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition shrink-0"
  >
    {JUEGOS.map(j => (
      <option key={j.value} value={j.value}>{j.label}</option>
    ))}
  </select>
  <div className="relative flex-1">
    {/* input existente — solo cambiar placeholder: */}
    <input
      ref={inputRef}
      type="text"
      value={searchText}
      onChange={e => setSearchText(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={PLACEHOLDERS[filters.game]}
      className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition pr-8"
    />
    {searchText && (
      <button
        onClick={handleClear}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
        aria-label="Limpiar búsqueda"
      >
        ×
      </button>
    )}
  </div>
  <button
    onClick={() => handleSearch(searchText)}
    disabled={resolving}
    className="px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
  >
    {resolving ? "Buscando…" : "Buscar"}
  </button>
</div>
```

- [ ] **Step 4: Hacer el hint de formato Pokémon condicional**

Localizar el `<p>` con el texto "Pokémon: podés buscar por nombre..." (~línea 287). Envolverlo en el guard:

```tsx
{filters.game === 'pokemon' && (
  <p className="text-xs text-gray-400">
    Pokémon: podés buscar por nombre, o con el formato{' '}
    <span className="font-mono">Nombre SETID Número</span> (ej:{' '}
    <span className="font-mono">Pikachu ex PAR 239</span>)
  </p>
)}
```

- [ ] **Step 5: Verificar TypeScript y arrancar el dev server para probar visualmente**

```bash
pnpm tsc --noEmit
```

```bash
pnpm run dev
```

Abrir `http://localhost:5173/cards`. Verificar:
- El select de juego aparece a la izquierda del input
- Al cambiar el juego el placeholder cambia
- El hint de Pokémon desaparece al cambiar a otro juego
- Con juego = Pokémon, buscar `Pikachu ex PAR 239` sigue resolviendo correctamente

- [ ] **Step 6: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/CardsPage.tsx
git commit -m "feat: game selector in CardsPage search box"
```

---

## Task 4: Colección y Rareza en ProductFilters + Wiring

**Files:**
- Modify: `vite-project/vite-project-ts/src/components/ProductFilters.tsx`
- Modify: `vite-project/vite-project-ts/src/pages/CardsPage.tsx` (solo el llamado a `<ProductFilters>`)

- [ ] **Step 1: Reemplazar ProductFilters.tsx completo**

Reemplazar el contenido íntegro de `src/components/ProductFilters.tsx`:

```tsx
import { useId, useContext } from 'react'
import { FiltersContext } from '../context/filters'

export function ProductFilters({
  cities = [],
  collections = [],
  rarities = [],
}: {
  cities?: string[]
  collections?: string[]
  rarities?: string[]
}) {
  const { filters, setFilters } = useContext(FiltersContext)
  const collectionFilterId = useId()
  const rarityFilterId = useId()
  const sortFilterId = useId()
  const cityFilterId = useId()
  const minPriceFilterId = useId()

  const handleChangeCollection = (event: any) => {
    setFilters((prev: any) => ({ ...prev, collection: event.target.value, rarity: 'all' }))
  }

  const handleChangeRarity = (event: any) => {
    setFilters((prev: any) => ({ ...prev, rarity: event.target.value }))
  }

  const handleChangeSort = (event: any) => {
    setFilters((prev: any) => ({ ...prev, sort: event.target.value }))
  }

  const handleChangeCity = (event: any) => {
    setFilters((prev: any) => ({ ...prev, city: event.target.value }))
  }

  const handleChangeMinPrice = (event: any) => {
    setFilters((prev: any) => ({ ...prev, minPrice: Number(event.target.value) }))
  }

  return (
    <section className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-md p-6 mb-8 flex flex-col md:flex-row gap-6 md:items-end justify-between">
      {/* COLECCIÓN */}
      <div className="flex flex-col gap-2 flex-1">
        <label htmlFor={collectionFilterId} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Colección
        </label>
        <select
          id={collectionFilterId}
          onChange={handleChangeCollection}
          value={filters.collection}
          className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="all">Todas las Colecciones</option>
          {collections.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* RAREZA */}
      <div className="flex flex-col gap-2 flex-1">
        <label htmlFor={rarityFilterId} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Rareza
        </label>
        <select
          id={rarityFilterId}
          onChange={handleChangeRarity}
          value={filters.rarity}
          className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="all">Todas las Rarezas</option>
          {rarities.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* ORDEN */}
      <div className="flex flex-col gap-2 flex-1">
        <label htmlFor={sortFilterId} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Ordenar por
        </label>
        <select
          id={sortFilterId}
          onChange={handleChangeSort}
          value={filters.sort}
          className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="default">Por defecto</option>
          <option value="name-asc">Nombre (A-Z)</option>
          <option value="name-desc">Nombre (Z-A)</option>
          <option value="price-asc">Precio (Menor a Mayor)</option>
          <option value="price-desc">Precio (Mayor a Menor)</option>
        </select>
      </div>

      {/* CIUDAD */}
      <div className="flex flex-col gap-2 flex-1">
        <label htmlFor={cityFilterId} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Ciudad
        </label>
        <select
          id={cityFilterId}
          onChange={handleChangeCity}
          value={filters.city}
          className="px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition"
        >
          <option value="all">Todas las ciudades</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* PRECIO */}
      <div className="flex flex-col gap-2 flex-1">
        <label htmlFor={minPriceFilterId} className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Precio a partir de
        </label>
        <input
          type="range"
          id={minPriceFilterId}
          min="0"
          max="1000"
          step="10"
          onChange={handleChangeMinPrice}
          value={filters.minPrice}
          className="w-full accent-primary cursor-pointer"
        />
        <span className="text-primary font-bold">
          ${filters.minPrice}
        </span>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Actualizar el llamado a `<ProductFilters>` en CardsPage**

Localizar `<ProductFilters cities={cities} />` (~línea 291 en el JSX). Reemplazarlo:

```tsx
<ProductFilters
  cities={cities}
  collections={availableCollections}
  rarities={availableRarities}
/>
```

- [ ] **Step 3: Verificar TypeScript**

```bash
pnpm tsc --noEmit
```

Sin errores nuevos.

- [ ] **Step 4: Verificar visualmente en el dev server**

Con el servidor corriendo en `http://localhost:5173/cards`:

1. Las cartas de Pokémon aparecen (defecto)
2. El select "Colección" muestra las colecciones de las cartas publicadas
3. Al seleccionar una colección, el select "Rareza" se actualiza mostrando solo las rarezas de esa colección
4. Al filtrar por rareza, las cartas se reducen correctamente
5. "Ordenar por" → Precio Menor a Mayor ordena la grilla correctamente
6. Cambiar el juego a "Magic" (si hay cartas publicadas de MTG) muestra solo esas; si no hay, muestra "No se encontraron cartas."
7. Al cambiar de juego, los selects de Colección y Rareza vuelven a "Todas las..."

- [ ] **Step 5: Commit final**

```bash
git add vite-project/vite-project-ts/src/components/ProductFilters.tsx
git add vite-project/vite-project-ts/src/pages/CardsPage.tsx
git commit -m "feat: collection and rarity filters in ProductFilters with dynamic options"
```
