/**
 * identify_from_photo.js
 *
 * Identifica una carta Pokémon desde una foto:
 *   1. OCR  — Google Cloud Vision (fallback automático: tesseract.js con --no-vision)
 *   2. Parse — extrae nombre y número del texto OCR usando stage_pokemon.json
 *   3. Lookup inverso — busca en v_cards_unified para determinar colección e idioma
 *
 * Uso:
 *   node identify_from_photo.js <ruta-imagen>
 *   node identify_from_photo.js <ruta-imagen> --no-vision    ← fuerza tesseract.js
 *   node identify_from_photo.js <ruta-imagen> --debug        ← muestra texto OCR completo
 */

import fs          from 'fs';
import path        from 'path';
import { fileURLToPath } from 'url';
import pg          from 'pg';
import vision      from '@google-cloud/vision';
import 'dotenv/config';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '..');

// ─── Argumentos ───────────────────────────────────────────────────────────────

const args       = process.argv.slice(2);
const imagePath  = args.find(a => !a.startsWith('--'));
const NO_VISION  = args.includes('--no-vision');
const DEBUG      = args.includes('--debug');

if (!imagePath) {
  console.error('Uso: node identify_from_photo.js <ruta-imagen> [--no-vision] [--debug]');
  process.exit(1);
}
if (!fs.existsSync(imagePath)) {
  console.error(`✗ Imagen no encontrada: ${imagePath}`);
  process.exit(1);
}

// ─── DB ───────────────────────────────────────────────────────────────────────

const pool = new pg.Pool({
  connectionString:
    process.env.DB_CONNECTION_STRING ||
    'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
});

// ─── Stage keywords (todas las lenguas) ───────────────────────────────────────
// Cargados desde stage_pokemon.json para detectar el inicio del nombre de la carta.

const STAGE_LOOKUP = new Map();   // valor_lower → { stageKey, isSpecial }

