/**
 * update_card_numbers.ts
 *
 * Rellena la columna `card_number` en la tabla `carta` consultando la API de TCGdex.
 *
 * Estrategia de matching (en orden):
 *  1. Si `link` contiene un ID de TCGdex reconocible (e.g. "sv1-1"), se usa directamente.
 *  2. Fallback: coincidencia por nombre (case-insensitive) dentro del mismo set.
 *
 * Concurrencia: máximo CONCURRENCY sets en paralelo, con DELAY_MS entre requests.
 *
 * Uso:
 *   pnpm tsx src/scripts/update_card_numbers.ts
 *   pnpm tsx src/scripts/update_card_numbers.ts --dry-run   (sin escribir en DB)
 */

import 'reflect-metadata';
import pg from 'pg';
import 'dotenv/config';

// ─── Configuración ────────────────────────────────────────────────────────────

const CONCURRENCY = 3;   // sets que se procesan en paralelo
const DELAY_MS    = 300; // ms de espera entre llamadas a la API (evitar rate-limit)
const DRY_RUN     = process.argv.includes('--dry-run');

const pool = new pg.Pool({
  connectionString:
    process.env.DB_CONNECTION_STRING ||
    'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
});

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TcgCard {
  id: string;       // e.g. "sv1-1"
  localId: string;  // número impreso: "1", "TG01", "A", etc.
  name: string;
}

interface TcgSetResponse {
  cards?: TcgCard[];
}

interface CartaRow {
  id: number;
  name: string;
  set_code: string | null;
  link: string | null;
  card_number: string | null;
}

// ─── Implementación simple de p-limit ────────────────────────────────────────
// Ejecuta `fn` con un máximo de `limit` promesas en vuelo simultáneamente.

function createLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next() {
    if (queue.length > 0 && active < limit) {
      active++;
      const run = queue.shift()!;
      run();
    }
  }

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };

      if (active < limit) {
        active++;
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Intenta extraer el ID de TCGdex desde el campo `link`.
 * Soporta formatos como:
 *   https://api.tcgdex.net/v2/en/cards/sv1-1
 *   https://www.tcgdex.net/cards/sv1-1
 *   sv1-1   (almacenado directamente)
 */
function extractTcgIdFromLink(link: string | null): string | null {
  if (!link) return null;

  // Patrón: /cards/{setId}-{localId}  o  /cards/{setId}/{localId}
  const urlMatch = link.match(/\/cards\/([a-z0-9.\-]+(?:-\w+))/i);
  if (urlMatch) return urlMatch[1];

  // Patrón: el link es directamente el ID (e.g. "sv1-1" o "swsh1-001")
  if (/^[a-z0-9.]+[-\/]\w+$/i.test(link.trim())) return link.trim();

  return null;
}

async function fetchTcgSet(setId: string): Promise<TcgCard[] | null> {
  const url = `https://api.tcgdex.net/v2/en/sets/${setId}`;
  try {
    const res = await fetch(url);
    if (res.status === 404) {
      console.warn(`  ⚠ [${setId}] 404 — set no encontrado en TCGdex`);
      return null;
    }
    if (!res.ok) {
      console.warn(`  ⚠ [${setId}] HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as TcgSetResponse;
    return data.cards ?? [];
  } catch (err) {
    console.warn(`  ⚠ [${setId}] Error de red: ${err}`);
    return null;
  }
}

// ─── Migración de columna ─────────────────────────────────────────────────────

/** Devuelve el nombre real de la tabla de cartas (puede ser 'carta' o 'cartas'). */
async function resolveCartaTable(client: pg.PoolClient): Promise<string> {
  const res = await client.query<{ table_name: string }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('carta', 'cartas', 'Carta', 'Cartas')
    LIMIT 1
  `);

  if (!res.rowCount || res.rowCount === 0) {
    // Listar todas las tablas disponibles para ayudar a diagnosticar
    const all = await client.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const names = all.rows.map(r => r.table_name).join(', ') || '(ninguna)';
    throw new Error(
      `No se encontró la tabla de cartas en el schema 'public'.\n` +
      `Tablas disponibles: ${names}\n` +
      `Solución: ejecuta primero  pnpm schema:update  para crear el esquema con MikroORM.`
    );
  }

  return res.rows[0].table_name;
}

async function ensureCardNumberColumn(client: pg.PoolClient): Promise<string> {
  const tableName = await resolveCartaTable(client);

  const res = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = $1
      AND column_name  = 'card_number'
  `, [tableName]);

  if (res.rowCount === 0) {
    console.log(`Columna card_number no existe en "${tableName}" → agregando...`);
    await client.query(`ALTER TABLE "${tableName}" ADD COLUMN card_number VARCHAR(20)`);
    console.log('✓ Columna card_number creada.');

    // Índice para búsquedas rápidas por set + número
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_carta_set_card_number
      ON "${tableName}" (set_code, card_number)
    `);
    console.log('✓ Índice idx_carta_set_card_number creado.');
  } else {
    console.log(`✓ Columna card_number ya existe en "${tableName}".`);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_carta_set_card_number
      ON "${tableName}" (set_code, card_number)
    `);
  }

  return tableName;
}

// ─── Lógica principal por set ─────────────────────────────────────────────────

async function processSet(
  setCode: string,
  cartas: CartaRow[],
  tableName: string,
): Promise<{ updated: number; skipped: number; notFound: number }> {
  await sleep(DELAY_MS);

  const tcgCards = await fetchTcgSet(setCode);
  if (!tcgCards) {
    return { updated: 0, skipped: 0, notFound: cartas.length };
  }

  // Mapa 1: tcgId → localId  (para matching por link)
  const byId = new Map<string, string>(
    tcgCards.map(c => [c.id.toLowerCase(), c.localId])
  );

  // Mapa 2: nombre normalizado → localId  (fallback por nombre)
  // Si hay duplicados de nombre dentro del set, el último gana —
  // se registra una advertencia más abajo.
  const byName = new Map<string, string>();
  const nameCount = new Map<string, number>();
  for (const c of tcgCards) {
    const key = c.name.trim().toLowerCase();
    byName.set(key, c.localId);
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }

  let updated = 0, skipped = 0, notFound = 0;

  for (const carta of cartas) {
    // Intentar matching por link primero
    let localId: string | undefined;

    const tcgId = extractTcgIdFromLink(carta.link);
    if (tcgId) {
      localId = byId.get(tcgId.toLowerCase());
    }

    // Fallback: matching por nombre
    if (!localId) {
      const nameKey = carta.name.trim().toLowerCase();
      if ((nameCount.get(nameKey) ?? 0) > 1) {
        console.warn(
          `  ⚠ [${setCode}] Nombre duplicado en set: "${carta.name}" — se omite (id=${carta.id})`
        );
        notFound++;
        continue;
      }
      localId = byName.get(nameKey);
    }

    if (!localId) {
      console.warn(`  ⚠ [${setCode}] No match para carta id=${carta.id} "${carta.name}"`);
      notFound++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] id=${carta.id} "${carta.name}" → card_number="${localId}"`);
      updated++;
      continue;
    }

    await pool.query(
      `UPDATE "${tableName}" SET card_number = $1 WHERE id = $2`,
      [localId, carta.id]
    );
    updated++;
  }

  skipped = cartas.filter(c => c.card_number !== null && c.card_number !== '').length;

  return { updated, skipped, notFound };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (DRY_RUN) console.log('⚠  Modo DRY-RUN: no se escribirá en la base de datos.\n');

  const client = await pool.connect();
  let tableName = '';

  try {
    // 1. Asegurar que la columna y el índice existen
    tableName = await ensureCardNumberColumn(client);
  } finally {
    client.release();
  }

  // 2. Obtener todas las cartas que aún no tienen card_number (o todas si --force)
  const force = process.argv.includes('--force');
  const { rows: cartas } = await pool.query<CartaRow>(`
    SELECT id, name, set_code, link, card_number
    FROM "${tableName}"
    WHERE set_code IS NOT NULL
      ${force ? '' : "AND (card_number IS NULL OR card_number = '')"}
    ORDER BY set_code, id
  `);

  if (cartas.length === 0) {
    console.log('\n✓ Todas las cartas ya tienen card_number. Nada que hacer.');
    console.log('  (Usa --force para re-procesar todas)');
    await pool.end();
    return;
  }

  // 3. Agrupar por set_code
  const bySet = new Map<string, CartaRow[]>();
  for (const carta of cartas) {
    const code = carta.set_code!;
    if (!bySet.has(code)) bySet.set(code, []);
    bySet.get(code)!.push(carta);
  }

  console.log(`\n→ ${cartas.length} cartas en ${bySet.size} sets para procesar.\n`);

  // 4. Procesar sets con concurrencia controlada
  const limit = createLimiter(CONCURRENCY);
  let totalUpdated = 0, totalSkipped = 0, totalNotFound = 0;

  const tasks = Array.from(bySet.entries()).map(([setCode, setCartas]) =>
    limit(async () => {
      console.log(`→ [${setCode}] ${setCartas.length} cartas...`);
      const { updated, skipped, notFound } = await processSet(setCode, setCartas, tableName);
      console.log(
        `  ✓ [${setCode}] actualizadas: ${updated}  sin match: ${notFound}`
      );
      totalUpdated  += updated;
      totalSkipped  += skipped;
      totalNotFound += notFound;
    })
  );

  await Promise.all(tasks);

  console.log('\n══════════════════════════════════════');
  console.log('Resumen final:');
  console.log(`  Cartas actualizadas : ${totalUpdated}`);
  console.log(`  Sin match en TCGdex : ${totalNotFound}`);
  if (DRY_RUN) console.log('  (Modo DRY-RUN — ningún cambio fue persistido)');
  console.log('══════════════════════════════════════\n');

  await pool.end();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
