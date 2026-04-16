/**
 * sync_tcg_translations.ts
 *
 * Phases:
 *  1. Create tables `pokemon_sets` and `card_translations` (if not exist)
 *  2. Upsert all sets from siglas_coleccion.json
 *  3. For each set × each non-EN language, fetch TCGdex API and upsert
 *     translations that differ from the English name.
 *
 * Run: pnpm sync-tcg
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// ─── Paths ───────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');

const sets: SetEntry[] = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'siglas_coleccion.json'), 'utf8')
);
const languages: LangEntry[] = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, 'siglas_idioma.json'), 'utf8')
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetEntry  { id: string; abbr: string; name_en: string; }
interface LangEntry { code: string; language: string; local: string; }
interface TcgCard   { id: string; localId: string; name: string; }
interface TcgSet    { id: string; name: string; cards?: TcgCard[]; }

// ─── Config ───────────────────────────────────────────────────────────────────

const NON_EN_LANGS = languages.map(l => l.code).filter(c => c !== 'en');

const DELAY_MS = 350; // ms between API calls to avoid rate-limiting

const pool = new pg.Pool({
  connectionString:
    process.env.DB_CONNECTION_STRING ||
    'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchTcgSet(lang: string, setId: string): Promise<TcgCard[] | null> {
  const url = `https://api.tcgdex.net/v2/${lang}/sets/${setId}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return null; // set not available in this lang
    if (!res.ok) {
      console.warn(`  [${lang}/${setId}] HTTP ${res.status} — skipping`);
      return null;
    }
    const data = await res.json() as TcgSet;
    return data.cards ?? [];
  } catch (err) {
    console.warn(`  [${lang}/${setId}] fetch error — ${err}`);
    return null;
  }
}

// ─── Phase 1: DDL ─────────────────────────────────────────────────────────────

async function createTables(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS pokemon_sets (
      id      TEXT PRIMARY KEY,
      abbr    TEXT NOT NULL,
      name_en TEXT NOT NULL
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS card_translations (
      card_id    TEXT NOT NULL,
      lang_code  TEXT NOT NULL,
      local_name TEXT NOT NULL,
      set_id     TEXT NOT NULL REFERENCES pokemon_sets(id) ON DELETE CASCADE,
      PRIMARY KEY (card_id, lang_code)
    )
  `);

  console.log('✓ Tables pokemon_sets and card_translations ready.');
}

// ─── Phase 2: Import sets ─────────────────────────────────────────────────────

async function importSets(client: pg.PoolClient): Promise<void> {
  for (const s of sets) {
    await client.query(
      `INSERT INTO pokemon_sets (id, abbr, name_en)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET abbr    = EXCLUDED.abbr,
             name_en = EXCLUDED.name_en`,
      [s.id, s.abbr, s.name_en]
    );
  }
  console.log(`✓ Upserted ${sets.length} sets into pokemon_sets.`);
}

// ─── Phase 3: Sync translations ───────────────────────────────────────────────

async function syncTranslations(client: pg.PoolClient): Promise<void> {
  let totalInserted = 0;
  let totalSkipped  = 0;
  let setsSkipped   = 0;

  for (const set of sets) {
    console.log(`\n→ [${set.id}] ${set.name_en}`);

    // Fetch English cards first to build the reference map
    const enCards = await fetchTcgSet('en', set.id);
    await sleep(DELAY_MS);

    if (!enCards) {
      console.log(`  ⚠ Not found in EN — skipping entire set`);
      setsSkipped++;
      continue;
    }

    // localId → english name
    const enMap = new Map<string, string>(
      enCards.map(c => [c.localId, c.name])
    );

    for (const lang of NON_EN_LANGS) {
      const localCards = await fetchTcgSet(lang, set.id);
      await sleep(DELAY_MS);

      if (!localCards) {
        console.log(`  [${lang}] not available`);
        continue;
      }

      let inserted = 0;
      let skipped  = 0;

      for (const card of localCards) {
        const enName = enMap.get(card.localId);

        // Skip if the local name is identical to English (saves space)
        if (enName !== undefined && card.name === enName) {
          skipped++;
          continue;
        }

        await client.query(
          `INSERT INTO card_translations (card_id, lang_code, local_name, set_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (card_id, lang_code) DO UPDATE
             SET local_name = EXCLUDED.local_name`,
          [card.id, lang, card.name, set.id]
        );
        inserted++;
      }

      console.log(`  [${lang}] +${inserted} inserted, ${skipped} same-as-EN skipped`);
      totalInserted += inserted;
      totalSkipped  += skipped;
    }
  }

  console.log(`\n✓ Sync complete.`);
  console.log(`  Sets skipped (not in EN): ${setsSkipped}`);
  console.log(`  Translations inserted:    ${totalInserted}`);
  console.log(`  Identical to EN (skipped):${totalSkipped}`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    await createTables(client);
    await importSets(client);
    await syncTranslations(client);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
