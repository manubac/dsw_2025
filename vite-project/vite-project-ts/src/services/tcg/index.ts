import type { GameSlug, ExternalCard, RarityVariant, SearchOptions, SearchResult } from './types';
import { searchPokemon, getPokemonRarities, resolvePokemon } from './pokemon';
import { searchMtg, getMtgRarities, resolveMtg } from './scryfall';
import { searchYgo, getYgoRarities, resolveYgo } from './ygoprodeck';
import { searchDigimon, getDigimonRarities, resolveDigimon } from './digimon';
import { searchRiftbound, getRiftboundRarities, resolveRiftbound } from './riftbound';

export type { GameSlug, ExternalCard, RarityVariant, SearchOptions, SearchResult };

export async function searchCards(
  game: GameSlug,
  query: string,
  options?: SearchOptions
): Promise<SearchResult> {
  switch (game) {
    case 'pokemon':   return searchPokemon(query, options);
    case 'mtg':       return searchMtg(query, options);
    case 'ygo':       return searchYgo(query, options);
    case 'digimon':   return searchDigimon(query, options);
    case 'riftbound': return searchRiftbound(query, options);
  }
}

export async function getCardRarities(
  game: GameSlug,
  name: string,
  setName?: string,
  setId?: string,
  number?: string
): Promise<RarityVariant[]> {
  switch (game) {
    case 'pokemon':   return getPokemonRarities(name, setName);
    case 'mtg':       return getMtgRarities(name, setName);
    case 'ygo':       return getYgoRarities(name, setName);
    case 'digimon':   return getDigimonRarities(name, setId, number);
    case 'riftbound': return getRiftboundRarities(name, setId, number);
  }
}

export async function resolveCard(
  game: GameSlug,
  params: { set?: string; number?: string; passcode?: string; id?: string; name?: string }
): Promise<ExternalCard | ExternalCard[] | null> {
  switch (game) {
    case 'pokemon':
      if (!params.set || !params.number) return null;
      return resolvePokemon(params.set, params.number, params.name);
    case 'mtg':
      if (!params.set || !params.number) return null;
      return resolveMtg(params.set, params.number);
    case 'ygo':
      if (!params.passcode) return null;
      return resolveYgo(params.passcode);
    case 'digimon':
      if (params.id)   return resolveDigimon(params.id, false);
      if (params.name) return resolveDigimon(params.name, true);
      return null;
    case 'riftbound':
      return resolveRiftbound({ name: params.name });
  }
}
