// embeddingService.ts
// Responsabilidad: fallback de identificación por similitud visual con CLIP.
// Solo se activa cuando lookupService devuelve match: "none".
//
// Flujo:
//   1. Generar embedding de la imagen croppeada usando CLIP vit-base-patch32
//   2. Comparar contra embeddings pre-generados del catálogo (embeddings.json)
//   3. Retornar top 5 con cosine similarity > 0.75
//
// Pre-requisito: correr scripts/generate-embeddings.ts para generar el catálogo.

import path from 'path';
import fs   from 'fs/promises';
import type { CartaResult } from './lookupService.js';

// @xenova/transformers es opcional — si no está instalado el fallback visual
// queda desactivado pero el resto del pipeline sigue funcionando.
let _pipelineFn: typeof import('@xenova/transformers')['pipeline'] | null = null;
try {
  const mod = await import('@xenova/transformers');
  _pipelineFn = mod.pipeline;
  console.log('[embeddingService] @xenova/transformers cargado.');
} catch (err: any) {
  console.warn('[embeddingService] @xenova/transformers no disponible — similitud visual desactivada:', err.message);
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface EmbeddingEntry extends CartaResult {
  embedding: number[];
}

export interface EmbeddingResult {
  match: 'embedding' | 'none';
  results: CartaResult[];
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// La ruta es relativa al CWD del proceso (backend/).
// tsc compila a dist/ pero embeddings.json vive en src/ — no se copia.
// El servidor se inicia siempre desde backend/, así que process.cwd() funciona.
const EMBEDDINGS_PATH = path.resolve(process.cwd(), 'src/identify/data/embeddings.json');

const MODEL_ID          = 'Xenova/clip-vit-base-patch32';
const SIMILARITY_THRESH = 0.75;
const TOP_K             = 5;

// ---------------------------------------------------------------------------
// Singletons con carga lazy (Promise-cached para evitar cargas concurrentes)
// ---------------------------------------------------------------------------

let _extractorPromise: Promise<any> | null = null;

function getExtractor(): Promise<any> | null {
  if (!_pipelineFn) return null;
  if (!_extractorPromise) {
    console.log('[embedding] cargando modelo CLIP (primera vez, puede tardar)...');
    _extractorPromise = _pipelineFn('image-feature-extraction', MODEL_ID).then((ext: any) => {
      console.log('[embedding] modelo CLIP listo');
      return ext;
    });
  }
  return _extractorPromise;
}

let _catalogPromise: Promise<EmbeddingEntry[]> | null = null;

function getCatalog(): Promise<EmbeddingEntry[]> {
  if (!_catalogPromise) {
    _catalogPromise = fs.readFile(EMBEDDINGS_PATH, 'utf-8')
      .then(raw => {
        const entries: EmbeddingEntry[] = JSON.parse(raw);
        console.log(`[embedding] catálogo cargado: ${entries.length} cartas`);
        return entries;
      })
      .catch(err => {
        // Si el archivo no existe o es inválido, devolver catálogo vacío
        // sin romper el servidor. Generar con: pnpm generate-embeddings
        console.warn('[embedding] embeddings.json no disponible:', err.message);
        return [] as EmbeddingEntry[];
      });
  }
  return _catalogPromise;
}

// ---------------------------------------------------------------------------
// Similitud de coseno
// ---------------------------------------------------------------------------

// Con embeddings normalizados (normalize: true en CLIP) equivale al dot product,
// pero esta implementación funciona también con embeddings sin normalizar.
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Función principal exportada
// ---------------------------------------------------------------------------

export async function findSimilar(imageBuffer: Buffer): Promise<EmbeddingResult> {
  try {
    const extractorPromise = getExtractor();
    if (!extractorPromise) return { match: 'none', results: [] };

    // Carga en paralelo: el modelo puede estar cargando mientras se lee el catálogo
    const [extractor, catalog] = await Promise.all([extractorPromise, getCatalog()]);

    if (catalog.length === 0) {
      return { match: 'none', results: [] };
    }

    // Generar embedding de la imagen de entrada
    const dataUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    const output  = await extractor(dataUrl, { pooling: 'mean', normalize: true });
    const queryEmbedding: number[] = Array.from(output.data as Float32Array);

    // Calcular similitud contra todo el catálogo y quedarse con top K
    const scored = catalog
      .map(entry => ({
        score:  cosineSimilarity(queryEmbedding, entry.embedding),
        result: entry as CartaResult,
      }))
      .filter(({ score }) => score >= SIMILARITY_THRESH)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    if (scored.length === 0) {
      return { match: 'none', results: [] };
    }

    // Quitar el campo embedding del resultado (no es útil para el cliente)
    const results: CartaResult[] = scored.map(({ result }) => {
      const { ...rest } = result as EmbeddingEntry;
      // @ts-ignore — eliminar embedding del objeto devuelto al cliente
      delete (rest as any).embedding;
      return rest;
    });

    return { match: 'embedding', results };

  } catch (err) {
    console.error('[embedding] error durante búsqueda por similitud:', err);
    return { match: 'none', results: [] };
  }
}

// Invalidar caché del catálogo (útil después de regenerar embeddings.json)
export function invalidateCatalogCache(): void {
  _catalogPromise = null;
}
