# Wishlist con Alertas por Email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender la wishlist existente para que los usuarios registrados reciban alertas por email cuando se publique una carta que buscan, con filtros de idioma, ciudad (Rosario / Buenos Aires) y precio máximo.

**Architecture:** Se agregan 5 campos a `Wishlist` (idioma, ciudad, notificar, precioMax, ultimaNotificacion) y un campo `lang` a `Carta`. Un servicio `wishlistNotifier.ts` se dispara fire-and-forget en el controller de creación de carta. El frontend agrega un modal de configuración al agregar a favoritos y un toggle de campana en la WishlistPage.

**Tech Stack:** MikroORM 6 + PostgreSQL, nodemailer (mailer.ts ya configurado), React 19 + Tailwind CSS

---

## File Map

| Acción | Archivo |
|--------|---------|
| Modify | `backend/src/wishlist/wishlist.entity.ts` |
| Modify | `backend/src/carta/carta.entity.ts` |
| Modify | `backend/src/carta/carta.controler.ts` |
| Modify | `backend/src/wishlist/wishlist.routes.ts` |
| Create | `backend/src/wishlist/wishlistNotifier.ts` |
| Create | `vite-project/vite-project-ts/src/components/WishlistModal.tsx` |
| Modify | `vite-project/vite-project-ts/src/pages/CardDetail.tsx` |
| Modify | `vite-project/vite-project-ts/src/pages/WishlistPage.tsx` |

---

## Task 1: Entity migrations + schema update

**Files:**
- Modify: `backend/src/wishlist/wishlist.entity.ts`
- Modify: `backend/src/carta/carta.entity.ts`
- Modify: `backend/src/carta/carta.controler.ts` (sanitizer only)

- [ ] **Step 1.1: Actualizar `wishlist.entity.ts`**

Reemplazar el contenido completo de `backend/src/wishlist/wishlist.entity.ts`:

```typescript
import { Entity, Property, ManyToOne } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";
import { CartaClass } from "../carta/cartaClass.entity.js";

@Entity()
export class Wishlist extends BaseEntity {
  @Property({ type: 'number' })
  userId!: number;

  @ManyToOne(() => CartaClass, { nullable: true })
  cartaClass?: CartaClass;

  @Property({ type: 'number', nullable: true })
  cartaId?: number;

  @Property({ type: 'string', nullable: true })
  idioma?: string; // 'es' | 'en' | 'jp' | 'fr' | null = cualquiera

  @Property({ type: 'string', nullable: true })
  ciudad?: string; // 'rosario' | 'buenos_aires' | null = cualquiera

  @Property({ type: 'boolean', default: true })
  notificar: boolean = true;

  @Property({ type: 'decimal', nullable: true, precision: 10, scale: 2 })
  precioMax?: number;

  @Property({ type: 'datetime', nullable: true })
  ultimaNotificacion?: Date;
}
```

- [ ] **Step 1.2: Agregar campo `lang` a `carta.entity.ts`**

En `backend/src/carta/carta.entity.ts`, agregar después de `cardNumber`:

```typescript
  @Property({ type: 'string', nullable: true })
  lang?: string; // 'es' | 'en' | 'jp' | 'fr' | 'de' | 'it' | 'pt' | 'ko' | 'zh-tw'
```

- [ ] **Step 1.3: Agregar `lang` y `ciudad` al sanitizer en `carta.controler.ts`**

En la función `sanitizeCartaInput`, agregar al objeto `sanitisedInput`:

```typescript
    lang: req.body.lang,
    ciudad: req.body.ciudad,
```

También agregar `setCode: req.body.setCode` si no está ya (es necesario para el notifier).

- [ ] **Step 1.4: Correr schema update**

```bash
cd backend
pnpm schema:update
```

Expected: output de MikroORM indicando que se agregaron columnas `idioma`, `ciudad`, `notificar`, `precio_max`, `ultima_notificacion` a la tabla `wishlist`, y `lang` a `carta`. Sin errores.

---

## Task 2: Crear el servicio `wishlistNotifier.ts`

**Files:**
- Create: `backend/src/wishlist/wishlistNotifier.ts`

- [ ] **Step 2.1: Crear `backend/src/wishlist/wishlistNotifier.ts`**

