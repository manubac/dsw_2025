import type { NavigateFunction } from 'react-router-dom'

export interface CardGroup {
  groupKey: string
  name: string
  setName: string
  setCode: string | null
  cardNumber: string | null
  rarity: string | null
  thumbnail: string | null
  publications: any[]
  allCities: string[]
}

export function filterCartasByGame(cartas: any[], game: string): any[] {
  return cartas.filter(c => {
    const name = c.cartaClass?.name?.toLowerCase()
    if (name === game) return true
    if (!c.cartaClass && game === 'pokemon') return true
    return false
  })
}

export function buildCardGroups(cartas: any[]): CardGroup[] {
  const groupMap = new Map<string, CardGroup>()

  for (const carta of cartas) {
    const setCode = carta.setCode || null
    const cardNumber = carta.cardNumber || null
    const rarity = carta.rarity || null
    const name = carta.title || carta.name || ''

    const keyBase = setCode && cardNumber
      ? `${setCode.toLowerCase()}-${cardNumber.toLowerCase()}`
      : name.toLowerCase()
    const groupKey = `${keyBase}-${(rarity || '').toLowerCase()}`

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        groupKey,
        name,
        setName: carta.set || 'Unknown Set',
        setCode,
        cardNumber,
        rarity,
        thumbnail: carta.thumbnail || null,
        publications: [],
        allCities: [],
      })
    }

    const group = groupMap.get(groupKey)!
    group.publications.push(carta)
    if (!group.thumbnail && carta.thumbnail) group.thumbnail = carta.thumbnail

    const citiesFromThis: string[] = (carta.intermediarios || [])
      .map((i: any) => i.direccion?.ciudad)
      .filter(Boolean)
    for (const city of citiesFromThis) {
      if (!group.allCities.includes(city)) group.allCities.push(city)
    }
  }

  return Array.from(groupMap.values())
}

export function buildCardIdToGroup(groups: CardGroup[]): Map<number, CardGroup> {
  const map = new Map<number, CardGroup>()
  for (const group of groups) {
    for (const pub of group.publications) {
      map.set(pub.id, group)
    }
  }
  return map
}

export function navigateToGroup(
  navigate: NavigateFunction,
  group: CardGroup,
  activeCity: string,
  publicationIds?: number[]
): void {
  if (publicationIds !== undefined) {
    navigate('/group', {
      state: {
        group: {
          name: group.name,
          setName: group.setName,
          setCode: group.setCode,
          cardNumber: group.cardNumber,
          rarity: group.rarity,
          thumbnail: group.thumbnail,
        },
        publications: [],
        bundles: [],
        activeCity,
        needsFetch: true,
        publicationIds,
      },
    })
  } else {
    navigate('/group', {
      state: {
        group: {
          name: group.name,
          setName: group.setName,
          setCode: group.setCode,
          cardNumber: group.cardNumber,
          rarity: group.rarity,
          thumbnail: group.thumbnail,
        },
        publications: group.publications,
        bundles: [],
        activeCity,
      },
    })
  }
}
