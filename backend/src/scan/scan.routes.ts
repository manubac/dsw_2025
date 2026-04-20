// scan.routes.ts
// POST /api/scan — OCR con Google Cloud Vision + parser de carta Pokémon.
// Detecta el stage en cualquier idioma (desde stage_pokemon.json) para
// extraer correctamente el nombre de la carta.

import { Router, Request, Response } from 'express';
import vision from '@google-cloud/vision';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

// Pool de pg apuntando a la DB de catálogo (heroclash_dsw con tabla cards + función get_card_name_en_safe)
const catalogPool = new pg.Pool({
  connectionString:
    process.env.DB_CONNECTION_STRING ||
    'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
});

const router = Router();
const client = new vision.ImageAnnotatorClient();

// ─────────────────────────────────────────────────────────────────────────────
// Datos de referencia  (cargados una vez al arrancar)
// dist/scan/ → ../../.. → dsw_2025/
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');

interface ColeccionEntry { abbr: string; name_en: string; }
interface IdiomaEntry    { code: string; language: string; local: string; }
interface StageJson {
  languages: Record<string, {
    stages: Record<string, string>;
    special: string[];
  }>;
}

const COLECCIONES: ColeccionEntry[] = JSON.parse(readFileSync(join(ROOT, 'siglas_coleccion.json'), 'utf8'));
const IDIOMAS:     IdiomaEntry[]    = JSON.parse(readFileSync(join(ROOT, 'siglas_idioma.json'),    'utf8'));
const STAGE_DATA:  StageJson        = JSON.parse(readFileSync(join(ROOT, 'stage_pokemon.json'),    'utf8'));

const SIGLAS_MAP = new Map(COLECCIONES.map(c => [c.abbr.toUpperCase(), c]));
const LANG_MAP   = new Map(IDIOMAS.map(l => [l.code.toUpperCase(), l]));

// ── Construir lookup de stages (todas las lenguas) ────────────────────────────
// Clave: valor en minúsculas  →  { lang, stageKey, isSpecial }
interface StageInfo { lang: string; stageKey: string; isSpecial: boolean; }
const STAGE_LOOKUP = new Map<string, StageInfo>();

