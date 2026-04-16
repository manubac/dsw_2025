// cropService.ts
// Responsabilidad: recibir la imagen completa de la carta y devolver la carta
// recortada y con perspectiva corregida como Buffer PNG (600×840 px).
//
// Pipeline principal (puro-JS, sin OpenCV):
//   1. Samplear color de fondo desde las esquinas de la imagen
//   2. Flood-fill BFS desde el borde → máscara de fondo
//   3. Detectar los 4 vértices del rectángulo de la carta en la máscara
//   4. Transformación de perspectiva (homografía DLT + bilineal)
//
// Pipeline OpenCV (si está disponible):
//   Canny → contornos → approxPolyDP → warpPerspective
//
// Fallback final si ningún método converge: resize simple a 600×840.

import sharp from 'sharp';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cv: any = null;
try {
  cv = (await import('opencv4nodejs')).default as any;
  console.log('[cropService] opencv4nodejs cargado.');
} catch (err: any) {
  console.warn('[cropService] opencv4nodejs no disponible — usando pipeline puro-JS:', err.message);
}

export const OUTPUT_W = 600;
export const OUTPUT_H = 840;

const CARD_RATIO_MIN = 0.55;
const CARD_RATIO_MAX = 0.85;
const MIN_AREA_FRACTION = 0.10;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de homografía (DLT + inversión 3×3)
// ─────────────────────────────────────────────────────────────────────────────

type Point2 = [number, number];

/**
 * Eliminación gaussiana con pivoting parcial para resolver Ax = b.
 * n = 8 (8 incógnitas de la homografía).
 */
function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    }
    [M[col], M[maxRow]] = [M[maxRow], M[col]];

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let k = col; k <= n; k++) M[row][k] -= factor * M[col][k];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i] || 1e-12;
  }
  return x;
}

/**
 * Calcula la homografía 3×3 H tal que dst = H * src (coords homogéneas).
 * Retorna un array de 9 elementos [h11..h33], con h33 = 1 normalizado.
 */
function computeHomography(src: Point2[], dst: Point2[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [X, Y] = dst[i];
    A.push([-x, -y, -1, 0, 0, 0, x * X, y * X]);  b.push(-X);
    A.push([0, 0, 0, -x, -y, -1, x * Y, y * Y]);   b.push(-Y);
  }
  const h = solveLinear(A, b);
  return [...h, 1];
}

/** Invierte una homografía 3×3 (array de 9 elementos). */
function invertHomography(H: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = H;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return H; // degenerada
  const inv = [
    (e * i - f * h), -(b * i - c * h),  (b * f - c * e),
    -(d * i - f * g), (a * i - c * g), -(a * f - c * d),
    (d * h - e * g), -(a * h - b * g),  (a * e - b * d),
  ].map(v => v / det);
  return inv;
}

/**
 * Aplica una transformación de perspectiva usando la homografía inversa y
 * interpolación bilineal. Opera sobre datos RGB crudos.
 */
