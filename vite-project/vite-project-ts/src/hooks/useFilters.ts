import { useContext } from 'react'
import { FiltersContext } from '../context/filters'

export function useFilters() {
  const context = useContext(FiltersContext)

  if (context === null) {
    throw new Error('useFilters must be used within a FiltersProvider')
  }

  const { filters, setFilters } = context

  const filterProducts = (products: any[]) => {
    let filteredProducts = products.filter(product => {
      const matchesPrice = product.price >= filters.minPrice
      const matchesCategory =
        filters.category === 'all' || product.category === filters.category
      const matchesQuery =
        !filters.query ||
        product.title.toLowerCase().includes(filters.query.toLowerCase()) ||
        product.description.toLowerCase().includes(filters.query.toLowerCase())

      return matchesPrice && matchesCategory && matchesQuery
    })

    if (filters.sort === 'name-asc') {
      filteredProducts = filteredProducts.sort((a, b) => a.title.localeCompare(b.title))
    } else if (filters.sort === 'name-desc') {
      filteredProducts = filteredProducts.sort((a, b) => b.title.localeCompare(a.title))
    } else if (filters.sort === 'price-asc') {
      filteredProducts = filteredProducts.sort((a, b) => a.price - b.price)
    } else if (filters.sort === 'price-desc') {
      filteredProducts = filteredProducts.sort((a, b) => b.price - a.price)
    }

    return filteredProducts
  }

  return { filters, setFilters, filterProducts }
}
