/**
 * setup_indexes.mjs — Índices, VIEW y test de integridad.
 *
 * Uso (desde backend/):
 *   node setup_indexes.mjs
 */

import pg from 'pg';

const DB_URL = process.env.DB_CONNECTION_STRING || 'postgresql://postgres:post1234@localhost:5432/heroclash_dsw';
const { Pool } = pg;
const pool = new Pool({ connectionString: DB_URL });

// ─── DDL ──────────────────────────────────────────────────────────────────────

const steps = [

  // ── Índices ────────────────────────────────────────────────────────────────

  {
    label: 'Índice cards(set_id, card_number)',
    sql: `CREATE INDEX IF NOT EXISTS idx_cards_set_number
          ON cards (set_id, card_number)`,
  },
  {
    label: 'Índice card_translations(lang_code)',
    sql: `CREATE INDEX IF NOT EXISTS idx_ct_lang_code
          ON card_translations (lang_code)`,
  },
  {
    label: 'Índice GIN card_translations(local_name) — búsqueda full-text',
    sql: `CREATE INDEX IF NOT EXISTS idx_ct_local_name_fts
          ON card_translations
          USING GIN (to_tsvector('simple', local_name))`,
  },
  {
    label: 'Índice B-tree card_translations(local_name) — ILIKE / exacto',
    sql: `CREATE INDEX IF NOT EXISTS idx_ct_local_name_btree
          ON card_translations (lower(local_name))`,
  },

  // ── Vista unificada ────────────────────────────────────────────────────────

  {
    label: 'Vista v_cards_unified',
    sql: `
      CREATE OR REPLACE VIEW v_cards_unified AS
      SELECT
        s.abbr                                     AS set_abbr,
        s.name_en                                  AS set_name,
        c.card_number,
        c.card_id,
        COALESCE(t.lang_code, 'en')                AS lang_code,
        COALESCE(t.local_name, c.card_id)          AS card_name
      FROM cards c
      JOIN sets s ON s.id = c.set_id
      LEFT JOIN card_translations t ON t.card_id = c.card_id
    `,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log(' setup_indexes.mjs — Índices + Vista v_cards_unified');
  console.log('══════════════════════════════════════════════════════════════\n');

  const client = await pool.connect();

  try {
    // 1. Aplicar DDL
    for (const step of steps) {
      process.stdout.write(`  • ${step.label} ... `);
      await client.query(step.sql);
      console.log('✓');
    }

    // 2. Test de integridad — buscar una carta real en la vista
    console.log('\n── Test de integridad ──────────────────────────────────────────');

    // Primero detectar qué carta existe (buscamos el set JTG si existe, si no el primero)
    const probe = await client.query(`
      SELECT set_abbr, set_name, card_number, card_id
      FROM v_cards_unified
      WHERE set_abbr = 'JTG'
      LIMIT 1
    `);

    let testAbbr, testNumber;
    if (probe.rowCount > 0) {
      testAbbr   = probe.rows[0].set_abbr;
      testNumber = probe.rows[0].card_number;
    } else {
      // Fallback: primera carta disponible en cualquier set
      const fallback = await client.query(`
        SELECT set_abbr, card_number FROM v_cards_unified LIMIT 1
      `);
      if (fallback.rowCount === 0) {
        console.log('  ⚠ La vista no tiene filas. ¿Corriste sync_db.mjs?');
        return;
      }
      testAbbr   = fallback.rows[0].set_abbr;
      testNumber = fallback.rows[0].card_number;
    }

    console.log(`  Carta de prueba: set_abbr='${testAbbr}'  card_number='${testNumber}'\n`);

    const result = await client.query(`
      SELECT set_abbr, set_name, card_number, lang_code, card_name
      FROM v_cards_unified
      WHERE set_abbr   = $1
        AND card_number = $2
      ORDER BY lang_code
    `, [testAbbr, testNumber]);

    if (result.rowCount === 0) {
      console.log('  ⚠ No se encontraron filas para esa carta.');
    } else {
      console.log(`  Resultados (${result.rowCount} filas):\n`);
      console.log(
        '  ' +
        'set_abbr'.padEnd(10) +
        'card_number'.padEnd(14) +
        'lang_code'.padEnd(12) +
        'card_name'
      );
      console.log('  ' + '─'.repeat(62));
      for (const row of result.rows) {
        console.log(
          '  ' +
          row.set_abbr.padEnd(10) +
          row.card_number.padEnd(14) +
          row.lang_code.padEnd(12) +
          row.card_name
        );
      }
    }

    // 3. Estadísticas generales
    console.log('\n── Estadísticas ────────────────────────────────────────────────');
    const stats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM sets)             AS total_sets,
        (SELECT COUNT(*) FROM cards)            AS total_cards,
        (SELECT COUNT(*) FROM card_translations) AS total_translations
    `);
    const s = stats.rows[0];
    console.log(`  Sets           : ${s.total_sets}`);
    console.log(`  Cartas         : ${s.total_cards}`);
    console.log(`  Traducciones   : ${s.total_translations}`);

  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log(' Base de datos lista para producción.');
  console.log('══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
