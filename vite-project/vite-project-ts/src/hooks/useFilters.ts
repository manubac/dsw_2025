import { useContext } from 'react'
import { FiltersContext } from '../context/filters'

export function useFilters () {
  const context = useContext(FiltersContext)

  if (context === null) {
    throw new Error('useFilters must be used within a FiltersProvider')
  }

  const { filters, setFilters } = context

  const filterProducts = (products: any[]) => {
    return products.filter(product => {
      return (
        product.price >= filters.minPrice &&
        (
          filters.category === 'all' ||
          product.category === filters.category
        ) &&
        (
          !filters.query || product.title.toLowerCase().includes(filters.query.toLowerCase()) || product.description.toLowerCase().includes(filters.query.toLowerCase())
        )
      )
    })
  }

  return { filters, filterProducts, setFilters }
}
