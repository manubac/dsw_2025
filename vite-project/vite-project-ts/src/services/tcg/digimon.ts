import type { ExternalCard, RarityVariant, SearchOptions, SearchResult } from './types';

// Proxy a través del backend para evitar CORS con apitcg.com
const BASE = '/api/tcg/digimon';
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
    id: `digimon_${card.id ?? card.code}`,
    game: 'digimon',
    name: card.name,
    language: 'en',
    set: card.set?.id ?? '',
    setName: card.set?.name ?? '',
    number: card.code ?? '',
    rarity: card.rarity ?? card.cardType ?? undefined,
    imageUrl: card.images?.small,
  };
}

export async function searchDigimon(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { page = 1 } = options;
  const r = await apiFetch(
    `${BASE}/cards?name=${encodeURIComponent(query.trim())}&page=${page}&limit=${PAGE_SIZE}`
  );
  if (!r.ok) throw new Error(`Digimon API: ${r.status}`);
  const data = await r.json();
  return {
    cards: (data.data ?? []).map(toCard),
    hasMore: (data.page ?? 1) < (data.totalPages ?? 1),
    total: data.total,
  };
}

export async function getDigimonRarities(name: string): Promise<RarityVariant[]> {
  const r = await apiFetch(
    `${BASE}/cards?name=${encodeURIComponent(name)}&limit=100`
  );
  if (!r.ok) throw new Error(`Digimon API: ${r.status}`);
  const data = await r.json();
  const all: any[] = data.data ?? [];

  // Filtra por coincidencia exacta de nombre, si hay; si no, devuelve todos
  const nameLower = name.toLowerCase();
  const exact = all.filter(c => c.name?.toLowerCase() === nameLower);
  const cards = exact.length > 0 ? exact : all;

  return cards.map(c => ({
    cardId: c.id ?? c.code,
    rarity: c.rarity ?? c.cardType ?? c.form ?? undefined,
    number: c.code,
    imageUrl: c.images?.small,
    setName: c.set?.name,
  }));
}

export async function resolveDigimon(idOrName: string, byName = false): Promise<ExternalCard | null> {
  if (byName) {
    const r = await apiFetch(`${BASE}/cards?name=${encodeURIComponent(idOrName)}&limit=5`);
    if (!r.ok) return null;
    const data = await r.json();
    const card = data.data?.[0];
    return card ? toCard(card) : null;
  }

  // Resolución por código (ej: BT1-009): buscar por nombre y filtrar por code exacto
  try {
    const r = await apiFetch(`${BASE}/cards?name=${encodeURIComponent(idOrName)}&limit=10`);
    if (r.ok) {
      const data = await r.json();
      const match = (data.data ?? []).find(
        (c: any) => c.code === idOrName || c.id === idOrName
      );
      if (match) return toCard(match);
    }
  } catch { /* ignore */ }
  return null;
}
