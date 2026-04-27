// translationService.ts
// Responsabilidad: resolver el nombre en inglés de una carta a partir de su
// nombre en idioma local y la abreviatura del set (código impreso en la carta).
//
// Usa las tablas pokemon_sets / card_translations creadas por sync_tcg_translations.ts.
// Se conecta directamente con pg (Pool independiente del ORM) para no acoplar
// este servicio al ciclo de vida del EntityManager de MikroORM.

import pg from 'pg';
import 'dotenv/config';

// ─── Pool ─────────────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString:
    process.env.DB_CONNECTION_STRING ||
    'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface TranslationMatch {
  /** Número local de la carta dentro del set (e.g. "4", "184") */
  cardLocalId: string;
  /** Abreviatura del set en inglés (e.g. "OBF", "SVI") */
  setAbbr: string;
  /** Código de idioma detectado (e.g. "fr", "es") */
  langCode: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extrae el localId del card_id de TCGdex.
 * Ejemplos:
 *   "sv3-4"     → "4"
 *   "swsh9-184" → "184"
 *   "sv3-TG01"  → "TG01"
 */
function extractLocalId(cardId: string, setId: string): string {
  const prefix = setId + '-';
  return cardId.startsWith(prefix) ? cardId.slice(prefix.length) : cardId.split('-').pop() ?? cardId;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Busca en card_translations el localId de una carta a partir de su nombre
 * en idioma local y la abreviatura del set (leída por OCR).
 *
 * Flujo:
 *   1. Resuelve abbr → set_id en pokemon_sets
 *   2. Busca local_name (case-insensitive) en card_translations para ese set
 *   3. Devuelve { cardLocalId, setAbbr, langCode } o null si no hay match
 */
export async function findByLocalName(
  localName: string,
  setAbbr: string,
): Promise<TranslationMatch | null> {
  if (!localName || !setAbbr) return null;

  try {
    // Paso 1: abbr → set_id
    const setRes = await pool.query<{ id: string }>(
      `SELECT id FROM pokemon_sets WHERE UPPER(abbr) = UPPER($1) LIMIT 1`,
      [setAbbr],
    );
    if (setRes.rows.length === 0) return null;

    const setId = setRes.rows[0].id;

    // Paso 2: local_name → card_id
    const transRes = await pool.query<{ card_id: string; lang_code: string; abbr: string }>(
      `SELECT ct.card_id, ct.lang_code, ps.abbr
       FROM   card_translations ct
       JOIN   pokemon_sets ps ON ps.id = ct.set_id
       WHERE  ct.set_id = $1
         AND  LOWER(ct.local_name) = LOWER($2)
       LIMIT 1`,
      [setId, localName],
    );
    if (transRes.rows.length === 0) return null;

    const row = transRes.rows[0];
    return {
      cardLocalId: extractLocalId(row.card_id, setId),
      setAbbr:     row.abbr,
      langCode:    row.lang_code,
    };
  } catch (err) {
    console.error('[translationService] error en findByLocalName:', err);
    return null;
  }
}

/**
 * Dado un término de búsqueda, devuelve todos los nombres de carta equivalentes
 * en cualquier idioma. Permite buscar "colagrito" y encontrar "Scream Tail",
 * o buscar "Scream Tail" y encontrar "Colagrito", etc.
 *
 * Usa v_cards_unified (set_abbr, card_number, lang_code, card_name) para
 * cruzar el nombre buscado con todos los idiomas de la misma carta.
 */
export async function resolveNamesAcrossLanguages(query: string): Promise<string[]> {
  if (!query || query.trim().length < 2) return [];
  try {
    const result = await pool.query<{ card_name: string }>(
      `WITH matched AS (
         SELECT DISTINCT set_abbr, card_number
         FROM   v_cards_unified
         WHERE  card_name ILIKE $1
       )
       SELECT DISTINCT vcu.card_name
       FROM   matched m
       JOIN   v_cards_unified vcu
              ON  vcu.set_abbr    = m.set_abbr
              AND vcu.card_number = m.card_number
       WHERE  vcu.card_name IS NOT NULL
         AND  vcu.card_name <> ''
       LIMIT  100`,
      [`%${query.trim()}%`],
    );
    return result.rows.map(r => r.card_name).filter(Boolean);
  } catch (err) {
    console.error('[translationService] resolveNamesAcrossLanguages error:', err);
    return [];
  }
}

/**
 * Dado un array de set IDs de TCGdex (e.g. ["sv3pt5", "swsh1"]), devuelve un
 * Map de id → abbr (e.g. "sv3pt5" → "MEW"). Los IDs sin match se omiten.
 */
export async function getSetAbbreviations(setIds: string[]): Promise<Map<string, string>> {
  if (setIds.length === 0) return new Map();
  try {
    const placeholders = setIds.map((_, i) => `$${i + 1}`).join(', ');
    const result = await pool.query<{ id: string; abbr: string }>(
      `SELECT id, abbr FROM pokemon_sets WHERE id IN (${placeholders})`,
      setIds,
    );
    return new Map(result.rows.map(r => [r.id, r.abbr]));
  } catch (err) {
    console.error('[translationService] getSetAbbreviations error:', err);
    return new Map();
  }
}

/**
 * Fallback cuando el OCR no pudo leer la abreviatura del set con confianza.
 *
 * Busca en card_translations el nombre local en CUALQUIER set y devuelve
 * el primer match. Se usa solo como último recurso antes del fuzzy search.
 */
export async function findByLocalNameAnySet(
  localName: string,
): Promise<TranslationMatch | null> {
  if (!localName) return null;

  try {
    const res = await pool.query<{ card_id: string; lang_code: string; abbr: string; set_id: string }>(
      `SELECT ct.card_id, ct.lang_code, ps.abbr, ct.set_id
       FROM   card_translations ct
       JOIN   pokemon_sets ps ON ps.id = ct.set_id
       WHERE  LOWER(ct.local_name) = LOWER($1)
       LIMIT 1`,
      [localName],
    );
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      cardLocalId: extractLocalId(row.card_id, row.set_id),
      setAbbr:     row.abbr,
      langCode:    row.lang_code,
    };
  } catch (err) {
    console.error('[translationService] error en findByLocalNameAnySet:', err);
    return null;
  }
}
