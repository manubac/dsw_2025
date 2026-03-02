import { useId, useContext } from 'react'
import { FiltersContext } from '../context/filters'


export function Filters ({ onChange }: { onChange: any }) {
  const { filters, setFilters } = useContext(FiltersContext)
  const minPriceFilterId = useId()
  const categoryFilterId = useId()
  const sortFilterId = useId()

  const handleChangeMinPrice = (event: any) => {
    onChange((prev: any) => ({ ...prev, minPrice: Number(event.target.value) }))
  }

  const handleChangeCategory = (event: any) => {
    onChange((prev: any) => ({ ...prev, category: event.target.value }))
  }

  const handleChangeSort = (event: any) => {
    onChange((prev: any) => ({ ...prev, sort: event.target.value }))
  }

return (
  <section
    className="
      w-full
      bg-orange-50
      dark:bg-gray-800
      rounded-2xl
      shadow-md
      p-6
      mb-8
      flex flex-col md:flex-row
      gap-6
      md:items-end
      justify-between
      border border-orange-200
    "
  >
    {/* PRECIO */}
    <div className="flex flex-col gap-2 flex-1">
      <label
        htmlFor={minPriceFilterId}
        className="text-sm font-semibold text-orange-700"
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
        className="w-full accent-orange-500 cursor-pointer"
      />

      <span className="text-orange-600 font-bold">
        ${filters.minPrice}
      </span>
    </div>

    {/* CATEGORIA */}
    <div className="flex flex-col gap-2 flex-1">
      <label
        htmlFor={categoryFilterId}
        className="text-sm font-semibold text-orange-700"
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
          border border-orange-200
          bg-white
          focus:outline-none
          focus:ring-2 focus:ring-orange-400
          hover:border-orange-400
          hover:bg-orange-100
          transition
        "
      >
        <option value="all">All Categories</option>
        <option value="trading-cards">Trading Cards</option>
        <option value="booster-packs">Booster Packs</option>
      </select>
    </div>

    {/* SORT */}
    <div className="flex flex-col gap-2 flex-1">
      <label
        htmlFor={sortFilterId}
        className="text-sm font-semibold text-orange-700"
      >
        Sort by
      </label>

      <select
        id={sortFilterId}
        onChange={handleChangeSort}
        value={filters.sort}
        className="
          px-3 py-2
          rounded-xl
          border border-orange-200
          bg-white
          focus:outline-none
          focus:ring-2 focus:ring-orange-400
          hover:border-orange-400
          hover:bg-orange-100
          transition
        "
      >
        <option value="default">Default</option>
        <option value="name-asc">Name (A-Z)</option>
        <option value="name-desc">Name (Z-A)</option>
        <option value="price-asc">Price (Low to High)</option>
        <option value="price-desc">Price (High to Low)</option>
      </select>
    </div>
  </section>
)
}
