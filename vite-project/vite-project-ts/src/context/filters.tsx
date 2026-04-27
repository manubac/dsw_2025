import React, { createContext, useState } from 'react'

export const FiltersContext = createContext<any>(null)

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState(() => {
    const stored = localStorage.getItem('user')
    const userData = stored ? JSON.parse(stored) : null
    const defaultCity = userData?.direcciones?.[0]?.ciudad ?? 'all'
    return {
      city: defaultCity,
      minPrice: 0,
      maxPrice: 999999,
      query: '',
      sort: 'default',
      queryAliases: [] as string[],
      game: 'pokemon',
      collection: 'all',
      rarity: 'all',
    }
  })
  return (
    <FiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </FiltersContext.Provider>
  )
}
