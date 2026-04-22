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

// Número base: parte antes del primer _ (ej: "030_ALT" → "030")
function baseCode(code: string): string {
  return code.split('_')[0];
}

function toCard(card: any): ExternalCard {
  const setId = card.set?.id ?? '';
  const base = baseCode(card.code ?? card.number ?? '');
  return {
    id: `riftbound_${setId}_${base}`,
    game: 'riftbound',
    name: card.name,
    language: 'en',
    set: setId,
    setName: card.set?.name ?? '',
    number: base,
    rarity: card.rarity ?? undefined,
    imageUrl: card.images?.small,
  };
}

export async function searchRiftbound(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { page = 1 } = options;
  const r = await apiFetch(
    `${BASE}?name=${encodeURIComponent(query.trim())}&page=${page}&limit=${PAGE_SIZE}`
  );
  if (!r.ok) throw new Error(`Riftbound API: ${r.status}`);
  const data = await r.json();

  // Deduplicar por id (colapsa variantes del mismo set+número base)
  const seen = new Set<string>();
  const cards: ExternalCard[] = [];
  for (const c of (data.data ?? []).map(toCard)) {
    if (!seen.has(c.id)) { seen.add(c.id); cards.push(c); }
  }
  return {
    cards,
    hasMore: (data.page ?? 1) < (data.totalPages ?? 1),
    total: data.total,
  };
}

export async function getRiftboundRarities(name: string, setId?: string, number?: string): Promise<RarityVariant[]> {
  const r = await apiFetch(
    `${BASE}?name=${encodeURIComponent(name)}&limit=100`
  );
  if (!r.ok) throw new Error(`Riftbound API: ${r.status}`);
  const data = await r.json();
  const all: any[] = data.data ?? [];

  let cards: any[];
  if (setId && number) {
    // Variantes del mismo set + número base exacto
    cards = all.filter(c => c.set?.id === setId && baseCode(c.code ?? c.number ?? '') === number);
    if (cards.length === 0) cards = all;
  } else {
    const normalize = (s: string) =>
      s.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[-–]/g, ' ').replace(/\s+/g, ' ').trim();
    const baseName = normalize(name);
    const exact = all.filter(c => normalize(c.cleanName ?? c.name) === baseName);
    cards = exact.length > 0 ? exact : all;
  }

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
      `${BASE}?name=${encodeURIComponent(params.name)}&limit=5`
    );
    if (r.ok) {
      const data = await r.json();
      const card = data.data?.[0];
      if (card) return toCard(card);
    }
  } catch { /* ignore */ }
  return null;
}
