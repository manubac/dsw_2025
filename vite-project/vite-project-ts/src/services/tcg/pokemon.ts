import type { ExternalCard, RarityVariant, SearchOptions, SearchResult } from './types';

const BASE = 'https://api.tcgdex.net/v2';
const PAGE_SIZE = 20;
const MAX_DETAIL_CALLS = 30;
const MAX_CONCURRENCY = 5;
const TIMEOUT = 8000;

const RAREZAS_CON_REVERSE = new Set([
  'common', 'uncommon', 'rare', 'rare holo',
  'rare holo v', 'rare holo vmax', 'rare holo vstar',
]);

const setNameCache = new Map<string, string>();
let setsLoaded = false;

// Mapeo sigla TCG Live (ej: "TWM") → ID interno TCGdex (ej: "sv6")
const setAbbrCache = new Map<string, string>();
let setAbbrLoaded = false;

async function loadSetAbbrMapping(): Promise<void> {
  if (setAbbrLoaded) return;
  try {
    const r = await fetch('/api/tcg/pokemon/sets');
    if (r.ok) {
      const rows: Array<{ id: string; abbr: string }> = await r.json();
      for (const row of rows) {
        if (row.abbr) setAbbrCache.set(row.abbr.toUpperCase(), row.id);
      }
      setAbbrLoaded = true;
    }
  } catch { /* silently fail */ }
}

