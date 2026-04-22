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

// Número base: strip de sufijos de variante paralela
// Ej: "BT1-009_P1" → "BT1-009", "ST17-02-p1" → "ST17-02"
// NO toca códigos de promo como "ST1-P001" (3 dígitos) ni letras parte del número
function baseCode(code: string): string {
  return code.replace(/-[Pp]\d$/, '').split('_')[0];
}

function toCard(card: any): ExternalCard {
  const setId = card.set?.id ?? '';
  const base = baseCode(card.code ?? '');
  return {
    id: `digimon_${setId}_${base}`,
    game: 'digimon',
    name: card.name,
    language: 'en',
    set: setId,
    setName: card.set?.name ?? '',
    number: base,
    rarity: card.rarity ?? card.cardType ?? undefined,
    imageUrl: card.images?.small,
  };
}

export async function searchDigimon(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  const { page = 1 } = options;
  const r = await apiFetch(
    `${BASE}?name=${encodeURIComponent(query.trim())}&page=${page}&limit=${PAGE_SIZE}`
  );
  if (!r.ok) throw new Error(`Digimon API: ${r.status}`);
  const data = await r.json();

  // Deduplicar por id (colapsa promos del mismo set+número base)
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

export async function getDigimonRarities(name: string, setId?: string, number?: string): Promise<RarityVariant[]> {
  const r = await apiFetch(
    `${BASE}?name=${encodeURIComponent(name)}&limit=100`
  );
  if (!r.ok) throw new Error(`Digimon API: ${r.status}`);
  const data = await r.json();
  const all: any[] = data.data ?? [];

  let cards: any[];
  if (setId && number) {
    // Variantes del mismo set + número base exacto
    cards = all.filter(c => c.set?.id === setId && baseCode(c.code ?? '') === number);
    if (cards.length === 0) cards = all;
  } else {
    const nameLower = name.toLowerCase();
    const exact = all.filter(c => c.name?.toLowerCase() === nameLower);
    cards = exact.length > 0 ? exact : all;
  }

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
    const r = await apiFetch(`${BASE}?name=${encodeURIComponent(idOrName)}&limit=5`);
    if (!r.ok) return null;
    const data = await r.json();
    const card = data.data?.[0];
    return card ? toCard(card) : null;
  }

  // Resolución por código (ej: BT1-009): buscar por nombre y filtrar por code exacto
  try {
    const r = await apiFetch(`${BASE}?name=${encodeURIComponent(idOrName)}&limit=10`);
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
