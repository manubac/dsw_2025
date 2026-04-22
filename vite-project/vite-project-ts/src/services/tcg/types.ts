export type GameSlug = 'pokemon' | 'mtg' | 'ygo' | 'digimon' | 'riftbound';

// Idiomas soportados: solo no-asiáticos
export const SUPPORTED_LANGS = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru'] as const;
export type SupportedLang = typeof SUPPORTED_LANGS[number];

export interface ExternalCard {
  id: string;        // "<game>_<origin_id>"
  game: GameSlug;
  name: string;
  language: string;
  set: string;       // código del set
  setName: string;
  number: string;    // número de carta en el set
  rarity?: string;
  imageUrl?: string; // solo para display, NO se guarda en BD
}

export interface RarityVariant {
  cardId: string;
  rarity?: string;
  number?: string;
  imageUrl?: string; // solo para display, NO se guarda en BD
  finish?: string;
  setName?: string;
}

export interface SearchOptions {
  lang?: string;
  set?: string;
  page?: number;
}

export interface SearchResult {
  cards: ExternalCard[];
  hasMore: boolean;
  total?: number;
}
