import type { ExternalCard, RarityVariant, SearchOptions, SearchResult } from './types';

const BASE = 'https://api.scryfall.com';
const TIMEOUT = 8000;
const ASIAN_LANGS = new Set(['ja', 'ko', 'zhs', 'zht']);

async function apiFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function toCard(card: any): ExternalCard {
  return {
    id: `mtg_${card.id}`,
    game: 'mtg',
    name: card.name,
    language: card.lang ?? 'en',
    set: card.set ?? '',
    setName: card.set_name ?? '',
    number: card.collector_number ?? '',
    rarity: card.rarity,
    imageUrl: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal,
  };
}

export async function searchMtg(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { lang = 'en', page = 1 } = options;
  const langFilter = ASIAN_LANGS.has(lang) ? 'en' : lang;
  const q = `${query} lang:${langFilter}`;
  const r = await apiFetch(
    `${BASE}/cards/search?q=${encodeURIComponent(q)}&unique=cards&page=${page}`
  );
  if (r.status === 404) return { cards: [], hasMore: false };
  if (!r.ok) throw new Error(`Scryfall API: ${r.status}`);
  const data = await r.json();
  return {
    cards: (data.data ?? []).map(toCard),
    hasMore: data.has_more ?? false,
    total: data.total_cards,
  };
}

export async function getMtgRarities(name: string, setName?: string): Promise<RarityVariant[]> {
  let q = `!"${name}"`;
  if (setName) q += ` s:"${setName}"`;
  const r = await apiFetch(
    `${BASE}/cards/search?q=${encodeURIComponent(q)}&unique=prints&page=1`
  );
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`Scryfall API: ${r.status}`);
  const data = await r.json();
  return (data.data ?? [])
    .filter((c: any) => !ASIAN_LANGS.has(c.lang))
    .map((c: any) => ({
      cardId: c.id,
      rarity: c.rarity,
      number: c.collector_number,
      imageUrl: c.image_uris?.small ?? c.card_faces?.[0]?.image_uris?.small,
      finish: c.finishes?.join(', '),
      setName: c.set_name,
    }));
}

export async function resolveMtg(setCode: string, number: string): Promise<ExternalCard | null> {
  const r = await apiFetch(`${BASE}/cards/${setCode.toLowerCase()}/${number}`);
  if (!r.ok) return null;
  return toCard(await r.json());
}
