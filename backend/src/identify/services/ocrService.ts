// ocrService.ts
// Responsabilidad: extraer texto de una carta Pokémon ya croppeada (600×840 px).
//
// Mejoras sobre la versión anterior:
//   • CLAHE (contrast-limited adaptive histogram equalization) antes de binarizar
//   • Mayor factor de escala para zonas pequeñas (6×)
//   • OCR secuencial (no paralelo) para evitar race conditions en el worker
//   • Múltiples intentos de preprocessing para nombre, colección y número
//   • Corrección post-OCR de errores comunes (0↔O, 1↔I, etc.)

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const IS_DEV = process.env.NODE_ENV !== 'production';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cv: any = null;
try {
  cv = (await import('opencv4nodejs')).default as any;
} catch {}

import { createWorker, Worker, OEM, PSM } from 'tesseract.js';

// ─────────────────────────────────────────────────────────────────────────────
// Layout de la carta normalizada 600×840 px
// Carta física: 88 mm alto × 63 mm ancho
// ─────────────────────────────────────────────────────────────────────────────

const W = 600;
const H = 840;

const PX_PER_MM_X = W / 63;   // ≈ 9.524
const PX_PER_MM_Y = H / 88;   // ≈ 9.545

function mmFromBottomToY(mmSuperior: number): number {
  return Math.round((88 - mmSuperior) * PX_PER_MM_Y);
}

// Nombre: ancho 11–47 mm, alto 80–85.5 mm desde abajo
const ROI_NAME = {
  x: Math.round(11 * PX_PER_MM_X),
  y: mmFromBottomToY(85.5),
  w: Math.round((47 - 11) * PX_PER_MM_X),
  h: Math.round((85.5 - 80) * PX_PER_MM_Y),
};

// Colección: ancho 5.5–10.5 mm, alto 3–6.5 mm desde abajo
const FALLBACK_COLLECTION = {
  x: Math.round(5.5 * PX_PER_MM_X),
  y: mmFromBottomToY(6.5),
  w: Math.round((10.5 - 5.5) * PX_PER_MM_X),
  h: Math.round((6.5 - 3) * PX_PER_MM_Y),
};

// Número: ancho 10–20 mm, alto 3–6.5 mm desde abajo (ligeramente más ancho)
const FALLBACK_NUMBER = {
  x: Math.round(10 * PX_PER_MM_X),
  y: mmFromBottomToY(6.5),
  w: Math.round((20 - 10) * PX_PER_MM_X),
  h: Math.round((6.5 - 3) * PX_PER_MM_Y),
};

// Franja de búsqueda del ancla
const ANCHOR_STRIP_Y_START = mmFromBottomToY(9);
const ANCHOR_STRIP_Y_END   = Math.round(H * 0.99);

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

interface Roi { x: number; y: number; w: number; h: number; }

interface OcrResult {
  nombre: string;
  codigoColeccion: string;
  numero: string;
  totalColeccion: string;
  claveLookup: string;
  confidence: 'high' | 'low';
  debug: { anclaEncontrada: boolean; fallbackUsado: boolean; };
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker singleton
// ─────────────────────────────────────────────────────────────────────────────

let _worker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (_worker) return _worker;
  _worker = await createWorker('eng', OEM.LSTM_ONLY);
  return _worker;
}

