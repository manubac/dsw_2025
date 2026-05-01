# Cancelación de Compras con Penalización — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar cancelación de órdenes de compra desde ambos lados (comprador/vendedor/tienda) con sistema de reputación de cancelaciones separado del rating general.

**Architecture:** Nuevo estado `'cancelado'` + 5 campos de metadata en `Compra`. Endpoint único `PATCH /api/compras/:id/cancelar` detecta el rol del actor y verifica acceso. Rating bilateral de cancelaciones usando `Valoracion` existente con `tipoObjeto: 'cancelacion_*'`. Stats calculadas dinámicamente en `GET /api/compras/stats-cancelaciones`. Badges amarillo/rojo en perfiles públicos.

**Tech Stack:** Express 5 + MikroORM 6 + PostgreSQL (backend) | React 19 + TypeScript + Tailwind CSS (frontend)

---

## Cancellation Rules

| Estado       | Comprador | Vendedor | Tienda |
|-------------|-----------|----------|--------|
| `pendiente` | ✅ | ✅ | ✅ (admin) |
| `en_tienda` | ✅ (con advertencia) | ✅ | ✅ |
| `listo_para_retirar` | ✅ | ✅ | ✅ |
| `finalizado` | ❌ | ❌ | ❌ |
| `cancelado`  | ❌ | ❌ | ❌ |

## File Map

**Modified (backend):**
- `backend/src/compra/compra.entity.ts` — add 5 cancellation fields
- `backend/src/compra/compra.controler.ts` — add `cancelarCompra` + `getCancelacionStats` handlers
- `backend/src/compra/compra.routes.ts` — add 2 new routes
- `backend/src/vendedor/vendedor.controller.ts` — include cancellation fields in `getVentas` response
- `backend/src/tiendaRetiro/tiendaRetiro.controller.ts` — include cancellation fields in `getVentas` + `getVentasDirectas` response

**Created (frontend):**
- `vite-project/vite-project-ts/src/components/CancelOrderModal.tsx`
- `vite-project/vite-project-ts/src/components/CancelReviewModal.tsx`
- `vite-project/vite-project-ts/src/components/CancelacionStats.tsx`

**Modified (frontend):**
- `vite-project/vite-project-ts/src/pages/Purchases.tsx`
- `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx`
- `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx`
- `vite-project/vite-project-ts/src/pages/VendedorProfile.tsx`
- `vite-project/vite-project-ts/src/pages/TiendaProfile.tsx`
- `vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx`
- `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`

---

## Task 1: Update Compra entity

**Files:**
- Modify: `backend/src/compra/compra.entity.ts`

- [ ] **Step 1: Add cancellation fields**

Add these 5 fields after the `items` property in `backend/src/compra/compra.entity.ts`:

```typescript
@Property({ type: 'string', nullable: true })
canceladoPorRol?: 'comprador' | 'vendedor' | 'tienda';

@Property({ type: 'number', nullable: true })
canceladoPorId?: number;

@Property({ type: 'string', nullable: true })
canceladoPorActorTipo?: string;

@Property({ type: 'string', nullable: true })
motivoCancelacion?: string;

@Property({ type: 'date', nullable: true })
fechaCancelacion?: Date;
```

Full file after edit:

```typescript
import { Entity, Property, ManyToOne, ManyToMany, Collection } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { User } from "../user/user.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { Envio } from "../envio/envio.entity.js";
import { TiendaRetiro } from "../tiendaRetiro/tiendaRetiro.entity.js";

@Entity()
export class Compra extends BaseEntity {
  @ManyToOne(() => User, { nullable: true })
  comprador?: User;

  @ManyToOne(() => TiendaRetiro, { nullable: true })
  compradorTienda?: TiendaRetiro;

  @ManyToMany(() => ItemCarta, undefined, { owner: true })
  itemCartas = new Collection<ItemCarta>(this);

  @Property({ type: "number" })
  total!: number;

  @Property({ type: 'string', default: "pendiente" })
  estado!: string;

  @Property({ type: 'string', nullable: true })
  nombre?: string;

  @Property({ type: 'string', nullable: true })
  email?: string;

  @Property({ type: 'string', nullable: true })
  telefono?: string;

  @ManyToOne(() => Direccion, { nullable: true })
  direccionEntrega?: Direccion;

  @ManyToOne(() => Envio, { nullable: true })
  envio?: Envio;

  @ManyToOne(() => TiendaRetiro, { nullable: true })
  tiendaRetiro?: TiendaRetiro;

  @Property({ type: 'string', nullable: true })
  metodoPago?: string;

  @Property({ type: 'json', nullable: true })
  items?: { cartaId: number; quantity: number; price?: number; title?: string }[];

  @Property({ type: 'string', nullable: true })
  canceladoPorRol?: 'comprador' | 'vendedor' | 'tienda';

  @Property({ type: 'number', nullable: true })
  canceladoPorId?: number;

  @Property({ type: 'string', nullable: true })
  canceladoPorActorTipo?: string;

  @Property({ type: 'string', nullable: true })
  motivoCancelacion?: string;

  @Property({ type: 'date', nullable: true })
  fechaCancelacion?: Date;
}
```

- [ ] **Step 2: Run schema update**

```bash
cd backend && pnpm schema:update
```

Expected: exits with code 0, no errors. New columns added to `compra` table.

- [ ] **Step 3: Commit**

```bash
git add backend/src/compra/compra.entity.ts
git commit -m "feat: add cancellation metadata fields to Compra entity"
```

---

## Task 2: Add cancelarCompra and getCancelacionStats handlers

**Files:**
- Modify: `backend/src/compra/compra.controler.ts`

- [ ] **Step 1: Add Valoracion import**

At the top of `backend/src/compra/compra.controler.ts`, after the existing imports, add:

```typescript
import { Valoracion } from "../valoracion/valoracion.entity.js";
```

(Note: `Vendedor` is already imported on line 6.)

- [ ] **Step 2: Add MOTIVOS_VALIDOS constant and sanitizeCancelacionInput**

