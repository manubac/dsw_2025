# Card Scan Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mejorar la identificación de cartas Pokémon desde OCR cuando la sigla de colección está garbled, usando número + nombre parcial como señal combinada, y completar el nombre cuando el OCR lo detectó parcialmente.

**Architecture:** Tres cambios en `backend/src/scan/scan.routes.ts`: (1) nueva función `queryByNumberAndName` para buscar por número+palabra clave del nombre, (2) nuevo paso (2b) en la cascada de resolución que llama a esa función cuando los pasos anteriores fallan, (3) ajuste de `namesOverlap` para aceptar que la DB "extienda" el nombre OCR con sufijos como "ex"/"V"/"VMAX". También se agrega Fallback C en `extractNombre` para cartas sin stage ni HP marker detectados.

**Tech Stack:** TypeScript, Node.js, PostgreSQL (`pg` pool directo), `v_cards_unified` view existente.

---

## Archivos

- Modify: `backend/src/scan/scan.routes.ts`
- Create: `backend/src/__tests__/scan.helpers.test.ts`

---

### Task 1: Tests para las funciones puras existentes que vamos a modificar

Las funciones `namesOverlap` y `extractNombre` son puras (no usan DB). Escribir tests antes de tocarlas.

**Files:**
- Create: `backend/src/__tests__/scan.helpers.test.ts`

- [ ] **Step 1: Crear el archivo de tests**

```typescript
// backend/src/__tests__/scan.helpers.test.ts
// Tests para las funciones puras de scan.routes.ts
// Importamos las funciones después de exportarlas en el Task 2.

import { namesOverlap, extractNombre } from '../scan/scan.helpers.js';

describe('namesOverlap', () => {
  it('acepta cuando los nombres son iguales', () => {
    expect(namesOverlap('Gardevoir ex', 'Gardevoir ex')).toBe(true);
  });

  it('acepta cuando el nombre OCR es prefijo del nombre DB (DB extiende con sufijo)', () => {
    expect(namesOverlap('Gardevoir', 'Gardevoir ex')).toBe(true);
  });

  it('acepta cuando DB es "Charizard ex" y OCR es "Charizard"', () => {
    expect(namesOverlap('Charizard', 'Charizard ex')).toBe(true);
  });

  it('acepta cuando DB es "Mewtwo VMAX" y OCR es "Mewtwo"', () => {
    expect(namesOverlap('Mewtwo', 'Mewtwo VMAX')).toBe(true);
  });

  it('rechaza cuando los nombres son completamente distintos', () => {
    expect(namesOverlap('Pikachu', 'Gardevoir ex')).toBe(false);
  });

  it('acepta cuando alguno está vacío (no podemos descartar)', () => {
    expect(namesOverlap('', 'Gardevoir ex')).toBe(true);
    expect(namesOverlap('Gardevoir', '')).toBe(true);
  });

  it('acepta coincidencia parcial por prefijo de 7 chars (comportamiento original)', () => {
    expect(namesOverlap('Clodsire de Paldea ex', 'Clodsire ex')).toBe(true);
  });
});

describe('extractNombre - Fallback C (primeras líneas)', () => {
  it('extrae nombre de primera línea cuando no hay stage ni HP', () => {
    const lines = ['Pikachu', 'Some flavor text that is very long and should not match', 'HP 60'];
    const result = extractNombre(lines);
    expect(result.nombre).toBe('Pikachu');
  });

  it('no extrae líneas con más de 5 palabras (isPlausibleName lo rechaza)', () => {
    const lines = ['This is a very long sentence that should fail', 'Eevee'];
    const result = extractNombre(lines);
    expect(result.nombre).toBe('Eevee');
  });

  it('no extrae cuando la línea empieza con dígito', () => {
    const lines = ['123 Some text', 'Bulbasaur'];
    const result = extractNombre(lines);
    expect(result.nombre).toBe('Bulbasaur');
  });
});
```

