# Mejora de escaneo de cartas Pokémon — Diseño

## Problema
El principal punto de falla en `/api/scan` es la extracción de la **sigla de colección** desde el pie de carta. El OCR de Google Cloud Vision frecuentemente devuelve tokens garbled (caracteres extra, sustituciones comunes) que no matchean en `SIGLAS_MAP` ni en las variantes de 3 letras actuales. El número de carta es confiable; el nombre está presente en el texto pero a veces incompleto o no extraído.

## Alcance
Modificaciones exclusivamente en `backend/src/scan/scan.routes.ts`. Sin cambios de schema de DB, sin nuevas tablas, sin cambios en frontend.

---

## Enfoque A revisado — Búsqueda por número + nombre parcial

### Trigger
Se activa como **paso (2b)** en la cascada, después de que los pasos (1) y (2) fallen (sigla primaria y variantes de sigla no encontraron carta válida).

### Condición
Requiere: `numero` presente + `ocrNombre` o `firstSigWord` disponible.

### Lógica

```
queryByNumberAndPartialName(numero, firstSigWord):
  SELECT set_abbr, set_name, card_number, lang_code, card_name
  FROM v_cards_unified
  WHERE card_number = ANY($numberVariants)
    AND card_name ILIKE '%' || $firstSigWord || '%'
  ORDER BY siglaSimilarity(set_abbr, rawSet) ASC
  LIMIT 10
```

- `firstSigWord`: primera palabra significativa del nombre OCR (≥4 chars, no partícula)
- `$numberVariants`: variantes de padding ya existentes (`["94","094"]`)
- Ranking por Levenshtein normalizado entre `set_abbr` y `rawSet` OCR

### Decisión sobre resultados
- **1 resultado** → tomar con fuente `'number-name'`, confianza alta
- **N resultados** → tomar el de menor distancia sigla, marcar `needsReview: true`
- **0 resultados** → fallback: mismo query sin filtro de nombre (solo número), rankear por sigla

### Fuente nueva
Agregar `'number-name'` al tipo `FuenteColeccion`. El frontend ya maneja `needsReview` según la fuente.

---

## Enfoque C1 — Tercer fallback en `extractNombre`

### Problema
`extractNombre` requiere stage conocido o marcador HP/PS/PV. Si ambos fallan, devuelve `''` aunque el nombre esté en el texto.

### Solución
Agregar **Fallback C** al final de `extractNombre`, después de los fallbacks A y B existentes:

```
// Fallback C: primeras 5 líneas del texto — la primera que pase isPlausibleName
for (const line of lines.slice(0, 5)) {
  const candidate = cleanName(line)
  if (isPlausibleName(candidate)) return { nombre: candidate, stage: '', stageLang: '', stageKey: '' }
}
```

Conservador: usa la misma validación `isPlausibleName` existente, solo expande el área de búsqueda.

---

## Enfoque C2 — Completar nombre OCR con nombre de DB

### Problema
`namesOverlap` actualmente rechaza cuando el nombre DB tiene sufijo que OCR no detectó (ej. OCR="Gardevoir", DB="Gardevoir ex"). Esto hace que el paso (1) descarte la carta correcta y continúe la cascada innecesariamente.

### Solución
Cambiar la semántica de `namesOverlap` para permitir que DB **extienda** el nombre OCR:

```
// Antes: ambos deben contener el prefijo del otro
// Después: además aceptar cuando db_name empieza con ocr_name (DB es más completo)
function namesOverlap(ocrName, dbName):
  ... lógica actual ...
  OR dbName.startsWith(ocrName)   // DB extiende el nombre OCR con sufijo
```

Esto resuelve cartas cuyo sufijo (`ex`, `V`, `VMAX`, `VSTAR`, `GX`) usa tipografía distinta que el OCR no captura como parte del nombre.

---

## Cascada final de resolución (orden completo)

```
(1) Sigla primaria del pie + número → validar namesOverlap (C2 aplicado)
(2) Variantes de sigla (ventanas de 3) + número → validar namesOverlap (C2 aplicado)
(2b) número + firstSigWord → rankear por similitud de sigla [NUEVO]
(3) reverseLookup existente (nombre completo + número, fallbacks)
(4) fallback OCR sin confirmación DB
```

---

## Impacto en respuesta al frontend

| Campo | Cambio |
|-------|--------|
| `fuenteColeccion` | Nuevo valor posible: `'number-name'` |
| `needsReview` | `true` cuando fuente es `'number-name'` con múltiples candidatos |
| `candidatos` | Se propaga también desde paso (2b) |
| Resto | Sin cambios |

El tipo `ScannedCardResult` en `cardRecognition.ts` no requiere cambios.
