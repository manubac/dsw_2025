import type { ExternalCard, RarityVariant, SearchOptions, SearchResult } from './types';

// Proxy a través del backend para evitar CORS con apitcg.com
const BASE = '/api/tcg/riftbound';
const PAGE_SIZE = 20;
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
    id: `riftbound_${card.id}`,
    game: 'riftbound',
    name: card.name,
    language: 'en',
    set: card.set?.id ?? '',
    setName: card.set?.name ?? '',
    number: card.code ?? card.number ?? '',
    rarity: card.rarity ?? undefined,
    imageUrl: card.images?.small,
  };
}

export async function searchRiftbound(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { page = 1 } = options;
  const r = await apiFetch(
    `${BASE}/cards?name=${encodeURIComponent(query.trim())}&page=${page}&limit=${PAGE_SIZE}`
  );
  if (!r.ok) throw new Error(`Riftbound API: ${r.status}`);
  const data = await r.json();
  return {
    cards: (data.data ?? []).map(toCard),
    hasMore: (data.page ?? 1) < (data.totalPages ?? 1),
    total: data.total,
  };
}

export async function getRiftboundRarities(name: string): Promise<RarityVariant[]> {
  const r = await apiFetch(
    `${BASE}/cards?name=${encodeURIComponent(name)}&limit=100`
  );
  if (!r.ok) throw new Error(`Riftbound API: ${r.status}`);
  const data = await r.json();
  const all: any[] = data.data ?? [];

  // Normaliza el cleanName del input (strip guiones/paréntesis/sufijos de arte)
  const normalize = (s: string) =>
    s.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
  const baseName = normalize(name);

  // Prioriza coincidencias exactas de cleanName, si no hay toma todos
  const exact = all.filter(c => normalize(c.cleanName ?? c.name) === baseName);
  const cards = exact.length > 0 ? exact : all;

  return cards.map(c => ({
    cardId: c.id,
    rarity: c.rarity ?? c.cardType ?? 'Unknown',
    number: c.code ?? c.number,
    imageUrl: c.images?.small,
    setName: c.set?.name,
  }));
}

export async function resolveRiftbound(params: {
  name?: string;
}): Promise<ExternalCard | null> {
  if (!params.name) return null;
  try {
    const r = await apiFetch(
      `${BASE}/cards?name=${encodeURIComponent(params.name)}&limit=5`
    );
    if (r.ok) {
      const data = await r.json();
      const card = data.data?.[0];
      if (card) return toCard(card);
    }
  } catch { /* ignore */ }
  return null;
}
