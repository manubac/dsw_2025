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
      const matchesCity =
        filters.city === 'all' ||
        (product.intermediarios || []).some(
          (i: any) => i.direccion?.ciudad === filters.city
        )
      const titleLower = product.title.toLowerCase();
      const queryLower = filters.query.toLowerCase();
      const matchesQuery =
        !filters.query ||
        titleLower.includes(queryLower) ||
        (product.description || '').toLowerCase().includes(queryLower) ||
        ((filters.queryAliases as string[]) || []).some(alias =>
          titleLower.includes(alias.toLowerCase())
        )

      return matchesPrice && matchesCity && matchesQuery
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