- [ ] **Step 2: Verificar que el test falla (las funciones no están exportadas aún)**

```bash
cd backend && pnpm test -- --testPathPattern="scan.helpers" 2>&1 | head -20
```

Esperado: error de importación — `namesOverlap` y `extractNombre` no están exportadas.

---

### Task 2: Extraer funciones puras a `scan.helpers.ts`

`namesOverlap` y `extractNombre` (y sus dependencias puras) viven actualmente en `scan.routes.ts`. Extraerlas a un archivo separado para poder testearlas.

**Files:**
- Create: `backend/src/scan/scan.helpers.ts`
- Modify: `backend/src/scan/scan.routes.ts`

- [ ] **Step 1: Crear `scan.helpers.ts` con las funciones puras**

```typescript
// backend/src/scan/scan.helpers.ts
// Funciones puras extraídas de scan.routes.ts — sin dependencias de DB ni filesystem.

// ── Levenshtein ───────────────────────────────────────────────────────────────
export function levenshtein(a: string, b: string): number {
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

// ── Normalización de nombre ───────────────────────────────────────────────────
export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9áéíóúàèìòùñü]/g, '');
}

// ── namesOverlap ─────────────────────────────────────────────────────────────
/**
 * Devuelve true si ocrName y dbName se refieren probablemente al mismo Pokémon.
 * Acepta que dbName extienda ocrName con un sufijo (ej. OCR="Gardevoir", DB="Gardevoir ex").
 */
export function namesOverlap(ocrName: string, dbName: string): boolean {
  if (!ocrName || !dbName) return true;
  const na = normalizeName(ocrName);
  const nb = normalizeName(dbName);
  if (!na || !nb) return true;

  // DB extiende el nombre OCR con sufijo (ex, V, VMAX, VSTAR, GX, etc.)
  if (nb.startsWith(na)) return true;

  // Comportamiento original: prefijo de 7 chars
  const prefix = Math.min(7, Math.min(na.length, nb.length));
  return na.includes(nb.slice(0, prefix)) || nb.includes(na.slice(0, prefix));
}

// ── HP marker ────────────────────────────────────────────────────────────────
const HP_MARKER = /^(?:HP|PS|PV|ПС|体力)$/i;

function wordsUntilHp(words: string[]): string {
  const MANGLED_HP = /^[A-Z]{1,2}\d{3,}$/i;
  const hpIdx = words.findIndex(
    (w, i) => (HP_MARKER.test(w) && /^\d+$/.test(words[i + 1] ?? ''))
              || MANGLED_HP.test(w)
  );
  return (hpIdx >= 0 ? words.slice(0, hpIdx) : words).join(' ').trim();
}

export function cleanName(raw: string): string {
  return raw
    .replace(/\s+LV\.\d+$/i, '')
    .replace(/\s+Level\s+\d+$/i, '')
    .replace(/[^\x20-\x7EáéíóúàèìòùâêîôûäëïöüñçãõÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜÑÇÃÕ''\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlausibleName(s: string): boolean {
  if (!s || s.length < 2 || s.length > 40) return false;
  if (!/^[A-ZÁÉÍÓÚÀÈÌÒÙÂÊÎÔÛÄËÏÖÜ'\u3040-\u9FFF]/.test(s)) return false;
  if (/^NO\.\s*\d+/i.test(s)) return false;
  if (/\d{3,}/.test(s)) return false;
  if (s.split(/\s+/).length > 5) return false;
  if (/\b(there is|if you|you may|damage|counter|benched)\b/i.test(s)) return false;
  return true;
}

// ── Tipos de stage ────────────────────────────────────────────────────────────
export interface StageInfo { lang: string; stageKey: string; isSpecial: boolean; }

export interface NameResult {
  nombre:    string;
  stage:     string;
  stageLang: string;
  stageKey:  string;
}

// ── extractNombre ─────────────────────────────────────────────────────────────
/**
 * Extrae el nombre de la carta desde las líneas de texto OCR.
 * Requiere el mapa de stages como parámetro para ser testeable sin filesystem.
 */
export function extractNombre(lines: string[], stageLookup?: Map<string, StageInfo>): NameResult {
  const LOOKUP = stageLookup ?? new Map<string, StageInfo>();

  for (let i = 0; i < lines.length; i++) {
    const line  = lines[i];
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const w0  = words[0].toLowerCase();
    const w01 = (words[0] + ' ' + (words[1] ?? '')).toLowerCase().trim();

    let stageInfo: StageInfo | undefined;
    let stageWordCount = 0;
    let stageRaw = '';

    if (LOOKUP.has(w01)) {
      stageInfo      = LOOKUP.get(w01)!;
      stageWordCount = 2;
      stageRaw       = words[0] + ' ' + words[1];
    } else if (LOOKUP.has(w0)) {
      stageInfo      = LOOKUP.get(w0)!;
      stageWordCount = 1;
      stageRaw       = words[0];
    }

    if (!stageInfo) continue;

    if (/\d+\/\d+/.test(line)) continue;

    const afterStage = words.slice(stageWordCount);

    if (afterStage.length > 0) {
      const nombre = cleanName(wordsUntilHp(afterStage));
      if (isPlausibleName(nombre)) {
        return { nombre, stage: stageRaw, stageLang: stageInfo.lang, stageKey: stageInfo.stageKey };
      }
    }

    if (afterStage.length === 0 && i > 0) {
      const prevWords = lines[i - 1].split(/\s+/).filter(Boolean);
      const nombre = cleanName(wordsUntilHp(prevWords));
      if (isPlausibleName(nombre)) {
        return { nombre, stage: stageRaw, stageLang: stageInfo.lang, stageKey: stageInfo.stageKey };
      }
    }

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

  // Fallback A: HP marker + número en misma línea
  for (const line of lines) {
    const hit = line.match(/^(.*?)\s+(?:HP|PS|PV)\s+\d+/i);
    if (!hit) continue;
    const candidate = cleanName(
      hit[1].replace(/^(?:BASIC|STAGE\s*\d+|V(?:MAX|STAR)?|EX|GX)\s+/i, '').trim()
    );
    if (isPlausibleName(candidate))
      return { nombre: candidate, stage: '', stageLang: '', stageKey: '' };
  }

  // Fallback B: HP marker en su propia línea y número en la siguiente
  for (let i = 1; i < lines.length - 1; i++) {
    if (HP_MARKER.test(lines[i].trim()) && /^\d+$/.test(lines[i + 1].trim())) {
      const candidate = cleanName(lines[i - 1]);
      if (isPlausibleName(candidate))
        return { nombre: candidate, stage: '', stageLang: '', stageKey: '' };
    }
  }

  // Fallback C: primeras 5 líneas — la primera que pase isPlausibleName
  for (const line of lines.slice(0, 5)) {
    const candidate = cleanName(line);
    if (isPlausibleName(candidate))
      return { nombre: candidate, stage: '', stageLang: '', stageKey: '' };
  }

  return { nombre: '', stage: '', stageLang: '', stageKey: '' };
}
```

