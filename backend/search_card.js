/**
 * search_card.js — Búsqueda de nombre EN por sigla de colección + número.
 *
 * Uso:
 *   node search_card.js <SIGLA> <NUMERO>
 *
 * Ejemplos:
 *   node search_card.js JTG 001
 *   node search_card.js jtg 1        ← case-insensitive, sin ceros funciona
 *   node search_card.js CRZ 014
 *   node search_card.js PAF 8
 */

import pg from 'pg';
import { createRequire } from 'module';

// ─── Configuración de conexión ────────────────────────────────────────────────

const DB_URL =
  process.env.DB_CONNECTION_STRING ||
  'postgresql://postgres:post1234@localhost:5432/heroclash_dsw';

// ─── Args ─────────────────────────────────────────────────────────────────────

const [,, abbr, rawNum] = process.argv;

if (!abbr || !rawNum) {
  console.error('Uso: node search_card.js <SIGLA> <NUMERO>');
  console.error('Ej:  node search_card.js JTG 001');
  process.exit(1);
}

// ─── Búsqueda ─────────────────────────────────────────────────────────────────

/**
 * Intenta el número tal como vino, luego con padding de 2 y 3 dígitos.
 * Así "8" encuentra "008", "08" y "8" indistintamente.
 */
function numberCandidates(num) {
  const n = parseInt(num, 10);
  const candidates = new Set([
    num,                            // tal cual: "8", "001", etc.
    String(n),                      // sin ceros: "1", "14"
    String(n).padStart(2, '0'),     // 2 dígitos: "01"
    String(n).padStart(3, '0'),     // 3 dígitos: "001"
  ]);
  return [...candidates];
}

async function searchCard(abbr, num) {
  const pool = new pg.Pool({ connectionString: DB_URL });

  try {
    // Intentar con la función PostgreSQL, probando variantes de número
    for (const candidate of numberCandidates(num)) {
      const { rows } = await pool.query(
        'SELECT get_card_name_en_safe($1, $2) AS name',
        [abbr, candidate],
      );
      const name = rows[0]?.name;
      if (name) return { name, matchedNumber: candidate };
    }
    return null;
  } finally {
    await pool.end();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const result = await searchCard(abbr, rawNum);

console.log('');
console.log('══════════════════════════════════════════');
console.log(`  Sigla   : ${abbr.toUpperCase()}`);
console.log(`  Número  : ${rawNum}`);
console.log('──────────────────────────────────────────');

if (result) {
  console.log(`  Nombre EN : ${result.name}`);
  console.log(`  (número en DB: ${result.matchedNumber})`);
} else {
  console.log('  ✗ No encontrado en la base de datos.');
  console.log('  Tip: ejecutá pnpm seed-en-names para poblar la DB con TCGdex.');
}

console.log('══════════════════════════════════════════');
console.log('');
