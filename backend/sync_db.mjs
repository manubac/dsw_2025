/**
 * sync_db.mjs — Reconstrucción total del esquema TCG + sincronización desde la API de TCGdex.
 *
 * Uso (desde la carpeta backend/):
 *   node sync_db.mjs
 *   node sync_db.mjs --dry-run      ← solo muestra DDL, no ejecuta nada
 *
 * Requiere:
 *   - pg (ya está en backend/node_modules)
 *   - Variables de entorno opcionales: DB_CONNECTION_STRING
 */

import pg       from 'pg';
import fs       from 'fs';
import path     from 'path';
import { fileURLToPath } from 'url';

// ─── Rutas ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');   // dsw_2025/

const sets     = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'siglas_coleccion.json'), 'utf-8'));
const languages = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'siglas_idioma.json'),   'utf-8'));

// ─── Configuración ────────────────────────────────────────────────────────────

const DB_URL      = process.env.DB_CONNECTION_STRING || 'postgresql://postgres:post1234@localhost:5432/heroclash_dsw';
const CONCURRENCY = 5;
const DELAY_MS    = 300;
const DRY_RUN     = process.argv.includes('--dry-run');

const { Pool } = pg;
const pool = new Pool({ connectionString: DB_URL });

// Idiomas que TCGdex soporta (mapeo de nuestros códigos → código de la API)
// TCGdex usa "kr" para coreano, nuestro JSON tiene "ko"
const LANG_MAP = { ko: 'kr' };
function apiLang(code) { return LANG_MAP[code] ?? code; }

const ALL_LANGS   = languages.map(l => l.code);
const NON_EN_LANGS = ALL_LANGS.filter(c => c !== 'en');

// ─── p-limit inline ───────────────────────────────────────────────────────────

