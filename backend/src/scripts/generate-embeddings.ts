// generate-embeddings.ts
// Genera embeddings CLIP para todas las cartas del catálogo y los guarda en
// src/identify/data/embeddings.json, listo para ser usado por embeddingService.
//
// Uso:
//   pnpm generate-embeddings
//   (o: npx tsx src/scripts/generate-embeddings.ts)
//
// Nota sobre tamaño: ~18500 cartas × 512 floats × ~10 chars = ~95 MB de JSON.
// El archivo se carga una vez en memoria al iniciar el servidor (~75 MB RAM).
// Si el tamaño es un problema, considerar formato binario (Float32 base64).
//
// Soporte de reanudación: si se interrumpe, volver a correr continúa desde
// donde quedó usando los IDs ya presentes en embeddings.json.

import 'reflect-metadata';
import path    from 'path';
import fs      from 'fs/promises';
import { pipeline, env } from '@xenova/transformers';
import { orm }   from '../shared/db/orm.js';
import { Carta } from '../carta/carta.entity.js';
import { parsePrice } from '../shared/parsePrice.js';

// Descargar modelos del hub de Hugging Face (se cachean en ~/.cache/huggingface)
env.allowRemoteModels = true;

const OUTPUT_PATH   = path.resolve(process.cwd(), 'src/identify/data/embeddings.json');
const MODEL_ID      = 'Xenova/clip-vit-base-patch32';
const BATCH_SIZE    = 5;   // inferencias en paralelo (limitado por CPU/memoria)
const LOG_EVERY     = 100; // mostrar progreso cada N cartas

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convierte una carta a la URL o data-URL que acepta el extractor CLIP. */
function toImageInput(carta: Carta): string | null {
  if (!carta.image) return null;

  // Si es una URL HTTP, usarla directamente (el extractor la descarga)
  if (carta.image.startsWith('http')) return carta.image;

  // Si es base64 en bruto (sin prefijo), añadir el data-URL header
  if (!carta.image.startsWith('data:')) {
    // Detectar PNG vs JPEG por magic bytes decodificados
    const start = carta.image.slice(0, 8);
    const mime  = start.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${carta.image}`;
  }

  return carta.image;
}

/** Genera el embedding de una imagen. Lanza excepción si falla. */
async function embed(extractor: any, imageInput: string): Promise<number[]> {
  const output = await extractor(imageInput, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/** Procesa un lote de cartas en paralelo. Retorna los entries generados. */
async function processBatch(
  extractor: any,
  batch:     Carta[],
): Promise<Array<{ id: number; nombre: string; coleccion: string; precio: number; imagenUrl: string; rareza: string; link: string; embedding: number[] }>> {
  const results = await Promise.allSettled(
    batch.map(async carta => {
      const imageInput = toImageInput(carta);
      if (!imageInput) throw new Error('sin imagen');

      const embedding = await embed(extractor, imageInput);

      return {
        id:        carta.id!,
        nombre:    carta.name,
        coleccion: carta.setName ?? '',
        precio:    parsePrice(carta.price),
        // Para cartas con imagen base64, guardar solo el link como URL pública
        imagenUrl: carta.image?.startsWith('http') ? carta.image : (carta.link ?? ''),
        rareza:    carta.rarity ?? '',
        link:      carta.link ?? '',
        embedding,
      };
    })
  );

  const entries = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'fulfilled') {
      entries.push(r.value);
    } else {
      console.warn(`  ✗ carta ${batch[i].id} (${batch[i].name}): ${r.reason?.message ?? r.reason}`);
    }
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // ── Cargar embeddings existentes para soporte de reanudación ─────────────
  let existing: Array<{ id: number; embedding: number[] }> = [];
  try {
    const raw = await fs.readFile(OUTPUT_PATH, 'utf-8');
    existing = JSON.parse(raw);
    if (existing.length > 0) {
      console.log(`Reanudando: ${existing.length} cartas ya procesadas.`);
    }
  } catch {
    // Archivo no existe todavía — empezar desde cero
  }
  const processedIds = new Set(existing.map(e => e.id));

  // ── Inicializar modelo ────────────────────────────────────────────────────
  console.log(`Cargando modelo ${MODEL_ID}...`);
  const extractor = await pipeline('image-feature-extraction', MODEL_ID);
  console.log('Modelo listo.\n');

  // ── Fetch cartas de la DB ─────────────────────────────────────────────────
  const em    = orm.em.fork();
  const todas = await em.find(Carta, {});
  const pendientes = todas.filter(c => c.image && !processedIds.has(c.id!));

  console.log(`Total cartas en DB: ${todas.length}`);
  console.log(`Pendientes de procesar: ${pendientes.length}\n`);

  if (pendientes.length === 0) {
    console.log('Nada que procesar. embeddings.json está actualizado.');
    process.exit(0);
  }

  // ── Procesar en lotes ─────────────────────────────────────────────────────
  const allEntries = [...existing];
  let processed = 0;
  let failed     = 0;
  const startTime = Date.now();

  for (let i = 0; i < pendientes.length; i += BATCH_SIZE) {
    const batch   = pendientes.slice(i, i + BATCH_SIZE);
    const entries = await processBatch(extractor, batch);

    allEntries.push(...entries);
    processed += entries.length;
    failed    += batch.length - entries.length;

    // Progreso cada LOG_EVERY cartas
    if (Math.floor((i + BATCH_SIZE) / LOG_EVERY) > Math.floor(i / LOG_EVERY)) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const total   = processed + failed;
      const rate    = total > 0 ? (total / parseFloat(elapsed)).toFixed(1) : '?';
      const eta     = total > 0
        ? Math.round((pendientes.length - total) / parseFloat(rate))
        : '?';

      console.log(
        `[${processed + failed}/${pendientes.length}] ` +
        `OK: ${processed}  ✗: ${failed}  ` +
        `${rate} cartas/s  ETA: ${eta}s`
      );
    }

    // Guardar progreso parcial cada 500 cartas para no perder todo si se interrumpe
    if (processed % 500 === 0 && processed > 0) {
      await fs.writeFile(OUTPUT_PATH, JSON.stringify(allEntries));
    }
  }

  // ── Guardar resultado final ───────────────────────────────────────────────
  console.log(`\nGuardando ${allEntries.length} entries en ${OUTPUT_PATH}...`);
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(allEntries));

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\nFinalizado en ${totalTime} minutos.`);
  console.log(`  Procesadas: ${processed}`);
  console.log(`  Fallidas:   ${failed}`);
  console.log(`  Total en archivo: ${allEntries.length}`);

  await orm.close();
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