function warpPerspectiveRGB(
  srcData: Buffer, srcW: number, srcH: number,
  srcCorners: Point2[],                         // [TL, TR, BR, BL] en coords de srcData
  dstW: number, dstH: number,
): Buffer {
  const dstCorners: Point2[] = [
    [0, 0], [dstW - 1, 0], [dstW - 1, dstH - 1], [0, dstH - 1],
  ];

  // H: srcCorners → dstCorners
  const H    = computeHomography(srcCorners, dstCorners);
  const Hinv = invertHomography(H); // dstCorners → srcCorners

  const out = Buffer.allocUnsafe(dstW * dstH * 3);

  for (let oy = 0; oy < dstH; oy++) {
    for (let ox = 0; ox < dstW; ox++) {
      const w  = Hinv[6] * ox + Hinv[7] * oy + Hinv[8];
      const sx = (Hinv[0] * ox + Hinv[1] * oy + Hinv[2]) / w;
      const sy = (Hinv[3] * ox + Hinv[4] * oy + Hinv[5]) / w;

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const outIdx = (oy * dstW + ox) * 3;

      if (x0 < 0 || y0 < 0 || x0 >= srcW || y0 >= srcH) {
        out[outIdx] = out[outIdx + 1] = out[outIdx + 2] = 255;
        continue;
      }

      for (let c = 0; c < 3; c++) {
        const v00 = srcData[(y0 * srcW + x0) * 3 + c];
        const v10 = srcData[(y0 * srcW + x1) * 3 + c];
        const v01 = srcData[(y1 * srcW + x0) * 3 + c];
        const v11 = srcData[(y1 * srcW + x1) * 3 + c];
        out[outIdx + c] = Math.round(
          (1 - fx) * (1 - fy) * v00 +
          fx * (1 - fy) * v10 +
          (1 - fx) * fy * v01 +
          fx * fy * v11,
        );
      }
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detección del rectángulo de la carta (pipeline puro-JS)
// ─────────────────────────────────────────────────────────────────────────────

const PROC_SIZE = 600; // lado máximo de la imagen de trabajo

/**
 * Ordena 4 puntos como [TL, TR, BR, BL].
 * Estrategia: ordenar por Y → los dos con menor Y son la fila superior,
 * dentro de cada fila ordenar por X.
 * Funciona para cards axis-aligned y ligeramente rotadas (< ~35°).
 */
function orderQuad(pts: Point2[]): [Point2, Point2, Point2, Point2] {
  const byY = [...pts].sort((a, b) => a[1] - b[1]);
  const top = byY.slice(0, 2).sort((a, b) => a[0] - b[0]); // menor X = TL
  const bot = byY.slice(2, 4).sort((a, b) => a[0] - b[0]); // menor X = BL
  return [top[0], top[1], bot[1], bot[0]]; // [TL, TR, BR, BL]
}

/**
 * Calcula la esquina estable usando el percentil más extremo de los puntos
 * de borde. Más robusto que tomar el único píxel extremo (resistente a ruido).
 *
 * @param pts    Array de puntos de borde de la carta
 * @param metric Función que asigna un valor escalar a cada punto
 * @param max    true = buscar máximo, false = buscar mínimo
 */
function stableCorner(pts: Point2[], metric: (p: Point2) => number, maximize: boolean, percent = 0.03): Point2 {
  if (pts.length === 0) return [0, 0];

  const vals = pts.map(metric);
  const sorted = [...vals].sort((a, b) => a - b);

  // Tomar el `percent`% más extremo (al menos 5 puntos) como candidatos
  const candidateCount = Math.max(5, Math.floor(pts.length * percent));
  const cutIdx = maximize
    ? sorted.length - 1 - Math.min(candidateCount, sorted.length - 1)
    : Math.min(candidateCount, sorted.length - 1);
  const cutVal = sorted[cutIdx];

  const candidates = pts.filter((_, i) => maximize ? vals[i] >= cutVal : vals[i] <= cutVal);
  const cx = candidates.reduce((s, p) => s + p[0], 0) / candidates.length;
  const cy = candidates.reduce((s, p) => s + p[1], 0) / candidates.length;
  return [cx, cy];
}

/**
 * Samplea el color de fondo desde parches de 10×10 en las 4 esquinas de la
 * imagen en escala de grises. Devuelve la mediana de los valores.
 */
function sampleBackgroundLuma(data: Buffer, W: number, H: number): number {
  const PATCH = 10;
  const samples: number[] = [];
  const corners = [[0, 0], [W - PATCH, 0], [0, H - PATCH], [W - PATCH, H - PATCH]];
  for (const [cx, cy] of corners) {
    for (let dy = 0; dy < PATCH; dy++) {
      for (let dx = 0; dx < PATCH; dx++) {
        const x = Math.min(cx + dx, W - 1);
        const y = Math.min(cy + dy, H - 1);
        samples.push(data[y * W + x]);
      }
    }
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

/**
 * Flood-fill BFS desde todos los píxeles del borde de la imagen.
 * Un píxel se une al fill si su luminosidad está dentro de `tolerance`
 * del color de fondo `bgLuma`.
 *
 * Retorna un Uint8Array donde 1 = fondo, 0 = carta.
 */
function floodFillBackground(
  data: Buffer, W: number, H: number,
  bgLuma: number, tolerance: number,
): Uint8Array {
  const mask  = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;

  const enqueue = (idx: number) => {
    if (mask[idx]) return;
    if (Math.abs(data[idx] - bgLuma) > tolerance) return;
    mask[idx] = 1;
    queue[tail++] = idx;
  };

  // Sembrar desde todos los píxeles del borde
  for (let x = 0; x < W; x++) { enqueue(x); enqueue((H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++) { enqueue(y * W); enqueue(y * W + W - 1); }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % W;
    const y = (idx - x) / W;
    if (x > 0)     enqueue(idx - 1);
    if (x < W - 1) enqueue(idx + 1);
    if (y > 0)     enqueue(idx - W);
    if (y < H - 1) enqueue(idx + W);
  }
  return mask;
}

interface CardDetection {
  corners: [Point2, Point2, Point2, Point2]; // TL TR BR BL en coords orig
  valid: boolean;
}

/**
 * Detecta los 4 vértices de la carta a partir de la máscara de fondo.
 *
 * Estrategia:
 *   - Recopila todos los píxeles "borde de carta" (foreground adyacente a fondo)
 *   - Encuentra los 4 píxeles extremos usando las diagonales:
 *       TL = mínimo x+y,  TR = máximo x−y
 *       BR = máximo x+y,  BL = mínimo x−y
 *   - Escala de vuelta a coordenadas de la imagen original
 */
async function detectCardCorners(
  imageBuffer: Buffer,
): Promise<CardDetection> {
  const { data, info } = await sharp(imageBuffer)
    .rotate()                                        // aplicar orientación EXIF (fotos de cámara)
    .resize(PROC_SIZE, PROC_SIZE, { fit: 'inside' })
    .grayscale()
    .blur(1.5)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Dimensiones de la imagen después de aplicar EXIF rotation
  const origInfo = await sharp(imageBuffer).rotate().metadata();
  const origW    = origInfo.width  ?? 1;
  const origH    = origInfo.height ?? 1;

  const W = info.width;
  const H = info.height;

  // 1. Color de fondo
  const bgLuma = sampleBackgroundLuma(data, W, H);

  // Tolerancia adaptativa:
  // Fondo muy claro (blanco/crema >220): tolerancia ajustada para NO comerse bordes
  // grises claros (~180-215 luma). La diferencia fondo-carta suele ser ~30-60 luma,
  // así que usamos ~40% de esa diferencia como umbral seguro.
  // Fondo oscuro: más tolerancia porque las sombras son más graduales.
  const CARD_BORDER_ESTIMATE = 200; // luma estimada del borde de carta gris claro
  const gap         = Math.abs(bgLuma - CARD_BORDER_ESTIMATE);
  const tolerance   = Math.max(12, Math.min(30, Math.round(gap * 0.35)));

  // 2. Flood-fill
  const bgMask = floodFillBackground(data, W, H, bgLuma, tolerance);

  // 3. Recopilar píxeles de borde de carta
  // Un píxel es "borde de carta" si es foreground y tiene al menos un vecino background
  const edgePts: Point2[] = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      if (bgMask[idx]) continue; // es fondo, no carta
      // ¿Tiene vecino que es fondo?
      if (bgMask[idx - 1] || bgMask[idx + 1] || bgMask[idx - W] || bgMask[idx + W]) {
        edgePts.push([x, y]);
      }
    }
  }

  if (edgePts.length < 20) {
    console.log('[crop] detectCardCorners: muy pocos puntos de borde, sin resultado');
    return { corners: [[0,0],[W,0],[W,H],[0,H]], valid: false };
  }

  // 4. Detectar las 4 esquinas usando extremos diagonales + promedio del 3% más extremo.
  //
  //   TL = mínimo  x+y  (arriba-izquierda en coordenadas de pantalla Y↓)
  //   TR = máximo  x−y  (arriba-derecha)
  //   BR = máximo  x+y  (abajo-derecha)
  //   BL = mínimo  x−y  (abajo-izquierda)
  //
  // Esta asignación es exacta para 0° y correcta hasta ~35° de rotación.
  // Nota: los extremos diagonales YA dan el orden semántico [TL,TR,BR,BL]
  //       correcto — NO llamar a orderQuad() sobre ellos.
  const tl = stableCorner(edgePts, ([x, y]) => x + y, false); // min x+y
  const tr = stableCorner(edgePts, ([x, y]) => x - y, true);  // max x-y
  const br = stableCorner(edgePts, ([x, y]) => x + y, true);  // max x+y
  const bl = stableCorner(edgePts, ([x, y]) => x - y, false); // min x-y

  // 5. Validar con el área del quad (fórmula de Gauss / Shoelace)
  const quadArea = Math.abs(
    tl[0] * (tr[1] - bl[1]) +
    tr[0] * (br[1] - tl[1]) +
    br[0] * (bl[1] - tr[1]) +
    bl[0] * (tl[1] - br[1]),
  ) / 2;

  const areaFrac = quadArea / (W * H);

  // Relación de aspecto usando distancias reales de los lados del quad
  const topW  = Math.hypot(tr[0] - tl[0], tr[1] - tl[1]);
  const botW  = Math.hypot(br[0] - bl[0], br[1] - bl[1]);
  const leftH = Math.hypot(bl[0] - tl[0], bl[1] - tl[1]);
  const rightH= Math.hypot(br[0] - tr[0], br[1] - tr[1]);
  const avgW  = (topW + botW) / 2;
  const avgH  = (leftH + rightH) / 2;
  const ratio = avgW / Math.max(avgH, 1);

  const valid = areaFrac >= 0.05 && ratio >= CARD_RATIO_MIN && ratio <= CARD_RATIO_MAX;

  if (!valid) {
    console.log(`[crop] detectCardCorners: quad inválido (ratio=${ratio.toFixed(3)}, area=${(areaFrac * 100).toFixed(1)}%)`);
  } else {
    console.log(`[crop] detectCardCorners: quad OK (ratio=${ratio.toFixed(3)}, area=${(areaFrac * 100).toFixed(1)}%)`);
  }

  // 6. Escalar a coordenadas originales
  const sx = origW / W;
  const sy = origH / H;
  const sc = (p: Point2): Point2 => [p[0] * sx, p[1] * sy];

  // Retornar en orden [TL, TR, BR, BL] — los extremos diagonales ya lo garantizan
  return {
    corners: [sc(tl), sc(tr), sc(br), sc(bl)],
    valid,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback: bounding-box sobre la máscara (sin perspectiva)
// ─────────────────────────────────────────────────────────────────────────────

async function cropByBoundingBox(imageBuffer: Buffer): Promise<Buffer | null> {
  const { data, info } = await sharp(imageBuffer)
    .rotate()                                        // aplicar orientación EXIF
    .resize(PROC_SIZE, PROC_SIZE, { fit: 'inside' })
    .grayscale()
    .blur(1.5)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const origInfo = await sharp(imageBuffer).rotate().metadata();
  const origW    = origInfo.width  ?? 1;
  const origH    = origInfo.height ?? 1;

  const W = info.width;
  const H = info.height;

  const bgLuma = sampleBackgroundLuma(data, W, H);
  const bgMask = floodFillBackground(data, W, H, bgLuma, 30);

  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!bgMask[y * W + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const bw = maxX - minX;
  const bh = maxY - minY;
  if (bw < W * 0.05 || bh < H * 0.05) return null;

  const sx = origW / W;
  const sy = origH / H;

  const rx = Math.max(0, Math.floor(minX * sx));
  const ry = Math.max(0, Math.floor(minY * sy));
  const rw = Math.min(origW - rx, Math.ceil(bw * sx));
  const rh = Math.min(origH - ry, Math.ceil(bh * sy));

  console.log(`[crop] bounding-box: (${rx},${ry}) ${rw}×${rh}`);

  return sharp(imageBuffer)
    .rotate()  // aplicar EXIF antes de recortar
    .extract({ left: rx, top: ry, width: rw, height: rh })
    .resize(OUTPUT_W, OUTPUT_H, { fit: 'fill' })
    .toFormat('png')
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline puro-JS principal
// ─────────────────────────────────────────────────────────────────────────────

async function pureJsCrop(imageBuffer: Buffer): Promise<Buffer> {
  // ── Estrategia 1: Polygon detection + warpPerspective ──────────────────
  try {
    const detection = await detectCardCorners(imageBuffer);

    if (detection.valid) {
      console.log('[crop] polygon: corners detectados, aplicando warp perspectivo');

      // Obtener datos RGB crudos de la imagen original con EXIF rotation aplicada
      const { data: srcRgb, info: srcInfo } = await sharp(imageBuffer)
        .rotate()       // CRÍTICO: aplica orientación EXIF antes de leer píxeles
        .removeAlpha()  // garantiza exactamente 3 canales RGB
        .raw()
        .toBuffer({ resolveWithObject: true });
      const origW = srcInfo.width;
      const origH = srcInfo.height;

      const warped = warpPerspectiveRGB(srcRgb, origW, origH, detection.corners, OUTPUT_W, OUTPUT_H);

      return sharp(warped, { raw: { width: OUTPUT_W, height: OUTPUT_H, channels: 3 } })
        .toFormat('png')
        .toBuffer();
    }
  } catch (e: any) {
    console.warn('[crop] polygon warp falló:', e.message);
  }

  // ── Estrategia 2: Bounding-box sobre la máscara ─────────────────────────
  try {
    const bb = await cropByBoundingBox(imageBuffer);
    if (bb) {
      console.log('[crop] bounding-box: carta recortada');
      return bb;
    }
  } catch (e: any) {
    console.warn('[crop] bounding-box falló:', e.message);
  }

  // ── Estrategia 3: sharp.trim() ──────────────────────────────────────────
  try {
    for (const threshold of [15, 30, 50]) {
      const trimmed  = await sharp(imageBuffer).trim({ threshold }).toBuffer();
      const trimMeta = await sharp(trimmed).metadata();
      const tw = trimMeta.width  ?? 0;
      const th = trimMeta.height ?? 1;
      const ratio = tw / th;
      if (ratio >= CARD_RATIO_MIN && ratio <= CARD_RATIO_MAX) {
        console.log(`[crop] trim(${threshold}): ratio=${ratio.toFixed(3)} → OK`);
        return sharp(trimmed)
          .resize(OUTPUT_W, OUTPUT_H, { fit: 'fill' })
          .toFormat('png')
          .toBuffer();
      }
    }
  } catch (e: any) {
    console.warn('[crop] trim falló:', e.message);
  }

  // ── Fallback: resize simple ─────────────────────────────────────────────
  console.log('[crop] fallback: resize simple');
  return sharp(imageBuffer)
    .resize(OUTPUT_W, OUTPUT_H, { fit: 'fill' })
    .toFormat('png')
    .toBuffer();
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline OpenCV (si disponible)
// ─────────────────────────────────────────────────────────────────────────────

async function opencvCrop(imageBuffer: Buffer): Promise<Buffer | null> {
  try {
    // Aplicar EXIF rotation antes de pasar a OpenCV
    const pngBuf   = await sharp(imageBuffer).rotate().toFormat('png').toBuffer();
    const original = cv!.imdecode(pngBuf);
    const small    = original.resize(0, 0, 0.5, 0.5, cv.INTER_AREA);
    const totalArea = small.rows * small.cols;

    const gray    = small.cvtColor(cv.COLOR_BGR2GRAY);
    const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);
    // Umbrales bajos (20/60) para detectar bordes de bajo contraste
    // como borde amarillo sobre fondo blanco (~225 vs ~255 en escala de grises)
    const edges   = blurred.canny(20, 60);
    // findContours opera sobre el mapa de bordes; devuelve Contour[]
    const contours: any[] = edges.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestPts: Point2[] | null = null;
    let bestArea = 0;

    for (const contour of contours) {
      // .area es una propiedad numérica del objeto Contour
      const area: number = contour.area;
      if (area < totalArea * MIN_AREA_FRACTION || area <= bestArea) continue;

      // arcLength(closed: boolean) → number
      const perim: number = contour.arcLength(true);

      // approxPolyDP(epsilon, closed) → Contour (NO es un array)
      const approxContour = contour.approxPolyDP(0.02 * perim, true);

      // numPoints es la propiedad de cantidad de vértices del Contour devuelto
      if (approxContour.numPoints !== 4) continue;

      // getPoints() → Point2[]  (objetos con .x y .y)
      const pts: any[] = approxContour.getPoints();

      const xs = pts.map((p: any) => p.x);
      const ys = pts.map((p: any) => p.y);
      const w  = Math.max(...xs) - Math.min(...xs);
      const h  = Math.max(...ys) - Math.min(...ys);
      if (h === 0) continue;

      const ratio = w / h;
      if (ratio < CARD_RATIO_MIN || ratio > CARD_RATIO_MAX) continue;

      bestArea = area;
      bestPts  = pts.map((p: any) => [p.x, p.y] as Point2);
    }

    if (!bestPts) return null;

    // Ordenar los 4 vértices como [TL, TR, BR, BL]
    const ordered = orderQuad(bestPts);

    // Los puntos vienen del `small` (escala 0.5) → escalar ×2 para el `original`
    const srcPts = ordered.map(([x, y]) => new cv.Point2(x * 2, y * 2));
    const dstPts = [
      new cv.Point2(0,            0            ),
      new cv.Point2(OUTPUT_W - 1, 0            ),
      new cv.Point2(OUTPUT_W - 1, OUTPUT_H - 1 ),
      new cv.Point2(0,            OUTPUT_H - 1 ),
    ];

    const M      = cv.getPerspectiveTransform(srcPts, dstPts);
    const warped = original.warpPerspective(M, new cv.Size(OUTPUT_W, OUTPUT_H));
    return cv.imencode('.png', warped);

  } catch (err: any) {
    console.warn('[crop] opencv error:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Punto de entrada público
// ─────────────────────────────────────────────────────────────────────────────

export async function crop(imageBuffer: Buffer): Promise<Buffer> {
  // Intentar OpenCV primero (más preciso)
  if (cv) {
    const result = await opencvCrop(imageBuffer);
    if (result) {
      console.log('[crop] opencv: éxito');
      return result;
    }
    console.log('[crop] opencv: sin resultado, usando pipeline puro-JS');
  }

  return pureJsCrop(imageBuffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// Debug / tuning API
// ─────────────────────────────────────────────────────────────────────────────

export interface DebugCropParams {
  /** Tolerancia manual de flood-fill. undefined = automática. */
  toleranceOverride?: number;
  /** Luma estimada del borde de la carta (default 200). */
  borderEstimate?: number;
  /** Lado máximo de la imagen de trabajo (default 600). */
  procSize?: number;
  /** Radio de desenfoque gaussiano antes de detectar (default 1.5). */
  blurRadius?: number;
  /** Fracción de puntos extremos para calcular esquina estable (default 0.03). */
  stablePercent?: number;
}

export interface DebugCropResult {
  /** Esquinas detectadas [TL,TR,BR,BL] en coords de la imagen original. Null si no hay. */
  corners: [[number, number], [number, number], [number, number], [number, number]] | null;
  valid: boolean;
  stats: {
    bgLuma: number;
    tolerance: number;
    edgePointCount: number;
    ratio: number;
    areaFrac: number;
  };
  origWidth: number;
  origHeight: number;
  /** Imagen de debug: fondo=rojo, borde=verde, esquinas marcadas. Data URI PNG. */
  maskImageBase64: string;
  /** Carta recortada y con perspectiva corregida. Data URI PNG. */
  croppedImageBase64: string;
}

export async function debugCrop(
  imageBuffer: Buffer,
  params: DebugCropParams = {},
): Promise<DebugCropResult> {
  const {
    toleranceOverride,
    borderEstimate = 200,
    procSize = PROC_SIZE,
    blurRadius = 1.5,
    stablePercent = 0.03,
  } = params;

  // ── 1. Imagen de trabajo (escala de grises, post-EXIF) ──────────────────
  const { data, info } = await sharp(imageBuffer)
    .rotate()
    .resize(procSize, procSize, { fit: 'inside' })
    .grayscale()
    .blur(blurRadius)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;
  const H = info.height;

  const origInfo = await sharp(imageBuffer).rotate().metadata();
  const origW = origInfo.width  ?? 1;
  const origH = origInfo.height ?? 1;

  // ── 2. Luma de fondo y tolerancia ──────────────────────────────────────
  const bgLuma = sampleBackgroundLuma(data, W, H);

  let tolerance: number;
  if (toleranceOverride !== undefined && toleranceOverride >= 0) {
    tolerance = toleranceOverride;
  } else {
    const gap = Math.abs(bgLuma - borderEstimate);
    tolerance = Math.max(12, Math.min(30, Math.round(gap * 0.35)));
  }

  // ── 3. Flood-fill ────────────────────────────────────────────────────
  const bgMask = floodFillBackground(data, W, H, bgLuma, tolerance);

  // ── 4. Puntos de borde ──────────────────────────────────────────────
  const edgePts: Point2[] = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x;
      if (bgMask[idx]) continue;
      if (bgMask[idx - 1] || bgMask[idx + 1] || bgMask[idx - W] || bgMask[idx + W]) {
        edgePts.push([x, y]);
      }
    }
  }

  // ── 5. Esquinas ─────────────────────────────────────────────────────
  let corners: [[number,number],[number,number],[number,number],[number,number]] | null = null;
  let valid = false;
  let ratio = 0;
  let areaFrac = 0;

  // Puntos en coords de procesamiento (para la imagen de debug)
  let tlP: Point2 = [0,0], trP: Point2 = [0,0], brP: Point2 = [0,0], blP: Point2 = [0,0];

  if (edgePts.length >= 20) {
    tlP = stableCorner(edgePts, ([x, y]) => x + y, false, stablePercent);
    trP = stableCorner(edgePts, ([x, y]) => x - y, true,  stablePercent);
    brP = stableCorner(edgePts, ([x, y]) => x + y, true,  stablePercent);
    blP = stableCorner(edgePts, ([x, y]) => x - y, false, stablePercent);

    const quadArea = Math.abs(
      tlP[0] * (trP[1] - blP[1]) +
      trP[0] * (brP[1] - tlP[1]) +
      brP[0] * (blP[1] - trP[1]) +
      blP[0] * (tlP[1] - brP[1]),
    ) / 2;
    areaFrac = quadArea / (W * H);

    const topW   = Math.hypot(trP[0] - tlP[0], trP[1] - tlP[1]);
    const botW   = Math.hypot(brP[0] - blP[0], brP[1] - blP[1]);
    const leftH  = Math.hypot(blP[0] - tlP[0], blP[1] - tlP[1]);
    const rightH = Math.hypot(brP[0] - trP[0], brP[1] - trP[1]);
    ratio = (topW + botW) / 2 / Math.max((leftH + rightH) / 2, 1);

    valid = areaFrac >= 0.05 && ratio >= CARD_RATIO_MIN && ratio <= CARD_RATIO_MAX;

    const sx = origW / W;
    const sy = origH / H;
    const sc = (p: Point2): [number, number] => [Math.round(p[0] * sx), Math.round(p[1] * sy)];
    corners = [sc(tlP), sc(trP), sc(brP), sc(blP)];
  }

  // ── 6. Imagen de debug (RGBA) ────────────────────────────────────────
  const maskRgba = Buffer.allocUnsafe(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const gray = data[i];
    const px   = i * 4;
    if (bgMask[i]) {
      // Fondo → tinte rojo
      maskRgba[px]     = 200;
      maskRgba[px + 1] = 60;
      maskRgba[px + 2] = 60;
      maskRgba[px + 3] = 220;
    } else {
      // Carta → escala de grises original
      maskRgba[px]     = gray;
      maskRgba[px + 1] = gray;
      maskRgba[px + 2] = gray;
      maskRgba[px + 3] = 255;
    }
  }

  // Borde de carta → verde brillante
  for (const [x, y] of edgePts) {
    const px = (y * W + x) * 4;
    maskRgba[px]     = 0;
    maskRgba[px + 1] = 230;
    maskRgba[px + 2] = 0;
    maskRgba[px + 3] = 255;
  }

  // Esquinas → cuadrado 9×9 con colores TL=amarillo, TR=naranja, BR=magenta, BL=cyan
  const cornerColors: Array<[number, number, number]> = [[255,230,0],[255,140,0],[255,0,200],[0,220,255]];
  const procCorners: Point2[] = [tlP, trP, brP, blP];
  for (let ci = 0; ci < 4; ci++) {
    const [cx, cy] = procCorners[ci];
    const [r, g, b] = cornerColors[ci];
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const nx = Math.round(cx) + dx;
        const ny = Math.round(cy) + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
        const p = (ny * W + nx) * 4;
        maskRgba[p]     = r;
        maskRgba[p + 1] = g;
        maskRgba[p + 2] = b;
        maskRgba[p + 3] = 255;
      }
    }
  }

  const maskPng = await sharp(maskRgba, { raw: { width: W, height: H, channels: 4 } })
    .toFormat('png')
    .toBuffer();
  const maskImageBase64 = `data:image/png;base64,${maskPng.toString('base64')}`;

  // ── 7. Carta recortada ───────────────────────────────────────────────
  let croppedImageBase64 = '';
  try {
    if (valid && corners) {
      const { data: srcRgb, info: srcInfo } = await sharp(imageBuffer)
        .rotate()
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const warped = warpPerspectiveRGB(
        srcRgb, srcInfo.width, srcInfo.height, corners, OUTPUT_W, OUTPUT_H,
      );
      const croppedPng = await sharp(warped, { raw: { width: OUTPUT_W, height: OUTPUT_H, channels: 3 } })
        .toFormat('png')
        .toBuffer();
      croppedImageBase64 = `data:image/png;base64,${croppedPng.toString('base64')}`;
    } else {
      // Fallback: resize simple orientado
      const fallback = await sharp(imageBuffer)
        .rotate()
        .resize(OUTPUT_W, OUTPUT_H, { fit: 'fill' })
        .toFormat('png')
        .toBuffer();
      croppedImageBase64 = `data:image/png;base64,${fallback.toString('base64')}`;
    }
  } catch (_e) { /* silencioso en debug */ }

  return {
    corners,
    valid,
    stats: { bgLuma, tolerance, edgePointCount: edgePts.length, ratio, areaFrac },
    origWidth:  origW,
    origHeight: origH,
    maskImageBase64,
    croppedImageBase64,
  };
}