async function apiFetch(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function imageUrl(base?: string): string | undefined {
  return base ? `${base}/low.webp` : undefined;
}

function setIdFromCardId(id: string): string {
  const parts = id.split('-');
  parts.pop();
  return parts.join('-');
}

async function loadSets(lang = 'en'): Promise<void> {
  if (setsLoaded) return;
  try {
    const r = await apiFetch(`${BASE}/${lang}/sets`);
    if (r.ok) {
      const data: Array<{ id: string; name: string }> = await r.json();
      for (const s of data) setNameCache.set(s.id, s.name);
      setsLoaded = true;
    }
  } catch { /* silently fail */ }
}

async function fetchCardDetail(lang: string, cardId: string): Promise<any> {
  try {
    const r = await apiFetch(`${BASE}/${lang}/cards/${cardId}`);
    if (r.ok) return await r.json();
  } catch { /* ignore */ }
  return null;
}

async function concurrentMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function toCard(summary: any, lang: string): ExternalCard {
  const setId = setIdFromCardId(summary.id);
  return {
    id: `pokemon_${summary.id}`,
    game: 'pokemon',
    name: summary.name,
    language: lang,
    set: setId,
    setName: setNameCache.get(setId) ?? setId,
    number: summary.localId ?? '',
    rarity: summary.rarity,
    imageUrl: imageUrl(summary.image),
  };
}

function toCardFromDetail(detail: any, lang: string): ExternalCard {
  const setId = detail.set?.id ?? setIdFromCardId(detail.id);
  return {
    id: `pokemon_${detail.id}`,
    game: 'pokemon',
    name: detail.name,
    language: lang,
    set: setId,
    setName: detail.set?.name ?? setNameCache.get(setId) ?? setId,
    number: detail.localId ?? '',
    rarity: detail.rarity,
    imageUrl: imageUrl(detail.image),
  };
}

export async function searchPokemon(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  const lang = options.lang ?? 'en';
  await loadSets(lang);

  const r = await apiFetch(
    `${BASE}/${lang}/cards?name=${encodeURIComponent(query.trim())}`
  );
  if (!r.ok) throw new Error(`TCGDex API: ${r.status}`);
  const data: any[] = await r.json();

  const page = options.page ?? 1;
  const start = (page - 1) * PAGE_SIZE;
  const slice = data.slice(start, start + PAGE_SIZE);

  return {
    cards: slice.map(c => toCard(c, lang)),
    hasMore: start + PAGE_SIZE < data.length,
    total: data.length,
  };
}

export async function getPokemonRarities(
  name: string,
  setName?: string
): Promise<RarityVariant[]> {
  await loadSets();

  let setId: string | undefined;
  if (setName) {
    for (const [id, sn] of setNameCache) {
      if (sn.toLowerCase().includes(setName.toLowerCase())) {
        setId = id;
        break;
      }
    }
  }

  const base = `${BASE}/en/cards?name=${encodeURIComponent(name)}`;
  const url = setId ? `${base}&set.id=${setId}` : base;
  const r = await apiFetch(url);
  if (!r.ok) throw new Error(`TCGDex API: ${r.status}`);
  const summaries: any[] = await r.json();

  const matching = summaries
    .filter(c => c.name.toLowerCase() === name.toLowerCase())
    .slice(0, MAX_DETAIL_CALLS);

  const details = await concurrentMap(
    matching,
    c => fetchCardDetail('en', c.id),
    MAX_CONCURRENCY
  );

  const variants: RarityVariant[] = [];
  const reversas: RarityVariant[] = [];

  for (const detail of details) {
    if (!detail) continue;
    const sid = detail.set?.id ?? setIdFromCardId(detail.id);
    const sName = detail.set?.name ?? setNameCache.get(sid) ?? sid;
    variants.push({
      cardId: detail.id,
      rarity: detail.rarity ?? 'Desconocida',
      number: detail.localId,
      imageUrl: imageUrl(detail.image),
      setName: sName,
    });
    if (RAREZAS_CON_REVERSE.has((detail.rarity ?? '').toLowerCase())) {
      reversas.push({
        cardId: `${detail.id}-reverse`,
        rarity: 'Reverse Holo',
        number: detail.localId,
        imageUrl: imageUrl(detail.image),
        setName: sName,
      });
    }
  }

  return [...variants, ...reversas];
}

export async function resolvePokemon(
  setCode: string,
  number: string,
  nameHint?: string
): Promise<ExternalCard | ExternalCard[] | null> {
  await loadSets();
  await loadSetAbbrMapping();

  // Traduce sigla TCG Live (ej: TWM) → ID TCGdex (ej: sv6)
  const tcgdexId = setAbbrCache.get(setCode.toUpperCase()) ?? setCode;

  // Algunos sets usan zero-padding en el número (ej: 35 → 035)
  const numInt = parseInt(number, 10);
  const numberFmts: string[] = [number];
  if (!isNaN(numInt) && numInt < 100) {
    const padded = String(numInt).padStart(3, '0');
    if (padded !== number) numberFmts.push(padded);
  }

  // 1. Fetch directo con el ID de TCGdex mapeado + variantes de número
  for (const num of numberFmts) {
    const detail = await fetchCardDetail('en', `${tcgdexId}-${num}`);
    if (detail) return toCardFromDetail(detail, 'en');
  }

  // 2. Fetch directo con el código original (para sets no mapeados o ya correctos)
  if (tcgdexId !== setCode) {
    for (const num of numberFmts) {
      const detail = await fetchCardDetail('en', `${setCode}-${num}`);
      if (detail) return toCardFromDetail(detail, 'en');
    }
  }

  // 3. Fetch con el código en minúsculas (TCGdex usa IDs en minúsculas; útil para sets nuevos no mapeados)
  const setCodeLower = setCode.toLowerCase();
  if (!setAbbrCache.has(setCode.toUpperCase()) && setCodeLower !== setCode) {
    for (const num of numberFmts) {
      const detail = await fetchCardDetail('en', `${setCodeLower}-${num}`);
      if (detail) return toCardFromDetail(detail, 'en');
    }
  }

  // 4. Búsqueda por nombre + número con filtro por set y normalización de formato
  if (nameHint) {
    try {
      // Comparación por número tolerando distinto zero-padding
      const matchesNumber = (localId: string): boolean => {
        if (numberFmts.includes(localId)) return true;
        if (!isNaN(numInt)) {
          const n = parseInt(localId, 10);
          return !isNaN(n) && n === numInt;
        }
        return false;
      };

      // Si tenemos un mapeo de DB, buscar filtrado por set en TCGdex para mayor precisión
      const hasMappedId = setAbbrCache.has(setCode.toUpperCase());
      const baseUrl = `${BASE}/en/cards?name=${encodeURIComponent(nameHint)}`;

      let summaries: any[] = [];
      let usedSetFilter = false;
      if (hasMappedId) {
        const r = await apiFetch(`${baseUrl}&set.id=${tcgdexId}`);
        if (r.ok) summaries = await r.json();
        if (summaries.length > 0) usedSetFilter = true;
      }
      // Si no hay mapeo, o el mapeo era incorrecto (0 resultados), buscar sin filtro de set
      if (summaries.length === 0) {
        const r = await apiFetch(baseUrl);
        if (r.ok) summaries = await r.json();
      }

      if (summaries.length > 0) {
        let matched = summaries.filter(c => matchesNumber(c.localId));

        // Si no se filtró por set, intentar acotar por set ID cuando hay varios resultados
        if (!usedSetFilter && matched.length > 1) {
          const fromSet = matched.filter(c =>
            setIdFromCardId(c.id).toLowerCase() === setCode.toLowerCase()
          );
          if (fromSet.length > 0) matched = fromSet;
        }

        if (matched.length === 1) {
          const d = await fetchCardDetail('en', matched[0].id);
          if (d) return toCardFromDetail(d, 'en');
        }
        if (matched.length > 1) {
          const ds = await concurrentMap(
            matched.slice(0, 10),
            c => fetchCardDetail('en', c.id),
            MAX_CONCURRENCY
          );
          const valid = ds.filter(Boolean);
          if (valid.length === 1) return toCardFromDetail(valid[0], 'en');
          if (valid.length > 1) return valid.map(d => toCardFromDetail(d, 'en'));
        }
      }
    } catch { /* silently fail */ }
  }

  return null;
}
