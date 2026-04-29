# Tienda como Vendedora Directa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que cuentas TiendaRetiro publiquen sus propias cartas y gestionen ventas directas (pendiente → finalizado) sin intervención de vendedor particular ni envío.

**Architecture:** Sin cambios de schema. Carta ya tiene `uploaderTienda`, ItemCarta ya tiene `uploaderTienda`, Compra ya tiene `tiendaRetiro`. Se agregan rutas de publicaciones en tiendaRetiro.routes, se modifica el `add` de compras para agrupar items por tienda en paralelo al mapa de vendedores, se ajusta `findAll` de cartas para exponer `uploaderTienda`, y se reemplazan placeholders en el perfil de tienda.

**Tech Stack:** Express 5 + TypeScript + MikroORM 6 + PostgreSQL — backend. React 19 + TypeScript + Vite + Tailwind — frontend. pnpm.

---

## Mapa de archivos

| Archivo | Acción |
|---|---|
| `backend/src/carta/carta.controler.ts` | Modificar `findAll`: exponer `uploaderTienda` en respuesta |
| `backend/src/compra/compra.controler.ts` | Modificar `add`: agregar `tiendaMap` para items de tienda |
| `backend/src/tiendaRetiro/tiendaRetiro.controller.ts` | Agregar: `sanitizePublicacionTiendaInput`, `getPublicaciones`, `addPublicacion`, `updatePublicacion`, `removePublicacion`, `getVentasDirectas`, `finalizarDirecto`. Modificar: `getVentas` para filtrar solo flujo 3 actores |
| `backend/src/tiendaRetiro/tiendaRetiro.routes.ts` | Agregar 6 nuevas rutas |
| `vite-project/vite-project-ts/src/pages/Reservar.tsx` | Detectar items de tienda, mostrar bloque fijo de retiro |
| `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx` | Reemplazar placeholder "Mis Publicaciones" y "Mis Ventas" |

**No tocar:**
- `TiendaRetiroVentasPage.tsx` — flujo 3 actores intacto
- `marcarEnTienda`, `finalizarCompra` existentes — intactos
- Schema — sin migraciones

---

## Task 1: Exponer `uploaderTienda` en `GET /api/cartas`

**Files:**
- Modify: `backend/src/carta/carta.controler.ts`

El `findAll` actual no incluye `uploaderTienda` en la respuesta formateada ni en el `populate`. Sin esto, el carrito no sabe si un item pertenece a una tienda y Reservar.tsx no puede separarlo.

- [ ] **Step 1: Abrir el archivo y localizar las líneas clave**

Leer `backend/src/carta/carta.controler.ts`.  
Buscar la línea ~52 donde está `em.find(Carta, {}, { populate: [...] })`.  
Buscar la línea ~115 donde se construye `cartaFormateada.uploader`.

- [ ] **Step 2: Agregar `uploaderTienda` al populate del `findAll`**

En la línea ~52, el `em.find` tiene:
```typescript
const cartas = await em.find(Carta, {}, { populate: ["cartaClass", "items", "items.cartas", "items.intermediarios.direccion", "uploader"] });
```

Cambiarlo a:
```typescript
const cartas = await em.find(Carta, {}, { populate: ["cartaClass", "items", "items.cartas", "items.intermediarios.direccion", "uploader", "uploaderTienda"] });
```

- [ ] **Step 3: Agregar `uploaderTienda` al objeto `cartaFormateada`**

Inmediatamente después del bloque `if (carta.uploader) { ... }` (línea ~115-123), agregar:

```typescript
if ((carta as any).uploaderTienda) {
  const t = (carta as any).uploaderTienda;
  cartaFormateada.uploaderTienda = {
    id: t.id,
    nombre: t.nombre,
    direccion: t.direccion,
    horario: t.horario ?? null,
    ciudad: t.ciudad ?? null,
  };
}
```

- [ ] **Step 4: Verificar en dev que el endpoint devuelve `uploaderTienda`**

Con el backend corriendo (`cd backend && pnpm start:dev`), hacer:
```bash
curl http://localhost:3000/api/cartas | python -m json.tool | grep -A5 uploaderTienda
```
Si no hay cartas de tienda aún, el campo no aparece — eso es correcto.

- [ ] **Step 5: Commit**

```bash
git add backend/src/carta/carta.controler.ts
git commit -m "feat(carta): expose uploaderTienda in findAll response"
```

---

## Task 2: Publicaciones CRUD en `tiendaRetiro.controller.ts`

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`

Agregar importaciones, un sanitize middleware, y cuatro funciones: `getPublicaciones`, `addPublicacion`, `updatePublicacion`, `removePublicacion`.

- [ ] **Step 1: Agregar imports faltantes al principio del archivo**

El archivo actualmente importa `TiendaRetiro`, `Compra`, etc. Agregar los que faltan:

```typescript
import { Carta } from "../carta/carta.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
```

Estos van después de las importaciones existentes, antes de `const em = orm.em`.

- [ ] **Step 2: Agregar `sanitizePublicacionTiendaInput` middleware**

Después de `sanitizeTiendaRetiroInput` (línea ~28), agregar:

```typescript
export function sanitizePublicacionTiendaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name:        req.body.name,
    price:       req.body.price,
    rarity:      req.body.rarity,
    setName:     req.body.setName,
    setCode:     req.body.setCode,
    cardNumber:  req.body.cardNumber,
    lang:        req.body.lang,
    description: req.body.description,
    stock:       req.body.stock,
    estado:      req.body.estado,
  };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}