export async function terminateWorker(): Promise<void> {
  if (_worker) { await _worker.terminate(); _worker = null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Preprocessing
// ─────────────────────────────────────────────────────────────────────────────

interface PreprocOpts {
  scale:      number;
  invert?:    boolean;
  threshold?: number;   // 0-255, umbral de binarización
  clahe?:     boolean;  // aplicar CLAHE antes de binarizar
}

/** Extrae un ROI de la imagen como Buffer PNG. */
async function extractRoi(imageBuffer: Buffer, roi: Roi): Promise<Buffer> {
  return sharp(imageBuffer)
    .extract({ left: roi.x, top: roi.y, width: roi.w, height: roi.h })
    .toFormat('png')
    .toBuffer();
}

/**
 * Preprocesa un ROI para OCR:
 *   1. Escala ×scale (6× para texto pequeño, 4× para nombres)
 *   2. Convierte a escala de grises
 *   3. CLAHE opcional — realza contraste local adaptativo
 *   4. Normaliza el histograma
 *   5. Sharpening — acentúa bordes de los trazos
 *   6. Inversión opcional (texto blanco sobre oscuro)
 *   7. Binarización con umbral fijo
 */
async function preprocessRoi(buf: Buffer, opts: PreprocOpts): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  const w = Math.round((meta.width  ?? 60) * opts.scale);
  const h = Math.round((meta.height ?? 20) * opts.scale);

  let pipe = sharp(buf)
    .resize(w, h, { kernel: 'lanczos3' })
    .grayscale();

  // CLAHE: mejora el contraste local sin saturar zonas homogéneas
  // Especialmente útil para texto impreso sobre fondos con gradiente
  if (opts.clahe !== false) {
    pipe = pipe.clahe({ width: 8, height: 8, maxSlope: 3 });
  }

  pipe = pipe
    .normalise()
    .sharpen({ sigma: 1.5, m1: 0.5, m2: 20 }); // realza trazos en negrita

  if (opts.invert) {
    pipe = pipe.negate();
  }

  pipe = pipe.threshold(opts.threshold ?? 130);

  return pipe.toFormat('png').toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR helpers
// ─────────────────────────────────────────────────────────────────────────────

async function runOcr(
  worker: Worker,
  buf: Buffer,
  psm: PSM,
  whitelist?: string,
): Promise<string> {
  const params: Record<string, string> = {
    tessedit_pageseg_mode: String(psm),
    // Activa el motor de reconocimiento mejorado para texto en negrita
    lstm_choice_mode: '2',
  };
  if (whitelist) params['tessedit_char_whitelist'] = whitelist;
  await worker.setParameters(params);
  const { data } = await worker.recognize(buf);
  return data.text.trim();
}

/** Limpieza genérica: deja solo caracteres alfanuméricos, /, - y espacio. */
function cleanText(raw: string): string {
  return raw.replace(/[^A-Za-z0-9/\- ]/g, '').trim();
}

/** Limpieza del nombre: elimina no-imprimibles y normaliza espacios. */
function cleanName(raw: string): string {
  return raw.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

/** Parsea "184/198" → { numero, totalColeccion }. */
function parseNumber(raw: string): { numero: string; totalColeccion: string } {
  const m = raw.match(/(\d+)\/(\d+)/);
  if (m) return { numero: m[1], totalColeccion: m[2] };
  const solo = raw.match(/(\d+)/);
  return { numero: solo ? solo[1] : '', totalColeccion: '' };
}

/**
 * Correcciones post-OCR para campos numéricos/alfanuméricos.
 * Tesseract confunde frecuentemente:
 *   O ↔ 0,  I ↔ 1,  l ↔ 1,  S ↔ 5,  B ↔ 8,  Z ↔ 2
 */
function fixOcrErrors(text: string, mode: 'number' | 'setcode'): string {
  if (mode === 'number') {
    // En el campo numérico solo deben haber dígitos y "/"
    return text
      .replace(/[oO]/g, '0')
      .replace(/[iIlL]/g, '1')
      .replace(/[sS]/g, '5')
      .replace(/[bB]/g, '8')
      .replace(/[zZ]/g, '2');
  }
  // set code: letras + dígitos (ej: "SV04", "PAL", "BW")
  return text
    .replace(/0/g, 'O')  // en set codes el 0 suele ser O (ej: "PAR" no "PAR0")
    .toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// OCR de cada zona — con múltiples intentos de preprocessing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intenta OCR sobre un ROI con varias combinaciones de preprocessing.
 * Devuelve el primer resultado no vacío; si todos fallan, devuelve ''.
 */
async function ocrWithFallback(
  worker: Worker,
  buf: Buffer,
  attempts: Array<{ opts: PreprocOpts; psm: PSM; whitelist?: string }>,
): Promise<string> {
  for (const { opts, psm, whitelist } of attempts) {
    try {
      const proc = await preprocessRoi(buf, opts);
      const text = await runOcr(worker, proc, psm, whitelist);
      const cleaned = cleanText(text);
      if (cleaned.length > 0) return cleaned;
    } catch (e: any) {
      console.warn('[ocr] intento fallido:', e.message);
    }
  }
  return '';
}

async function ocrName(worker: Worker, imageBuffer: Buffer): Promise<string> {
  const raw = await extractRoi(imageBuffer, ROI_NAME);

  const text = await ocrWithFallback(worker, raw, [
    // Intento 1: texto oscuro sobre fondo claro, CLAHE activado
    { opts: { scale: 4, invert: false, clahe: true,  threshold: 120 }, psm: PSM.SINGLE_LINE },
    // Intento 2: umbral más bajo para capturar más contraste
    { opts: { scale: 4, invert: false, clahe: true,  threshold: 150 }, psm: PSM.SINGLE_LINE },
    // Intento 3: sin CLAHE, normalización estándar
    { opts: { scale: 4, invert: false, clahe: false, threshold: 128 }, psm: PSM.SINGLE_LINE },
  ]);

  return cleanName(text);
}

async function ocrCollection(worker: Worker, imageBuffer: Buffer, roi: Roi): Promise<string> {
  const raw = await extractRoi(imageBuffer, roi);

  // El código de colección suele ser texto BLANCO sobre fondo NEGRO/OSCURO
  // → invertir la imagen antes de binarizar para tener texto negro sobre fondo blanco
  const rawText = await ocrWithFallback(worker, raw, [
    // Intento 1: invertido (texto blanco → negro), CLAHE + alta escala
    {
      opts: { scale: 6, invert: true, clahe: true, threshold: 110 },
      psm: PSM.SINGLE_WORD,
      whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    },
    // Intento 2: sin invertir (texto oscuro sobre fondo claro)
    {
      opts: { scale: 6, invert: false, clahe: true, threshold: 130 },
      psm: PSM.SINGLE_WORD,
      whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    },
    // Intento 3: PSM SINGLE_LINE con umbral diferente
    {
      opts: { scale: 6, invert: true, clahe: false, threshold: 128 },
      psm: PSM.SINGLE_LINE,
      whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    },
  ]);

  // Corrección de errores típicos en códigos de set
  return fixOcrErrors(rawText, 'setcode');
}

async function ocrNumber(worker: Worker, imageBuffer: Buffer, roi: Roi): Promise<string> {
  const raw = await extractRoi(imageBuffer, roi);

  const rawText = await ocrWithFallback(worker, raw, [
    // Intento 1: texto oscuro, CLAHE + alta escala
    {
      opts: { scale: 6, invert: false, clahe: true, threshold: 130 },
      psm: PSM.SINGLE_LINE,
      whitelist: '0123456789/',
    },
    // Intento 2: umbral más bajo
    {
      opts: { scale: 6, invert: false, clahe: true, threshold: 110 },
      psm: PSM.SINGLE_LINE,
      whitelist: '0123456789/',
    },
    // Intento 3: invertido (a veces el número tiene fondo oscuro)
    {
      opts: { scale: 6, invert: true, clahe: true, threshold: 130 },
      psm: PSM.SINGLE_LINE,
      whitelist: '0123456789/',
    },
  ]);

  return fixOcrErrors(rawText, 'number');
}

// ─────────────────────────────────────────────────────────────────────────────
// Detección del ancla (recuadro negro del código de colección) con OpenCV
// ─────────────────────────────────────────────────────────────────────────────

interface AnchorResult { found: boolean; roi: Roi; }

async function findAnchorRoi(imageBuffer: Buffer): Promise<AnchorResult> {
  if (!cv) return { found: false, roi: FALLBACK_COLLECTION };

  try {
    const stripH   = ANCHOR_STRIP_Y_END - ANCHOR_STRIP_Y_START;
    const stripBuf = await sharp(imageBuffer)
      .extract({ left: 0, top: ANCHOR_STRIP_Y_START, width: W, height: stripH })
      .toFormat('png')
      .toBuffer();

    const mat  = cv.imdecode(stripBuf);
    const hsv  = mat.cvtColor(cv.COLOR_BGR2HSV);
    const vCh  = hsv.splitChannels()[2];
    const mask = vCh.threshold(40, 255, cv.THRESH_BINARY_INV);
    const contours = mask.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best: any | null = null;
    let bestArea = Infinity;

    for (const c of contours) {
      const rect: any = c.boundingRect();
      const { width: rw, height: rh } = rect;
      if (rw === 0 || rh === 0) continue;
      const ar = rw / rh;
      if (ar < 1.0 || ar > 4.0) continue;
      const area = rw * rh;
      if (area < 50 || area > W * stripH * 0.25) continue;
      if (area < bestArea) { bestArea = area; best = rect; }
    }

    if (!best) return { found: false, roi: FALLBACK_COLLECTION };

    return {
      found: true,
      roi: { x: best.x, y: ANCHOR_STRIP_Y_START + best.y, w: best.width, h: best.height },
    };
  } catch {
    return { found: false, roi: FALLBACK_COLLECTION };
  }
}

function deriveRois(anchor: Roi): { collection: Roi; number: Roi } {
  const number: Roi = {
    x: Math.min(anchor.x + anchor.w + 4, W - 1),
    y: anchor.y,
    w: Math.min(Math.round(anchor.w * 2.5), W - (anchor.x + anchor.w + 4)),
    h: anchor.h,
  };
  return { collection: { ...anchor }, number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Punto de entrada público
// ─────────────────────────────────────────────────────────────────────────────

export async function extractText(croppedBuffer: Buffer): Promise<OcrResult> {
  const worker = await getWorker();

  // PASO 1: Buscar ancla
  const anchor       = await findAnchorRoi(croppedBuffer);
  const fallbackUsado = !anchor.found;

  // PASO 2: Derivar ROIs
  let collectionRoi: Roi;
  let numberRoi: Roi;

  if (anchor.found) {
    const derived = deriveRois(anchor.roi);
    collectionRoi = derived.collection;
    numberRoi     = derived.number;
  } else {
    collectionRoi = FALLBACK_COLLECTION;
    numberRoi     = FALLBACK_NUMBER;
  }

  console.log(`[ocr] ancla: found=${anchor.found}, col=${JSON.stringify(collectionRoi)}, num=${JSON.stringify(numberRoi)}`);

  // PASO 3 (debug): guardar ROIs solo en desarrollo
  if (IS_DEV) {
    const debugDir = path.resolve(process.cwd(), 'debug-ocr');
    try {
      await fs.mkdir(debugDir, { recursive: true });
      await sharp(croppedBuffer).toFile(path.join(debugDir, '1_cropped_full.png'));
      await sharp(croppedBuffer)
        .extract({ left: ROI_NAME.x, top: ROI_NAME.y, width: ROI_NAME.w, height: ROI_NAME.h })
        .toFile(path.join(debugDir, '2_roi_name.png'));
      await sharp(croppedBuffer)
        .extract({ left: collectionRoi.x, top: collectionRoi.y, width: collectionRoi.w, height: collectionRoi.h })
        .toFile(path.join(debugDir, '3_roi_collection.png'));
      await sharp(croppedBuffer)
        .extract({ left: numberRoi.x, top: numberRoi.y, width: numberRoi.w, height: numberRoi.h })
        .toFile(path.join(debugDir, '4_roi_number.png'));
    } catch (e: any) {
      console.warn('[ocr] no se pudieron guardar debug images:', e.message);
    }
  }

  // PASO 4: OCR secuencial (evita race conditions en el worker compartido)
  const rawCollection = await ocrCollection(worker, croppedBuffer, collectionRoi)
    .catch(e => { console.error('[ocr] collection error:', e.message); return ''; });

  const rawNumber = await ocrNumber(worker, croppedBuffer, numberRoi)
    .catch(e => { console.error('[ocr] number error:', e.message); return ''; });

  const nombre = await ocrName(worker, croppedBuffer)
    .catch(e => { console.error('[ocr] name error:', e.message); return ''; });

  console.log(`[ocr] resultado → nombre="${nombre}" | col="${rawCollection}" | num="${rawNumber}"`);

  // PASO 5: Parsear y estructurar
  const { numero, totalColeccion } = parseNumber(rawNumber);
  const codigoColeccion = rawCollection.toUpperCase();
  const claveLookup     = codigoColeccion && numero ? `${codigoColeccion}-${numero}` : '';

  return {
    nombre,
    codigoColeccion,
    numero,
    totalColeccion,
    claveLookup,
    confidence: claveLookup ? 'high' : 'low',
    debug: { anclaEncontrada: anchor.found, fallbackUsado },
  };
}
