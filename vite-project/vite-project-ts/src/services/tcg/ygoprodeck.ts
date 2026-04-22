import type { ExternalCard, RarityVariant, SearchOptions, SearchResult } from './types';

const BASE = 'https://db.ygoprodeck.com/api/v7';
const PAGE_SIZE = 8;
const TIMEOUT = 8000;

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
    id: `ygo_${card.id}`,
    game: 'ygo',
    name: card.name,
    language: 'en',
    set: card.card_sets?.[0]?.set_code ?? '',
    setName: card.card_sets?.[0]?.set_name ?? '',
    number: card.card_sets?.[0]?.set_num ?? '',
    rarity: card.card_sets?.[0]?.set_rarity ?? card.type,
    imageUrl: card.card_images?.[0]?.image_url,
  };
}

export async function searchYgo(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { page = 1 } = options;
  const offset = (page - 1) * PAGE_SIZE;
  const r = await apiFetch(
    `${BASE}/cardinfo.php?fname=${encodeURIComponent(query)}&num=${PAGE_SIZE}&offset=${offset}`
  );
  if (r.status === 400) return { cards: [], hasMore: false };
  if (!r.ok) throw new Error(`YGOPRODeck API: ${r.status}`);
  const data = await r.json();
  const meta = data.meta;
  return {
    cards: (data.data ?? []).map(toCard),
    hasMore: meta ? offset + PAGE_SIZE < meta.total_rows : false,
    total: meta?.total_rows,
  };
}

export async function getYgoRarities(name: string, setName?: string): Promise<RarityVariant[]> {
  const r = await apiFetch(`${BASE}/cardinfo.php?name=${encodeURIComponent(name)}`);
  if (r.status === 400) return [];
  if (!r.ok) throw new Error(`YGOPRODeck API: ${r.status}`);
  const data = await r.json();
  const card = data.data?.[0];
  if (!card) return [];
  const sets: any[] = card.card_sets ?? [];
  const filtered = setName
    ? sets.filter(s => s.set_name.toLowerCase().includes(setName.toLowerCase()))
    : sets;
  return filtered.map(s => ({
    cardId: `${card.id}-${s.set_num}`,
    rarity: s.set_rarity,
    number: s.set_num,
    imageUrl: card.card_images?.[0]?.image_url_small,
    setName: s.set_name,
  }));
}

export async function resolveYgo(passcode: string): Promise<ExternalCard | null> {
  const r = await apiFetch(`${BASE}/cardinfo.php?id=${encodeURIComponent(passcode)}`);
  if (!r.ok) return null;
  const data = await r.json();
  const card = data.data?.[0];
  return card ? toCard(card) : null;
}