- [ ] **Step 2: Actualizar `scan.routes.ts` para importar desde `scan.helpers.ts` y eliminar las definiciones duplicadas**

En `scan.routes.ts`, reemplazar las definiciones de `levenshtein`, `normalizeName`, `namesOverlap`, `cleanName`, `isPlausibleName`, `wordsUntilHp`, `extractNombre` (y sus tipos `NameResult`, `StageInfo`) con imports:

```typescript
import {
  levenshtein,
  normalizeName,
  namesOverlap,
  cleanName,
  isPlausibleName,
  extractNombre,
  type StageInfo,
  type NameResult,
} from './scan.helpers.js';
```

Eliminar del archivo las funciones ahora importadas (líneas 65–347 aproximadamente). Mantener todo lo demás sin cambios.

- [ ] **Step 3: Ajustar llamada a `extractNombre` en el handler del router**

La nueva firma requiere el mapa de stages. Donde se llama `extractNombre(lines)`, cambiar a:

```typescript
const nameResult = extractNombre(lines, STAGE_LOOKUP);
```

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
cd backend && pnpm exec tsc --noEmit 2>&1 | head -30
```

Esperado: sin errores.

- [ ] **Step 5: Correr los tests**

```bash
cd backend && pnpm test -- --testPathPattern="scan.helpers"
```

Esperado: todos los tests del Task 1 pasan ahora (las funciones están exportadas).

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/scan/scan.helpers.ts src/scan/scan.routes.ts src/__tests__/scan.helpers.test.ts
git commit -m "refactor(scan): extract pure helpers to scan.helpers.ts for testability"
```

