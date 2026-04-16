// lookupService.ts
// Responsabilidad: tomar el resultado del ocrService y buscar la carta
// correspondiente en la base de datos del marketplace.
//
// Campos en Carta disponibles para identificación:
//   • Carta.name       — nombre de la carta  ("Charizard ex")
//   • Carta.setName    — nombre completo del set ("Obsidian Flames")
//   • Carta.setCode    — código corto del set ("SV04", "BW", etc.)
//   • Carta.cardNumber — número dentro del set ("184")
//   • Carta.price, Carta.image, Carta.rarity, Carta.link

import { orm } from '../../shared/db/orm.js';
import { Carta } from '../../carta/carta.entity.js';
import { findByLocalName, findByLocalNameAnySet } from './translationService.js';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface OcrInput {
  nombre: string;
  codigoColeccion: string;   // e.g. "SV04"
  numero: string;            // e.g. "184"
  totalColeccion: string;    // e.g. "198"
  claveLookup: string;       // e.g. "SV04-184"
  confidence: 'high' | 'low';
}

export interface CartaResult {
  id: number | undefined;
  nombre: string;
  coleccion: string;
  numero: string;
  precio: number;
  imagenUrl: string;
  rareza: string;
  link: string;
}

export interface LookupResult {
  match: 'exact' | 'fuzzy' | 'none';
  results: CartaResult[];
  /** Idioma detectado si se usó traducción (e.g. "fr"). Undefined si no se tradujo. */
  langDetected?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convierte una entidad Carta al formato de respuesta del módulo de identificación. */
function toResult(carta: Carta): CartaResult {
  return {
    id:         carta.id,
    nombre:     carta.name,
    coleccion:  carta.setName ?? '',
    numero:     carta.cardNumber ?? '',
    precio:     carta.price ? parseFloat(carta.price.replace(/[^0-9.]/g, '')) : 0,
    imagenUrl:  carta.image ?? '',
    rareza:     carta.rarity ?? '',
    link:       carta.link ?? '',
  };
}

/**
 * Scoring JS-side para búsqueda fuzzy.
 * Devuelve un número 0-N: cantidad de palabras del query que aparecen en el
 * nombre de la carta. MySQL LIKE ya filtró los que contienen alguna palabra;
 * esto solo reordena por relevancia.
 */
function scoreMatch(cartaNombre: string, queryNombre: string): number {
  const palabras = queryNombre.toLowerCase().split(/\s+/).filter(Boolean);
  const target   = cartaNombre.toLowerCase();
  return palabras.reduce((acc, p) => acc + (target.includes(p) ? 1 : 0), 0);
}

// ---------------------------------------------------------------------------
// Búsqueda principal
// ---------------------------------------------------------------------------

export async function lookup(ocrResult: OcrInput): Promise<LookupResult> {
  const em = orm.em.fork();

  try {
    // ── PRIORIDAD 1: Exact match por número + setCode ────────────────────
    // Usa cardNumber y setCode — campos agregados a la entidad Carta.
    // Este match es el más preciso: si el OCR extrajo "SV04" y "184", busca
    // exactamente esa carta sin ambigüedad de nombre.

    if (ocrResult.confidence === 'high' && ocrResult.claveLookup) {
      const [setCode, num] = ocrResult.claveLookup.split('-');
      const cartaExacta = await em.findOne(
        Carta,
        { cardNumber: num, setCode },
        { populate: ['cartaClass'] }
      );
      if (cartaExacta) {
        return { match: 'exact', results: [toResult(cartaExacta)] };
      }
    }

    // ── PRIORIDAD 1b: Exact match por nombre exacto (sin número/set) ─────
    if (ocrResult.confidence === 'high' && ocrResult.nombre) {
      const exact = await em.findOne(
        Carta,
        { name: ocrResult.nombre },
        { populate: ['cartaClass'] }
      );
      if (exact) {
        return { match: 'exact', results: [toResult(exact)] };
      }
    }

    // ── PRIORIDAD 1c: Traducción de nombre local → número+set en inglés ──
    // Entra cuando el nombre en la carta NO está en inglés y las prioridades
    // anteriores no encontraron nada.
    // Casos:
    //   A) abbr detectada (e.g. "OBF") → busca en ese set específico
    //   B) abbr vacía o no reconocida   → busca en cualquier set (último recurso)
    if (ocrResult.nombre) {
      const translation = ocrResult.codigoColeccion
        ? await findByLocalName(ocrResult.nombre, ocrResult.codigoColeccion)
        : await findByLocalNameAnySet(ocrResult.nombre);

      if (translation) {
        const { cardLocalId, setAbbr, langCode } = translation;
        console.log(`[lookup] traducción encontrada: idioma=${langCode}, setAbbr=${setAbbr}, localId=${cardLocalId}`);

        // Intenta localId tal cual, y también con zero-padding (e.g. "4" → "004")
        const localIdPadded = cardLocalId.padStart(3, '0');
        const candidates = [cardLocalId, localIdPadded];

        for (const num of candidates) {
          const translated = await em.findOne(
            Carta,
            { cardNumber: num, setCode: setAbbr },
            { populate: ['cartaClass'] },
          );
          if (translated) {
            return { match: 'exact', results: [toResult(translated)], langDetected: langCode };
          }
        }

        // Si no hay carta en nuestra DB con ese número, al menos buscamos por setCode
        const bySet = await em.find(
          Carta,
          { setCode: setAbbr },
          { populate: ['cartaClass'], limit: 10 },
        );
        if (bySet.length > 0) {
          return { match: 'fuzzy', results: bySet.map(toResult), langDetected: langCode };
        }
      }
    }

    // ── PRIORIDAD 2: Fuzzy match por nombre (+ bonus por setCode) ────────
    if (ocrResult.nombre) {
      const palabras = ocrResult.nombre.split(/\s+/).filter(Boolean);
      const likeConditions = palabras.map(p => ({ name: { $like: `%${p}%` } }));

      const candidates = await em.find(
        Carta,
        { $or: likeConditions },
        { populate: ['cartaClass'], limit: 30 }
      );

      if (candidates.length > 0) {
        // Scoring: palabras en común + bonus +2 si el setCode coincide
        const setCodeOcr = ocrResult.codigoColeccion?.toUpperCase() ?? '';
        const ranked = candidates
          .map(c => {
            let score = scoreMatch(c.name, ocrResult.nombre);
            if (setCodeOcr && c.setCode?.toUpperCase() === setCodeOcr) score += 2;
            return { carta: c, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(({ carta }) => toResult(carta));

        return { match: 'fuzzy', results: ranked };
      }
    }

    // ── PRIORIDAD 3: No se encontró nada ─────────────────────────────────
    return { match: 'none', results: [] };

  } catch (err) {
    // El pipeline nunca debe romperse por un error de DB
    console.error('lookupService: error durante la búsqueda', err);
    return { match: 'none', results: [] };
  }
}