for (const [lang, langData] of Object.entries(STAGE_DATA.languages)) {
  for (const [stageKey, value] of Object.entries(langData.stages)) {
    STAGE_LOOKUP.set(value.toLowerCase(), { lang, stageKey, isSpecial: false });
  }
  for (const value of langData.special) {
    STAGE_LOOKUP.set(value.toLowerCase(), { lang, stageKey: 'special', isSpecial: true });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Levenshtein
// ─────────────────────────────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function resolveColeccion(raw: string): ColeccionEntry | null {
  const upper = raw.toUpperCase();
  if (SIGLAS_MAP.has(upper)) return SIGLAS_MAP.get(upper)!;
  let best: ColeccionEntry | null = null;
  let bestDist = Infinity;
  for (const [sigla, entry] of SIGLAS_MAP) {
    const dist = levenshtein(upper, sigla);
    if (dist < bestDist) { bestDist = dist; best = entry; }
  }
  return bestDist <= 1 ? best : null;
}

function resolveIdioma(raw: string): IdiomaEntry | null {
  return LANG_MAP.get(raw.toUpperCase()) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción de sigla + idioma desde el pie de la carta
// ─────────────────────────────────────────────────────────────────────────────

interface SetInfo { rawSet: string; rawLang: string; numero: string; }

/**
 * Extrae el código de colección de 3 letras desde un token OCR.
 * Para tokens de 4 letras (ej. "MEGA", "GPAF") prueba ambos substrings de 3
 * letras contiguos y prefiere el que existe en SIGLAS_MAP:
 *   "MEGA" → "MEG" (existe) antes que "EGA"
 *   "GPAF" → "PAF" (existe) antes que "GPA"
 */
function extractCode(token: string): string {
  if (token.length === 3) return token;
  if (token.length === 4) {
    const first3 = token.slice(0, 3);
    const last3  = token.slice(1);
    if (SIGLAS_MAP.has(first3) && !SIGLAS_MAP.has(last3)) return first3;
    if (SIGLAS_MAP.has(last3)  && !SIGLAS_MAP.has(first3)) return last3;
    // Ambos o ninguno existe: preferir el que tenga menor distancia Levenshtein
    // al conjunto de siglas, o usar last3 como fallback (comportamiento original).
    return last3;
  }
  if (token.length > 4) {
    // Para tokens de 5+, probar todas las ventanas de 3 y devolver la primera
    // que exista en SIGLAS_MAP.
    for (let i = 0; i <= token.length - 3; i++) {
      const sub = token.slice(i, i + 3);
      if (SIGLAS_MAP.has(sub)) return sub;
    }
    return token.slice(-3);
  }
  return token;
}

/**
 * Genera todas las variantes de sigla de 3 letras posibles desde un token OCR.
 * Ej: "MEGA" → ["MEG", "EGA"]   "GPAF" → ["GPA", "PAF"]
 */
function codeVariants(token: string): string[] {
  const t = token.toUpperCase().replace(/[^A-Z]/g, '');
  const v = new Set<string>();
  if (t.length === 3) { v.add(t); }
  else if (t.length === 4) { v.add(t.slice(0, 3)); v.add(t.slice(1)); }
  else if (t.length >= 5) { v.add(t.slice(0, 3)); v.add(t.slice(1, 4)); v.add(t.slice(-3)); }
  return [...v];
}

/**
 * Busca nombre en catálogo por sigla+número (prueba variantes de padding).
 * Primero usa get_card_name_en_safe; si no hay resultado, consulta v_cards_unified directamente.
 * Devuelve el nombre si existe, null si no.
 */
async function dbLookupCard(abbr: string, numero: string): Promise<string | null> {
  const n = parseInt(numero, 10);
  if (isNaN(n) || !abbr) return null;
  const nums = [...new Set([numero, String(n), String(n).padStart(2, '0'), String(n).padStart(3, '0')])];
  for (const num of nums) {
    try {
      const { rows } = await catalogPool.query<{ name: string }>(
        `SELECT get_card_name_en_safe($1, $2) AS name`, [abbr, num],
      );
      if (rows[0]?.name) return rows[0].name;
    } catch { /* continúa con el siguiente padding */ }
  }
  // Fallback: consultar v_cards_unified directamente (cubre sets no indexados por la función SQL)
  for (const num of nums) {
    try {
      const { rows } = await catalogPool.query<{ card_name: string }>(
        `SELECT card_name FROM v_cards_unified
         WHERE set_abbr = $1 AND card_number = $2
         ORDER BY CASE WHEN lang_code = 'en' THEN 0 ELSE 1 END, lang_code
         LIMIT 1`,
        [abbr, num],
      );
      if (rows[0]?.card_name) return rows[0].card_name;
    } catch { /* continúa */ }
  }
  return null;
}

/**
 * Busca cartas en v_cards_unified por número, rankeadas por similitud de sigla con el token OCR.
 * Cubre el caso donde la sigla está garbled/ausente pero el número es confiable.
 */
async function queryByNumberWithSiglaRank(
  numero: string,
  siglaRef: string,
): Promise<ReverseLookupMatch[]> {
  const n = parseInt(numero, 10);
  if (isNaN(n)) return [];
  const nums = [...new Set([numero, String(n), String(n).padStart(2, '0'), String(n).padStart(3, '0')])];
  try {
    const { rows } = await catalogPool.query<ReverseLookupMatch>(
      `SELECT set_abbr, set_name, card_number, lang_code, card_name
       FROM v_cards_unified
       WHERE card_number = ANY($1::text[])
       ORDER BY CASE WHEN lang_code = 'en' THEN 0 ELSE 1 END, set_abbr
       LIMIT 50`,
      [nums],
    );
    if (rows.length === 0) return [];
    if (!siglaRef) return rows;
    const ref = siglaRef.toUpperCase();
    return rows
      .map(r => ({ r, dist: levenshtein(r.set_abbr.toUpperCase(), ref) }))
      .sort((a, b) => a.dist - b.dist)
      .map(({ r }) => r);
  } catch (err: any) {
    console.warn('[scan] queryByNumberWithSiglaRank falló:', err.message);
    return [];
  }
}

function extractSetInfo(text: string): SetInfo {
  const upper = text.toUpperCase();

  // Bug fix: se eliminó \b para capturar números pegados a letras (e.g. "MIG056/132").
  // Se usa .index del match en lugar de indexOf para mayor confiabilidad.
  const numMatch = upper.match(/(\d+)\/(\d+)/);
  const numero   = numMatch ? String(parseInt(numMatch[1], 10)) : '';
  if (!numMatch) return { rawSet: '', rawLang: '', numero: '' };

  const numIdx = numMatch.index!;
  const before = upper.substring(0, numIdx).trim();
  const tokens = before.split(/\s+/).filter(t => /^[A-Z]+$/.test(t));

  if (tokens.length === 0) return { rawSet: '', rawLang: '', numero };

  const last       = tokens[tokens.length - 1];
  const secondLast = tokens.length >= 2 ? tokens[tokens.length - 2] : '';

  let rawSet = '', rawLang = '';

  if (last.length === 2 && secondLast.length >= 3) {
    // e.g. "GPAF EN" → lang="EN", set desde "GPAF" → "PAF"
    rawSet  = extractCode(secondLast);
    rawLang = last;
  } else if (last.length >= 5) {
    // set+lang concatenados, e.g. "PAFEN" (5) o "GPAFEN" (6 = prefijo+set+lang)
    if (last.length === 6) {
      rawSet  = last.slice(1, 4);   // prefijo+set+lang: saltar primera letra
      rawLang = last.slice(4, 6);
    } else {
      rawSet  = last.slice(0, 3);
      rawLang = last.slice(3, 5);
    }
  } else if (last.length === 3) {
    rawSet = last;
  } else if (last.length === 4) {
    // Token de 4 letras sin lang aparte: primera letra es prefijo
    rawSet = extractCode(last);
  } else if (last.length === 2 && secondLast.length > 0) {
    rawLang = last;
    rawSet  = extractCode(secondLast);
  }

  return { rawSet, rawLang, numero };
}

// ─────────────────────────────────────────────────────────────────────────────
// Extracción del nombre — solo para cartas Pokémon
//
// Algoritmo:
//   1. Revisar cada línea en busca de un stage conocido al principio
//      (chequeando 1 palabra y 2 palabras para stages multi-palabra como "Stage 1")
//   2. Si se encuentra un stage → el nombre es todo lo que sigue hasta "HP N"
//   3. Fallback: línea que contenga "HP N" y tomar lo que está antes
// ─────────────────────────────────────────────────────────────────────────────

interface NameResult {
  nombre:    string;
  stage:     string;       // valor del stage detectado, ej: "Basic"
  stageLang: string;       // idioma del stage, ej: "en"
  stageKey:  string;       // clave, ej: "basic"
}

const HP_MARKER = /^(?:HP|PS|PV|ПС|体力)$/i;

function wordsUntilHp(words: string[]): string {
  // Detecta HP "pegado": "CX280" = 1-2 letras + 3+ dígitos (ej. HP280 → GX 280)
  const MANGLED_HP = /^[A-Z]{1,2}\d{3,}$/i;
  // Detecta HP sin texto previo: número standalone múltiplo de 10 en rango típico (30–400).
  // Cubre casos como "STAGE! Mega Camerupt ex 340" donde "340" es el HP sin etiqueta "HP".
  const STANDALONE_HP = (w: string) => {
    const n = parseInt(w, 10);
    return /^\d{2,3}$/.test(w) && n >= 30 && n <= 400 && n % 10 === 0;
  };
  const hpIdx = words.findIndex(
    (w, i) => (HP_MARKER.test(w) && /^\d+$/.test(words[i + 1] ?? ''))
              || MANGLED_HP.test(w)
              || STANDALONE_HP(w)
  );
  return (hpIdx >= 0 ? words.slice(0, hpIdx) : words).join(' ').trim();
}

/** Limpia el nombre: quita sufijos de nivel (LV.48), normaliza espacios. */
function cleanName(raw: string): string {
  return raw
    .replace(/\s+LV\.\d+$/i, '')
    .replace(/\s+Level\s+\d+$/i, '')
    .replace(/[^\x20-\x7EáéíóúàèìòùâêîôûäëïöüñçãõÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÇÃÕ''\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Texto típico de carta que nunca es un nombre de Pokémon.
// Usado en extractNombre (Fallbacks B y C) y en el cascade para validar ocrNombre.
const GAME_TEXT = /^(?:evolves |put |attach|flip |search|draw |shuffle|discard|during |if your|when your|this pok|the pok|your opp|weakness|retreat|resistance|energy |damage|prize|bench|does |it is |illus\.|©|®|\d)/i;

/**
 * Valida que un string parezca un nombre de carta Pokémon y no flavor text
 * ni datos del Pokémon ("NO. 488 Lunar Pokémon HT: 4'11"...").
 */
function isPlausibleName(s: string): boolean {
  if (!s || s.length < 3 || s.length > 40) return false;
  if (!/^[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ'\u3040-\u9FFF]/.test(s)) return false;
  if (/^NO\.\s*\d+/i.test(s)) return false;          // "NO. 488 Pokémon data"
  if (/\d{3,}/.test(s)) return false;                 // 3+ dígitos → flavor text
  if (s.split(/\s+/).length > 5) return false;        // más de 5 palabras → oración
  if (/\b(there is|if you|you may|damage|counter|benched)\b/i.test(s)) return false;
  if (GAME_TEXT.test(s)) return false;                // texto de juego/flavor
  return true;
}

function extractNombre(lines: string[]): NameResult {
  for (let i = 0; i < lines.length; i++) {
    const line  = lines[i];
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const w0  = words[0].toLowerCase();
    const w01 = (words[0] + ' ' + (words[1] ?? '')).toLowerCase().trim();

    let stageInfo: StageInfo | undefined;
    let stageWordCount = 0;
    let stageRaw = '';

    if (STAGE_LOOKUP.has(w01)) {
      stageInfo      = STAGE_LOOKUP.get(w01)!;
      stageWordCount = 2;
      stageRaw       = words[1] !== undefined ? words[0] + ' ' + words[1] : words[0];
    } else if (STAGE_LOOKUP.has(w0)) {
      stageInfo      = STAGE_LOOKUP.get(w0)!;
      stageWordCount = 1;
      stageRaw       = words[0];
    } else {
      // Artefacto OCR: "STAGE!" o "STAGE." → limpiar puntuación e intentar de nuevo
      const w0clean = w0.replace(/[^a-záéíóúàèìòùñü]/g, '');
      if (STAGE_LOOKUP.has(w0clean)) {
        stageInfo      = STAGE_LOOKUP.get(w0clean)!;
        stageWordCount = 1;
        stageRaw       = words[0];
      } else if (/^(stage|basic|mega|vmax|vstar|break)$/.test(w0clean)) {
        // Stage parcial sin número (ej. "STAGE!" cuando OCR dropó el "1"):
        // usamos stageInfo vacío solo para activar la extracción del nombre en afterStage
        stageInfo      = { lang: 'unknown', stageKey: 'unknown', isSpecial: false };
        stageWordCount = 1;
        stageRaw       = words[0];
      }
    }

    if (!stageInfo) continue;

    // Saltar líneas de pie de carta: si la línea contiene un patrón N/M (número de carta)
    // no es una línea de nombre — evita que "MEGA 100/132" se trate como stage+nombre.
    if (/\d+\/\d+/.test(line)) continue;

    const afterStage = words.slice(stageWordCount);

    // Caso A: nombre en la misma línea que el stage — "BASIC Charmander HP 70"
    if (afterStage.length > 0) {
      const nombre = cleanName(wordsUntilHp(afterStage));
      if (isPlausibleName(nombre)) {
        return { nombre, stage: stageRaw, stageLang: stageInfo.lang, stageKey: stageInfo.stageKey };
      }
    }

    // Caso C (solo cuando el stage ocupa su propia línea): nombre en la línea ANTERIOR
    // Formato DP/HGSS antiguo: "Cresselia LV.48 \n BASIC \n ..."
    if (afterStage.length === 0 && i > 0) {
      const prevWords = lines[i - 1].split(/\s+/).filter(Boolean);
      const nombre = cleanName(wordsUntilHp(prevWords));
      if (isPlausibleName(nombre)) {
        return { nombre, stage: stageRaw, stageLang: stageInfo.lang, stageKey: stageInfo.stageKey };
      }
    }

    // Caso B: stage solo en su línea → nombre en la línea SIGUIENTE (formato moderno)
    if (i + 1 < lines.length) {
      const nextWords = lines[i + 1].split(/\s+/).filter(Boolean);
      if (!HP_MARKER.test(nextWords[0] ?? '')) {
        const nombre = cleanName(wordsUntilHp(nextWords));
        if (isPlausibleName(nombre)) {
          return { nombre, stage: stageRaw, stageLang: stageInfo.lang, stageKey: stageInfo.stageKey };
        }
      }
    }
  }

  // Fallback A: HP marker + número en la MISMA línea — "Charizard HP 120"
  for (const line of lines) {
    const hit = line.match(/^(.*?)\s+(?:HP|PS|PV)\s+\d+/i);
    if (!hit) continue;
    const candidate = cleanName(
      hit[1].replace(/^(?:BASIC|STAGE\s*\d+|V(?:MAX|STAR)?|EX|GX)\s+/i, '').trim()
    );
    if (isPlausibleName(candidate))
      return { nombre: candidate, stage: '', stageLang: '', stageKey: '' };
  }

  // Fallback B: HP marker en su propia línea y el número en la SIGUIENTE
  // Cubre el formato moderno donde OCR separa "PS" y "280" en líneas distintas:
  //   "Clodsire de Paldea ex"  ← línea i-1 → nombre
  //   "PS"                      ← línea i   → HP marker solo
  //   "280"                     ← línea i+1 → valor numérico
  for (let i = 1; i < lines.length - 1; i++) {
    if (HP_MARKER.test(lines[i].trim()) && /^\d+$/.test(lines[i + 1].trim())) {
      const candidate = cleanName(lines[i - 1]);
      if (isPlausibleName(candidate))
        return { nombre: candidate, stage: '', stageLang: '', stageKey: '' };
    }
  }

  // Fallback C: primeras 8 líneas — la primera que pase isPlausibleName y no sea un label de stage/tipo.
  // isPlausibleName ya incluye el filtro GAME_TEXT, así que solo se necesita la exclusión de labels.
  const STAGE_LABELS = /^(?:BASIC|STAGE|MEGA|VMAX|VSTAR|BREAK|GX|EX|TAG|PRISM|LEVEL|LVL|POKÉMON|POKEMON|HP|PS|PV)$/i;
  for (const line of lines.slice(0, 8)) {
    const candidate = cleanName(line);
    if (!isPlausibleName(candidate)) continue;
    if (STAGE_LOOKUP.has(candidate.toLowerCase())) continue;
    if (STAGE_LABELS.test(candidate.trim())) continue;
    return { nombre: candidate, stage: '', stageLang: '', stageKey: '' };
  }

  return { nombre: '', stage: '', stageLang: '', stageKey: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Energy card detection
// "ENERGÍA" / "ENERGY" / "ENERGIE" en mayúsculas = indicador de tipo en carta
// ─────────────────────────────────────────────────────────────────────────────

interface EnergyInfo {
  isEnergy: boolean;
  isBasic:  boolean;
  langCode: string;   // idioma detectado desde el nombre de energía, o ''
}

// Palabra "ENERGÍA/ENERGY/etc." en mayúsculas como token suelto = indicador de tipo
const ENERGY_TYPE_RE = /\bENERG(?:[ÍI]A|Y|IE)\b/;

// Nombres de "Energía Básica" en cada idioma → para confirmar básica y detectar idioma
const BASIC_ENERGY_I18N: Array<{ re: RegExp; lang: string }> = [
  { re: /energ[íi]a\s+b[aá]sica/i, lang: 'ES' },   // Español
  { re: /energia\s+b[aá]sica/i,     lang: 'PT' },   // Português
  { re: /basic\s+energy/i,          lang: 'EN' },   // English
  { re: /[eé]nergie\s+de\s+base/i,  lang: 'FR' },   // Français
  { re: /basisenergie/i,            lang: 'DE' },   // Deutsch
  { re: /energia\s+di\s+base/i,     lang: 'IT' },   // Italiano
  { re: /energi\s+dasar/i,          lang: 'ID' },   // Indonesian
];

function detectEnergyCard(text: string): EnergyInfo {
  if (!ENERGY_TYPE_RE.test(text)) return { isEnergy: false, isBasic: false, langCode: '' };
  for (const { re, lang } of BASIC_ENERGY_I18N) {
    if (re.test(text)) return { isEnergy: true, isBasic: true, langCode: lang };
  }
  return { isEnergy: true, isBasic: false, langCode: '' };
}

/**
 * Extrae sigla + idioma + número desde el pie de una carta de energía.
 *
 * Algoritmo posicional — no depende de que los tokens estén en la misma línea:
 *
 *  1. Recoge todos los tokens de 2-5 letras ASCII puras ([A-Z], sin acentos)
 *     y todos los números standalone de 1-3 dígitos (excluyendo años 4+ dígitos
 *     y valores > 300 que no son números de carta).
 *  2. Para cada número candidato, mira las 1-2 palabras inmediatamente anteriores
 *     (por posición en el texto) y deduce:
 *       - Si la palabra más cercana tiene ≥ 3 letras  → es el código de set
 *         (puede llevar sufijo de idioma fusionado, ej. "SVEB", "MEELA")
 *       - Si la palabra más cercana tiene 2 letras   → es el idioma (ej. "LA", "ES"),
 *         y la siguiente palabra anterior es el código de set
 *       - Si la palabra más cercana tiene 1 letra     → artefacto OCR, ignorar;
 *         buscar la siguiente palabra anterior como set
 *  3. Devuelve el primer par (set, número) encontrado.
 *
 * Casos cubiertos:
 *   "SVEB 007"     → rawSet=SVEB, numero=7    (sufijo de idioma fusionado)
 *   "MEELA 008"    → rawSet=MEELA, numero=8   (set+lang fusionados)
 *   "MEE LA 002"   → rawSet=MEE, rawLang=LA, numero=2
 *   "MEE A 004"    → rawSet=MEE, numero=4     ("A" descartado por ser 1 letra)
 *   "MEE\nLA\n002" → igual que "MEE LA 002" (cruza líneas)
 */
function extractEnergySetInfo(text: string): SetInfo {
  const upper = text.toUpperCase();

  // Tokens de 2-5 letras ASCII puras (Á, É, Í… quedan fuera de [A-Z])
  const words: Array<{ val: string; idx: number }> = [];
  for (const m of upper.matchAll(/\b([A-Z]{2,5})\b/g)) {
    words.push({ val: m[1], idx: m.index! });
  }

  // Números standalone: 1-3 dígitos, no parte de runs de 4+ dígitos (años, copyright)
  const nums: Array<{ val: string; idx: number }> = [];
  for (const m of upper.matchAll(/(?<!\d)(\d{1,3})(?!\d)/g)) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 300) nums.push({ val: m[1], idx: m.index! });
  }

  if (!nums.length || !words.length) return { rawSet: '', rawLang: '', numero: '' };

  for (const num of nums) {
    // Palabras que aparecen ANTES de este número, ordenadas por proximidad
    const before = words
      .filter(w => w.idx < num.idx)
      .sort((a, b) => b.idx - a.idx);   // más cercana primero

    if (!before.length) continue;

    const w0 = before[0];   // palabra más cercana al número
    const w1 = before[1];   // segunda más cercana (puede no existir)

    // w0 de ≥ 3 letras → es el código de set (ej. "MEE", "SVEB", "MEELA")
    if (w0.val.length >= 3) {
      return { rawSet: w0.val, rawLang: '', numero: String(parseInt(num.val, 10)) };
    }

    // w0 de 2 letras → probable código de idioma (ej. "LA", "ES", "PT")
    // → buscar el set en w1
    if (w0.val.length === 2 && w1 && w1.val.length >= 2) {
      return {
        rawSet:  w1.val,
        rawLang: w0.val,   // se valida en el handler; si no está en IDIOMAS se descarta
        numero:  String(parseInt(num.val, 10)),
      };
    }

    // w0 de 1 letra (artefacto OCR, ej. "A" de "LA") → ignorar, buscar set en w1
    if (w0.val.length === 1 && w1 && w1.val.length >= 2) {
      return { rawSet: w1.val, rawLang: '', numero: String(parseInt(num.val, 10)) };
    }
  }

  return { rawSet: '', rawLang: '', numero: '' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Búsqueda predictiva de energía en DB
//
// En lugar de intentar parsear el texto a un formato exacto (frágil ante OCR),
// extrae TODOS los candidatos posibles y hace una sola consulta SQL que los
// prueba a la vez. Lo que exista en la DB gana.
//
// Candidatos set:    todos los tokens ASCII 2-5 letras del texto + sus ventanas de 3.
// Candidatos número: todos los números 1-300 del texto + variantes de padding.
// Ranking:           prioriza el par (set, número) cuyo token set aparece más
//                    cerca del número en el texto (distancia de caracteres).
// ─────────────────────────────────────────────────────────────────────────────

interface EnergyMatch {
  setAbbr:    string;
  cardNumber: string;
  cardName:   string;
}

async function findEnergyCardInDB(fullText: string): Promise<EnergyMatch | null> {
  const upper = fullText.toUpperCase();

  // Números candidatos con su posición en el texto (excluye años 4+ dígitos)
  const rawNums = [...upper.matchAll(/(?<!\d)(\d{1,3})(?!\d)/g)]
    .map(m => ({ val: m[1], idx: m.index! }))
    .filter(({ val }) => { const v = parseInt(val, 10); return v >= 1 && v <= 300; });

  if (!rawNums.length) return null;

  // Variantes de padding: "7" → ["7","07","007"]
  const numVariants = [...new Set(
    rawNums.flatMap(({ val }) => {
      const v = parseInt(val, 10);
      return [val, String(v), v.toString().padStart(2, '0'), v.toString().padStart(3, '0')];
    }),
  )];

  // Tokens ASCII uppercase (2-5 letras, sin acentos) + ventanas de 3 letras
  // Ej: "SVEB" → {SVEB, SVE, VEB}   "MEELA" → {MEELA, MEE, EEL, ELA}
  const tokenPos = new Map<string, number>();   // code → posición más temprana
  for (const m of upper.matchAll(/\b([A-Z]{2,5})\b/g)) {
    const tok = m[1]; const idx = m.index!;
    if (!tokenPos.has(tok)) tokenPos.set(tok, idx);
    for (let i = 0; i <= tok.length - 3; i++) {
      const sub = tok.slice(i, i + 3);
      if (!tokenPos.has(sub)) tokenPos.set(sub, idx);
    }
  }

  if (!tokenPos.size) return null;

  try {
    // Una sola consulta: prueba todos los (set_abbr, card_number) posibles a la vez
    const { rows } = await catalogPool.query<{ set_abbr: string; card_number: string; card_name: string }>(
      `SELECT set_abbr, card_number, card_name
       FROM v_cards_unified
       WHERE set_abbr    = ANY($1::text[])
         AND card_number = ANY($2::text[])
         AND lang_code   = 'en'
       LIMIT 20`,
      [[...tokenPos.keys()], numVariants],
    );

    if (!rows.length) return null;

    // Rankear por distancia (en caracteres) entre la posición del set token
    // y la posición del número candidato en el texto OCR.
    // El par más cercano corresponde al pie de la carta real.
    const scored = rows.map(row => {
      const setPos = tokenPos.get(row.set_abbr) ?? Infinity;
      const numPos = rawNums.find(({ val }) => {
        const v = parseInt(val, 10);
        return [val, String(v), v.toString().padStart(2, '0'), v.toString().padStart(3, '0')]
          .includes(row.card_number);
      })?.idx ?? Infinity;
      return { ...row, dist: Math.abs(setPos - numPos) };
    });

    scored.sort((a, b) => a.dist - b.dist);
    const best = scored[0];
    return { setAbbr: best.set_abbr, cardNumber: best.card_number, cardName: best.card_name };
  } catch (err: any) {
    console.warn('[scan] findEnergyCardInDB falló:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse lookup — busca en v_cards_unified por nombre (y número opcional)
// cuando no se detectó la colección desde el pie de la carta.
// ─────────────────────────────────────────────────────────────────────────────

interface ReverseLookupMatch {
  set_abbr:    string;
  set_name:    string;
  card_number: string;
  lang_code:   string;
  card_name:   string;
}

/**
 * Normaliza un nombre para búsqueda flexible: minúsculas, elimina todo lo que
 * no sea letra o dígito. "Mega-Latias ex" → "megalatiasex".
 */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9áéíóúàèìòùñü]/g, '');
}

/**
 * Devuelve true si los dos nombres se refieren probablemente al mismo Pokémon.
 * Compara los primeros 7 caracteres normalizados de cada nombre y verifica que
 * uno contenga al otro (maneja "Mega-Latias" ↔ "Mega-Latias ex", etc.).
 */
function namesOverlap(a: string, b: string): boolean {
  if (!a || !b) return true;   // sin nombre OCR → no podemos descartar
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return true;
  const prefix = Math.min(7, Math.min(na.length, nb.length));
  return na.includes(nb.slice(0, prefix)) || nb.includes(na.slice(0, prefix));
}

/**
 * Ejecuta una consulta de nombre flexible contra v_cards_unified.
 * Busca por coincidencia directa (ILIKE) y por nombre normalizado (sin acentos/guiones).
 * Si se pasan variantes de número, filtra por ellas; si no, busca en todos los números.
 */
async function queryByName(
  term: string,
  variants: string[],
): Promise<ReverseLookupMatch[]> {
  const normTerm = normalizeName(term);

  const scoreExpr = `
    CASE
      WHEN LOWER(card_name) = LOWER($1)                                                    THEN 0
      WHEN LOWER(card_name) ILIKE LOWER($1) || ' %'                                        THEN 1
      WHEN REGEXP_REPLACE(LOWER(card_name),'[^a-z0-9áéíóúàèìòùñü]','','g') = $2           THEN 2
      WHEN REGEXP_REPLACE(LOWER(card_name),'[^a-z0-9áéíóúàèìòùñü]','','g') LIKE $2 || '%' THEN 3
      ELSE 4
    END
  `;
  const whereNames = `(
    LOWER(card_name) ILIKE '%' || LOWER($1) || '%'
    OR REGEXP_REPLACE(LOWER(card_name),'[^a-z0-9áéíóúàèìòùñü]','','g') LIKE '%' || $2 || '%'
  )`;

  try {
  if (variants.length > 0) {
    const { rows } = await catalogPool.query<ReverseLookupMatch>(
      `SELECT set_abbr, set_name, card_number, lang_code, card_name
       FROM v_cards_unified
       WHERE ${whereNames} AND card_number = ANY($3::text[])
       ORDER BY ${scoreExpr}, set_abbr, lang_code
       LIMIT 10`,
      [term, normTerm, variants],
    );
    return rows;
  }

  const { rows } = await catalogPool.query<ReverseLookupMatch>(
    `SELECT set_abbr, set_name, card_number, lang_code, card_name
     FROM v_cards_unified
     WHERE ${whereNames}
     ORDER BY ${scoreExpr}, set_abbr, lang_code
     LIMIT 10`,
    [term, normTerm],
  );
  return rows;
  } catch (err: any) {
    console.warn('[scan] queryByName falló:', err.message);
    return [];
  }
}

/**
 * Reverse lookup en cascada:
 *   1. Nombre completo + número  (ej. "Clodsire de Paldea ex" + "94")
 *   2. Nombre completo sin número
 *   3. Primera palabra significativa + número  (ej. "Clodsire" + "94")
 *      → cubre idiomas distintos: "Clodsire de Paldea ex" → encuentra "Clodsire ex" EN
 *   4. Primera palabra significativa sin número
 */
async function reverseLookup(nombre: string, numero: string): Promise<ReverseLookupMatch[]> {
  if (!nombre) return [];

  const n = parseInt(numero, 10);
  const variants: string[] = numero && !isNaN(n)
    ? [...new Set([numero, String(n), String(n).padStart(2, '0'), String(n).padStart(3, '0')])]
    : [];

  // Primera palabra con al menos 4 letras y no una partícula o sufijo de tipo
  const PARTICLES = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'ex', 'gx', 'vmax', 'vstar']);
  const firstSigWord = nombre.split(/\s+/).find(
    w => w.length >= 4 && !PARTICLES.has(w.toLowerCase())
  ) ?? '';

  try {
    // (1) Nombre completo + número
    if (variants.length > 0) {
      const rows = await queryByName(nombre, variants);
      if (rows.length > 0) return rows;
    }

    // (2) Nombre completo sin número
    {
      const rows = await queryByName(nombre, []);
      if (rows.length > 0) return rows;
    }

    // (3) Primera palabra significativa + número
    if (firstSigWord && firstSigWord !== nombre && variants.length > 0) {
      const rows = await queryByName(firstSigWord, variants);
      if (rows.length > 0) return rows;
    }

    // (4) Primera palabra significativa sin número
    if (firstSigWord && firstSigWord !== nombre) {
      const rows = await queryByName(firstSigWord, []);
      return rows;
    }

    return [];
  } catch (err: any) {
    console.warn('[scan] reverseLookup falló:', err.message);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scan
// ─────────────────────────────────────────────────────────────────────────────

router.post('/', async (req: Request, res: Response) => {
  const { image } = req.body as { image?: string };

  if (!image) {
    return res.status(400).json({ success: false, mensaje: 'Falta el campo "image" en Base64.' });
  }

  const base64 = image.includes(',') ? image.split(',')[1] : image;

  try {
    const [result] = await client.documentTextDetection({
      image: { content: base64 },
    });

    const fullText = result.fullTextAnnotation?.text?.trim() ?? '';

    if (!fullText) {
      return res.status(200).json({
        success: false,
        mensaje: 'No se detectó texto en la imagen.',
        nombre: '', coleccion: '', numero: '', fullText: '',
      });
    }

    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

    // ── Detección temprana de carta de energía ────────────────────────────────
    const energyInfo = detectEnergyCard(fullText);

    // ── Pie de carta: sigla + idioma + número ─────────────────────────────────
    let { rawSet, rawLang, numero } = extractSetInfo(fullText);

    // Cartas de energía no tienen formato N/M en el pie → fallback a "SIGLA [LANG] NNN"
    if (energyInfo.isEnergy && !rawSet) {
      const ef = extractEnergySetInfo(fullText);
      if (ef.rawSet) {
        rawSet  = ef.rawSet;
        numero  = ef.numero;
        if (ef.rawLang) rawLang = ef.rawLang;
      }
    }

    // Si el idioma del pie no se reconoce (ej. "LA" para Latinoamérica) o está vacío,
    // usar el idioma detectado desde el texto de la energía básica ("Energía Básica" → ES).
    if (energyInfo.isBasic && energyInfo.langCode && !resolveIdioma(rawLang)) {
      rawLang = energyInfo.langCode;
    }

    const coleccionEntry = rawSet  ? resolveColeccion(rawSet)  : null;
    const idiomaEntry    = rawLang
      ? resolveIdioma(rawLang)
      : coleccionEntry ? resolveIdioma('EN') : null;   // si hay colección pero no idioma → EN por defecto

    // ── Nombre de la carta ───────────────────────────────────────────────────
    // Para cartas de energía el nombre viene solo de la DB (colección+número),
    // no del OCR — "Energía Básica" no es el nombre real de la carta.
    const nameResult = energyInfo.isEnergy
      ? { nombre: '', stage: '', stageLang: '', stageKey: '' }
      : extractNombre(lines);

    // ── Resolución validada contra la DB ─────────────────────────────────────
    // Estrategia en cascada hasta encontrar una carta REAL:
    //   (1) Sigla del pie tal cual + número
    //   (2) Variantes de la sigla OCR (ej. "MEGA" → prueba "MEG" y "EGA")
    //   (2b) Número + ranking por similitud de sigla (cubre sigla garbled y nombre ausente)
    //   (3) Reverse lookup por nombre OCR + número
    //   (4) Fallback OCR (no confirmado por DB)
    type FuenteColeccion = 'footer' | 'footer-alt' | 'number-name' | 'reverse' | 'ocr';

    let nombreFinal    = nameResult.nombre;
    let coleccionFinal = coleccionEntry?.abbr ?? rawSet;
    let idiomaFinal    = idiomaEntry?.code.toUpperCase() ?? rawLang;
    let numeroFinal    = numero;
    let fuente: FuenteColeccion = 'ocr';
    let reverseMatches: ReverseLookupMatch[] = [];
    let dbName: string | null = null;

    const ocrNombre = nameResult.nombre;

    // (1-energía) Búsqueda predictiva para cartas de energía
    // Una sola consulta SQL prueba todos los tokens del texto (+ ventanas de 3 letras)
    // contra todos los números 1-300 del texto. Lo que esté en la DB gana.
    // Ranking por proximidad de texto: el par (set, número) más cercano en el OCR
    // corresponde al pie de carta real.
    if (energyInfo.isEnergy) {
      const em = await findEnergyCardInDB(fullText);
      if (em) {
        dbName         = em.cardName;
        nombreFinal    = em.cardName;
        coleccionFinal = em.setAbbr;
        numeroFinal    = em.cardNumber;
        rawSet         = em.setAbbr;    // para logging correcto
        fuente         = 'footer';
        console.log(`[scan]   (1-energía) "${em.cardName}" en ${em.setAbbr}#${em.cardNumber}`);
      }
    }

    // (1) Sigla primaria del pie + número
    // La sigla está confirmada en SIGLAS_MAP y el número viene del patrón N/M del pie.
    // Juntos identifican la carta unívocamente → siempre confiamos en el resultado de DB.

    if (coleccionEntry && numero) {
      const name = await dbLookupCard(coleccionEntry.abbr, numero);
      if (name) {
        dbName = name; nombreFinal = name; fuente = 'footer';
      }
    }

    // (2) Variantes alternativas de la sigla (ej. "MEGA" → ["MEG", "EGA"])
    if (!dbName && rawSet && numero) {
      for (const variant of codeVariants(rawSet)) {
        if (variant === coleccionEntry?.abbr) continue;
        const altEntry = SIGLAS_MAP.get(variant) ?? null;
        if (!altEntry) continue;
        const name = await dbLookupCard(altEntry.abbr, numero);
        if (name && namesOverlap(name, ocrNombre)) {
          dbName         = name;
          nombreFinal    = name;
          coleccionFinal = altEntry.abbr;
          idiomaFinal    = rawLang ? (resolveIdioma(rawLang)?.code.toUpperCase() ?? rawLang) : 'EN';
          fuente         = 'footer-alt';
          break;
        }
      }
    }

    // (2b) Número + nombre → colección
    // Se activa cuando pasos 1/2 fallaron y hay número.
    // Con nombre confiable: filtra por nombre+número en SQL (sin límite artificial de candidatos).
    // Sin nombre confiable: busca por número y rankea por similitud de sigla con rawSet.
    // Para cartas de energía se omite: no hay nombre Pokémon útil en el OCR.
    if (!dbName && numero && !energyInfo.isEnergy) {
      const nParsed    = parseInt(numero, 10);
      const numVariants = !isNaN(nParsed)
        ? [...new Set([numero, String(nParsed), String(nParsed).padStart(2, '0'), String(nParsed).padStart(3, '0')])]
        : [numero];

      const ocrNombreConfiable = ocrNombre.length >= 4 && !GAME_TEXT.test(ocrNombre);
      let candidates: ReverseLookupMatch[] = [];

      if (ocrNombreConfiable) {
        // Filtrar por nombre+número en SQL: más preciso y sin el límite de candidatos
        candidates = await queryByName(ocrNombre, numVariants);
        // Si el nombre completo no da resultados, probar con la primera palabra significativa
        if (candidates.length === 0) {
          const PART = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'ex', 'gx', 'vmax', 'vstar']);
          const firstSig = ocrNombre.split(/\s+/).find(w => w.length >= 4 && !PART.has(w.toLowerCase())) ?? '';
          if (firstSig && firstSig !== ocrNombre) candidates = await queryByName(firstSig, numVariants);
        }
      }

      if (candidates.length === 0) {
        // Fallback: buscar por número, luego filtrar/rankear en JS
        const byNum = await queryByNumberWithSiglaRank(numero, rawSet);
        candidates   = ocrNombreConfiable ? byNum.filter(c => namesOverlap(c.card_name, ocrNombre)) : byNum;
      }

      // Rankear por similitud de sigla con el token OCR del pie
      if (candidates.length > 0 && rawSet) {
        const ref = rawSet.toUpperCase();
        candidates = [...candidates]
          .map(r => ({ r, dist: levenshtein(r.set_abbr.toUpperCase(), ref) }))
          .sort((a, b) => a.dist - b.dist)
          .map(({ r }) => r);
      }

      const best = candidates[0] ?? null;
      if (best) {
        dbName         = best.card_name;
        nombreFinal    = best.card_name;
        coleccionFinal = best.set_abbr;
        idiomaFinal    = best.lang_code.trim().toUpperCase();
        numeroFinal    = best.card_number;
        fuente         = 'number-name';
        reverseMatches = candidates;
        console.log(`[scan]   (2b) "${best.card_name}" en ${best.set_abbr}  candidatos: ${candidates.length}`);
      } else {
        console.log(`[scan]   (2b) sin resultado — número: "${numero}"  nombre OCR: "${ocrNombre}"  rawSet: "${rawSet}"`);
      }
    }

    // (3) Reverse lookup por nombre OCR + número
    // Se activa cuando pasos 1/2/2b no encontraron nada, hay nombre OCR confiable
    // (no texto de juego como "Evolves from...") y ese nombre puede servir de búsqueda.
    // Para cartas de energía se omite: no tiene nombre Pokémon en el OCR.
    if (!dbName && ocrNombre && !GAME_TEXT.test(ocrNombre) && !energyInfo.isEnergy) {
      reverseMatches = await reverseLookup(ocrNombre, numero);
      // Rankear candidatos por similitud de sigla con rawSet (igual que paso 2b)
      if (reverseMatches.length > 1 && rawSet) {
        const ref = rawSet.toUpperCase();
        reverseMatches = [...reverseMatches]
          .map(r => ({ r, dist: levenshtein(r.set_abbr.toUpperCase(), ref) }))
          .sort((a, b) => a.dist - b.dist)
          .map(({ r }) => r);
      }
      const best = reverseMatches[0] ?? null;
      if (best) {
        dbName         = best.card_name;
        nombreFinal    = best.card_name;
        coleccionFinal = best.set_abbr;
        idiomaFinal    = best.lang_code.trim().toUpperCase();
        fuente         = 'reverse';
        // Si el OCR no detectó número pero la DB sí lo tiene, usarlo
        if (!numeroFinal) numeroFinal = best.card_number;
      }
    }

    // (2c) Post-confirmación: nombre EN definitivo + número OCR → colección exacta
    // Cuando pasos 2b/3 encontraron el nombre buscando por nombre OCR (posiblemente en
    // otro idioma o parcial), usamos el nombre EN confirmado + el número OCR para hacer
    // una búsqueda precisa que devuelva la colección y número definitivos.
    if (dbName && numero) {
      const nParsed = parseInt(numero, 10);
      const numVars = !isNaN(nParsed)
        ? [...new Set([numero, String(nParsed), String(nParsed).padStart(2, '0'), String(nParsed).padStart(3, '0')])]
        : [numero];
      try {
        const { rows } = await catalogPool.query<{ set_abbr: string; card_number: string }>(
          `SELECT set_abbr, card_number FROM v_cards_unified
           WHERE LOWER(card_name) = LOWER($1) AND lang_code = 'en'
             AND card_number = ANY($2::text[])
           LIMIT 1`,
          [dbName, numVars],
        );
        if (rows[0]) {
          if (coleccionFinal !== rows[0].set_abbr || numeroFinal !== rows[0].card_number) {
            console.log(`[scan]   (2c) colección ${coleccionFinal}→${rows[0].set_abbr}  número ${numeroFinal}→${rows[0].card_number}`);
            coleccionFinal = rows[0].set_abbr;
            numeroFinal    = rows[0].card_number;
          }
        }
      } catch { /* continúa con los valores anteriores */ }
    }

    // ── Log detallado ─────────────────────────────────────────────────────────
    console.log('\n[scan] ─────────────────────────────────────────────────');
    console.log(`[scan] texto: "${fullText.replace(/\n/g, ' | ')}"`);
    if (energyInfo.isEnergy) {
      console.log(`[scan] ─── carta de energía ────────────────────────────`);
      console.log(`[scan]   tipo           : ${energyInfo.isBasic ? 'Energía Básica' : 'Energía especial'}`);
      if (energyInfo.langCode) console.log(`[scan]   idioma (energía): "${energyInfo.langCode}"`);
    }
    console.log('[scan] ─── stage detectado ─────────────────────────────');
    if (nameResult.stage) {
      console.log(`[scan]   stage raw      : "${nameResult.stage}"`);
      console.log(`[scan]   stage idioma   : "${nameResult.stageLang}"  clave: "${nameResult.stageKey}"`);
    } else {
      console.log(`[scan]   stage          : (no detectado — fallback HP)`);
    }
    console.log('[scan] ─── pie de carta ────────────────────────────────');
    console.log(`[scan]   rawSet  bruto  : "${rawSet}"`);
    console.log(`[scan]   rawLang bruto  : "${rawLang}"`);
    if (coleccionEntry) {
      console.log(`[scan]   colección      : "${coleccionEntry.abbr}"  →  ${coleccionEntry.name_en}${coleccionEntry.abbr !== rawSet.toUpperCase() ? `  (corregido desde "${rawSet}")` : ''}`);
    } else {
      console.log(`[scan]   colección raw  : "${rawSet}" — probando variantes: [${codeVariants(rawSet).join(', ')}]`);
    }
    if (idiomaEntry && rawLang) {
      console.log(`[scan]   idioma         : "${idiomaEntry.code.toUpperCase()}"  →  ${idiomaEntry.language} / ${idiomaEntry.local}`);
    } else if (idiomaEntry && !rawLang) {
      console.log(`[scan]   idioma         : "EN"  (inferido)`);
    } else if (rawLang) {
      console.log(`[scan]   idioma         : "${rawLang}" (no reconocido)`);
    } else {
      console.log(`[scan]   idioma         : (no detectado)`);
    }
    console.log(`[scan]   número         : "${numeroFinal}"${numero !== numeroFinal ? `  (corregido desde OCR "${numero}")` : ''}`);
    console.log('[scan] ─── resultado final ─────────────────────────────');
    console.log(`[scan]   nombre ocr     : "${nameResult.nombre}"`);
    if (dbName) {
      console.log(`[scan]   nombre DB      : "${dbName}"  ← fuente: ${fuente}`);
    }
    if (fuente === 'reverse' && reverseMatches.length > 1) {
      console.log(`[scan]   candidatos     : ${reverseMatches.map(r => `${r.set_abbr}#${r.card_number}`).join(', ')}`);
    }
    console.log(`[scan]   nombre final   : "${nombreFinal}"  colección: ${coleccionFinal}  fuente: ${fuente}`);
    console.log('[scan] ─────────────────────────────────────────────────\n');

    return res.status(200).json({
      success:          true,
      nombre:           nombreFinal,
      coleccion:        coleccionFinal,
      numero:           numeroFinal,
      idioma:           idiomaFinal,
      fullText,
      fuenteColeccion:  fuente,
      candidatos:       reverseMatches.length > 1 ? reverseMatches : undefined,
    });

  } catch (err: any) {
    console.error('[scan] error Google Vision:', err.message);
    return res.status(500).json({
      success: false,
      mensaje: 'Error al procesar la imagen con Google Vision.',
      debug: process.env.NODE_ENV !== 'production' ? err.message : undefined,
    });
  }
});

export default router;