Add right after the existing `sanitizeCompraInput` function (before `findAll`):

```typescript
const MOTIVOS_VALIDOS = [
  'sin_stock', 'error_precio', 'producto_daniado', 'no_respondio',
  'cambio_decision', 'sospecha_fraude', 'problema_tienda', 'otro',
] as const;

function sanitizeCancelacionInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = { motivo: req.body.motivo };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) delete req.body.sanitizedInput[key];
  });
  next();
}
```

- [ ] **Step 3: Add cancelarCompra handler**

Add after the `remove` function (before the export line):

```typescript
async function cancelarCompra(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const { motivo } = req.body.sanitizedInput;

    if (!motivo || !MOTIVOS_VALIDOS.includes(motivo as any)) {
      return res.status(400).json({ message: 'Motivo de cancelación inválido o faltante' });
    }

    const emFork = orm.em.fork();
    const compra = await emFork.findOne(Compra, { id }, {
      populate: [
        'comprador', 'compradorTienda',
        'itemCartas', 'itemCartas.uploaderVendedor', 'itemCartas.uploaderTienda',
        'tiendaRetiro',
      ],
    });

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

    if (compra.estado === 'finalizado' || compra.estado === 'cancelado') {
      return res.status(400).json({ message: `No se puede cancelar una compra en estado "${compra.estado}"` });
    }

    let canceladoPorRol: 'comprador' | 'vendedor' | 'tienda' | null = null;
    let canceladoPorId: number | null = null;
    let canceladoPorActorTipo: string | null = null;

    if (req.actorRole === 'user') {
      const user = req.actor as User;
      if (compra.comprador?.id === user.id) {
        canceladoPorRol = 'comprador';
        canceladoPorId = user.id;
        canceladoPorActorTipo = 'user';
      }
    } else if (req.actorRole === 'vendedor') {
      const vendedor = req.actor as Vendedor;
      const vendedorUserId = (vendedor.user as any)?.id;
      if (vendedorUserId && compra.comprador?.id === vendedorUserId) {
        canceladoPorRol = 'comprador';
        canceladoPorId = vendedor.id;
        canceladoPorActorTipo = 'vendedor';
      } else if (compra.itemCartas.getItems().some(ic => (ic as any).uploaderVendedor?.id === vendedor.id)) {
        canceladoPorRol = 'vendedor';
        canceladoPorId = vendedor.id;
        canceladoPorActorTipo = 'vendedor';
      }
    } else if (req.actorRole === 'tiendaRetiro') {
      const tienda = req.actor as TiendaRetiro;
      if (compra.compradorTienda?.id === tienda.id) {
        canceladoPorRol = 'comprador';
        canceladoPorId = tienda.id;
        canceladoPorActorTipo = 'tiendaRetiro';
      } else if (
        compra.tiendaRetiro?.id === tienda.id ||
        compra.itemCartas.getItems().some(ic => (ic as any).uploaderTienda?.id === tienda.id)
      ) {
        canceladoPorRol = 'tienda';
        canceladoPorId = tienda.id;
        canceladoPorActorTipo = 'tiendaRetiro';
      }
    }

    if (!canceladoPorRol || canceladoPorId === null) {
      return res.status(403).json({ message: 'No tenés acceso para cancelar esta compra' });
    }

    compra.estado = 'cancelado';
    compra.canceladoPorRol = canceladoPorRol;
    compra.canceladoPorId = canceladoPorId;
    compra.canceladoPorActorTipo = canceladoPorActorTipo!;
    compra.motivoCancelacion = motivo;
    compra.fechaCancelacion = new Date();

    await emFork.flush();
    res.json({ message: 'Compra cancelada exitosamente', data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
```

- [ ] **Step 4: Add getCancelacionStats handler**

Add after `cancelarCompra` (before the export):

```typescript
async function getCancelacionStats(req: Request, res: Response) {
  try {
    const { actorTipo, actorId: actorIdStr } = req.query as { actorTipo: string; actorId: string };
    const actorId = Number(actorIdStr);

    if (!actorTipo || !actorId) {
      return res.status(400).json({ message: 'actorTipo y actorId son obligatorios' });
    }

    const emFork = orm.em.fork();

    const cancelaciones = await emFork.find(Compra, {
      estado: 'cancelado',
      canceladoPorId: actorId,
      canceladoPorActorTipo: actorTipo,
    });

    const comoComprador = cancelaciones.filter(c => c.canceladoPorRol === 'comprador').length;
    const comoVendedor  = cancelaciones.filter(c => c.canceladoPorRol === 'vendedor').length;
    const comoTienda    = cancelaciones.filter(c => c.canceladoPorRol === 'tienda').length;

    let totalOperaciones = 0;

    if (actorTipo === 'vendedor') {
      const asSellerCount = await emFork.count(Compra, { itemCartas: { uploaderVendedor: { id: actorId } } });
      const vendedor = await emFork.findOne(Vendedor, { id: actorId }, { populate: ['user'] });
      const asBuyerCount = vendedor?.user
        ? await emFork.count(Compra, { comprador: { id: (vendedor.user as any).id } })
        : 0;
      totalOperaciones = asSellerCount + asBuyerCount;
    } else if (actorTipo === 'user') {
      totalOperaciones = await emFork.count(Compra, { comprador: { id: actorId } });
    } else if (actorTipo === 'tiendaRetiro') {
      const asSellerCount = await emFork.count(Compra, { itemCartas: { uploaderTienda: { id: actorId } } });
      const asIntermCount = await emFork.count(Compra, { tiendaRetiro: { id: actorId } });
      const asBuyerCount  = await emFork.count(Compra, { compradorTienda: { id: actorId } });
      totalOperaciones = asSellerCount + asIntermCount + asBuyerCount;
    }

    const totalCancelaciones = cancelaciones.length;
    const porcentajeCancelacion = totalOperaciones > 0
      ? Math.round((totalCancelaciones / totalOperaciones) * 1000) / 10
      : 0;

    const tipoObjetoRating = `cancelacion_${actorTipo}`;
    const valoraciones = await emFork.find(Valoracion, { tipoObjeto: tipoObjetoRating, objetoId: actorId });
    const ratingCancelaciones = valoraciones.length > 0
      ? Math.round(valoraciones.reduce((s, v) => s + v.puntuacion, 0) / valoraciones.length * 10) / 10
      : null;

    const badge = porcentajeCancelacion >= 10 ? 'red'
      : porcentajeCancelacion >= 5 ? 'yellow'
      : 'none';

    res.json({
      data: {
        totalOperaciones,
        totalCancelaciones,
        porcentajeCancelacion,
        comoComprador,
        comoVendedor,
        comoTienda,
        ratingCancelaciones,
        totalRatingsCancelacion: valoraciones.length,
        badge,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
```

