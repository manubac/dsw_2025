// identify.ts  (route handler)
// Responsabilidad: exponer POST /api/identify
// Recibe: multipart/form-data con campo "image" (jpg/jpeg/png/webp, max 10 MB)
// Devuelve: carta identificada o mensaje de error estructurado

import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { crop, debugCrop } from '../services/cropService.js';
import { extractText }     from '../services/ocrService.js';
import { lookup }          from '../services/lookupService.js';
import { findSimilar }     from '../services/embeddingService.js';

const IS_DEV = process.env.NODE_ENV !== 'production';

// ---------------------------------------------------------------------------
// Multer: memoria (no disco), 10 MB, solo imágenes
// ---------------------------------------------------------------------------

const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    if (ALLOWED_MIME.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Formato no soportado: ${file.mimetype}. Usá jpg, jpeg, png o webp.`));
    }
  },
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const identifyRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify/debug-crop  — tuning de parámetros de detección
// ─────────────────────────────────────────────────────────────────────────────

identifyRouter.post(
  '/debug-crop',
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (!err) return next();
      return res.status(400).json({ success: false, mensaje: err.message ?? 'Error al procesar el archivo.' });
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, mensaje: 'Falta el campo "image".' });
    }

    const parseNum = (v: unknown, fallback?: number): number | undefined => {
      const n = Number(v);
      return isNaN(n) ? fallback : n;
    };

    try {
      const result = await debugCrop(req.file.buffer, {
        toleranceOverride: req.body.toleranceAuto === 'true' || req.body.toleranceAuto === true
          ? undefined
          : parseNum(req.body.tolerance),
        borderEstimate: parseNum(req.body.borderEstimate),
        procSize:       parseNum(req.body.procSize),
        blurRadius:     parseNum(req.body.blurRadius),
        stablePercent:  parseNum(req.body.stablePercent) !== undefined
          ? parseNum(req.body.stablePercent)! / 100
          : undefined,
      });
      return res.status(200).json({ success: true, ...result });
    } catch (e: any) {
      console.error('[debug-crop] error:', e);
      return res.status(500).json({ success: false, mensaje: IS_DEV ? e.message : 'internal error' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/identify
// ─────────────────────────────────────────────────────────────────────────────

identifyRouter.post(
  '/',
  // Multer como middleware inline — errores de tamaño/formato se capturan abajo
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (!err) return next();

      // Error de tamaño (multer lanza MulterError con code LIMIT_FILE_SIZE)
      if ((err as any).code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          mensaje: `La imagen supera el límite de 10 MB.`,
        });
      }

      // Error de formato (lanzado por fileFilter)
      return res.status(400).json({
        success: false,
        mensaje: err.message ?? 'Error al procesar el archivo adjunto.',
      });
    });
  },

  async (req: Request, res: Response) => {
    // ── Validar que llegó el archivo ──────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({
        success: false,
        mensaje: 'No se recibió ninguna imagen. Enviá el campo "image" como multipart/form-data.',
      });
    }

    const imageBuffer = req.file.buffer;
    console.log(`[identify] imagen recibida: ${req.file.originalname} (${req.file.size} bytes)`);

    try {
      // ── PASO 1: Crop + corrección de perspectiva ──────────────────────
      console.log('[identify] ejecutando cropService...');
      const croppedBuffer = await crop(imageBuffer);
      const cropAplicado  = croppedBuffer !== imageBuffer;
      console.log(`[identify] crop done (aplicado=${cropAplicado})`);

      // ── PASO 2: OCR ───────────────────────────────────────────────────
      console.log('[identify] ejecutando ocrService...');
      const ocrResult = await extractText(croppedBuffer);
      console.log('[identify] OCR result:', JSON.stringify(ocrResult));

      // ── PASO 3: Lookup en la DB ───────────────────────────────────────
      console.log('[identify] ejecutando lookupService...');
      const lookupResult = await lookup(ocrResult);
      console.log(`[identify] match: ${lookupResult.match}, resultados: ${lookupResult.results.length}`);

      // ── PASO 4: Fallback por similitud visual (solo si lookup no encontró nada)
      let embeddingUsado = false;
      let finalResults   = lookupResult.results;
      let finalMatch     = lookupResult.match as string;

      if (lookupResult.match === 'none') {
        console.log('[identify] lookup sin resultado, probando similitud visual...');
        const embResult = await findSimilar(croppedBuffer);
        console.log(`[identify] embedding match: ${embResult.match}, resultados: ${embResult.results.length}`);

        if (embResult.match === 'embedding') {
          finalResults   = embResult.results;
          finalMatch     = 'embedding';
          embeddingUsado = true;
        }
      }

      // ── Debug payload (siempre presente, stack trace nunca) ───────────
      const debug = {
        crop_aplicado:     cropAplicado,
        ancla_encontrada:  ocrResult.debug.anclaEncontrada,
        fallback_usado:    ocrResult.debug.fallbackUsado,
        embedding_usado:   embeddingUsado,
        lang_detected:     lookupResult.langDetected,
        ocr_raw: {
          nombre:           ocrResult.nombre,
          codigoColeccion:  ocrResult.codigoColeccion,
          numero:           ocrResult.numero,
          claveLookup:      ocrResult.claveLookup,
        },
      };

      // ── Carta no encontrada (ni OCR ni embeddings) ────────────────────
      if (finalResults.length === 0) {
        return res.status(200).json({
          success: false,
          mensaje: 'No encontramos esta carta en nuestra base de datos',
          match:      'none',
          confidence: ocrResult.confidence,
          debug,
        });
      }

      // ── Carta encontrada: primer resultado como principal ─────────────
      const [top, ...rest] = finalResults;

      const carta = {
        id:         top.id,
        nombre:     top.nombre,
        coleccion:  top.coleccion,
        setCode:    ocrResult.codigoColeccion || undefined,
        numero:     ocrResult.numero
          ? `${ocrResult.numero}${ocrResult.totalColeccion ? '/' + ocrResult.totalColeccion : ''}`
          : top.numero,
        precio:     top.precio,
        imagen_url: top.imagenUrl,
        rareza:     top.rareza,
        link:       top.link,
      };

      return res.status(200).json({
        success:    true,
        carta,
        candidatos: rest.length > 0 ? rest : undefined,
        match:      finalMatch,
        confidence: ocrResult.confidence,
        debug,
      });

    } catch (e: any) {
      console.error('[identify] error inesperado:', e);

      return res.status(500).json({
        success: false,
        mensaje: 'Error al procesar la imagen',
        debug: {
          // stack trace solo en desarrollo
          error: IS_DEV ? e.message : 'internal error',
        },
      });
    }
  }
);
