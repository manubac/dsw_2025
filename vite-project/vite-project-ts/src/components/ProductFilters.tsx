import { useId, useContext } from 'react'
import { FiltersContext } from '../context/filters'

export function ProductFilters({
  cities = [],
  collections = [],
  rarities = [],
  maxAvailablePrice = 10000,
}: {
  cities?: string[]
  collections?: string[]
  rarities?: string[]
  maxAvailablePrice?: number
}) {
  const { filters, setFilters } = useContext(FiltersContext)
  const collectionFilterId = useId()
  const rarityFilterId = useId()
  const sortFilterId = useId()
  const cityFilterId = useId()

  const priceStep = maxAvailablePrice <= 1000 ? 10 : maxAvailablePrice <= 10000 ? 100 : 500

  const sliderMin = filters.minPrice
  const sliderMax = Math.min(filters.maxPrice, maxAvailablePrice)
  const noUpperLimit = filters.maxPrice >= maxAvailablePrice

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

  const handleChangeFromPrice = (event: any) => {
    const val = Math.min(Number(event.target.value), sliderMax - priceStep)
    setFilters((prev: any) => ({ ...prev, minPrice: val }))
  }

  const handleChangeToPrice = (event: any) => {
    const val = Math.max(Number(event.target.value), sliderMin + priceStep)
    setFilters((prev: any) => ({ ...prev, maxPrice: val }))
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

      {/* PRECIO (rango) */}
      <div className="flex flex-col gap-2 flex-1 min-w-[180px]">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Precio entre{' '}
          <span className="text-primary font-bold">${sliderMin.toLocaleString()}</span>
          {' '}y{' '}
          <span className="text-primary font-bold">
            {noUpperLimit ? 'sin límite' : `$${sliderMax.toLocaleString()}`}
          </span>
        </label>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-12 shrink-0">Desde</span>
            <input
              type="range"
              min="0"
              max={maxAvailablePrice}
              step={priceStep}
              value={sliderMin}
              onChange={handleChangeFromPrice}
              className="flex-1 accent-primary cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-12 shrink-0">Hasta</span>
            <input
              type="range"
              min="0"
              max={maxAvailablePrice}
              step={priceStep}
              value={sliderMax}
              onChange={handleChangeToPrice}
              className="flex-1 accent-primary cursor-pointer"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