- [ ] **Step 5: Update export line**

Replace the existing export at the bottom:
```typescript
export { sanitizeCompraInput, sanitizeCancelacionInput, findAll, findOne, add, update, remove, createPreference, cancelarCompra, getCancelacionStats };
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/compra/compra.controler.ts
git commit -m "feat: add cancelarCompra and getCancelacionStats handlers"
```

---

## Task 3: Update compra.routes.ts

**Files:**
- Modify: `backend/src/compra/compra.routes.ts`

- [ ] **Step 1: Add new routes (IMPORTANT: /stats-cancelaciones must be before /:id)**

Replace the full file content:

```typescript
import { Router } from "express";
import {
  sanitizeCompraInput,
  sanitizeCancelacionInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  createPreference,
  cancelarCompra,
  getCancelacionStats,
} from "./compra.controler.js";
import { authenticate, authorizeRoles } from "../shared/middleware/auth.js";

export const compraRouter = Router();

compraRouter.get("/", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), findAll);
compraRouter.get("/stats-cancelaciones", getCancelacionStats);
compraRouter.get("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), findOne);
compraRouter.post("/", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, add);
compraRouter.post("/preference", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, createPreference);
compraRouter.patch("/:id/cancelar", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCancelacionInput, cancelarCompra);
compraRouter.put("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, update);
compraRouter.patch("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, update);
compraRouter.delete("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), remove);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/compra/compra.routes.ts
git commit -m "feat: add /cancelar and /stats-cancelaciones to compra router"
```

---

## Task 4: Fix getVentas response mappers

The vendedor and tiendaRetiro `getVentas` functions build manual response objects that omit the new cancellation fields. Fix both.

