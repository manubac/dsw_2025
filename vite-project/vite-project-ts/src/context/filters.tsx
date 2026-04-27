import React, { createContext, useState } from 'react'

export const FiltersContext = createContext<any>(null)

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFilters] = useState({ city: 'all', minPrice: 0, query: '', sort: 'default', queryAliases: [] as string[] })
  return (
    <FiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </FiltersContext.Provider>
  )
}
