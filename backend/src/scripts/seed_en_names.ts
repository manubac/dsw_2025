/**
 * seed_en_names.ts
 *
 * 1. Agrega la columna `en_name` a `cards` (si no existe).
 * 2. Para cada set en `sets`, resuelve el ID real de TCGdex (los IDs de la
 *    DB usan "sv1", "me1" etc., mientras TCGdex usa "sv01", "me01", "sv09"…).
 * 3. Hace UPSERT de todas las cartas con su nombre EN.
 * 4. Crea/reemplaza la vista `v_cards_unified`.
 * 5. Crea/reemplaza las funciones `get_card_name_en` y `get_card_name_en_safe`.
 *
 * Uso:
 *   pnpm tsx src/scripts/seed_en_names.ts
 *   pnpm tsx src/scripts/seed_en_names.ts --dry-run
 */

import pg from 'pg';
import 'dotenv/config';

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 300;

const pool = new pg.Pool({
  connectionString:
    process.env.DB_CONNECTION_STRING ||
    'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
});

// ─── Mapeo DB id → TCGdex id ──────────────────────────────────────────────────
// Los IDs de la DB difieren de los TCGdex reales (sv1≠sv01, sv7.5≠sv09, etc.).
// Para SWSH el id ya es correcto (swsh1 = swsh1 en TCGdex).

const TCGDEX_ID: Record<string, string> = {
  // Scarlet & Violet
  'sv1':   'sv01',  'sv2':   'sv02',  'sv3':   'sv03',  'sv3.5': 'sv03.5',
  'sv4':   'sv04',  'sv4.5': 'sv04.5','sv5':   'sv05',  'sv6':   'sv06',
  'sv6.5': 'sv06.5','sv7':   'sv07',  'sv7.5': 'sv09',  // JTG = sv09, no sv7.5
  'sv8':   'sv08',  'sv8.5': 'sv08.5',
  // Mega Evolution (JP format)
  'me1':   'me01',  'me1.5': 'me02',  'me2':   'me02.5','me3':   'me03',
};