```

- [ ] **Step 3: Agregar `getPublicaciones`**

Al final del archivo, antes del último export, agregar:

```typescript
export async function getPublicaciones(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const cartas = await orm.em.find(
      Carta,
      { uploaderTienda: { id } },
      { populate: ['items'], orderBy: { id: 'DESC' } }
    );
    res.json({ data: cartas });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 4: Agregar `addPublicacion`**

```typescript
export async function addPublicacion(req: Request, res: Response) {
  try {
    const tiendaId = Number(req.params.id);
    const input = req.body.sanitizedInput;

    if (!input.name || input.price === undefined || input.stock === undefined) {
      return res.status(400).json({ message: 'name, price y stock son obligatorios' });
    }

    const tienda = await orm.em.findOne(TiendaRetiro, { id: tiendaId });
    if (!tienda) return res.status(404).json({ message: 'Tienda no encontrada' });

    const itemCarta = orm.em.create(ItemCarta, {
      name:          input.name,
      description:   input.description ?? '',
      stock:         Number(input.stock),
      estado:        input.estado ?? 'disponible',
      uploaderTienda: tienda,
    });

    const carta = orm.em.create(Carta, {
      name:          input.name,
      price:         String(input.price),
      rarity:        input.rarity,
      setName:       input.setName,
      setCode:       input.setCode,
      cardNumber:    input.cardNumber,
      lang:          input.lang,
      uploaderTienda: tienda,
    });
    carta.items.add(itemCarta);

    await orm.em.flush();
    res.status(201).json({ message: 'Publicación creada', data: carta });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 5: Agregar `updatePublicacion`**

```typescript
export async function updatePublicacion(req: Request, res: Response) {
  try {
    const tiendaId = Number(req.params.id);
    const cartaId  = Number(req.params.cartaId);
    const input    = req.body.sanitizedInput;

    const carta = await orm.em.findOne(
      Carta,
      { id: cartaId, uploaderTienda: { id: tiendaId } },
      { populate: ['items'] }
    );
    if (!carta) return res.status(404).json({ message: 'Publicación no encontrada' });

    if (input.name      !== undefined) carta.name     = input.name;
    if (input.price     !== undefined) carta.price    = String(input.price);
    if (input.rarity    !== undefined) carta.rarity   = input.rarity;
    if (input.setName   !== undefined) carta.setName  = input.setName;
    if (input.setCode   !== undefined) carta.setCode  = input.setCode;
    if (input.cardNumber !== undefined) carta.cardNumber = input.cardNumber;

    const item = carta.items.getItems()[0];
    if (item) {
      if (input.description !== undefined) item.description = input.description;
      if (input.stock       !== undefined) item.stock       = Number(input.stock);
      if (input.estado      !== undefined) item.estado      = input.estado;
      if (input.name        !== undefined) item.name        = input.name;
    }

    await orm.em.flush();
    res.json({ message: 'Publicación actualizada', data: carta });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 6: Agregar `removePublicacion`**

```typescript
export async function removePublicacion(req: Request, res: Response) {
  try {
    const tiendaId = Number(req.params.id);
    const cartaId  = Number(req.params.cartaId);

    const carta = await orm.em.findOne(
      Carta,
      { id: cartaId, uploaderTienda: { id: tiendaId } },
      { populate: ['items', 'items.compras'] }
    );
    if (!carta) return res.status(404).json({ message: 'Publicación no encontrada' });

    const hasActive = carta.items.getItems().some((ic) =>
      ic.compras.getItems().some((c) => c.estado === 'pendiente')
    );
    if (hasActive) {
      return res.status(400).json({ message: 'No se puede eliminar una publicación con compras pendientes' });
    }

    await orm.em.removeAndFlush(carta);
    res.json({ message: 'Publicación eliminada' });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 7: Verificar que TypeScript compila sin errores**

```bash
cd backend && pnpm start:dev
```
Esperar que diga `Compiled successfully` (o equivalente del tsc-watch). Si hay errores, resolverlos antes de continuar.

- [ ] **Step 8: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.controller.ts
git commit -m "feat(tiendaRetiro): add publicaciones CRUD controller functions"
```

---

## Task 3: Ventas directas y finalizar directo en `tiendaRetiro.controller.ts`

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`

Agregar `getVentasDirectas` y `finalizarDirecto`. Modificar `getVentas` para excluir ventas directas (flujo 2 actores).

- [ ] **Step 1: Agregar `getVentasDirectas`**

Al final del archivo, agregar:

```typescript
export async function getVentasDirectas(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const compras = await orm.em.find(
      Compra,
      { tiendaRetiro: { id } },
      {
        populate: ['comprador', 'itemCartas', 'itemCartas.uploaderTienda'],
        orderBy: { createdAt: 'DESC' },
      }
    );

    // Solo compras cuyo primer item pertenece a esta tienda (flujo directo)
    const directas = compras.filter((c) =>
      c.itemCartas.getItems().some((ic) => (ic as any).uploaderTienda?.id === id)
    );

    const data = directas.map((compra) => ({
      id:        compra.id,
      estado:    compra.estado,
      total:     compra.total,
      createdAt: compra.createdAt,
      nombre:    (compra.comprador as any)?.username || compra.nombre || 'Comprador',
      email:     (compra.comprador as any)?.email    || compra.email  || '',
      telefono:  compra.telefono ?? '',
      items:     (compra.items ?? []).map((i) => ({
        cartaNombre: i.title ?? `Carta #${i.cartaId}`,
        cantidad:    i.quantity,
        precio:      i.price ?? 0,
      })),
    }));

    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 2: Agregar `finalizarDirecto`**

```typescript
export async function finalizarDirecto(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador'] }
    );

    if (!compra) {
      return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });
    }
    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'finalizado';
    await orm.em.flush();

    res.json({ message: 'Compra finalizada', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 3: Modificar `getVentas` para excluir ventas directas**

`getVentas` está en el controller. Actualmente hace:
```typescript
const compras = await em.find(Compra, { tiendaRetiro: { id } }, { populate: [...] });
```

Agregar populate de `uploaderTienda` en items y filtrar en memoria. Buscar la sección dentro de `getVentas` donde se mapea el resultado y agregar antes del `.map(...)`:

```typescript
// Agregar 'itemCartas.uploaderTienda' al populate existente de getVentas:
// populate: ["comprador", "itemCartas", "itemCartas.uploaderVendedor"]
// → cambiar a:
// populate: ["comprador", "itemCartas", "itemCartas.uploaderVendedor", "itemCartas.uploaderTienda"]
```

Luego, después de obtener `compras`, agregar el filtro:

```typescript
// Conservar solo compras del flujo 3 actores (items tienen uploaderVendedor, no uploaderTienda)
const comprasFiltradas = compras.filter((c) =>
  c.itemCartas.getItems().some((ic) => (ic as any).uploaderVendedor?.id != null)
);
```

Y usar `comprasFiltradas` en lugar de `compras` para el `.map(...)` que construye `data`.

El código completo de `getVentas` quedaría:

```typescript
export async function getVentas(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const compras = await em.find(
      Compra,
      { tiendaRetiro: { id } },
      {
        populate: ["comprador", "itemCartas", "itemCartas.uploaderVendedor", "itemCartas.uploaderTienda"],
        orderBy: { createdAt: "DESC" },
      }
    );

    // Solo flujo 3 actores: items tienen uploaderVendedor
    const comprasFiltradas = compras.filter((c) =>
      c.itemCartas.getItems().some((ic) => (ic as any).uploaderVendedor?.id != null)
    );

    const data = comprasFiltradas.map((compra) => {
      const vendedoresMap = new Map<number, { nombre: string; alias: string | null; cbu: string | null }>();
      for (const itemCarta of compra.itemCartas) {
        const v = (itemCarta as any).uploaderVendedor;
        if (v && !vendedoresMap.has(v.id)) {
          vendedoresMap.set(v.id, { nombre: v.nombre, alias: v.alias ?? null, cbu: v.cbu ?? null });
        }
      }

      const items = (compra.items ?? []).map((i) => ({
        cartaNombre: i.title ?? `Carta #${i.cartaId}`,
        cantidad:    i.quantity,
        precio:      i.price ?? 0,
      }));

      return {
        id:        compra.id,
        estado:    compra.estado,
        total:     compra.total,
        createdAt: compra.createdAt,
        comprador: {
          nombre: (compra.comprador as any)?.username || compra.nombre || "Comprador",
          email:  (compra.comprador as any)?.email    || compra.email  || "",
        },
        vendedores: Array.from(vendedoresMap.values()),
        items,
      };
    });

    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd backend && pnpm start:dev
```

Esperar `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.controller.ts
git commit -m "feat(tiendaRetiro): add ventasDirectas endpoint and finalizarDirecto, filter getVentas to 3-actor flow"
```

---

## Task 4: Registrar nuevas rutas en `tiendaRetiro.routes.ts`

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.routes.ts`

- [ ] **Step 1: Actualizar los imports del router**

El archivo actual importa las funciones del controller. Agregar las nuevas:

```typescript
import {
  sanitizeTiendaRetiroInput,
  sanitizePublicacionTiendaInput,
  findAll,
  findOne,
  add,
  login,
  update,
  getVentas,
  marcarEnTienda,
  finalizarCompra,
  getPublicaciones,
  addPublicacion,
  updatePublicacion,
  removePublicacion,
  getVentasDirectas,
  finalizarDirecto,
} from "./tiendaRetiro.controller.js";
```

- [ ] **Step 2: Agregar las 6 nuevas rutas**

Al final del archivo (después de las rutas existentes), agregar:

```typescript
// Publicaciones de la tienda (como vendedora directa)
tiendaRouter.get(
  "/:id/publicaciones",
  authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf,
  getPublicaciones
);
tiendaRouter.post(
  "/:id/publicaciones",
  authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf,
  sanitizePublicacionTiendaInput, addPublicacion
);
tiendaRouter.patch(
  "/:id/publicaciones/:cartaId",
  authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf,
  sanitizePublicacionTiendaInput, updatePublicacion
);
tiendaRouter.delete(
  "/:id/publicaciones/:cartaId",
  authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf,
  removePublicacion
);

// Ventas directas de la tienda
tiendaRouter.get(
  "/:id/ventas-directas",
  authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf,
  getVentasDirectas
);
tiendaRouter.patch(
  "/:id/ventas/:compraId/finalizar-directo",
  authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf,
  finalizarDirecto
);
```

- [ ] **Step 3: Smoke test manual de las rutas**

Con el backend corriendo, verificar que las rutas existen (deben devolver 401, no 404):

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tiendas/1/publicaciones
# Esperar: 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/tiendas/1/ventas-directas
# Esperar: 401
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.routes.ts
git commit -m "feat(tiendaRetiro): register publicaciones and ventasDirectas routes"
```

---

## Task 5: Modificar `add` en `compra.controler.ts` para items de tienda

**Files:**
- Modify: `backend/src/compra/compra.controler.ts`

El `add` actual agrupa todos los items en `vendorMap` por `uploaderVendedor.id`. Items de tienda tienen `uploaderTienda` set y `uploaderVendedor = null`, así que caen en `vendorId = 0` — incorrecto. Necesitamos un `tiendaMap` paralelo.

- [ ] **Step 1: Localizar el bloque de procesamiento de items en `add`**

Buscar en el archivo la sección que empieza con:
```typescript
// Agrupar items por vendedor
const vendorMap = new Map<number, { itemCartas: ItemCarta[]; items: any[] }>();
```
(aproximadamente línea 156).

- [ ] **Step 2: Agregar `tiendaMap` y modificar el procesamiento de `cartaId`**

Agregar el segundo mapa justo después de `vendorMap`:

```typescript
const vendorMap  = new Map<number, { itemCartas: ItemCarta[]; items: any[] }>();
const tiendaMap  = new Map<number, { tienda: TiendaRetiro; itemCartas: ItemCarta[]; items: any[] }>();
```

Luego, en el bloque `cartaId` (línea ~197), la línea que hace:
```typescript
const carta = await em.findOne(
  Carta,
  { id: reqItem.cartaId },
  { populate: ['items', 'items.uploaderVendedor', 'uploader'] }
);
```
Cambiarla a (agrega `uploaderTienda` al populate):
```typescript
const carta = await em.findOne(
  Carta,
  { id: reqItem.cartaId },
  { populate: ['items', 'items.uploaderVendedor', 'items.uploaderTienda', 'uploader', 'uploaderTienda'] }
);
```

Después, donde se calcula `vendorId` y se agrupa al `vendorMap`, reemplazar:

```typescript
const vendorId = availableItem.uploaderVendedor?.id ?? carta.uploader?.id ?? 0;

if (!vendorMap.has(vendorId)) {
  vendorMap.set(vendorId, { itemCartas: [], items: [] });
}
const group = vendorMap.get(vendorId)!;
group.itemCartas.push(availableItem);
group.items.push({ ... });
```

Por:

```typescript
// Detectar si es item de tienda
const tiendaUploader = (availableItem as any).uploaderTienda ?? (carta as any).uploaderTienda;

if (tiendaUploader?.id) {
  const tiendaId = tiendaUploader.id as number;
  if (!tiendaMap.has(tiendaId)) {
    tiendaMap.set(tiendaId, { tienda: tiendaUploader as TiendaRetiro, itemCartas: [], items: [] });
  }
  const tGroup = tiendaMap.get(tiendaId)!;
  tGroup.itemCartas.push(availableItem);
  tGroup.items.push({
    cartaId:  reqItem.cartaId,
    quantity: reqItem.quantity,
    price:    reqItem.price,
    title:    reqItem.title,
  });
} else {
  const vendorId = availableItem.uploaderVendedor?.id ?? carta.uploader?.id ?? 0;
  if (!vendorMap.has(vendorId)) {
    vendorMap.set(vendorId, { itemCartas: [], items: [] });
  }
  const group = vendorMap.get(vendorId)!;
  group.itemCartas.push(availableItem);
  group.items.push({
    cartaId:  reqItem.cartaId,
    quantity: reqItem.quantity,
    price:    reqItem.price,
    title:    reqItem.title,
  });
}
```

- [ ] **Step 3: Agregar creación de Compras desde `tiendaMap`**

Después del loop `for (const [vendorId, group] of vendorMap)` que crea compras, agregar:

```typescript
// Crear una Compra por cada tienda (venta directa)
for (const [, tGroup] of tiendaMap) {
  const tiendaTotal = tGroup.items.reduce(
    (sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 1),
    0
  );

  const compra = em.create(Compra, {
    ...(compradorUser   ? { comprador: compradorUser }   : {}),
    ...(compradorTienda ? { compradorTienda }            : {}),
    itemCartas:   tGroup.itemCartas,
    total:        tiendaTotal,
    estado:       'pendiente',
    nombre:       input.nombre,
    email:        input.email,
    telefono:     input.telefono,
    tiendaRetiro: tGroup.tienda,
    metodoPago:   input.metodoPago,
    items:        tGroup.items,
    // sin envio — retiro en tienda
  });

  compras.push(compra);
}
```

- [ ] **Step 4: Verificar que compila**

```bash
cd backend && pnpm start:dev
```

- [ ] **Step 5: Test manual — crear una compra con item de tienda**

Primero crear una tienda y una publicación vía API (o usar el perfil frontend). Luego:

```bash
# 1. Login de tienda (obtener token)
TOKEN=$(curl -s -X POST http://localhost:3000/api/tiendas/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tienda@test.com","password":"pass123"}' | python -m json.tool | grep '"token"' | sed 's/.*: "\(.*\)".*/\1/')

# 2. Crear publicación
CARTA_ID=$(curl -s -X POST http://localhost:3000/api/tiendas/1/publicaciones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Pikachu","price":500,"stock":3,"description":"Mint","estado":"disponible"}' \
  | python -m json.tool | grep '"id"' | head -1 | sed 's/.*: \([0-9]*\).*/\1/')

echo "Carta ID: $CARTA_ID"

# 3. Crear compra (sin auth user, como guest anon)
curl -s -X POST http://localhost:3000/api/compras \
  -H "Content-Type: application/json" \
  -d "{\"nombre\":\"Test User\",\"email\":\"test@test.com\",\"telefono\":\"1234\",\"metodoPago\":\"efectivo\",\"total\":500,\"items\":[{\"cartaId\":$CARTA_ID,\"quantity\":1,\"price\":500,\"title\":\"Pikachu\"}]}" \
  | python -m json.tool
# Esperar: data con tiendaRetiro seteado, sin envio, estado pendiente
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/compra/compra.controler.ts
git commit -m "feat(compra): group tienda items into tiendaMap for direct-sale compras"
```

---

## Task 6: Modificar `Reservar.tsx` para items de tienda

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/Reservar.tsx`

Los items de tienda tienen `item.uploaderTienda` seteado (en lugar de `item.uploader`). El formulario de reserva debe mostrar un bloque fijo de retiro para ellos, sin selector.

- [ ] **Step 1: Agregar tipo `UploaderTienda` e `itemsPorTienda` al componente**

Al inicio del componente (luego de los estados existentes), agregar:

```typescript
interface UploaderTienda {
  id: number
  nombre: string
  direccion: string
  horario?: string | null
}

// Separar items por tipo de vendedor
const itemsPorVendedor: Record<string, { vendedorNombre: string; items: any[] }> = {}
const itemsPorTienda:   Record<string, { tienda: UploaderTienda; items: any[] }> = {}

for (const item of cart) {
  if (item.uploaderTienda?.id) {
    const key    = String(item.uploaderTienda.id)
    const tienda = item.uploaderTienda as UploaderTienda
    if (!itemsPorTienda[key]) itemsPorTienda[key] = { tienda, items: [] }
    itemsPorTienda[key].items.push(item)
  } else {
    const key    = String(item.uploader?.id ?? 'sin-vendedor')
    const nombre = item.uploader?.nombre ?? 'Vendedor desconocido'
    if (!itemsPorVendedor[key]) itemsPorVendedor[key] = { vendedorNombre: nombre, items: [] }
    itemsPorVendedor[key].items.push(item)
  }
}
```

**Importante:** el código anterior REEMPLAZA el bloque existente que construye `itemsPorVendedor` (que empieza en la línea ~39). Dejar solo el nuevo bloque.

- [ ] **Step 2: Actualizar la validación del submit**

En `handleReservar`, la validación actual itera `Object.keys(itemsPorVendedor)`. Ahora también hay tienda items, que NO requieren selección. La validación existente ya solo aplica a vendedores, así que solo necesitamos asegurarnos de que `vendedorKeys` no incluya tienda items.

El bloque de validación (línea ~94) queda intacto porque ya itera solo `Object.keys(itemsPorVendedor)`.

- [ ] **Step 3: Agregar bloque fijo de retiro para items de tienda en el form**

En el JSX del form, después del bloque `{Object.entries(itemsPorVendedor).map(...)}` (selector de tiendas por vendedor), agregar:

```tsx
{/* Bloque fijo de retiro para items de tienda */}
{Object.entries(itemsPorTienda).map(([tiendaKey, grupo]) => (
  <div className="form-section" key={`tienda-${tiendaKey}`}>
    <h3>
      Retiro — <span style={{ color: '#f97316' }}>{grupo.tienda.nombre}</span>
    </h3>
    <div
      style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          '0.75rem',
        padding:      '0.75rem 1rem',
        border:       '2px solid #f97316',
        borderRadius: '0.5rem',
        background:   '#fff7ed',
      }}
    >
      <span style={{ fontSize: '1.2rem' }}>📍</span>
      <div>
        <p style={{ fontWeight: 600, margin: 0 }}>{grupo.tienda.nombre}</p>
        <p style={{ fontSize: '0.85rem', color: '#4b5563', margin: '0.1rem 0 0' }}>
          {grupo.tienda.direccion}
        </p>
        {grupo.tienda.horario && (
          <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '0.1rem 0 0' }}>
            🕐 {grupo.tienda.horario}
          </p>
        )}
        <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0.4rem 0 0', fontWeight: 500 }}>
          Pagás y retirás en el local al momento de buscar tu pedido.
        </p>
      </div>
    </div>
  </div>
))}
```

- [ ] **Step 4: Actualizar resumen del pedido para incluir items de tienda**

En el `checkout-summary` (lado derecho), el resumen actual solo itera `itemsPorVendedor`. Agregar también los grupos de tienda:

Después del bloque `{Object.entries(itemsPorVendedor).map(...)}` dentro de `.order-items`, agregar:

```tsx
{Object.entries(itemsPorTienda).map(([key, grupo]) => (
  <div key={`tienda-sum-${key}`} style={{ marginBottom: '1rem' }}>
    <p
      style={{
        fontSize:       '0.75rem',
        fontWeight:     600,
        textTransform:  'uppercase',
        letterSpacing:  '0.05em',
        color:          '#6b7280',
        marginBottom:   '0.5rem',
        borderBottom:   '1px solid #e5e7eb',
        paddingBottom:  '0.25rem',
      }}
    >
      Tienda: {grupo.tienda.nombre}
    </p>
    {grupo.items.map((item: any) => (
      <div key={item.id} className="order-item">
        <img src={item.thumbnail} alt={item.title} className="item-image" />
        <div className="item-details">
          <h4>{item.title}</h4>
          <p>Cantidad: {item.quantity}</p>
          <p className="item-price">${(item.price * item.quantity).toFixed(2)}</p>
        </div>
      </div>
    ))}
  </div>
))}
```

- [ ] **Step 5: Actualizar el mensaje de confirmación**

Cuando `reservaConfirmada === true`, el mensaje actual dice "Desde Mis Compras podés chatear con el vendedor...". Actualizar para contemplar si hay compras de tienda:

Reemplazar el bloque `if (reservaConfirmada)` completo:

```tsx
if (reservaConfirmada) {
  const tieneItemsTienda  = Object.keys(itemsPorTienda).length > 0
  const tieneItemsVendedor = Object.keys(itemsPorVendedor).length > 0

  return (
    <div className="checkout-success">
      <div className="success-icon">✅</div>
      <h2>¡Reserva confirmada!</h2>
      {compraIds.length > 0 && (
        <p className="text-sm text-gray-500 mb-1">
          {compraIds.length === 1
            ? `Orden #${compraIds[0]}`
            : `Órdenes: ${compraIds.map((id) => `#${id}`).join(', ')}`}
        </p>
      )}
      {tieneItemsTienda && (
        <p style={{ marginBottom: '0.5rem' }}>
          🏪 Tus cartas de tienda están listas. Acercate a retirarlas y pagá en el local.
        </p>
      )}
      {tieneItemsVendedor && (
        <p>
          Desde <strong>Mis Compras</strong> podés chatear con el vendedor para acordar el encuentro.
        </p>
      )}
      <button
        onClick={() => navigate('/purchases')}
        className="continue-shopping-btn"
        style={{ marginTop: '1.5rem' }}
      >
        Ver mis compras
      </button>
    </div>
  )
}
```

**Nota:** `itemsPorTienda` e `itemsPorVendedor` se calculan fuera del render (antes del return principal), así que están disponibles en el bloque `if (reservaConfirmada)`.

- [ ] **Step 6: Verificar en el frontend**

Levantar frontend (`cd vite-project/vite-project-ts && pnpm run dev`), agregar al carrito una carta de tienda y una de vendedor, ir a Reservar. Verificar:
- Items de tienda muestran bloque fijo naranja con dirección
- Items de vendedor muestran selector normal
- El resumen muestra ambos grupos

- [ ] **Step 7: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/Reservar.tsx
git commit -m "feat(Reservar): show fixed pickup block for tienda items, skip store selector"
```

---

## Task 7: Reemplazar placeholders en `MiPerfilTiendaRetiroPage.tsx`

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`

Reemplazar los dos placeholders: "Mis Publicaciones" y "Mis Ventas".

- [ ] **Step 1: Agregar estados para publicaciones y ventas directas**

Al principio del componente (junto con los estados existentes de `tienda`, `loading`, etc.), agregar:

```typescript
// Publicaciones
const [publicaciones, setPublicaciones]   = useState<any[]>([])
const [pubLoading, setPubLoading]         = useState(false)
const [showPubForm, setShowPubForm]       = useState(false)
const [editingPub, setEditingPub]         = useState<any | null>(null)
const [pubForm, setPubForm]               = useState({
  name: '', price: '', rarity: '', setName: '', description: '', stock: '1', estado: 'disponible',
})
const [pubSaving, setPubSaving]           = useState(false)
const [pubMsg, setPubMsg]                 = useState<string | null>(null)
const [pubError, setPubError]             = useState<string | null>(null)

// Ventas directas
const [ventas, setVentas]                 = useState<any[]>([])
const [ventasLoading, setVentasLoading]   = useState(false)
const [finalizando, setFinalizando]       = useState<number | null>(null)
const [ventaMsg, setVentaMsg]             = useState<string | null>(null)
```

- [ ] **Step 2: Cargar publicaciones y ventas en el `useEffect`**

Dentro de `fetchAll` (en el `useEffect` que ya existe), agregar la carga de publicaciones y ventas directas al final del try, después de que `setTienda` y similares se hayan ejecutado:

```typescript
// Cargar publicaciones
setPubLoading(true)
const [pubRes, ventasRes] = await Promise.all([
  fetchApi(`/api/tiendas/${user.id}/publicaciones`),
  fetchApi(`/api/tiendas/${user.id}/ventas-directas`),
])
const pubJson    = await pubRes.json()
const ventasJson = await ventasRes.json()
setPublicaciones(pubJson.data ?? [])
setVentas(ventasJson.data ?? [])
setPubLoading(false)
setVentasLoading(false)
```

- [ ] **Step 3: Agregar funciones de publicaciones**

Después de `saveHorario` y antes del `if (loading) return (...)`, agregar:

```typescript
const resetPubForm = () => {
  setPubForm({ name: '', price: '', rarity: '', setName: '', description: '', stock: '1', estado: 'disponible' })
  setEditingPub(null)
  setShowPubForm(false)
  setPubMsg(null)
  setPubError(null)
}

const handlePubChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  const { name, value } = e.target
  setPubForm(prev => ({ ...prev, [name]: value }))
}

const handleSavePub = async () => {
  if (!user?.id) return
  setPubSaving(true)
  setPubMsg(null)
  setPubError(null)
  try {
    const body = {
      name:        pubForm.name,
      price:       Number(pubForm.price),
      rarity:      pubForm.rarity || undefined,
      setName:     pubForm.setName || undefined,
      description: pubForm.description,
      stock:       Number(pubForm.stock),
      estado:      pubForm.estado,
    }

    if (editingPub) {
      const res = await fetchApi(`/api/tiendas/${user.id}/publicaciones/${editingPub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).message)
      setPublicaciones(prev => prev.map(p => p.id === editingPub.id ? { ...p, ...body } : p))
    } else {
      const res = await fetchApi(`/api/tiendas/${user.id}/publicaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setPublicaciones(prev => [json.data, ...prev])
    }
    setPubMsg(editingPub ? 'Publicación actualizada.' : 'Publicación creada.')
    resetPubForm()
  } catch (err: any) {
    setPubError(err.message || 'Error al guardar.')
  } finally {
    setPubSaving(false)
  }
}

const handleEditPub = (pub: any) => {
  const item = pub.items?.[0]
  setPubForm({
    name:        pub.name        ?? '',
    price:       pub.price       ?? '',
    rarity:      pub.rarity      ?? '',
    setName:     pub.setName     ?? '',
    description: item?.description ?? '',
    stock:       String(item?.stock ?? 1),
    estado:      item?.estado    ?? 'disponible',
  })
  setEditingPub(pub)
  setShowPubForm(true)
  setPubMsg(null)
  setPubError(null)
}

const handleDeletePub = async (cartaId: number) => {
  if (!user?.id) return
  if (!confirm('¿Eliminar esta publicación?')) return
  try {
    const res = await fetchApi(`/api/tiendas/${user.id}/publicaciones/${cartaId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).message)
    setPublicaciones(prev => prev.filter(p => p.id !== cartaId))
  } catch (err: any) {
    alert(err.message || 'Error al eliminar')
  }
}
```

- [ ] **Step 4: Agregar función para finalizar venta directa**

```typescript
const handleFinalizarVenta = async (compraId: number) => {
  if (!user?.id) return
  if (!confirm('¿Confirmás que el comprador pagó y retiró el pedido?')) return
  setFinalizando(compraId)
  setVentaMsg(null)
  try {
    const res = await fetchApi(`/api/tiendas/${user.id}/ventas/${compraId}/finalizar-directo`, { method: 'PATCH' })
    if (!res.ok) throw new Error((await res.json()).message)
    setVentas(prev => prev.map(v => v.id === compraId ? { ...v, estado: 'finalizado' } : v))
    setVentaMsg(`Orden #${compraId} finalizada.`)
  } catch (err: any) {
    alert(err.message || 'Error al finalizar')
  } finally {
    setFinalizando(null)
  }
}
```

- [ ] **Step 5: Reemplazar el placeholder "Mis Publicaciones"**

Buscar el bloque:
```tsx
{/* ── MIS PUBLICACIONES (placeholder) ── */}
<div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
  <h2 className="text-lg font-bold text-gray-800 mb-5">Mis Publicaciones</h2>
  <div className="text-center py-12">
    <div className="text-5xl mb-3 opacity-30">🃏</div>
    <p className="text-gray-400">Próximamente: publicaciones de la tienda.</p>
  </div>
</div>
```

Reemplazarlo por:

```tsx
{/* ── MIS PUBLICACIONES ── */}
<div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
  <div className="flex items-center justify-between mb-5">
    <h2 className="text-lg font-bold text-gray-800">Mis Publicaciones</h2>
    <button
      onClick={() => { resetPubForm(); setShowPubForm(true) }}
      className="text-sm bg-orange-500 hover:bg-orange-600 text-white font-semibold px-4 py-1.5 rounded-lg transition"
    >
      + Nueva
    </button>
  </div>

  {pubMsg && (
    <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{pubMsg}</div>
  )}

  {/* Formulario inline */}
  {showPubForm && (
    <div className="mb-6 p-4 bg-amber-50 border border-orange-100 rounded-xl">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        {editingPub ? 'Editar publicación' : 'Nueva publicación'}
      </h3>
      {pubError && (
        <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{pubError}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { name: 'name',        label: 'Nombre de la carta *', type: 'text'   },
          { name: 'price',       label: 'Precio ($) *',         type: 'number' },
          { name: 'stock',       label: 'Stock *',              type: 'number' },
          { name: 'rarity',      label: 'Rareza',               type: 'text'   },
          { name: 'setName',     label: 'Set',                  type: 'text'   },
        ].map(f => (
          <div key={f.name}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
            <input
              type={f.type}
              name={f.name}
              value={(pubForm as any)[f.name]}
              onChange={handlePubChange}
              disabled={pubSaving}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
            />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
          <select
            name="estado"
            value={pubForm.estado}
            onChange={handlePubChange}
            disabled={pubSaving}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60"
          >
            <option value="disponible">Disponible</option>
            <option value="pausado">Pausado</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
          <textarea
            name="description"
            value={pubForm.description}
            onChange={handlePubChange}
            disabled={pubSaving}
            rows={2}
            placeholder="Estado de la carta, condición, etc."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange-400 transition disabled:opacity-60 resize-none"
          />
        </div>
      </div>
      <div className="flex gap-3 mt-3">
        <button
          onClick={handleSavePub}
          disabled={pubSaving}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition"
        >
          {pubSaving ? 'Guardando...' : (editingPub ? 'Actualizar' : 'Publicar')}
        </button>
        <button
          onClick={resetPubForm}
          className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-sm font-medium px-5 py-2 rounded-lg transition"
        >
          Cancelar
        </button>
      </div>
    </div>
  )}

  {pubLoading ? (
    <p className="text-sm text-gray-400">Cargando...</p>
  ) : publicaciones.length === 0 ? (
    <div className="text-center py-10">
      <div className="text-4xl mb-2 opacity-30">🃏</div>
      <p className="text-gray-400 text-sm">No tenés publicaciones aún.</p>
    </div>
  ) : (
    <div className="space-y-3">
      {publicaciones.map((pub: any) => {
        const item = pub.items?.[0]
        return (
          <div key={pub.id} className="flex items-start justify-between gap-3 p-3 border border-gray-100 rounded-lg hover:border-orange-200 transition">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm truncate">{pub.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                ${pub.price} · Stock: {item?.stock ?? '—'} · {item?.estado ?? '—'}
                {pub.rarity && ` · ${pub.rarity}`}
              </p>
              {item?.description && (
                <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleEditPub(pub)}
                className="text-xs text-orange-500 hover:text-orange-700 border border-orange-200 px-2.5 py-1 rounded-full transition"
              >
                ✏ Editar
              </button>
              <button
                onClick={() => handleDeletePub(pub.id)}
                className="text-xs text-red-400 hover:text-red-600 border border-red-200 px-2.5 py-1 rounded-full transition"
              >
                🗑
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )}
</div>
```

- [ ] **Step 6: Reemplazar el placeholder "Mis Ventas"**

Buscar el bloque:
```tsx
{/* ── MIS VENTAS (placeholder) ── */}
<div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
  <h2 className="text-lg font-bold text-gray-800 mb-5">Mis Ventas</h2>
  <div className="text-center py-12">
    <div className="text-5xl mb-3 opacity-30">🏪</div>
    <p className="text-gray-400">Próximamente: ventas de las publicaciones de esta tienda.</p>
  </div>
</div>
```

Reemplazarlo por:

```tsx
{/* ── MIS VENTAS (ventas directas) ── */}
<div className="bg-white border border-orange-100 rounded-xl shadow-sm p-6">
  <h2 className="text-lg font-bold text-gray-800 mb-5">Mis Ventas</h2>
  {ventaMsg && (
    <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{ventaMsg}</div>
  )}
  {ventasLoading ? (
    <p className="text-sm text-gray-400">Cargando...</p>
  ) : ventas.length === 0 ? (
    <div className="text-center py-10">
      <div className="text-4xl mb-2 opacity-30">🏪</div>
      <p className="text-gray-400 text-sm">No tenés ventas directas aún.</p>
    </div>
  ) : (
    <div className="space-y-3">
      {ventas.map((venta: any) => (
        <div key={venta.id} className="p-4 border border-gray-100 rounded-xl hover:border-orange-200 transition">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Orden #{venta.id}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {venta.nombre} · {venta.email}
                {venta.telefono && ` · ${venta.telefono}`}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(venta.createdAt).toLocaleDateString('es-AR')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                venta.estado === 'finalizado'
                  ? 'bg-green-100 text-green-700 border-green-200'
                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
              }`}>
                {venta.estado === 'finalizado' ? 'Finalizado' : 'Pendiente'}
              </span>
              {venta.estado === 'pendiente' && (
                <button
                  onClick={() => handleFinalizarVenta(venta.id)}
                  disabled={finalizando === venta.id}
                  className="text-xs bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-3 py-1 rounded-lg transition"
                >
                  {finalizando === venta.id ? '...' : 'Finalizar'}
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            {(venta.items ?? []).map((it: any, i: number) => (
              <p key={i} className="text-xs text-gray-600">
                {it.cartaNombre} × {it.cantidad} — ${it.precio}
              </p>
            ))}
            <p className="text-sm font-semibold text-gray-800 mt-1">Total: ${venta.total}</p>
          </div>
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 7: Verificar en el frontend**

Levantar frontend y backend. Loguear como tienda. Ir a Mi Perfil. Verificar:
- Sección "Mis Publicaciones" carga (vacía al inicio) y muestra botón "+ Nueva"
- Crear una publicación → aparece en la lista
- Editar publicación → formulario se pre-rellena con los valores actuales
- Eliminar publicación → se confirma y desaparece
- Sección "Mis Ventas" carga (vacía al inicio)
- Después de que un user haga una reserva de un item de la tienda, aparece en la lista con estado "Pendiente"
- Botón "Finalizar" → cambia a "Finalizado"

- [ ] **Step 8: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx
git commit -m "feat(MiPerfilTiendaRetiroPage): add publicaciones CRUD and ventas directas panel"
```

---

## Self-Review

### Spec coverage

| Sección del spec | Task que la implementa |
|---|---|
| Backend CRUD publicaciones (4 rutas) | Task 2 + Task 4 |
| Backend creación compra para items tienda | Task 5 |
| Backend `finalizar-directo` | Task 3 + Task 4 |
| Backend `getVentasDirectas` | Task 3 + Task 4 |
| Backend `getVentas` filtrado a 3 actores | Task 3 |
| Frontend Reservar.tsx bloque fijo tienda | Task 6 |
| Frontend MiPerfilTiendaRetiroPage publicaciones | Task 7 |
| Frontend MiPerfilTiendaRetiroPage ventas directas | Task 7 |
| `uploaderTienda` en respuesta `findAll` cartas | Task 1 |
| Sin email al reservar | Task 3 (`finalizarDirecto` no llama `sendEmail`) |
| `TiendaRetiroVentasPage` intacta | ninguna task la toca |

### Checklist

- No hay TBDs ni TODOs en el plan
- Los tipos usados en Task 6 (`UploaderTienda`) son consistentes con los datos que devuelve Task 1
- `sanitizePublicacionTiendaInput` definido en Task 2, usado en Task 4
- `getVentasDirectas` definido en Task 3, registrado en Task 4
- `finalizarDirecto` definido en Task 3, registrado en Task 4
- `Carta` e `ItemCarta` importados en Task 2 antes de usarlos en Task 3
