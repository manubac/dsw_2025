# Filtros en CardsPage — Diseño

**Fecha:** 2026-04-27  
**Referencia visual:** preciostcg.com (selector de juego inline en búsqueda, barra de filtros secundaria con colección/rareza/orden)

---

## Resumen

Agregar a `/cards` un selector de juego inline junto a la barra de búsqueda, y filtros dinámicos de colección y rareza en la barra de filtros existente (`ProductFilters`). El sort por precio y nombre ya existe y permanece sin cambios funcionales.

---

## Arquitectura

Tres archivos modificados, ninguno creado:

| Archivo | Cambio |
|---|---|
| `context/filters.tsx` | Agregar `game`, `collection`, `rarity` al estado inicial |
| `pages/CardsPage.tsx` | Selector de juego en search box; lógica de filtrado en cadena |
| `components/ProductFilters.tsx` | Dos nuevos selects: colección y rareza, con props dinámicas |

---

## Sección 1 — Selector de juego (CardsPage.tsx)

### Ubicación
Dentro del `<div className="flex gap-2">` que ya contiene el input y el botón de búsqueda, se agrega un `<select>` **antes** del input:

```
[ 🎮 Pokémon ▼ ]  [ Pikachu ex PAR 239...      ]  [ Buscar ]
```

### Opciones
```ts
const JUEGOS = [
  { value: 'pokemon',   label: '🎮 Pokémon' },
  { value: 'magic',     label: '⚔️ Magic' },
  { value: 'yugioh',    label: '👁️ Yu-Gi-Oh!' },
  { value: 'digimon',   label: '🦕 Digimon' },
  { value: 'riftbound', label: '⚡ Riftbound' },
]
```

### Comportamiento
- Default: `'pokemon'`
- Al cambiar: `setFilters(prev => ({ ...prev, game: value, query: '', queryAliases: [], collection: 'all', rarity: 'all' }))` y limpiar `searchText`
- El parser `POKEMON_CODE_RE` y el endpoint `/api/cartas/resolve/pokemon` solo se ejecutan cuando `filters.game === 'pokemon'`
- El placeholder del input cambia según el juego:
  - pokemon: `"Ej: Pikachu, Charizard PAR 4, Pikachu ex SV3 123"`
  - magic: `"Ej: Black Lotus, Lightning Bolt"`
  - yugioh: `"Ej: Dark Magician, Blue-Eyes White Dragon"`
  - digimon: `"Ej: Agumon, Omnimon"`
  - riftbound: `"Ej: Jinx, Jinx 001"`
- El hint de formato Pokémon (texto `"Pokémon: podés buscar por nombre..."`) solo se muestra cuando `filters.game === 'pokemon'`

---

## Sección 2 — Barra de filtros (ProductFilters.tsx)

### Layout resultante (inspirado en preciostcg.com)
```
[ Todas las Colecciones ▼ ]  [ Todas las Rarezas ▼ ]  [ Ordenar por ▼ ]  [ Ciudad ▼ ]  [ Precio desde $X ——— ]
```

En mobile la barra pasa a columna (ya funciona así con `flex-col md:flex-row`).

### Props nuevas
```ts
interface ProductFiltersProps {
  cities?: string[]
  collections?: string[]   // nuevo
  rarities?: string[]      // nuevo
}
```

### Selects nuevos
**Colección:**
```tsx
<select value={filters.collection} onChange={e => setFilters(prev => ({ ...prev, collection: e.target.value, rarity: 'all' }))}>
  <option value="all">Todas las Colecciones</option>
  {collections.map(c => <option key={c} value={c}>{c}</option>)}
</select>
```
Al cambiar colección se resetea rareza a `'all'` (porque las rarezas disponibles cambian).

**Rareza:**
```tsx
<select value={filters.rarity} onChange={e => setFilters(prev => ({ ...prev, rarity: e.target.value }))}>
  <option value="all">Todas las Rarezas</option>
  {rarities.map(r => <option key={r} value={r}>{r}</option>)}
</select>
```

---

## Sección 3 — Estado y lógica de filtrado

### FiltersContext (context/filters.tsx)
Estado inicial extendido:
```ts
{
  city: 'all',
  minPrice: 0,
  query: '',
  sort: 'default',
  queryAliases: [] as string[],
  game: 'pokemon',       // nuevo
  collection: 'all',     // nuevo
  rarity: 'all',         // nuevo
}
```

### Lógica en CardsPage (memo `filteredGroups` refactorizado)

**Paso 1 — Filtrar cartas por juego antes de agrupar:**
```ts
const gameCartas = useMemo(() => {
  if (filters.game === 'all') return cartas
  return cartas.filter(c =>
    c.cartaClass?.name?.toLowerCase() === filters.game.toLowerCase()
  )
}, [cartas, filters.game])
```
El memo `groups` pasa a usar `gameCartas` en lugar de `cartas`.

Nota: `cartaClass.name` en DB es "Pokemon", "Magic", "YuGiOh", "Digimon", "Riftbound". La comparación es case-insensitive. Para YGO: `filters.game === 'yugioh'` comparar con `'yugioh'` — el nombre en DB es `'YuGiOh'`, así que toLowerCase de ambos coincide.

**Paso 2 — baseGroups (query + ciudad + precio):**
Misma lógica actual de `filteredGroups` pero sin el sort al final — solo los tres filtros básicos.

**Paso 3 — availableCollections:**
```ts
const availableCollections = useMemo(() =>
  Array.from(new Set(baseGroups.map(g => g.setName).filter(Boolean))).sort()
, [baseGroups])
```

**Paso 4 — collectionGroups:**
```ts
const collectionGroups = useMemo(() =>
  filters.collection === 'all'
    ? baseGroups
    : baseGroups.filter(g => g.setName === filters.collection)
, [baseGroups, filters.collection])
```

**Paso 5 — availableRarities:**
```ts
const availableRarities = useMemo(() =>
  Array.from(new Set(collectionGroups.map(g => g.rarity).filter(Boolean))).sort()
, [collectionGroups])
```

**Paso 6 — finalGroups (rareza + sort):**
```ts
const finalGroups = useMemo(() => {
  let result = filters.rarity === 'all'
    ? collectionGroups
    : collectionGroups.filter(g => g.rarity === filters.rarity)
  // sort existente (name-asc, name-desc, price-asc, price-desc)
  return sorted(result)
}, [collectionGroups, filters.rarity, filters.sort, filters.city])
```

El render usa `finalGroups` (antes usaba `filteredGroups`).

**ProductFilters** recibe como props: `cities`, `collections={availableCollections}`, `rarities={availableRarities}`.

---

## Casos borde

- Si el juego cambia y no hay cartas de ese juego publicadas: la grilla muestra "No se encontraron cartas."
- Si se selecciona una colección y luego cambia el juego: collection y rarity se resetean a `'all'`
- Si `availableCollections` tiene un solo elemento, igual se muestra el select (no se auto-selecciona)
- `cartaClass` puede ser `null` en cartas legacy — esas cartas no aparecen con ningún juego seleccionado (quedan fuera del filtro de juego). Con `game === 'all'` sí aparecerían, pero no exponemos esa opción en la UI por ahora.

---

## Lo que NO cambia

- Lógica de bundles (permanece igual, no se filtra por juego)
- Endpoint `/api/cartas` (no requiere cambios en el backend)
- Resolver de nombres Pokémon (`/api/cartas/resolve-names`, `/api/cartas/resolve/pokemon`)
- Navegación a `/group` al hacer click en una carta
- `useFilters` hook y su `filterProducts` (usado en otras páginas, no se modifica)
