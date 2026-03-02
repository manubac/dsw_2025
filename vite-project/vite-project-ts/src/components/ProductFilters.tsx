import { useId, useContext } from 'react'
import { FiltersContext } from '../context/filters'


export function ProductFilters() {
  const { filters, setFilters } = useContext(FiltersContext)
  const minPriceFilterId = useId()
  const categoryFilterId = useId()
  const sortFilterId = useId()

  const handleChangeMinPrice = (event: any) => {
    setFilters((prev: any) => ({ ...prev, minPrice: Number(event.target.value) }))
  }

  const handleChangeCategory = (event: any) => {
    setFilters((prev: any) => ({ ...prev, category: event.target.value }))
  }

  const handleChangeSort = (event: any) => {
    setFilters((prev: any) => ({ ...prev, sort: event.target.value }))
  }

return (
  <section
    className="
      w-full
      bg-white dark:bg-gray-800
      rounded-2xl
      shadow-md
      p-6
      mb-8
      flex flex-col md:flex-row
      gap-6
      md:items-end
      justify-between
    "
  >
    {/* PRECIO */}
    <div className="flex flex-col gap-2 flex-1">
      <label
        htmlFor={minPriceFilterId}
        className="text-sm font-semibold text-gray-700 dark:text-gray-200"
      >
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

    {/* CATEGORIA */}
    <div className="flex flex-col gap-2 flex-1">
      <label
        htmlFor={categoryFilterId}
        className="text-sm font-semibold text-gray-700 dark:text-gray-200"
      >
        Categoría
      </label>

      <select
        id={categoryFilterId}
        onChange={handleChangeCategory}
        value={filters.category}
        className="
          px-3 py-2
          rounded-xl
          border border-gray-300
          dark:border-gray-600
          bg-white dark:bg-gray-700
          focus:outline-none
          focus:ring-2 focus:ring-primary
          transition
        "
      >
        <option value="all">All Categories</option>
        <option value="trading-cards">Trading Cards</option>
        <option value="booster-packs">Booster Packs</option>
      </select>
    </div>

    {/* ORDEN */}
    <div className="flex flex-col gap-2 flex-1">
      <label
        htmlFor={sortFilterId}
        className="text-sm font-semibold text-gray-700 dark:text-gray-200"
      >
        Ordenar por
      </label>

      <select
        id={sortFilterId}
        onChange={handleChangeSort}
        value={filters.sort}
        className="
          px-3 py-2
          rounded-xl
          border border-gray-300
          dark:border-gray-600
          bg-white dark:bg-gray-700
          focus:outline-none
          focus:ring-2 focus:ring-primary
          transition
        "
      >
        <option value="default">Por defecto</option>
        <option value="name-asc">Nombre (A-Z)</option>
        <option value="name-desc">Nombre (Z-A)</option>
        <option value="price-asc">Precio (Menor a Mayor)</option>
        <option value="price-desc">Precio (Mayor a Menor)</option>
      </select>
    </div>
  </section>
)
}
