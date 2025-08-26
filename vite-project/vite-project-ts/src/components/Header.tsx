import { Filters } from './Filters'

export function Header({ changeFilters }: { changeFilters: any }) {
  return (
    <header>
      <h1>Pokémon TCG Store (TS copy)</h1>
      <Filters onChange={changeFilters} />
    </header>
  )
}