```typescript
import { EntityManager } from "@mikro-orm/postgresql";
import { Wishlist } from "./wishlist.entity.js";
import { User } from "../user/user.entity.js";
import { sendEmail } from "../shared/mailer.js";
import { Carta } from "../carta/carta.entity.js";

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function notifyWishlistSubscribers(em: EntityManager, carta: Carta): Promise<void> {
  try {
    if (!carta.cartaClass) return;

    const cartaPrice = carta.price
      ? parseFloat(carta.price.replace(/[^0-9.]/g, ''))
      : null;

    const entries = await em.find(
      Wishlist,
      { notificar: true },
      { populate: ['cartaClass'] }
    );

    const now = new Date();
    const toNotify: Wishlist[] = [];

    for (const entry of entries) {
      if (!entry.cartaClass) continue;
      if (entry.cartaClass.id !== carta.cartaClass.id) continue;

      // Cooldown de 24h
      if (entry.ultimaNotificacion) {
        const elapsed = now.getTime() - entry.ultimaNotificacion.getTime();
        if (elapsed < COOLDOWN_MS) continue;
      }

      // Filtro de idioma
      if (entry.idioma && carta.lang && entry.idioma !== carta.lang) continue;

      // Filtro de precio máximo
      if (
        entry.precioMax !== null &&
        entry.precioMax !== undefined &&
        cartaPrice !== null
      ) {
        if (cartaPrice > entry.precioMax) continue;
      }

      toNotify.push(entry);
    }

    for (const entry of toNotify) {
      const user = await em.findOne(User, { id: entry.userId });
      if (!user?.email) continue;

      const cartaName = carta.cartaClass?.name ?? carta.name;
      const precioStr =
        cartaPrice !== null ? `$${cartaPrice.toLocaleString('es-AR')}` : 'Sin precio';
      const cityLabel =
        entry.ciudad === 'rosario'
          ? 'Rosario'
          : entry.ciudad === 'buenos_aires'
          ? 'Buenos Aires'
          : null;

      const subject = `¡Tu carta deseada está disponible! ${cartaName}`;

      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fffbf5;border-radius:12px;border:1px solid #fed7aa;">
          <h2 style="color:#f97316;margin:0 0 8px;">¡Buenas noticias!</h2>
          <p style="color:#374151;margin:0 0 16px;">Una carta de tu lista de deseos acaba de publicarse en HeroClash4Geeks:</p>
          <div style="background:white;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin-bottom:16px;">
            ${carta.image ? `<img src="${carta.image}" alt="${cartaName}" style="width:80px;float:right;border-radius:6px;margin-left:12px;">` : ''}
            <strong style="font-size:18px;color:#1f2937;">${cartaName}</strong>
            ${carta.setName ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">${carta.setName}</p>` : ''}
            ${carta.rarity ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">Rareza: ${carta.rarity}</p>` : ''}
            ${carta.lang ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">Idioma: ${carta.lang.toUpperCase()}</p>` : ''}
            <p style="color:#f97316;font-weight:bold;font-size:22px;margin:8px 0;">${precioStr}</p>
            ${cityLabel ? `<p style="color:#6b7280;margin:4px 0;font-size:14px;">📍 ${cityLabel}</p>` : ''}
            <div style="clear:both;"></div>
          </div>
          <p style="color:#6b7280;font-size:12px;margin:0;">
            Recibís este email porque la carta está en tu lista de deseos.<br>
            Para desactivar estas alertas, ingresá a tu wishlist y desactivá las notificaciones de esta carta.
          </p>
        </div>
      `;

      const text = `¡${cartaName} está disponible! Precio: ${precioStr}. Ingresá a HeroClash4Geeks para verla.`;
      await sendEmail(user.email, subject, text, html);

      entry.ultimaNotificacion = now;
    }

    if (toNotify.length > 0) {
      await em.flush();
    }
  } catch (err) {
    console.error('[wishlistNotifier] Error:', err);
  }
}
```

---

## Task 3: Actualizar `wishlist.routes.ts`

**Files:**
- Modify: `backend/src/wishlist/wishlist.routes.ts`

- [ ] **Step 3.1: Actualizar el POST para guardar los nuevos campos**

En el bloque POST, cuando se crea la entrada por `cartaClassId`, agregar antes de `em.create`:

```typescript
    const { idioma, ciudad, notificar, precioMax } = req.body;

    if (cartaClassId) {
      const existing = await em.findOne(Wishlist, { userId, cartaClass: { id: Number(cartaClassId) } });
      if (existing) return res.status(200).json({ data: existing, message: "Ya está en favoritos" });

      const cartaClass = await em.findOne(CartaClass, { id: Number(cartaClassId) });
      if (!cartaClass) return res.status(404).json({ message: "CartaClass no encontrada" });

      const entry = em.create(Wishlist, {
        userId,
        cartaClass,
        idioma: idioma || undefined,
        ciudad: ciudad || undefined,
        notificar: notificar !== false,
        precioMax: precioMax ? Number(precioMax) : undefined,
      });
      await em.flush();
      return res.status(201).json({ data: entry });
    }

    // Fallback por cartaId
    const existing = await em.findOne(Wishlist, { userId, cartaId: Number(cartaId) });
    if (existing) return res.status(200).json({ data: existing, message: "Ya está en favoritos" });

    const carta = await em.findOne(Carta, { id: Number(cartaId) });
    if (!carta) return res.status(404).json({ message: "Carta no encontrada" });

    const entry = em.create(Wishlist, {
      userId,
      cartaId: Number(cartaId),
      idioma: idioma || undefined,
      ciudad: ciudad || undefined,
      notificar: notificar !== false,
      precioMax: precioMax ? Number(precioMax) : undefined,
    });
    await em.flush();
    return res.status(201).json({ data: entry });
```

- [ ] **Step 3.2: Agregar PATCH `/:id` para actualizar preferencias**

Agregar antes del primer DELETE en `wishlist.routes.ts`:

```typescript
// PATCH /api/wishlist/:id — actualizar preferencias de notificación
wishlistRouter.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const userId = actor.id;
    const id = Number(req.params.id);

    const entry = await em.findOne(Wishlist, { id, userId });
    if (!entry) return res.status(404).json({ message: "Favorito no encontrado" });

    const { idioma, ciudad, notificar, precioMax } = req.body;

    if (idioma !== undefined) entry.idioma = idioma || undefined;
    if (ciudad !== undefined) entry.ciudad = ciudad || undefined;
    if (notificar !== undefined) entry.notificar = Boolean(notificar);
    if (precioMax !== undefined) entry.precioMax = precioMax !== '' && precioMax !== null ? Number(precioMax) : undefined;

    await em.flush();
    res.json({ data: entry });
  } catch (error: any) {
    res.status(500).json({ message: "Error al actualizar favorito", error: error.message });
  }
});
```

- [ ] **Step 3.3: Actualizar el GET para devolver los nuevos campos**

El GET ya devuelve los objetos entry completos vía MikroORM. Verificar que la respuesta del GET incluye `idioma`, `ciudad`, `notificar`, `precioMax` en cada entrada. Si no los incluye (por serialización), agregar en el map:

```typescript
// En el return del map de entries, después de disponible:
notificar: entry.notificar,
idioma: entry.idioma ?? null,
ciudad: entry.ciudad ?? null,
precioMax: entry.precioMax ?? null,
id: entry.id,  // ya existe
```

Esto aplica a ambas ramas (cartaClass y cartaId).

---

## Task 4: Wiring del notifier en `carta.controler.ts`

**Files:**
- Modify: `backend/src/carta/carta.controler.ts`

- [ ] **Step 4.1: Importar `notifyWishlistSubscribers` y `orm`**

Al inicio del archivo `carta.controler.ts`, agregar imports:

```typescript
import { notifyWishlistSubscribers } from "../wishlist/wishlistNotifier.js";
import { orm } from "../shared/db/orm.js";
```

- [ ] **Step 4.2: Llamar el notifier en `add()` tras el flush**

En la función `add()`, reemplazar:

```typescript
    const carta = em.create(Carta, cartaData);
    await em.flush();

    res.status(201).json({ message: "Carta created", data: carta });
```

por:

```typescript
    const carta = em.create(Carta, cartaData);
    await em.flush();

    // Populate cartaClass para que el notifier pueda matchear
    if (carta.cartaClass) {
      await em.populate(carta, ['cartaClass']);
    }
    // Fire-and-forget: no bloqueamos la respuesta
    notifyWishlistSubscribers(orm.em.fork(), carta).catch(console.error);

    res.status(201).json({ message: "Carta created", data: carta });
```

---

## Task 5: Crear `WishlistModal.tsx`

**Files:**
- Create: `vite-project/vite-project-ts/src/components/WishlistModal.tsx`

- [ ] **Step 5.1: Crear el componente modal**

```tsx
import { useState } from 'react'
import { fetchApi } from '../services/api'

export interface WishlistPrefs {
  idioma: string   // '' = cualquiera
  ciudad: string   // '' = cualquiera
  precioMax: string
  notificar: boolean
}

interface Props {
  cartaClassId?: number
  cartaId?: number
  onSaved: () => void
  onCancel: () => void
}

const IDIOMAS = [
  { value: '', label: 'Cualquier idioma' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'jp', label: 'Japonés' },
  { value: 'fr', label: 'Francés' },
  { value: 'de', label: 'Alemán' },
  { value: 'pt', label: 'Portugués' },
]

const CIUDADES = [
  { value: '', label: 'Cualquier ciudad' },
  { value: 'rosario', label: 'Rosario' },
  { value: 'buenos_aires', label: 'Buenos Aires' },
]

export default function WishlistModal({ cartaClassId, cartaId, onSaved, onCancel }: Props) {
  const [prefs, setPrefs] = useState<WishlistPrefs>({
    idioma: '',
    ciudad: '',
    precioMax: '',
    notificar: true,
  })
  const [loading, setLoading] = useState(false)

  const handleGuardar = async () => {
    setLoading(true)
    try {
      const body: Record<string, any> = {
        idioma: prefs.idioma || null,
        ciudad: prefs.ciudad || null,
        notificar: prefs.notificar,
        precioMax: prefs.precioMax !== '' ? Number(prefs.precioMax) : null,
      }
      if (cartaClassId) body.cartaClassId = cartaClassId
      else if (cartaId) body.cartaId = cartaId

      await fetchApi('/api/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      onSaved()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Agregar a favoritos</h2>
        <p className="text-sm text-gray-500 mb-5">
          Configurá tus preferencias de alerta. Te avisamos por email cuando se publique.
        </p>

        {/* Idioma */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 block mb-1">Idioma de la carta</span>
          <select
            value={prefs.idioma}
            onChange={e => setPrefs(p => ({ ...p, idioma: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {IDIOMAS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </label>

        {/* Ciudad */}
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 block mb-1">Ciudad</span>
          <select
            value={prefs.ciudad}
            onChange={e => setPrefs(p => ({ ...p, ciudad: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          >
            {CIUDADES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        {/* Precio máximo */}
        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 block mb-1">
            Precio máximo (opcional)
          </span>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">$</span>
            <input
              type="number"
              min="0"
              placeholder="Sin límite"
              value={prefs.precioMax}
              onChange={e => setPrefs(p => ({ ...p, precioMax: e.target.value }))}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Solo te avisamos si el precio es menor a este valor.</p>
        </label>

        {/* Toggle notificaciones */}
        <div className="flex items-center justify-between mb-6 bg-orange-50 rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Recibir alertas por email</p>
            <p className="text-xs text-gray-400">Te avisamos cuando la carta se publique</p>
          </div>
          <button
            type="button"
            onClick={() => setPrefs(p => ({ ...p, notificar: !p.notificar }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              prefs.notificar ? 'bg-orange-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                prefs.notificar ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={loading}
            className="flex-1 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition disabled:opacity-60"
          >
            {loading ? 'Guardando...' : '♥ Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 6: Actualizar `CardDetail.tsx` para usar el modal

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/CardDetail.tsx`

- [ ] **Step 6.1: Importar `WishlistModal` y agregar estado `showWishlistModal`**

Al inicio del archivo, agregar el import:

```tsx
import WishlistModal from '../components/WishlistModal'
```

En el componente `CardDetail`, agregar el estado:

```tsx
const [showWishlistModal, setShowWishlistModal] = useState(false)
```

- [ ] **Step 6.2: Reemplazar `handleToggleWishlist` para abrir el modal en lugar de llamar directo**

Reemplazar la función `handleToggleWishlist` para que, cuando `!enFavoritos`, abra el modal en lugar de llamar la API directamente:

```tsx
  const handleToggleWishlist = async () => {
    if (!card?.id || wishlistLoading) return

    if (enFavoritos) {
      setWishlistLoading(true)
      try {
        const deleteUrl = card.cartaClass?.id
          ? `/api/wishlist/${card.cartaClass.id}`
          : `/api/wishlist/carta/${card.id}`
        await fetchApi(deleteUrl, { method: 'DELETE' })
        setEnFavoritos(false)
      } finally {
        setWishlistLoading(false)
      }
    } else {
      setShowWishlistModal(true)
    }
  }
```

- [ ] **Step 6.3: Renderizar el modal condicionalmente**

En el JSX del componente (antes del `return` final o como último elemento dentro del fragment), agregar:

```tsx
      {showWishlistModal && (
        <WishlistModal
          cartaClassId={card?.cartaClass?.id}
          cartaId={!card?.cartaClass?.id ? card?.id : undefined}
          onSaved={() => {
            setEnFavoritos(true)
            setShowWishlistModal(false)
          }}
          onCancel={() => setShowWishlistModal(false)}
        />
      )}
```

---

## Task 7: Actualizar `WishlistPage.tsx`

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/WishlistPage.tsx`

- [ ] **Step 7.1: Agregar tipos para los nuevos campos**

Actualizar la interfaz `FavoritoEntry`:

```tsx
interface FavoritoEntry {
  id: number
  disponible: boolean
  cartaClass: { id: number; name: string; description: string } | null
  cartaId: number | null
  cartas: CartaVendedor[]
  notificar: boolean
  idioma: string | null
  ciudad: string | null
  precioMax: number | null
}
```

- [ ] **Step 7.2: Agregar función `handleToggleNotificar`**

```tsx
  const handleToggleNotificar = async (entry: FavoritoEntry) => {
    const nuevo = !entry.notificar
    // Optimistic update
    setFavoritos(prev =>
      prev.map(f => f.id === entry.id ? { ...f, notificar: nuevo } : f)
    )
    try {
      await fetchApi(`/api/wishlist/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificar: nuevo }),
      })
    } catch {
      // Revert on error
      setFavoritos(prev =>
        prev.map(f => f.id === entry.id ? { ...f, notificar: !nuevo } : f)
      )
    }
  }
```

- [ ] **Step 7.3: Mostrar tags de idioma/ciudad y toggle de campana por entrada**

Dentro del bloque `<div className="flex items-center gap-3 mt-2 flex-wrap">` (donde están el badge y el precio), agregar después del `minPrecio`:

```tsx
                        {/* Tags de preferencia */}
                        {entry.idioma && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-600 border border-blue-100">
                            {entry.idioma.toUpperCase()}
                          </span>
                        )}
                        {entry.ciudad && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-600 border border-purple-100">
                            📍 {entry.ciudad === 'rosario' ? 'Rosario' : 'Buenos Aires'}
                          </span>
                        )}
                        {entry.precioMax && (
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-600 border border-green-100">
                            Máx. ${entry.precioMax.toLocaleString('es-AR')}
                          </span>
                        )}
```

- [ ] **Step 7.4: Agregar toggle de campana (notificar) en el header de cada carta**

Dentro de `<div className="flex items-start justify-between gap-2">`, al lado del botón ♥ (eliminar), agregar el toggle de notificaciones:

```tsx
                        {/* Toggle notificaciones */}
                        <button
                          onClick={() => handleToggleNotificar(entry)}
                          title={entry.notificar ? 'Desactivar alertas por email' : 'Activar alertas por email'}
                          className={`text-xl flex-shrink-0 transition ${
                            entry.notificar
                              ? 'text-orange-400 hover:text-orange-600'
                              : 'text-gray-300 hover:text-gray-400'
                          }`}
                        >
                          {entry.notificar ? '🔔' : '🔕'}
                        </button>
```

- [ ] **Step 7.5: Actualizar el texto descriptivo de la WishlistPage**

Reemplazar el párrafo del subtítulo:

```tsx
          <p className="text-gray-500 mt-1 text-sm">
            Tus cartas guardadas. Compará precios y recibí alertas cuando se publiquen.
          </p>
```

---

## Self-review

### Spec coverage
- ✅ Agregar carta a wishlist con idioma → Task 1 (entity), Task 5 (modal con selector)
- ✅ Seleccionar ciudad (Rosario / Buenos Aires / Cualquiera) → Task 1 + Task 5
- ✅ Notificación por email al publicarse → Task 2 (notifier) + Task 4 (wiring)
- ✅ Solo usuarios registrados → autenticación ya implementada; el notifier usa `userId` para buscar `User.email`
- ✅ Precio máximo como filtro → Task 1 + Task 5 + Task 2 (filtro en notifier)
- ✅ Cooldown 24h → Task 2 (`COOLDOWN_MS`)
- ✅ Toggle on/off por carta → Task 3 (PATCH) + Task 7 (toggle campana UI)
- ✅ Badge visual de alerta activa → Task 7 (campana naranja vs gris)
- ✅ Tags de idioma/ciudad en la wishlist → Task 7.3

### Type consistency
- `Wishlist.idioma`, `Wishlist.ciudad`, `Wishlist.notificar`, `Wishlist.precioMax`, `Wishlist.ultimaNotificacion` — definidos en Task 1, usados en Tasks 2, 3, 7
- `Carta.lang` — definido en Task 1, filtrado en Task 2
- `FavoritoEntry.notificar/idioma/ciudad/precioMax` — tipado en Task 7.1, usado en Tasks 7.2-7.4
- `WishlistPrefs` interface — exportada desde WishlistModal (Task 5), no se importa en otros componentes (no se necesita)
