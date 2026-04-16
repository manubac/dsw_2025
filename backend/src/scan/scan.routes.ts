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
  return null;
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
  // Detecta también HP "pegado" en OCR: "CX280" = 1-2 letras + 3+ dígitos (ej. HP280 → GX 280)
  const MANGLED_HP = /^[A-Z]{1,2}\d{3,}$/i;
  const hpIdx = words.findIndex(
    (w, i) => (HP_MARKER.test(w) && /^\d+$/.test(words[i + 1] ?? ''))
              || MANGLED_HP.test(w)
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

/**
 * Valida que un string parezca un nombre de carta Pokémon y no flavor text
 * ni datos del Pokémon ("NO. 488 Lunar Pokémon HT: 4'11"...").
 */
function isPlausibleName(s: string): boolean {
  if (!s || s.length < 2 || s.length > 40) return false;
  if (!/^[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ'\u3040-\u9FFF]/.test(s)) return false;
  if (/^NO\.\s*\d+/i.test(s)) return false;          // "NO. 488 Pokémon data"
  if (/\d{3,}/.test(s)) return false;                 // 3+ dígitos → flavor text
  if (s.split(/\s+/).length > 5) return false;        // más de 5 palabras → oración
  if (/\b(there is|if you|you may|damage|counter|benched)\b/i.test(s)) return false;
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
      stageRaw       = words[0] + ' ' + words[1];
    } else if (STAGE_LOOKUP.has(w0)) {
      stageInfo      = STAGE_LOOKUP.get(w0)!;
      stageWordCount = 1;
      stageRaw       = words[0];
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

  return { nombre: '', stage: '', stageLang: '', stageKey: '' };
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

    // ── Pie de carta: sigla + idioma + número ─────────────────────────────────
    const { rawSet, rawLang, numero } = extractSetInfo(fullText);
    const coleccionEntry = rawSet  ? resolveColeccion(rawSet)  : null;
    const idiomaEntry    = rawLang
      ? resolveIdioma(rawLang)
      : coleccionEntry ? resolveIdioma('EN') : null;   // si hay colección pero no idioma → EN por defecto

    // ── Nombre de la carta ───────────────────────────────────────────────────
    const nameResult = extractNombre(lines);

    // ── Resolución validada contra la DB ─────────────────────────────────────
    // Estrategia en cascada hasta encontrar una carta REAL:
    //   (1) Sigla del pie tal cual + número
    //   (2) Variantes de la sigla OCR (ej. "MEGA" → prueba "MEG" y "EGA")
    //   (3) Reverse lookup por nombre OCR + número
    //   (4) Fallback OCR (no confirmado por DB)
    type FuenteColeccion = 'footer' | 'footer-alt' | 'reverse' | 'ocr';

    let nombreFinal    = nameResult.nombre;
    let coleccionFinal = coleccionEntry?.abbr ?? rawSet;
    let idiomaFinal    = idiomaEntry?.code.toUpperCase() ?? rawLang;
    let fuente: FuenteColeccion = 'ocr';
    let reverseMatches: ReverseLookupMatch[] = [];
    let dbName: string | null = null;

    const ocrNombre = nameResult.nombre;

    // (1) Sigla primaria del pie + número
    if (coleccionEntry && numero) {
      const name = await dbLookupCard(coleccionEntry.abbr, numero);
      if (name) {
        if (namesOverlap(name, ocrNombre)) {
          dbName = name; nombreFinal = name; fuente = 'footer';
        } else {
          // Carta encontrada pero nombre no coincide con OCR → guardamos como
          // último recurso pero seguimos buscando algo mejor.
          console.log(`[scan]   (1) descartar "${name}" en ${coleccionEntry.abbr} — no coincide con OCR "${ocrNombre}"`);
        }
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

    // (3) Reverse lookup por nombre OCR + número
    // Se activa cuando:
    //   a) pasos 1/2 no encontraron nada, O
    //   b) la carta del pie no coincidía con el nombre OCR (y tenemoss nombre)
    if (!dbName && ocrNombre) {
      reverseMatches = await reverseLookup(ocrNombre, numero);
      const best = reverseMatches[0] ?? null;
      if (best) {
        dbName         = best.card_name;
        nombreFinal    = best.card_name;
        coleccionFinal = best.set_abbr;
        idiomaFinal    = best.lang_code.trim().toUpperCase();
        fuente         = 'reverse';
      }
    }

    // ── Log detallado ─────────────────────────────────────────────────────────
    console.log('\n[scan] ─────────────────────────────────────────────────');
    console.log(`[scan] texto: "${fullText.replace(/\n/g, ' | ')}"`);
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
    console.log(`[scan]   número         : "${numero}"`);
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
      numero,
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