---

### Task 3: Función `queryByNumberAndName` (paso 2b)

Nueva función de DB que busca cartas por número + palabra clave del nombre, rankeando por similitud de sigla con el token OCR.

**Files:**
- Modify: `backend/src/scan/scan.routes.ts`

- [ ] **Step 1: Agregar test de integración para la nueva función**

Agregar al final de `backend/src/__tests__/scan.helpers.test.ts`:

```typescript
// Nota: este test requiere DB activa. Skipearlo en CI si no hay conexión.
// Para correrlo manualmente: pnpm test -- --testPathPattern="scan.helpers" --verbose
describe('siglaSimilarityScore', () => {
  it('devuelve 0 para sigla exacta', () => {
    // siglaSimilarityScore es una función pura que exportaremos
    const { siglaSimilarityScore } = require('../scan/scan.helpers.js');
    expect(siglaSimilarityScore('PAF', 'PAF')).toBe(0);
  });

  it('devuelve distancia normalizada para siglas similares', () => {
    const { siglaSimilarityScore } = require('../scan/scan.helpers.js');
    // "GPAF" tiene distancia 1 con "PAF" → score = 1/4 = 0.25
    expect(siglaSimilarityScore('GPAF', 'PAF')).toBeCloseTo(0.25);
  });

  it('devuelve 1 para siglas completamente distintas', () => {
    const { siglaSimilarityScore } = require('../scan/scan.helpers.js');
    expect(siglaSimilarityScore('XYZ', 'PAF')).toBe(1);
  });
});
```

- [ ] **Step 2: Exportar `siglaSimilarityScore` desde `scan.helpers.ts`**

Agregar al final de `scan.helpers.ts`:

```typescript
/**
 * Score de similitud entre la sigla OCR y una sigla de DB.
 * 0 = idénticas, 1 = completamente distintas.
 * Normaliza por la longitud máxima para que tokens largos no penalicen desproporcionadamente.
 */
export function siglaSimilarityScore(ocrToken: string, dbAbbr: string): number {
  if (!ocrToken) return 1;
  const dist = levenshtein(ocrToken.toUpperCase(), dbAbbr.toUpperCase());
  return dist / Math.max(ocrToken.length, dbAbbr.length);
}
```

- [ ] **Step 3: Correr tests**

```bash
cd backend && pnpm test -- --testPathPattern="scan.helpers"
```

Esperado: todos los tests pasan incluyendo los nuevos de `siglaSimilarityScore`.

- [ ] **Step 4: Agregar `queryByNumberAndName` en `scan.routes.ts`**

Agregar esta función después de `queryByName` (alrededor de línea 390 en el archivo original, ajustar según refactor del Task 2):