**Files:**
- Modify: `backend/src/vendedor/vendedor.controller.ts`
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`

- [ ] **Step 1: Update vendedor getVentas result mapper**

In `backend/src/vendedor/vendedor.controller.ts`, in the `getVentas` function, find the `return { id: c.id, fecha: c.createdAt, ...` object and add two fields:

```typescript
return {
  id: c.id,
  fecha: c.createdAt,
  total: c.total,
  estado: c.estado,
  esTiendaCompradora: !!(c as any).compradorTienda,
  motivoCancelacion: c.motivoCancelacion ?? null,   // ADD
  canceladoPorRol: c.canceladoPorRol ?? null,        // ADD
  comprador: { ... },
  // ... rest unchanged
};
```

- [ ] **Step 2: Update tiendaRetiro getVentas mapper**

In `backend/src/tiendaRetiro/tiendaRetiro.controller.ts`, in `getVentas`, find the `return { id: compra.id, estado: compra.estado, ...` object:

```typescript
return {
  id:        compra.id,
  estado:    compra.estado,
  total:     compra.total,
  createdAt: compra.createdAt,
  motivoCancelacion: compra.motivoCancelacion ?? null,  // ADD
  canceladoPorRol: compra.canceladoPorRol ?? null,       // ADD
  comprador: { ... },
  vendedores: Array.from(vendedoresMap.values()),
  items,
};
```

- [ ] **Step 3: Update tiendaRetiro getVentasDirectas mapper**

In `getVentasDirectas`, find the `return { id: compra.id, estado: compra.estado, ...` object and add:

```typescript
return {
  id:          compra.id,
  estado:      compra.estado,
  total:       compra.total,
  createdAt:   compra.createdAt,
  compradorId: (compra.comprador as any)?.id || null,
  nombre:      (compra.comprador as any)?.username || compra.nombre || 'Comprador',
  email:       (compra.comprador as any)?.email || compra.email || '',
  telefono:    compra.telefono ?? '',
  alias:       tienda?.alias ?? null,
  cbu:         tienda?.cbu   ?? null,
  motivoCancelacion: compra.motivoCancelacion ?? null,  // ADD
  canceladoPorRol: compra.canceladoPorRol ?? null,       // ADD
  items: (compra.items ?? []).map(...),
};
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/vendedor/vendedor.controller.ts backend/src/tiendaRetiro/tiendaRetiro.controller.ts
git commit -m "feat: include cancellation fields in getVentas/getVentasDirectas responses"
```

---

## Task 5: Create CancelOrderModal component

**Files:**
- Create: `vite-project/vite-project-ts/src/components/CancelOrderModal.tsx`

- [ ] **Step 1: Create file**

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';
import { useUser } from '../context/user';

const MOTIVOS = [
  { value: 'sin_stock',        label: 'Sin stock' },
  { value: 'error_precio',     label: 'Error de precio' },
  { value: 'producto_daniado', label: 'Producto dañado o incorrecto' },
  { value: 'no_respondio',     label: 'La otra parte no respondió' },
  { value: 'cambio_decision',  label: 'Cambio de decisión' },
  { value: 'sospecha_fraude',  label: 'Sospecha de fraude' },
  { value: 'problema_tienda',  label: 'Problema con la tienda' },
  { value: 'otro',             label: 'Otro' },
] as const;

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  compraId: number;
  estadoActual: string;
  onSuccess: () => void;
}

export function CancelOrderModal({ isOpen, onClose, compraId, estadoActual, onSuccess }: CancelOrderModalProps) {
  const { user } = useUser();
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const advertencia =
    estadoActual === 'en_tienda'
      ? '⚠️ Las cartas ya están en la tienda. Coordiná con la tienda para la devolución o desistimiento.'
      : estadoActual === 'listo_para_retirar'
      ? '⚠️ Las cartas ya están listas para retirar. Informá a la tienda sobre la cancelación.'
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) { setError('Seleccioná un motivo para continuar'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/compras/${compraId}/cancelar`, { motivo }, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cancelar la orden');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-[460px] max-w-[94%] rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl">🚫</div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Cancelar orden #{compraId}</h3>
            <p className="text-xs text-gray-500">Esta acción no se puede deshacer</p>
          </div>
        </div>

        {advertencia && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm font-medium flex gap-2">
            <span className="shrink-0">⚠️</span>
            <span>{advertencia.replace('⚠️ ', '')}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Motivo de cancelación <span className="text-red-500">*</span>
          </p>
          <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
            {MOTIVOS.map(({ value, label }) => (
              <label
                key={value}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  motivo === value
                    ? 'border-red-400 bg-red-50 text-red-800 font-semibold shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="motivo"
                  value={value}
                  checked={motivo === value}
                  onChange={() => { setMotivo(value); setError(null); }}
                  className="accent-red-500"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 transition text-sm font-medium"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={submitting || !motivo}
              className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Cancelando...
                </>
              ) : 'Confirmar cancelación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/components/CancelOrderModal.tsx
git commit -m "feat: add CancelOrderModal component with motivo selector"
```

---

## Task 6: Create CancelReviewModal component

**Files:**
- Create: `vite-project/vite-project-ts/src/components/CancelReviewModal.tsx`

Bilateral rating after cancellation. Uses `tipoObjeto: 'cancelacion_vendedor'` | `'cancelacion_user'` | `'cancelacion_tiendaRetiro'` so stats are tracked separately from general ratings.

- [ ] **Step 1: Create file**

```tsx
import React, { useState } from 'react';
import { api } from '../services/api';
import { useUser } from '../context/user';

interface CancelReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: number;
  targetActorTipo: 'user' | 'vendedor' | 'tiendaRetiro';
  targetName: string;
  compraId: number;
  onSuccess: (puntuacion: number) => void;
}

const TIPO_LABEL: Record<string, string> = {
  user: 'comprador',
  vendedor: 'vendedor',
  tiendaRetiro: 'tienda',
};

const RATING_LABELS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente'];

export function CancelReviewModal({
  isOpen, onClose, targetId, targetActorTipo, targetName, compraId, onSuccess,
}: CancelReviewModalProps) {
  const { user } = useUser();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const tipoObjeto = `cancelacion_${targetActorTipo}`;
  const active = hover || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return alert('Seleccioná una puntuación');
    setSubmitting(true);
    try {
      await api.post('/api/valoraciones', {
        puntuacion: rating,
        comentario: comentario || undefined,
        tipoObjeto,
        objetoId: targetId,
        compraId,
      }, { headers: { Authorization: `Bearer ${user?.token}` } });
      onSuccess(rating);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al enviar valoración');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-[430px] max-w-[94%] rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl">📋</div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Valorar gestión de cancelación</h3>
            <p className="text-xs text-gray-500">
              ¿Cómo manejó{' '}
              <span className="font-semibold text-gray-700">{targetName}</span>{' '}
              ({TIPO_LABEL[targetActorTipo]}) esta cancelación?
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center gap-2 text-4xl mb-2 cursor-pointer select-none">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`transition-transform ${active >= star ? 'text-orange-400 scale-110' : 'text-gray-200 hover:text-orange-300 hover:scale-105'}`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
              >★</span>
            ))}
          </div>

          {active > 0 && (
            <p className="text-center text-sm font-semibold text-orange-600 mb-4">{RATING_LABELS[active]}</p>
          )}
          {active === 0 && <div className="mb-4" />}

          <textarea
            className="w-full h-24 border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition"
            placeholder="Comentario opcional sobre cómo se manejó la cancelación..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />

          <div className="flex gap-3 justify-end mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50 transition font-medium"
            >
              Omitir
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="px-5 py-2 text-sm rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Enviando...' : 'Enviar valoración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/components/CancelReviewModal.tsx
git commit -m "feat: add CancelReviewModal for bilateral post-cancellation rating"
```

---

## Task 7: Create CancelacionStats component

**Files:**
- Create: `vite-project/vite-project-ts/src/components/CancelacionStats.tsx`

- [ ] **Step 1: Create file**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface StatsData {
  totalOperaciones: number;
  totalCancelaciones: number;
  porcentajeCancelacion: number;
  comoComprador: number;
  comoVendedor: number;
  comoTienda: number;
  ratingCancelaciones: number | null;
  totalRatingsCancelacion: number;
  badge: 'none' | 'yellow' | 'red';
}

interface CancelacionStatsProps {
  actorTipo: 'vendedor' | 'user' | 'tiendaRetiro';
  actorId: number;
  compact?: boolean;
}

export function CancelacionStats({ actorTipo, actorId, compact = false }: CancelacionStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/api/compras/stats-cancelaciones?actorTipo=${actorTipo}&actorId=${actorId}`)
      .then(r => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actorTipo, actorId]);

  if (loading || !stats || stats.totalCancelaciones === 0) return null;

  const badgeClasses = stats.badge === 'red'
    ? 'bg-red-100 text-red-700 border-red-300'
    : stats.badge === 'yellow'
    ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
    : 'bg-gray-100 text-gray-600 border-gray-200';

  const badgeIcon = stats.badge === 'red' ? '🔴' : stats.badge === 'yellow' ? '🟡' : '⚪';
  const badgeLabel = stats.badge === 'red' ? 'Alta tasa de cancelaciones' : stats.badge === 'yellow' ? 'Tasa moderada de cancelaciones' : '';

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${badgeClasses}`}>
        <span>{badgeIcon}</span>
        <span>{stats.porcentajeCancelacion}% cancelaciones</span>
        {stats.ratingCancelaciones !== null && (
          <span className="text-orange-500 font-bold">★ {stats.ratingCancelaciones}</span>
        )}
      </div>
    );
  }

  const numColor = stats.badge === 'red' ? 'text-red-700' : stats.badge === 'yellow' ? 'text-yellow-700' : 'text-gray-800';
  const numBg = stats.badge === 'red' ? 'bg-red-50 border-red-200' : stats.badge === 'yellow' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-700">Historial de cancelaciones</h4>
        {stats.badge !== 'none' && badgeLabel && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeClasses}`}>
            {badgeIcon} {badgeLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-gray-800">{stats.totalOperaciones}</p>
          <p className="text-xs text-gray-500 mt-0.5">operaciones</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${numBg}`}>
          <p className={`text-2xl font-extrabold ${numColor}`}>{stats.totalCancelaciones}</p>
          <p className="text-xs text-gray-500 mt-0.5">cancelaciones</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${numBg}`}>
          <p className={`text-2xl font-extrabold ${numColor}`}>{stats.porcentajeCancelacion}%</p>
          <p className="text-xs text-gray-500 mt-0.5">tasa</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {stats.comoComprador > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Canceló como comprador</span>
            <span className="font-semibold text-gray-800">{stats.comoComprador}</span>
          </div>
        )}
        {stats.comoVendedor > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Canceló como vendedor</span>
            <span className="font-semibold text-gray-800">{stats.comoVendedor}</span>
          </div>
        )}
        {stats.comoTienda > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Canceló como tienda</span>
            <span className="font-semibold text-gray-800">{stats.comoTienda}</span>
          </div>
        )}
      </div>

      {stats.ratingCancelaciones !== null && (
        <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Rating de gestión</span>
          <div className="flex items-center gap-1.5">
            <span className="text-orange-400">
              {'★'.repeat(Math.round(stats.ratingCancelaciones))}{'☆'.repeat(5 - Math.round(stats.ratingCancelaciones))}
            </span>
            <span className="text-sm font-bold text-gray-800">{stats.ratingCancelaciones}</span>
            <span className="text-xs text-gray-400">({stats.totalRatingsCancelacion})</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/components/CancelacionStats.tsx
git commit -m "feat: add CancelacionStats component with badge thresholds (5%/10%)"
```

---

## Task 8: Update Purchases.tsx (buyer view)

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/Purchases.tsx`

- [ ] **Step 1: Add imports**

After existing imports add:
```tsx
import { CancelOrderModal } from '../components/CancelOrderModal';
import { CancelReviewModal } from '../components/CancelReviewModal';
```

- [ ] **Step 2: Add MOTIVO_LABELS constant before the component function**

```tsx
const MOTIVO_LABELS: Record<string, string> = {
  sin_stock: 'Sin stock', error_precio: 'Error de precio',
  producto_daniado: 'Producto dañado', no_respondio: 'No respondió',
  cambio_decision: 'Cambio de decisión', sospecha_fraude: 'Sospecha de fraude',
  problema_tienda: 'Problema con tienda', otro: 'Otro',
};
```

- [ ] **Step 3: Extract fetchCompras out of useEffect and add cancel state**

Convert `fetchCompras` to a named function in component scope (not inside useEffect), then call it from useEffect. Add cancel state:

```tsx
const [cancelModalOpen, setCancelModalOpen] = useState(false);
const [cancelTarget, setCancelTarget] = useState<{ id: number; estado: string } | null>(null);
const [cancelReviewOpen, setCancelReviewOpen] = useState(false);
const [cancelReviewTarget, setCancelReviewTarget] = useState<{
  compraId: number; targetId: number; targetActorTipo: 'vendedor' | 'tiendaRetiro'; targetName: string;
} | null>(null);
const [cancelReviewedMap, setCancelReviewedMap] = useState<Record<string, number>>({});
```

- [ ] **Step 4: Update fetchCompras to load cancel reviews**

In the valoraciones loop inside `fetchCompras`, after setting `map`, add:
```tsx
const cancelMap: Record<string, number> = {};
for (const v of (reviewsJson.data || [])) {
  if (v.compra?.id != null) {
    map[`${v.compra.id}_${v.tipoObjeto}_${v.objetoId}`] = v.puntuacion;
    if (v.tipoObjeto?.startsWith('cancelacion_')) {
      const at = v.tipoObjeto.replace('cancelacion_', '');
      cancelMap[`cancel_${v.compra.id}_${at}_${v.objetoId}`] = v.puntuacion;
    }
  }
}
setReviewedMap(map);
setCancelReviewedMap(cancelMap);
```

- [ ] **Step 5: Add cancel handlers**

```tsx
const handleOpenCancel = (compraId: number, estado: string) => {
  setCancelTarget({ id: compraId, estado });
  setCancelModalOpen(true);
};

const handleCancelSuccess = (comp: any) => {
  const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor;
  const tienda = comp.tiendaRetiro;
  if (vendedor) {
    setCancelReviewTarget({ compraId: comp.id, targetId: vendedor.id, targetActorTipo: 'vendedor', targetName: vendedor.nombre });
    setCancelReviewOpen(true);
  } else if (tienda) {
    setCancelReviewTarget({ compraId: comp.id, targetId: tienda.id, targetActorTipo: 'tiendaRetiro', targetName: tienda.nombre });
    setCancelReviewOpen(true);
  }
  fetchCompras();
};
```

- [ ] **Step 6: Update estado badge to include 'cancelado'**

In the badge className ternary, add:
```tsx
comp.estado === 'cancelado' ? 'bg-red-100 text-red-700'
```

In the badge label ternary, add:
```tsx
comp.estado === 'cancelado' ? 'Cancelado 🚫'
```

- [ ] **Step 7: Add cancel button in each compra header**

In the flex div containing the estado badge and chat button, before the chat button:
```tsx
{comp.estado !== 'finalizado' && comp.estado !== 'cancelado' && (
  <button
    onClick={() => handleOpenCancel(comp.id, comp.estado)}
    className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1 rounded text-xs font-semibold transition"
  >
    🚫 Cancelar
  </button>
)}
```

- [ ] **Step 8: Add cancelled state info block**

After the main compra content (before the items list), add:
```tsx
{comp.estado === 'cancelado' && (
  <div className="mt-2 mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
    <p className="font-semibold text-red-700 mb-1">🚫 Orden cancelada</p>
    {comp.motivoCancelacion && (
      <p className="text-red-600 text-xs">Motivo: {MOTIVO_LABELS[comp.motivoCancelacion] ?? comp.motivoCancelacion}</p>
    )}
    {comp.canceladoPorRol && (
      <p className="text-gray-500 text-xs mt-0.5">Cancelada por: el {comp.canceladoPorRol}</p>
    )}
    {(() => {
      const vendedor = comp.itemCartas?.find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor;
      const tienda = comp.tiendaRetiro;
      const target = vendedor
        ? { id: vendedor.id, tipo: 'vendedor' as const, nombre: vendedor.nombre }
        : tienda ? { id: tienda.id, tipo: 'tiendaRetiro' as const, nombre: tienda.nombre } : null;
      if (!target) return null;
      const key = `cancel_${comp.id}_${target.tipo}_${target.id}`;
      const reviewed = cancelReviewedMap[key];
      return reviewed != null ? (
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
          <span className="text-orange-300">{'★'.repeat(reviewed)}{'☆'.repeat(5 - reviewed)}</span>
          <span>Gestión de cancelación valorada</span>
        </div>
      ) : (
        <button
          className="mt-2 text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg transition font-semibold"
          onClick={() => {
            setCancelReviewTarget({ compraId: comp.id, targetId: target.id, targetActorTipo: target.tipo, targetName: target.nombre });
            setCancelReviewOpen(true);
          }}
        >
          📋 Valorar gestión de esta cancelación
        </button>
      );
    })()}
  </div>
)}
```

- [ ] **Step 9: Add modals at the end of the return (before final closing div)**

```tsx
{cancelTarget && (
  <CancelOrderModal
    isOpen={cancelModalOpen}
    onClose={() => setCancelModalOpen(false)}
    compraId={cancelTarget.id}
    estadoActual={cancelTarget.estado}
    onSuccess={() => {
      const comp = compras.find(c => c.id === cancelTarget!.id);
      handleCancelSuccess(comp);
    }}
  />
)}

{cancelReviewTarget && (
  <CancelReviewModal
    isOpen={cancelReviewOpen}
    onClose={() => setCancelReviewOpen(false)}
    targetId={cancelReviewTarget.targetId}
    targetActorTipo={cancelReviewTarget.targetActorTipo}
    targetName={cancelReviewTarget.targetName}
    compraId={cancelReviewTarget.compraId}
    onSuccess={(puntuacion) => {
      const { compraId, targetId, targetActorTipo } = cancelReviewTarget!;
      setCancelReviewedMap(prev => ({ ...prev, [`cancel_${compraId}_${targetActorTipo}_${targetId}`]: puntuacion }));
      setCancelReviewOpen(false);
    }}
  />
)}
```

- [ ] **Step 10: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/Purchases.tsx
git commit -m "feat: add cancel order and bilateral cancel review to Purchases page"
```

---

## Task 9: Update MisVentasPage.tsx (vendedor seller view)

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx`

- [ ] **Step 1: Add imports and MOTIVO_LABELS**

```tsx
import { CancelOrderModal } from '../components/CancelOrderModal';
import { CancelReviewModal } from '../components/CancelReviewModal';

const MOTIVO_LABELS: Record<string, string> = {
  sin_stock: 'Sin stock', error_precio: 'Error de precio',
  producto_daniado: 'Producto dañado', no_respondio: 'No respondió',
  cambio_decision: 'Cambio de decisión', sospecha_fraude: 'Sospecha de fraude',
  problema_tienda: 'Problema con tienda', otro: 'Otro',
};
```

- [ ] **Step 2: Add cancel state**

After existing state declarations:
```tsx
const [cancelModalOpen, setCancelModalOpen] = useState(false);
const [cancelTarget, setCancelTarget] = useState<{ id: number; estado: string } | null>(null);
const [cancelReviewOpen, setCancelReviewOpen] = useState(false);
const [cancelReviewTarget, setCancelReviewTarget] = useState<{
  compraId: number; targetId: number; targetActorTipo: 'user'; targetName: string;
} | null>(null);
const [cancelReviewedMap, setCancelReviewedMap] = useState<Record<string, number>>({});
```

- [ ] **Step 3: Update fetchVentas to load cancel reviews**

After the existing reviewsMap loop, add:
```tsx
const cancelMap: Record<string, number> = {};
for (const v of (misReviewsRes.data.data || [])) {
  if (v.tipoObjeto?.startsWith('cancelacion_') && v.compra?.id != null) {
    const at = v.tipoObjeto.replace('cancelacion_', '');
    cancelMap[`cancel_${v.compra.id}_${at}_${v.objetoId}`] = v.puntuacion;
  }
}
setCancelReviewedMap(cancelMap);
```

- [ ] **Step 4: Add cancel handlers**

After `handleFinalizar`:
```tsx
const handleOpenCancel = (ventaId: number, estado: string) => {
  setCancelTarget({ id: ventaId, estado });
  setCancelModalOpen(true);
};

const handleCancelSuccess = (venta: any) => {
  const compradorId = venta?.comprador?.id;
  const compradorNombre = venta?.comprador?.nombre || 'Comprador';
  if (compradorId) {
    setCancelReviewTarget({ compraId: venta.id, targetId: compradorId, targetActorTipo: 'user', targetName: compradorNombre });
    setCancelReviewOpen(true);
  }
  fetchVentas();
};
```

- [ ] **Step 5: Update estado badge and add 'cancelado'**

In badge className:
```tsx
venta.estado === 'cancelado' ? 'bg-red-100 text-red-700'
```

In badge label:
```tsx
venta.estado === 'cancelado' ? 'Cancelado 🚫'
```

- [ ] **Step 6: Add cancel button**

After all existing action buttons (finalizar/markSent), add:
```tsx
{venta.estado !== 'finalizado' && venta.estado !== 'cancelado' && (
  <button
    className="w-full mt-3 bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2 px-4 rounded-lg text-sm transition"
    onClick={() => handleOpenCancel(venta.id, venta.estado)}
  >
    🚫 Cancelar pedido
  </button>
)}
```

- [ ] **Step 7: Add cancelled info block**

After the comprador/tienda/envio info section inside each venta card:
```tsx
{venta.estado === 'cancelado' && (
  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
    <p className="font-semibold text-red-700 mb-1">🚫 Pedido cancelado</p>
    {(venta as any).motivoCancelacion && (
      <p className="text-xs text-red-600">
        Motivo: {MOTIVO_LABELS[(venta as any).motivoCancelacion] ?? (venta as any).motivoCancelacion}
      </p>
    )}
    {(venta as any).canceladoPorRol && (
      <p className="text-xs text-gray-500 mt-0.5">Cancelado por: el {(venta as any).canceladoPorRol}</p>
    )}
    {(() => {
      const cid = venta.comprador?.id;
      if (!cid) return null;
      const key = `cancel_${venta.id}_user_${cid}`;
      const reviewed = cancelReviewedMap[key];
      return reviewed != null ? (
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
          <span className="text-orange-300">{'★'.repeat(reviewed)}{'☆'.repeat(5 - reviewed)}</span>
          <span>Gestión valorada</span>
        </div>
      ) : (
        <button
          className="mt-2 text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-semibold transition"
          onClick={() => {
            setCancelReviewTarget({ compraId: venta.id, targetId: cid, targetActorTipo: 'user', targetName: venta.comprador.nombre });
            setCancelReviewOpen(true);
          }}
        >
          📋 Valorar gestión de esta cancelación
        </button>
      );
    })()}
  </div>
)}
```

- [ ] **Step 8: Add modals before final closing div**

```tsx
{cancelTarget && (
  <CancelOrderModal
    isOpen={cancelModalOpen}
    onClose={() => setCancelModalOpen(false)}
    compraId={cancelTarget.id}
    estadoActual={cancelTarget.estado}
    onSuccess={() => {
      const venta = ventas.find(v => v.id === cancelTarget!.id);
      handleCancelSuccess(venta);
    }}
  />
)}
{cancelReviewTarget && (
  <CancelReviewModal
    isOpen={cancelReviewOpen}
    onClose={() => setCancelReviewOpen(false)}
    targetId={cancelReviewTarget.targetId}
    targetActorTipo={cancelReviewTarget.targetActorTipo}
    targetName={cancelReviewTarget.targetName}
    compraId={cancelReviewTarget.compraId}
    onSuccess={(puntuacion) => {
      const { compraId, targetId, targetActorTipo } = cancelReviewTarget!;
      setCancelReviewedMap(prev => ({ ...prev, [`cancel_${compraId}_${targetActorTipo}_${targetId}`]: puntuacion }));
      setCancelReviewOpen(false);
    }}
  />
)}
```

- [ ] **Step 9: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/MisVentasPage.tsx
git commit -m "feat: add cancel order and post-cancel review to MisVentasPage"
```

---

## Task 10: Update TiendaRetiroVentasPage.tsx

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx`

- [ ] **Step 1: Add imports and MOTIVO_LABELS**

```tsx
import { CancelOrderModal } from '../components/CancelOrderModal';
import { CancelReviewModal } from '../components/CancelReviewModal';

const MOTIVO_LABELS: Record<string, string> = {
  sin_stock: 'Sin stock', error_precio: 'Error de precio',
  producto_daniado: 'Producto dañado', no_respondio: 'No respondió',
  cambio_decision: 'Cambio de decisión', sospecha_fraude: 'Sospecha de fraude',
  problema_tienda: 'Problema con tienda', otro: 'Otro',
};
```

- [ ] **Step 2: Add 'cancelado' to ESTADO_BADGE**

```tsx
const ESTADO_BADGE: Record<string, { label: string; color: string }> = {
  pendiente:           { label: "Pendiente",          color: "bg-yellow-100 text-yellow-800" },
  en_tienda:           { label: "Llegó al local",      color: "bg-blue-100 text-blue-800" },
  listo_para_retirar:  { label: "Listo para retirar",  color: "bg-orange-100 text-orange-800" },
  finalizado:          { label: "Finalizado",          color: "bg-green-100 text-green-800" },
  cancelado:           { label: "Cancelado 🚫",        color: "bg-red-100 text-red-700" },
};
```

- [ ] **Step 3: Update Venta type to include cancellation fields**

```tsx
type Venta = {
  id: number;
  estado: string;
  total: number;
  createdAt: string;
  comprador: { id: number | null; nombre: string; email: string };
  vendedores: Vendedor[];
  items: VentaItem[];
  motivoCancelacion?: string;
  canceladoPorRol?: string;
};
```

- [ ] **Step 4: Add cancel state**

```tsx
const [cancelModalOpen, setCancelModalOpen] = useState(false);
const [cancelTarget, setCancelTarget] = useState<{ id: number; estado: string } | null>(null);
const [cancelReviewOpen, setCancelReviewOpen] = useState(false);
const [cancelReviewTarget, setCancelReviewTarget] = useState<{
  compraId: number; targetId: number; targetActorTipo: 'user'; targetName: string;
} | null>(null);
const [cancelReviewedMap, setCancelReviewedMap] = useState<Record<string, number>>({});
```

- [ ] **Step 5: Update fetchVentas to load cancel reviews**

After the existing reviewedMap population loop, add:
```tsx
const cancelMap: Record<string, number> = {};
for (const v of (reviewsJson.data || [])) {
  if (v.tipoObjeto?.startsWith('cancelacion_') && v.compra?.id != null) {
    const at = v.tipoObjeto.replace('cancelacion_', '');
    cancelMap[`cancel_${v.compra.id}_${at}_${v.objetoId}`] = v.puntuacion;
  }
}
setCancelReviewedMap(cancelMap);
```

- [ ] **Step 6: Add cancel handlers**

```tsx
const handleOpenCancel = (ventaId: number, estado: string) => {
  setCancelTarget({ id: ventaId, estado });
  setCancelModalOpen(true);
};

const handleCancelSuccess = (venta: Venta) => {
  const cid = venta.comprador.id;
  if (cid) {
    setCancelReviewTarget({ compraId: venta.id, targetId: cid, targetActorTipo: 'user', targetName: venta.comprador.nombre });
    setCancelReviewOpen(true);
  }
  fetchVentas();
};
```

- [ ] **Step 7: Add cancel button in each venta card**

In the actions area (bottom row), add after existing action buttons:
```tsx
{venta.estado !== 'finalizado' && venta.estado !== 'cancelado' && (
  <button
    disabled={actionLoading === venta.id}
    onClick={() => handleOpenCancel(venta.id, venta.estado)}
    className="bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-sm font-semibold px-4 py-2 rounded-lg transition"
  >
    🚫 Cancelar
  </button>
)}
```

- [ ] **Step 8: Add cancelled info block inside each venta card**

After the artículos section:
```tsx
{venta.estado === 'cancelado' && (
  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
    <p className="font-semibold text-red-700 mb-1">🚫 Pedido cancelado</p>
    {venta.motivoCancelacion && (
      <p className="text-xs text-red-600">
        Motivo: {MOTIVO_LABELS[venta.motivoCancelacion] ?? venta.motivoCancelacion}
      </p>
    )}
    {venta.canceladoPorRol && (
      <p className="text-xs text-gray-500 mt-0.5">Cancelado por: el {venta.canceladoPorRol}</p>
    )}
    {(() => {
      const cid = venta.comprador.id;
      if (!cid) return null;
      const key = `cancel_${venta.id}_user_${cid}`;
      const reviewed = cancelReviewedMap[key];
      return reviewed != null ? (
        <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
          <span className="text-orange-300">{'★'.repeat(reviewed)}{'☆'.repeat(5 - reviewed)}</span>
          <span>Gestión valorada</span>
        </div>
      ) : (
        <button
          className="mt-2 text-xs bg-white border border-red-200 hover:bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-semibold transition"
          onClick={() => {
            setCancelReviewTarget({ compraId: venta.id, targetId: cid, targetActorTipo: 'user', targetName: venta.comprador.nombre });
            setCancelReviewOpen(true);
          }}
        >
          📋 Valorar gestión de esta cancelación
        </button>
      );
    })()}
  </div>
)}
```

- [ ] **Step 9: Add modals at end of JSX**

Before the existing ReviewModal, add:
```tsx
{cancelTarget && (
  <CancelOrderModal
    isOpen={cancelModalOpen}
    onClose={() => setCancelModalOpen(false)}
    compraId={cancelTarget.id}
    estadoActual={cancelTarget.estado}
    onSuccess={() => {
      const venta = ventas.find(v => v.id === cancelTarget!.id);
      if (venta) handleCancelSuccess(venta);
      else fetchVentas();
    }}
  />
)}
{cancelReviewTarget && (
  <CancelReviewModal
    isOpen={cancelReviewOpen}
    onClose={() => setCancelReviewOpen(false)}
    targetId={cancelReviewTarget.targetId}
    targetActorTipo={cancelReviewTarget.targetActorTipo}
    targetName={cancelReviewTarget.targetName}
    compraId={cancelReviewTarget.compraId}
    onSuccess={(puntuacion) => {
      const { compraId, targetId, targetActorTipo } = cancelReviewTarget!;
      setCancelReviewedMap(prev => ({ ...prev, [`cancel_${compraId}_${targetActorTipo}_${targetId}`]: puntuacion }));
      setCancelReviewOpen(false);
    }}
  />
)}
```

- [ ] **Step 10: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/TiendaRetiroVentasPage.tsx
git commit -m "feat: add cancel order and post-cancel review to TiendaRetiroVentasPage"
```

---

## Task 11: Add CancelacionStats to profile pages

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/VendedorProfile.tsx`
- Modify: `vite-project/vite-project-ts/src/pages/TiendaProfile.tsx`
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx`
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`

- [ ] **Step 1: Update VendedorProfile.tsx**

Add import:
```tsx
import { CancelacionStats } from '../components/CancelacionStats';
```

In the JSX profile header section (after the stars / average rating display), add:
```tsx
<CancelacionStats actorTipo="vendedor" actorId={Number(id)} />
```

- [ ] **Step 2: Update TiendaProfile.tsx**

Add import:
```tsx
import { CancelacionStats } from '../components/CancelacionStats';
```

In the JSX after the store rating display:
```tsx
<CancelacionStats actorTipo="tiendaRetiro" actorId={Number(id)} />
```

- [ ] **Step 3: Update MiPerfilVendedorPage.tsx**

Add import:
```tsx
import { CancelacionStats } from '../components/CancelacionStats';
```

In the JSX in the stats/profile section:
```tsx
<CancelacionStats actorTipo="vendedor" actorId={user.id} />
```

- [ ] **Step 4: Update MiPerfilTiendaRetiroPage.tsx**

Add import:
```tsx
import { CancelacionStats } from '../components/CancelacionStats';
```

In the JSX profile section:
```tsx
<CancelacionStats actorTipo="tiendaRetiro" actorId={user.id} />
```

- [ ] **Step 5: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/VendedorProfile.tsx \
        vite-project/vite-project-ts/src/pages/TiendaProfile.tsx \
        vite-project/vite-project-ts/src/pages/MiPerfilVendedorPage.tsx \
        vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx
git commit -m "feat: add CancelacionStats to seller and store profile pages"
```