function createLimiter(limit) {
  let active = 0;
  const queue = [];
  function next() {
    if (queue.length && active < limit) { active++; queue.shift()(); }
  }
  return function run(fn) {
    return new Promise((resolve, reject) => {
      const go = () => fn().then(resolve, reject).finally(() => { active--; next(); });
      active < limit ? (active++, go()) : queue.push(go);
    });
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchTcgSet(lang, setId) {
  const url = `https://api.tcgdex.net/v2/${apiLang(lang)}/sets/${setId}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) { console.warn(`  ⚠ [${lang}/${setId}] HTTP ${res.status}`); return null; }
    const data = await res.json();
    return data.cards ?? [];
  } catch (err) {
    console.warn(`  ⚠ [${lang}/${setId}] fetch error: ${err.message}`);
    return null;
  }
}

// ─── Fase 1: Reconstruir esquema ──────────────────────────────────────────────

async function rebuildSchema(client) {
  console.log('\n── Fase 1: Reconstruyendo esquema ──────────────────────────────');

  const ddl = [
    // DROP (CASCADE elimina FKs automáticamente)
    `DROP TABLE IF EXISTS card_translations CASCADE`,
    `DROP TABLE IF EXISTS cards             CASCADE`,
    `DROP TABLE IF EXISTS sets              CASCADE`,

    // sets
    `CREATE TABLE sets (
       id      VARCHAR(30)  PRIMARY KEY,
       abbr    VARCHAR(10)  NOT NULL UNIQUE,
       name_en TEXT         NOT NULL
     )`,

    // cards
    `CREATE TABLE cards (
       card_id     VARCHAR(50)  PRIMARY KEY,
       set_id      VARCHAR(30)  NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
       card_number VARCHAR(20)  NOT NULL
     )`,

    // índice para búsquedas por set + número
    `CREATE INDEX idx_cards_set_number ON cards (set_id, card_number)`,

    // card_translations
    `CREATE TABLE card_translations (
       card_id    VARCHAR(50)  NOT NULL REFERENCES cards(card_id) ON DELETE CASCADE,
       lang_code  CHAR(5)      NOT NULL,
       local_name TEXT         NOT NULL,
       PRIMARY KEY (card_id, lang_code)
     )`,
  ];

  for (const stmt of ddl) {
    const preview = stmt.trim().split('\n')[0].slice(0, 70);
    if (DRY_RUN) { console.log(`  [DRY-RUN] ${preview}...`); continue; }
    await client.query(stmt);
    console.log(`  ✓ ${preview}`);
  }
}

// ─── Fase 2: Insertar sets ────────────────────────────────────────────────────

async function insertSets(client) {
  console.log('\n── Fase 2: Insertando sets ─────────────────────────────────────');
  if (DRY_RUN) { console.log(`  [DRY-RUN] ${sets.length} sets omitidos`); return; }

  for (const s of sets) {
    await client.query(
      `INSERT INTO sets (id, abbr, name_en) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET abbr = EXCLUDED.abbr, name_en = EXCLUDED.name_en`,
      [s.id, s.abbr, s.name_en]
    );
  }
  console.log(`  ✓ ${sets.length} sets insertados`);
}

// ─── Fase 3: Sincronizar cartas por set ───────────────────────────────────────

async function syncSet(setEntry) {
  const { id: setId, name_en } = setEntry;
  await sleep(DELAY_MS);

  // Obtener cartas en inglés (fuente de verdad para card_id, card_number y nombre EN)
  const enCards = await fetchTcgSet('en', setId);
  if (!enCards || enCards.length === 0) {
    console.log(`  ⚠ [${setId}] Sin cartas en EN — omitido`);
    return { cards: 0, translations: 0 };
  }

  // Mapa localId → { card_id, name_en }
  const enMap = new Map(enCards.map(c => [c.localId, { cardId: c.id, nameEn: c.name }]));

  let cardsInserted = 0;
  let translationsInserted = 0;

  if (!DRY_RUN) {
    // Insertar cartas (card_id, set_id, card_number)
    for (const card of enCards) {
      await pool.query(
        `INSERT INTO cards (card_id, set_id, card_number) VALUES ($1, $2, $3)
         ON CONFLICT (card_id) DO UPDATE SET card_number = EXCLUDED.card_number`,
        [card.id, setId, card.localId]
      );
      cardsInserted++;
    }
  } else {
    cardsInserted = enCards.length;
  }

  // Traducciones: solo para idiomas distintos al inglés
  for (const langCode of NON_EN_LANGS) {
    await sleep(DELAY_MS);
    const localCards = await fetchTcgSet(langCode, setId);
    if (!localCards) continue;

    let inserted = 0;
    for (const card of localCards) {
      const enEntry = enMap.get(card.localId);
      if (!enEntry) continue;                   // carta no presente en EN
      if (card.name === enEntry.nameEn) continue; // nombre idéntico al inglés — no hace falta traducción

      if (!DRY_RUN) {
        await pool.query(
          `INSERT INTO card_translations (card_id, lang_code, local_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (card_id, lang_code) DO UPDATE SET local_name = EXCLUDED.local_name`,
          [enEntry.cardId, langCode, card.name]
        );
      }
      inserted++;
    }
    translationsInserted += inserted;
    if (inserted > 0) process.stdout.write(`    [${langCode}] +${inserted}  `);
  }

  return { cards: cardsInserted, translations: translationsInserted };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' sync_db.mjs — Reconstrucción de esquema TCG + sincronización');
  if (DRY_RUN) console.log(' MODO DRY-RUN: no se ejecutan cambios en la BD');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`Sets a procesar : ${sets.length}`);
  console.log(`Idiomas         : ${ALL_LANGS.join(', ')}`);
  console.log(`Concurrencia    : ${CONCURRENCY} sets en paralelo`);

  const client = await pool.connect();
  try {
    await rebuildSchema(client);
    await insertSets(client);
  } finally {
    client.release();
  }

  // ── Fase 3: sincronización de cartas ──────────────────────────────────────
  console.log('\n── Fase 3: Sincronizando cartas ────────────────────────────────');
  console.log(`(${sets.length} sets × ${ALL_LANGS.length} idiomas)\n`);

  const limiter = createLimiter(CONCURRENCY);
  let totalCards = 0, totalTranslations = 0, setsOk = 0, setsFailed = 0;
  const startTime = Date.now();

  await Promise.all(
    sets.map((setEntry, idx) =>
      limiter(async () => {
        process.stdout.write(`→ [${String(idx + 1).padStart(2)}/${sets.length}] ${setEntry.id.padEnd(12)} `);
        try {
          const { cards, translations } = await syncSet(setEntry);
          console.log(`→ ${cards} cartas, ${translations} traducciones`);
          totalCards        += cards;
          totalTranslations += translations;
          setsOk++;
        } catch (err) {
          console.error(`\n  ✗ [${setEntry.id}] Error: ${err.message}`);
          setsFailed++;
        }
      })
    )
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' Resumen final');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Sets procesados   : ${setsOk} OK  /  ${setsFailed} con error`);
  console.log(`  Cartas insertadas : ${totalCards}`);
  console.log(`  Traducciones      : ${totalTranslations}`);
  console.log(`  Tiempo total      : ${elapsed}s`);
  if (DRY_RUN) console.log('\n  (Modo DRY-RUN — ningún cambio fue persistido)');
  console.log('══════════════════════════════════════════════════════════════\n');

  await pool.end();
}

main().catch(err => {
  console.error('\nError fatal:', err.message);
  process.exit(1);
});