```typescript
/**
 * Paso (2b): Busca cartas por número + primera palabra significativa del nombre.
 * Cuando la sigla está garbled pero el número es confiable, este query filtra
 * candidatos reales y los rankea por similitud de sigla con el token OCR.
 *
 * Si firstSigWord está vacío, busca solo por número (más candidatos, menos preciso).
 */
async function queryByNumberAndName(
  numero: string,
  firstSigWord: string,
  rawSetToken: string,
): Promise<ReverseLookupMatch[]> {
  const n = parseInt(numero, 10);
  if (isNaN(n)) return [];

  const numVariants = [...new Set([numero, String(n), String(n).padStart(2, '0'), String(n).padStart(3, '0')])];

  try {
    let rows: ReverseLookupMatch[];

    if (firstSigWord && firstSigWord.length >= 4) {
      const { rows: r } = await catalogPool.query<ReverseLookupMatch>(
        `SELECT set_abbr, set_name, card_number, lang_code, card_name
         FROM v_cards_unified
         WHERE card_number = ANY($1::text[])
           AND card_name ILIKE '%' || $2 || '%'
         LIMIT 30`,
        [numVariants, firstSigWord],
      );
      rows = r;
    } else {
      // Sin nombre: solo por número, resultados más amplios
      const { rows: r } = await catalogPool.query<ReverseLookupMatch>(
        `SELECT set_abbr, set_name, card_number, lang_code, card_name
         FROM v_cards_unified
         WHERE card_number = ANY($1::text[])
         LIMIT 30`,
        [numVariants],
      );
      rows = r;
    }

    if (rows.length === 0) return [];

    // Rankear por similitud de sigla con el token OCR
    return rows
      .map(r => ({ ...r, _score: siglaSimilarityScore(rawSetToken, r.set_abbr) }))
      .sort((a, b) => a._score - b._score)
      .map(({ _score: _s, ...r }) => r);

  } catch (err: any) {
    console.warn('[scan] queryByNumberAndName falló:', err.message);
    return [];
  }
}
```

También agregar el import de `siglaSimilarityScore` al bloque de imports de `scan.helpers.ts`:

```typescript
import {
  levenshtein,
  normalizeName,
  namesOverlap,
  cleanName,
  isPlausibleName,
  extractNombre,
  siglaSimilarityScore,
  type StageInfo,
  type NameResult,
} from './scan.helpers.js';
```

- [ ] **Step 5: Verificar compilación**

```bash
cd backend && pnpm exec tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/scan/scan.routes.ts src/scan/scan.helpers.ts src/__tests__/scan.helpers.test.ts
git commit -m "feat(scan): add siglaSimilarityScore helper and queryByNumberAndName function"
```

---

### Task 4: Insertar paso (2b) en la cascada de resolución

Conectar `queryByNumberAndName` en el flujo principal del handler POST `/api/scan`.

**Files:**
- Modify: `backend/src/scan/scan.routes.ts`

- [ ] **Step 1: Agregar `'number-name'` al tipo `FuenteColeccion`**

Localizar la línea:
```typescript
type FuenteColeccion = 'footer' | 'footer-alt' | 'reverse' | 'ocr';
```

Reemplazar con:
```typescript
type FuenteColeccion = 'footer' | 'footer-alt' | 'number-name' | 'reverse' | 'ocr';
```

- [ ] **Step 2: Calcular `firstSigWord` antes del bloque de la cascada**

Justo antes de `// (1) Sigla primaria del pie + número`, agregar:

```typescript
const PARTICLES = new Set(['de', 'del', 'el', 'la', 'los', 'las', 'ex', 'gx', 'vmax', 'vstar']);
const firstSigWord = ocrNombre
  .split(/\s+/)
  .find(w => w.length >= 4 && !PARTICLES.has(w.toLowerCase())) ?? '';
```

- [ ] **Step 3: Insertar el paso (2b) en la cascada**

Localizar el bloque `// (3) Reverse lookup por nombre OCR + número` (actualmente empieza con `if (!dbName && ocrNombre)`).

Insertar **antes** de ese bloque:

```typescript
// (2b) número + primera palabra significativa del nombre → rankear por similitud de sigla
// Se activa cuando sigla primaria y variantes fallaron, pero tenemos número
if (!dbName && numero) {
  const candidates = await queryByNumberAndName(numero, firstSigWord, rawSet);
  const best = candidates.find(c => namesOverlap(ocrNombre, c.card_name)) ?? candidates[0] ?? null;
  if (best) {
    dbName         = best.card_name;
    nombreFinal    = best.card_name;
    coleccionFinal = best.set_abbr;
    idiomaFinal    = best.lang_code.trim().toUpperCase();
    fuente         = 'number-name';
    if (!numeroFinal) numeroFinal = best.card_number;
    reverseMatches = candidates;
    console.log(`[scan]   (2b) "${best.card_name}" en ${best.set_abbr}  score: ${siglaSimilarityScore(rawSet, best.set_abbr).toFixed(2)}  total candidatos: ${candidates.length}`);
  }
}
```

- [ ] **Step 4: Actualizar lógica de `needsReview` para incluir `'number-name'`**

Localizar la línea (en `cardRecognition.ts` del frontend, que ya maneja esto automáticamente via `fuenteColeccion`). En `scan.routes.ts`, en el log final, agregar:

```typescript
if (fuente === 'number-name') {
  console.log(`[scan]   fuente: number-name  candidatos totales: ${reverseMatches.length}`);
}
```

- [ ] **Step 5: Verificar compilación**

```bash
cd backend && pnpm exec tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 6: Correr todos los tests**

```bash
cd backend && pnpm test 2>&1 | tail -20
```

Esperado: todos los tests pasan.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/scan/scan.routes.ts
git commit -m "feat(scan): add step 2b — number+name lookup with sigla similarity ranking"
```

---

### Task 5: Ajustar `namesOverlap` y verificar que `needsReview` fluye correctamente al frontend

`namesOverlap` ya fue actualizada en Task 2 (se exportó con la nueva lógica `nb.startsWith(na)`). Este task verifica que el cambio no genera falsos positivos en los tests existentes y que `needsReview` se propaga correctamente desde la nueva fuente.

**Files:**
- Modify: `backend/src/scan/scan.routes.ts`
- Modify: `vite-project/vite-project-ts/src/services/cardRecognition.ts`

- [ ] **Step 1: Verificar tests de `namesOverlap`**

```bash
cd backend && pnpm test -- --testPathPattern="scan.helpers" --verbose 2>&1 | grep -E "(PASS|FAIL|✓|✗|namesOverlap)"
```

Esperado: todos los tests de `namesOverlap` en verde.

- [ ] **Step 2: Actualizar `needsReview` en `cardRecognition.ts`**

En `vite-project/vite-project-ts/src/services/cardRecognition.ts`, localizar:

```typescript
const needsReview = !data.nombre || data.fuenteColeccion === 'ocr' || data.fuenteColeccion === 'reverse'
```

Reemplazar con:

```typescript
const needsReview = !data.nombre || data.fuenteColeccion === 'ocr' || data.fuenteColeccion === 'reverse' || data.fuenteColeccion === 'number-name'
```

Esto asegura que las cartas identificadas via `number-name` pasen por revisión manual del usuario si hay múltiples candidatos.

- [ ] **Step 3: Compilar frontend**

```bash
cd vite-project/vite-project-ts && pnpm exec tsc --noEmit 2>&1 | head -20
```

Esperado: sin errores.

- [ ] **Step 4: Correr todos los tests**

```bash
cd backend && pnpm test 2>&1 | tail -15
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scan/scan.routes.ts vite-project/vite-project-ts/src/services/cardRecognition.ts
git commit -m "feat(scan): propagate number-name source to needsReview in frontend"
```

---

## Resumen de la cascada final

```
(1) footer:        sigla primaria + número → namesOverlap (ahora acepta DB extiende OCR)
(2) footer-alt:    variantes de sigla + número → namesOverlap
(2b) number-name:  número + firstSigWord → rankear por siglaSimilarityScore  [NUEVO]
(3) reverse:       reverseLookup por nombre completo + número (existente)
(4) ocr:           fallback sin confirmación DB

extractNombre tiene ahora Fallback C: primeras 5 líneas si stage y HP fallan.
```