/** Devuelve el ID de TCGdex para un set (usa override si existe, si no el ID tal cual). */
function tcgdexId(dbId: string): string {
  return TCGDEX_ID[dbId] ?? dbId;
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface SetRow  { id: string; abbr: string; name_en: string; }
interface TcgCard { id: string; localId: string; name: string; }
interface TcgSet  { cards?: TcgCard[]; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function fetchTcgSet(tcgId: string): Promise<TcgCard[] | null> {
  const url = `https://api.tcgdex.net/v2/en/sets/${tcgId}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) { console.warn(`  ⚠ [${tcgId}] 404 en TCGdex`); return null; }
    if (!res.ok)            { console.warn(`  ⚠ [${tcgId}] HTTP ${res.status}`); return null; }
    const data = await res.json() as TcgSet;
    return data.cards ?? [];
  } catch (err) {
    console.warn(`  ⚠ [${tcgId}] Error de red: ${err}`);
    return null;
  }
}

// ─── Paso 1: Columna e índice ─────────────────────────────────────────────────

async function ensureSchema(client: pg.PoolClient): Promise<void> {
  await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS en_name TEXT`);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_cards_set_number ON cards (set_id, card_number)
  `);
  console.log('✓ Columna en_name e índice asegurados.');
}

// ─── Paso 2: Seed de cartas ───────────────────────────────────────────────────

async function seedSet(setRow: SetRow): Promise<number> {
  await sleep(DELAY_MS);
  const tid = tcgdexId(setRow.id);
  const cards = await fetchTcgSet(tid);
  if (!cards || cards.length === 0) return 0;

  if (DRY_RUN) {
    console.log(`  [DRY-RUN] ${setRow.abbr} (${tid}): ${cards.length} cartas`);
    return cards.length;
  }

  for (const card of cards) {
    await pool.query(
      `INSERT INTO cards (card_id, set_id, card_number, en_name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (card_id) DO UPDATE SET en_name = EXCLUDED.en_name`,
      [card.id, setRow.id, card.localId, card.name],
    );
  }
  return cards.length;
}

// ─── Paso 3: Vista v_cards_unified ────────────────────────────────────────────

async function createView(client: pg.PoolClient): Promise<void> {
  // Hay que DROP + CREATE porque PostgreSQL no permite cambiar tipos/orden de columnas
  // en una vista existente con CREATE OR REPLACE.
  await client.query(`DROP VIEW IF EXISTS v_cards_unified CASCADE`);
  await client.query(`
    CREATE VIEW v_cards_unified AS
    -- Nombres EN desde cards.en_name
    SELECT
        s.abbr        AS set_abbr,
        s.name_en     AS set_name,
        c.card_id,
        c.card_number,
        'en'::text    AS lang_code,
        c.en_name     AS card_name
    FROM  cards c
    JOIN  sets  s ON s.id = c.set_id
    WHERE c.en_name IS NOT NULL

    UNION ALL

    -- Traducciones no-EN desde card_translations
    SELECT
        s.abbr        AS set_abbr,
        s.name_en     AS set_name,
        c.card_id,
        c.card_number,
        ct.lang_code,
        ct.local_name AS card_name
    FROM  cards             c
    JOIN  sets              s  ON s.id       = c.set_id
    JOIN  card_translations ct ON ct.card_id = c.card_id
  `);
  console.log('✓ Vista v_cards_unified creada.');
}

// ─── Paso 4: Funciones de búsqueda ───────────────────────────────────────────

async function createFunctions(client: pg.PoolClient): Promise<void> {
  // Función principal: busca directamente en la vista
  await client.query(`
    CREATE OR REPLACE FUNCTION get_card_name_en(
      abbr_input TEXT,
      num_input  TEXT
    )
    RETURNS TEXT
    LANGUAGE sql
    STABLE
    AS $$
      SELECT card_name
      FROM   v_cards_unified
      WHERE  UPPER(set_abbr) = UPPER(abbr_input)
        AND  card_number     = num_input
        AND  lang_code       = 'en'
      LIMIT 1
    $$
  `);

  // Función segura: vista con fallback a tabla maestra
  // Útil si en algún borde en_name quedó NULL pero la carta existe
  await client.query(`
    CREATE OR REPLACE FUNCTION get_card_name_en_safe(
      abbr_input TEXT,
      num_input  TEXT
    )
    RETURNS TEXT
    LANGUAGE sql
    STABLE
    AS $$
      SELECT COALESCE(
        -- Intento 1: vista unificada (lang_code = 'en')
        (SELECT card_name
         FROM   v_cards_unified
         WHERE  UPPER(set_abbr) = UPPER(abbr_input)
           AND  card_number     = num_input
           AND  lang_code       = 'en'
         LIMIT 1),
        -- Fallback: tabla maestra directa
        (SELECT c.en_name
         FROM   cards c
         JOIN   sets  s ON s.id = c.set_id
         WHERE  UPPER(s.abbr) = UPPER(abbr_input)
           AND  c.card_number = num_input
         LIMIT 1)
      )
    $$
  `);

  console.log('✓ Funciones get_card_name_en y get_card_name_en_safe creadas.');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (DRY_RUN) console.log('⚠  DRY-RUN: no se escribe en la DB.\n');

  const client = await pool.connect();
  try {
    if (!DRY_RUN) await ensureSchema(client);

    const { rows: sets } = await client.query<SetRow>(
      `SELECT id, abbr, name_en FROM sets ORDER BY id`,
    );
    console.log(`\n→ ${sets.length} sets a procesar.\n`);

    let total = 0;
    for (const set of sets) {
      const tid = tcgdexId(set.id);
      const label = tid !== set.id ? `${set.abbr} (DB:${set.id}→TCGdex:${tid})` : set.abbr;
      process.stdout.write(`→ [${label}] ${set.name_en} ... `);
      const n = await seedSet(set);
      console.log(`${n} cartas`);
      total += n;
    }

    if (!DRY_RUN) {
      await createView(client);
      await createFunctions(client);
    }

    console.log('\n══════════════════════════════════');
    console.log(`Total cartas upserted : ${total}`);
    if (DRY_RUN) console.log('(DRY-RUN — sin cambios)');
    console.log('══════════════════════════════════\n');

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
