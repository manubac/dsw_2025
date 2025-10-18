import { useId, useContext } from 'react'
import { FiltersContext } from '../context/filters'
import './Filters.css'

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
    <section className='filters'>
      <div>
        <label htmlFor={minPriceFilterId}>Precio a partir de:</label>
        <input type="range" id={minPriceFilterId} min="0" max="1000" step="10" onChange={handleChangeMinPrice} value={filters.minPrice} />
        <span>${filters.minPrice}</span>
      </div>
      <div>
        <label htmlFor={categoryFilterId}>Categoria</label>
        <select id={categoryFilterId} onChange={handleChangeCategory} value={filters.category}>
          <option value="all">All Categories</option>
          <option value="trading-cards">Trading Cards</option>
          <option value="booster-packs">Booster Packs</option>
        </select>
      </div>
      <div>
        <label htmlFor={sortFilterId}>Sort by</label>
        <select id={sortFilterId} onChange={handleChangeSort} value={filters.sort}>
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
