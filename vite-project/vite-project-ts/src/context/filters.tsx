import React, { createContext, useState } from 'react'

export const FiltersContext = createContext<any>(null)

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState({ category: 'all', minPrice: 0, query: '', sort: 'default' })
  return (
    <FiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </FiltersContext.Provider>
  )
}
