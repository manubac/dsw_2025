import { useId, useContext } from 'react'
import { FiltersContext } from '../context/filters'
import './Filters.css'

export function ProductFilters() {
  const { filters, setFilters } = useContext(FiltersContext)
  const minPriceFilterId = useId()
  const categoryFilterId = useId()

  const handleChangeMinPrice = (event: any) => {
    setFilters((prev: any) => ({ ...prev, minPrice: Number(event.target.value) }))
  }

  const handleChangeCategory = (event: any) => {
    setFilters((prev: any) => ({ ...prev, category: event.target.value }))
  }

  return (
    <section className='filters product-filters'>
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
    </section>
  )
}