try {
  const stageData = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'stage_pokemon.json'), 'utf8'),
  );
  for (const langData of Object.values(stageData.languages)) {
    for (const [key, val] of Object.entries(langData.stages)) {
      STAGE_LOOKUP.set(val.toLowerCase(), { stageKey: key, isSpecial: false });
    }
    for (const val of langData.special) {
      STAGE_LOOKUP.set(val.toLowerCase(), { stageKey: 'special', isSpecial: true });
    }
  }
} catch {
  // Si no se puede cargar el JSON, la extracción cae al fallback HP
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

async function ocrWithVision(imgPath) {
  const client     = new vision.ImageAnnotatorClient();
  const imgBuffer  = fs.readFileSync(imgPath);
  const [result]   = await client.documentTextDetection({
    image: { content: imgBuffer.toString('base64') },
  });
  return result.fullTextAnnotation?.text?.trim() ?? '';
}

async function ocrWithTesseract(imgPath) {
  // Importación dinámica para no romper si tesseract no está disponible
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize(imgPath);
  await worker.terminate();
  return data.text.trim();
}

async function runOcr(imgPath) {
  if (NO_VISION) {
    console.log('[OCR] Usando tesseract.js (--no-vision)...');
    return ocrWithTesseract(imgPath);
  }
  try {
    console.log('[OCR] Usando Google Cloud Vision...');
    return await ocrWithVision(imgPath);
  } catch (err) {
    console.warn(`[OCR] Vision falló (${err.message}), intentando tesseract.js...`);
    return ocrWithTesseract(imgPath);
  }
}

// ─── Extracción de número ─────────────────────────────────────────────────────

/**
 * Busca el patrón X/Y o un número aislado de 1-3 dígitos.
 * Devuelve el número sin ceros iniciales (e.g. "008" → "8").
 */
function extractNumber(text) {
  // Prioridad 1: patrón X/Y — más confiable (número de carta / total del set)
  // Acepta números pegados a letras: "MIG056/132", "PAF EN 054/091"
  const slashMatch = text.match(/(\d+)\/(\d+)/);
  if (slashMatch) return String(parseInt(slashMatch[1], 10));

  // Prioridad 2: número de 3 dígitos aislado (e.g. "074", "200")
  const threeDigit = text.match(/\b(\d{3})\b/);
  if (threeDigit) return String(parseInt(threeDigit[1], 10));

  return '';
}

// ─── Extracción de nombre ─────────────────────────────────────────────────────

const HP_MARKER = /^(?:HP|PS|PV|ПС|体力)$/i;

/** Dado un array de palabras, devuelve las previas al marcador de HP. */
function wordsBeforeHp(words) {
  const idx = words.findIndex(
    (w, i) => HP_MARKER.test(w) && /^\d+$/.test(words[i + 1] ?? ''),
  );
  return (idx >= 0 ? words.slice(0, idx) : words).join(' ').trim();
}

/**
 * Verifica si un string parece un nombre de carta Pokémon válido.
 * Descarta líneas de datos, flavor text o artefactos OCR.
 */
function isPlausibleName(s) {
  if (!s || s.length < 2 || s.length > 40) return false;
  // Debe empezar con letra mayúscula (o acento)
  if (!/^[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ'\u3040-\u9FFF]/.test(s)) return false;
  // Patrón de datos del Pokémon: "NO. 488 ..."
  if (/^NO\.\s*\d+/i.test(s)) return false;
  // Contiene 3 o más dígitos seguidos → probable flavor text
  if (/\d{3,}/.test(s)) return false;
  // Más de 5 palabras → probable oración de flavor text
  if (s.split(/\s+/).length > 5) return false;
  // Contiene verbos de flavor text comunes
  if (/\b(there is|if you|you may|damage|counter|benched|pokémon\b.*\blbs)/i.test(s)) return false;
  return true;
}

/** Elimina caracteres no imprimibles, normaliza espacios y quita sufijos típicos. */
function cleanName(raw) {
  return raw
    // Quitar sufijos de nivel (DP/HGSS) y otros metadatos pegados al nombre
    .replace(/\s+LV\.\d+$/i, '')
    .replace(/\s+Level\s+\d+$/i, '')
    // Solo dejar alfanumérico + acentos + apóstrofos + guiones
    .replace(/[^\x20-\x7EáéíóúàèìòùâêîôûäëïöüñçãõÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÇÃÕ''\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae el nombre de la carta del texto OCR.
 *
 * Estrategia:
 *  1. Busca líneas donde la primera palabra (o las dos primeras) sea un stage
 *     conocido → el nombre sigue en esa misma línea o en la siguiente.
 *  2. Fallback: línea que contiene "HP N" → toma lo que está antes.
 */
function extractName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const words = lines[i].split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const w0  = words[0].toLowerCase();
    const w01 = (words[0] + ' ' + (words[1] ?? '')).toLowerCase().trim();

    let stageWordCount = 0;
    if (STAGE_LOOKUP.has(w01))      stageWordCount = 2;
    else if (STAGE_LOOKUP.has(w0))  stageWordCount = 1;

    if (stageWordCount === 0) continue;

    const afterStage = words.slice(stageWordCount);

    // Caso A: nombre en la misma línea que el stage ("BASIC Charmander HP 70")
    if (afterStage.length > 0) {
      const candidate = cleanName(wordsBeforeHp(afterStage));
      if (isPlausibleName(candidate)) return candidate;
    }

    // Caso C (prioridad sobre B cuando stage está solo): nombre en la línea ANTERIOR
    // Formato DP/HGSS antiguo: "Cresselia LV.48 \n BASIC \n ..."
    if (i > 0 && afterStage.length === 0) {
      const prevWords = lines[i - 1].split(/\s+/).filter(Boolean);
      const candidate = cleanName(wordsBeforeHp(prevWords));
      if (isPlausibleName(candidate)) return candidate;
    }

    // Caso B: nombre en la línea SIGUIENTE (formato moderno)
    // Solo si no encontramos nada antes
    if (i + 1 < lines.length) {
      const nextWords = lines[i + 1].split(/\s+/).filter(Boolean);
      if (!HP_MARKER.test(nextWords[0] ?? '')) {
        const candidate = cleanName(wordsBeforeHp(nextWords));
        if (isPlausibleName(candidate)) return candidate;
      }
    }
  }

  // Fallback: línea con "HP N"
  for (const line of lines) {
    const hit = line.match(/^(.*?)\s+(?:HP|PS|PV)\s+\d+/i);
    if (!hit) continue;
    const candidate = hit[1]
      .replace(/^(?:BASIC|STAGE\s*\d+|V(?:MAX|STAR)?|EX|GX|BREAK|MEGA)\s+/i, '')
      .trim();
    if (candidate.length > 1 && /[A-Za-zÀ-ÿ]/.test(candidate))
      return cleanName(candidate);
  }

  return '';
}

// ─── Variantes de número (con y sin zero-padding) ────────────────────────────

function numberVariants(num) {
  const n = parseInt(num, 10);
  return [...new Set([
    num,
    String(n),
    String(n).padStart(2, '0'),
    String(n).padStart(3, '0'),
  ])];
}

// ─── Lookup en v_cards_unified ────────────────────────────────────────────────

/**
 * Busca coincidencias por nombre + número.
 * Prioriza coincidencias exactas de nombre sobre parciales.
 */
async function lookupByNameAndNumber(nombre, numero) {
  const variants = numberVariants(numero);
  const { rows } = await pool.query(`
    SELECT
      set_abbr,
      set_name,
      card_number,
      lang_code,
      card_name,
      CASE WHEN LOWER(card_name) = LOWER($1) THEN 0 ELSE 1 END AS score
    FROM  v_cards_unified
    WHERE LOWER(card_name) ILIKE $2
      AND card_number = ANY($3::text[])
    ORDER BY score, set_abbr, lang_code
    LIMIT 20
  `, [nombre, `%${nombre}%`, variants]);
  return rows;
}

/**
 * Busca solo por nombre (cuando el número no está disponible o no dio resultados).
 */
async function lookupByName(nombre) {
  const { rows } = await pool.query(`
    SELECT
      set_abbr,
      set_name,
      card_number,
      lang_code,
      card_name,
      CASE WHEN LOWER(card_name) = LOWER($1) THEN 0 ELSE 1 END AS score
    FROM  v_cards_unified
    WHERE LOWER(card_name) ILIKE $2
    ORDER BY score, set_abbr, lang_code
    LIMIT 20
  `, [nombre, `%${nombre}%`]);
  return rows;
}

/**
 * Busca solo por número (último recurso cuando el nombre no está claro).
 * Devuelve solo EN para no generar demasiado ruido.
 */
async function lookupByNumber(numero) {
  const variants = numberVariants(numero);
  const { rows } = await pool.query(`
    SELECT
      set_abbr,
      set_name,
      card_number,
      lang_code,
      card_name,
      0 AS score
    FROM  v_cards_unified
    WHERE card_number = ANY($1::text[])
      AND lang_code = 'en'
    ORDER BY set_abbr
    LIMIT 20
  `, [variants]);
  return rows;
}

// ─── Nombres de idioma ────────────────────────────────────────────────────────

const LANG_LABEL = {
  en: 'English',  es: 'Español',  fr: 'Français',
  de: 'Deutsch',  it: 'Italiano', pt: 'Português',
  jp: 'Japanese', kr: 'Korean',
};

function langLabel(code) {
  const c = (code ?? '').trim();
  return LANG_LABEL[c] ?? c.toUpperCase();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'═'.repeat(58)}`);
  console.log(`  identify_from_photo.js`);
  console.log(`  Imagen : ${path.basename(imagePath)}`);
  console.log(`${'═'.repeat(58)}\n`);

  // ── PASO 1: OCR ──────────────────────────────────────────────────────────────
  let fullText = '';
  try {
    fullText = await runOcr(imagePath);
  } catch (err) {
    console.error('[OCR] Fallo total:', err.message);
    await pool.end();
    process.exit(1);
  }

  if (!fullText) {
    console.error('[OCR] No se detectó texto en la imagen.');
    await pool.end();
    process.exit(1);
  }

  if (DEBUG) {
    console.log('[DEBUG] Texto OCR completo:');
    console.log('─'.repeat(58));
    console.log(fullText);
    console.log('─'.repeat(58) + '\n');
  } else {
    console.log(`[OCR] Texto: "${fullText.replace(/\n/g, ' | ').slice(0, 120)}..."\n`);
  }

  // ── PASO 2: Extracción ───────────────────────────────────────────────────────
  const nombre = extractName(fullText);
  const numero = extractNumber(fullText);

  console.log('[PARSE]');
  console.log(`  Nombre extraído : "${nombre || '(no detectado)'}"`);
  console.log(`  Número extraído : "${numero || '(no detectado)'}"\n`);

  // ── PASO 3: Lookup inverso ───────────────────────────────────────────────────
  let matches   = [];
  let strategy  = '';

  if (nombre && numero) {
    matches  = await lookupByNameAndNumber(nombre, numero);
    strategy = 'nombre + número';
  }

  if (matches.length === 0 && nombre) {
    matches  = await lookupByName(nombre);
    strategy = 'nombre solo';
  }

  if (matches.length === 0 && numero) {
    matches  = await lookupByNumber(numero);
    strategy = 'número solo (EN)';
  }

  // ── PASO 4: Output ───────────────────────────────────────────────────────────
  if (matches.length === 0) {
    console.log('[DB] ✗ Sin coincidencias en la base de datos.\n');
    console.log(
      `Carta detectada: ${nombre || '(sin nombre)'} | ` +
      `Número: ${numero || '(sin número)'} | ` +
      `Idioma: desconocido | ` +
      `Colección probable: no encontrada`,
    );
    console.log('');
    await pool.end();
    return;
  }

  console.log(`[DB] ${matches.length} coincidencia(s) vía "${strategy}"\n`);

  // Deduplicar: una fila por (set_abbr, lang_code)
  const seen    = new Set();
  const deduped = matches.filter(r => {
    const key = `${r.set_abbr}|${(r.lang_code ?? '').trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const best = deduped[0];
  const lang = langLabel(best.lang_code);

  // Salida en el formato requerido
  console.log('═'.repeat(58));
  console.log(
    `Carta detectada: ${best.card_name} | ` +
    `Número: ${best.card_number} | ` +
    `Idioma: ${lang} | ` +
    `Colección probable: ${best.set_abbr} - ${best.set_name}`,
  );
  console.log('═'.repeat(58));

  if (deduped.length > 1) {
    console.log(`\nOtras ${deduped.length - 1} coincidencia(s) posible(s):\n`);
    for (const row of deduped.slice(1)) {
      console.log(
        `  → ${row.card_name} | ` +
        `#${row.card_number} | ` +
        `${langLabel(row.lang_code)} | ` +
        `${row.set_abbr} - ${row.set_name}`,
      );
    }
  }

  console.log('');
  await pool.end();
}

main().catch(async err => {
  console.error('\n[ERROR]', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
