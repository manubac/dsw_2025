# BUYER → SELLER Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el flujo de conversión de BUYER a SELLER mediante OTP de WhatsApp, refactorizando `Vendedor` como perfil comercial vinculado 1:1 a `User`.

**Architecture:** `User` es la identidad primaria (email, password, verificaciones). `Vendedor` se convierte en un perfil comercial con FK requerida a `User`. El JWT usa `userId: user.id`; el middleware carga `Vendedor` a través de esa FK. El upgrade se dispara con OTP de WhatsApp desde el módulo `seller/`.

**Tech Stack:** Node.js/Express 5, TypeScript, MikroORM 6, PostgreSQL, Twilio (WhatsApp), React 19, Vite 7.

---

## File Map

### Backend — Archivos modificados
| Archivo | Cambio |
|---|---|
| `backend/src/user/user.entity.ts` | + `is_email_verified`, `is_phone_verified` |
| `backend/src/vendedor/vendedores.entity.ts` | + `user` (FK 1:1), + `unique` en `telefono`, - `email`, `password`, reset tokens |
| `backend/src/shared/middleware/auth.ts` | Lookup de `'vendedor'` vía `User → Vendedor` |
| `backend/src/user/user.controler.ts` | Login detecta `Vendedor`, emite role correcto en JWT y devuelve datos de vendedor |
| `backend/src/vendedor/vendedor.controller.ts` | Eliminar `email`/`password` del sanitize; deprecar `login`; bloquear `add` directo |
| `backend/src/shared/db/orm.ts` | + `VerificationCode` en lista de entidades |
| `backend/src/app.ts` | + registrar `sellerRouter` en `/api/seller` |
| `backend/package.json` | + `twilio`, + script `migrate:sellers` |

### Backend — Archivos nuevos
| Archivo | Propósito |
|---|---|
| `backend/src/verification/verificationCode.entity.ts` | Entidad OTP con TTL |
| `backend/src/shared/whatsapp.ts` | Servicio WhatsApp (real / test mode) |
| `backend/src/seller/seller.routes.ts` | Rutas `/api/seller` |
| `backend/src/seller/seller.controler.ts` | Lógica de `request-otp` y `verify-otp` |
| `backend/src/scripts/migrate_vendedores_to_users.ts` | Migración one-shot de Vendedores existentes |

### Frontend — Archivos modificados
| Archivo | Cambio |
|---|---|
| `vite-project/vite-project-ts/src/context/user.tsx` | + `is_email_verified`, `is_phone_verified` en interfaz `User`; + `upgradeToSeller` helper |
| `vite-project/vite-project-ts/src/pages/UserProfilePage.tsx` | + renderizar `<SellerOnboarding />` |

### Frontend — Archivos nuevos
| Archivo | Propósito |
|---|---|
| `vite-project/vite-project-ts/src/components/SellerOnboarding.tsx` | Flujo de onboarding con OTP |

---

## Task 1: Instalar Twilio y agregar variables de entorno

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/.env`

- [ ] **Step 1: Instalar twilio**

Desde el directorio `backend/`:
```bash
cd backend
pnpm add twilio
pnpm add -D @types/twilio
```

- [ ] **Step 2: Agregar variables a `backend/.env`**

Abrir `backend/.env` y agregar al final:
```
WHATSAPP_TEST_MODE=true
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
```

Con `WHATSAPP_TEST_MODE=true` no se llama a Twilio; el código se imprime en consola y `'123456'` siempre es válido.

- [ ] **Step 3: Verificar instalación**

```bash
cd backend
node -e "import('twilio').then(() => console.log('twilio ok'))"
```

Expected: `twilio ok`

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml
git commit -m "deps: add twilio for WhatsApp OTP"
```

---

## Task 2: Extender la entidad `User`

**Files:**
- Modify: `backend/src/user/user.entity.ts`

- [ ] **Step 1: Agregar campos al final de la entidad**

Abrir `backend/src/user/user.entity.ts`. El archivo actual termina en:
```typescript
  @Property({ type: 'datetime', hidden: true, nullable: true })
  resetPasswordExpires?: Date;
}
```

Reemplazar ese cierre con:
```typescript
  @Property({ type: 'datetime', hidden: true, nullable: true })
  resetPasswordExpires?: Date;

  @Property({ type: 'boolean', default: false })
  is_email_verified!: boolean;

  @Property({ type: 'boolean', default: false })
  is_phone_verified!: boolean;
}
```

- [ ] **Step 2: Sincronizar schema**

```bash
cd backend
pnpm schema:update
```

Expected: el log de MikroORM muestra `ALTER TABLE "user" ADD COLUMN "is_email_verified" boolean ...` y `ADD COLUMN "is_phone_verified" boolean ...` sin errores.

- [ ] **Step 3: Verificar en psql que las columnas existen**

```bash
psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw -c "\d user"
```

Expected: columnas `is_email_verified boolean` e `is_phone_verified boolean` visibles.

- [ ] **Step 4: Commit**

```bash
git add backend/src/user/user.entity.ts
git commit -m "feat(db): add is_email_verified and is_phone_verified to User"
```

---

## Task 3: Crear la entidad `VerificationCode`

**Files:**
- Create: `backend/src/verification/verificationCode.entity.ts`
- Modify: `backend/src/shared/db/orm.ts`

- [ ] **Step 1: Crear el directorio y la entidad**

Crear el archivo `backend/src/verification/verificationCode.entity.ts`:

```typescript
import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseEntity } from '../shared/db/baseEntity.js';
import { User } from '../user/user.entity.js';

@Entity()
export class VerificationCode extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ type: 'string' })
  codeHash!: string;

  @Property({ type: 'string' })
  purpose!: string;

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'boolean', default: false })
  used!: boolean;
}
```

- [ ] **Step 2: Registrar en `orm.ts`**

Abrir `backend/src/shared/db/orm.ts`. Agregar el import al final de los imports de entidades:
```typescript
import { VerificationCode } from '../../verification/verificationCode.entity.js'
```

En la lista de `entities`, agregar `VerificationCode`:
```typescript
entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, User, Direccion, Intermediario, Envio, Valoracion, StagePokemon, Mensaje, Wishlist, VerificationCode],
```

- [ ] **Step 3: Sincronizar schema**

```bash
cd backend
pnpm schema:update
```

Expected: `CREATE TABLE "verification_code" ...` en el log.

- [ ] **Step 4: Verificar tabla creada**

```bash
psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw -c "\d verification_code"
```

Expected: tabla con columnas `id`, `created_at`, `updated_at`, `user_id`, `code_hash`, `purpose`, `expires_at`, `used`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/verification/verificationCode.entity.ts backend/src/shared/db/orm.ts
git commit -m "feat(db): add VerificationCode entity for OTP flow"
```

---

## Task 4: Crear el servicio WhatsApp

**Files:**
- Create: `backend/src/shared/whatsapp.ts`

- [ ] **Step 1: Crear el servicio**

Crear `backend/src/shared/whatsapp.ts`:

```typescript
import twilio from 'twilio';

class WhatsAppService {
  async send(phone: string, code: string): Promise<void> {
    if (process.env.WHATSAPP_TEST_MODE === 'true') {
      console.log(`[WhatsApp TEST] OTP para ${phone}: ${code}`);
      return;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio env vars no configuradas');
    }

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${phone}`,
      body: `Tu código para activar tu cuenta de vendedor en HeroClash: ${code}. Válido por 10 minutos.`,
    });
  }
}

export const whatsAppService = new WhatsAppService();
```

- [ ] **Step 2: Smoke test en TEST_MODE**

Asegurarse de que `WHATSAPP_TEST_MODE=true` en `backend/.env`, luego iniciar el servidor (`pnpm start:dev`) y verificar que compila sin errores de TypeScript.

- [ ] **Step 3: Commit**

```bash
git add backend/src/shared/whatsapp.ts
git commit -m "feat: add WhatsApp service with test mode"
```

---

## Task 5: Refactorizar la entidad `Vendedor` (fase 1 — agregar FK, hacer telefono único)

**Files:**
- Modify: `backend/src/vendedor/vendedores.entity.ts`

Esta tarea es **aditiva**: se agrega el campo `user` y se hace `telefono` único. Los campos `email`/`password` se eliminan en Task 9, después de correr la migración.

- [ ] **Step 1: Modificar la entidad**

Reemplazar el contenido de `backend/src/vendedor/vendedores.entity.ts` con:

```typescript
import { Entity, Property, OneToMany, ManyToMany, Collection, OneToOne, Rel } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { ItemCarta } from "../carta/itemCarta.entity.js"
import { TiendaRetiro } from "../tiendaRetiro/tiendaRetiro.entity.js"
import { User } from "../user/user.entity.js"

@Entity()
export class Vendedor extends BaseEntity {
    @OneToOne(() => User, { owner: true, unique: true, nullable: true })
    user?: Rel<User>

    @Property({ type: 'string', nullable: false, unique: true })
    nombre!: string

    @Property({ type: 'string', hidden: true, nullable: false, unique: true })
    email!: string

    @Property({ type: 'string', hidden: true, nullable: false })
    password!: string

    @Property({ type: 'string', nullable: false, unique: true })
    telefono!: string

    @Property({ type: 'string', nullable: true })
    ciudad?: string

    @Property({ type: 'string', nullable: true })
    alias?: string

    @Property({ type: 'string', nullable: true })
    cbu?: string

    @Property({ type: 'string', hidden: true, nullable: true })
    resetPasswordToken?: string;

    @Property({ type: 'datetime', hidden: true, nullable: true })
    resetPasswordExpires?: Date;

    @OneToMany(() => ItemCarta, (itemCarta) => itemCarta.uploaderVendedor)
    itemCartas = new Collection<ItemCarta>(this)

    @ManyToMany(() => TiendaRetiro, undefined, { owner: true })
    tiendasRetiro = new Collection<TiendaRetiro>(this)
}
```

Nota: `user` es nullable temporalmente para no romper los Vendedores existentes. Se volverá required en Task 9.

- [ ] **Step 2: Sincronizar schema**

```bash
cd backend
pnpm schema:update
```

Expected: `ALTER TABLE "vendedor" ADD COLUMN "user_id" int ...` y `ADD CONSTRAINT "vendedor_telefono_unique" ...` en el log. El comando NO debe soltar columnas existentes.

- [ ] **Step 3: Verificar en psql**

```bash
psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw -c "\d vendedor"
```

Expected: columna `user_id` visible. Columnas `email`, `password` siguen presentes.

- [ ] **Step 4: Commit**

```bash
git add backend/src/vendedor/vendedores.entity.ts
git commit -m "feat(db): add user FK and unique telefono to Vendedor (phase 1)"
```

---

## Task 6: Script de migración de Vendedores existentes

**Files:**
- Create: `backend/src/scripts/migrate_vendedores_to_users.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Crear el script**

Crear `backend/src/scripts/migrate_vendedores_to_users.ts`:

```typescript
import 'dotenv/config';
import 'reflect-metadata';
import { MikroORM } from '@mikro-orm/postgresql';
import { SqlHighlighter } from '@mikro-orm/sql-highlighter';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import { VerificationCode } from '../verification/verificationCode.entity.js';
import { Carta } from '../carta/carta.entity.js';
import { CartaClass } from '../carta/cartaClass.entity.js';
import { ItemCarta } from '../carta/itemCarta.entity.js';
import { Compra } from '../compra/compra.entity.js';
import { Direccion } from '../direccion/direccion.entity.js';
import { Intermediario } from '../intermediario/intermediario.entity.js';
import { Envio } from '../envio/envio.entity.js';
import { Valoracion } from '../valoracion/valoracion.entity.js';
import { StagePokemon } from '../stage/stage.entity.js';
import { Mensaje } from '../mensaje/mensaje.entity.js';
import { Wishlist } from '../wishlist/wishlist.entity.js';
import { TiendaRetiro } from '../tiendaRetiro/tiendaRetiro.entity.js';

const orm = await MikroORM.init({
  entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, User, Direccion, Intermediario, Envio, Valoracion, StagePokemon, Mensaje, Wishlist, TiendaRetiro, VerificationCode],
  clientUrl: process.env.DB_CONNECTION_STRING || 'postgresql://postgres:post1234@localhost:5432/heroclash_dsw',
  highlighter: new SqlHighlighter(),
  debug: false,
});

const em = orm.em.fork();

const vendedores = await em.find(Vendedor, { user: null });
console.log(`Migrando ${vendedores.length} vendedor(es) sin User asociado...`);

for (const v of vendedores) {
  const existingUser = await em.findOne(User, { email: v.email });

  if (existingUser) {
    console.log(`  [skip] ${v.email} — User ya existe (id=${existingUser.id}), vinculando.`);
    v.user = existingUser;
  } else {
    const newUser = em.create(User, {
      username: v.nombre,
      email: v.email,
      password: v.password,
      role: 'user',
      is_email_verified: true,
      is_phone_verified: false,
    });
    v.user = newUser;
    console.log(`  [create] User para ${v.email}`);
  }
}

await em.flush();
console.log('Migración completada.');
await orm.close();
```

- [ ] **Step 2: Agregar script npm en `backend/package.json`**

En el objeto `"scripts"` de `backend/package.json`, agregar después de `"seed-tiendas"`:
```json
"migrate:sellers": "npx tsx src/scripts/migrate_vendedores_to_users.ts",
```

- [ ] **Step 3: Ejecutar la migración**

```bash
cd backend
pnpm migrate:sellers
```

Expected: por cada vendedor existente, imprime `[create] User para <email>` o `[skip] <email>`. Finaliza con `Migración completada.`

- [ ] **Step 4: Verificar en psql**

```bash
psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw -c "SELECT v.id, v.nombre, v.user_id FROM vendedor v;"
```

Expected: todos los registros de `vendedor` tienen `user_id` distinto de null.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/migrate_vendedores_to_users.ts backend/package.json
git commit -m "feat: add migration script for Vendedor → User linking"
```

---

## Task 7: Refactorizar entidad `Vendedor` (fase 2 — remover campos duplicados)

**Files:**
- Modify: `backend/src/vendedor/vendedores.entity.ts`

**PREREQUISITO:** Task 6 (migración) debe haberse ejecutado con éxito antes de este paso.

- [ ] **Step 1: Verificar que todos los Vendedores tienen user_id**

```bash
psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw -c "SELECT COUNT(*) FROM vendedor WHERE user_id IS NULL;"
```

Expected: `0`. Si no es 0, re-ejecutar la migración de Task 6.

- [ ] **Step 2: Reemplazar la entidad Vendedor con la versión limpia**

Reemplazar el contenido de `backend/src/vendedor/vendedores.entity.ts`:

```typescript
import { Entity, Property, OneToMany, ManyToMany, Collection, OneToOne, Rel } from "@mikro-orm/core"
import { BaseEntity } from "../shared/db/baseEntity.js"
import { ItemCarta } from "../carta/itemCarta.entity.js"
import { TiendaRetiro } from "../tiendaRetiro/tiendaRetiro.entity.js"
import { User } from "../user/user.entity.js"

@Entity()
export class Vendedor extends BaseEntity {
    @OneToOne(() => User, { owner: true, unique: true, nullable: false })
    user!: Rel<User>

    @Property({ type: 'string', nullable: false, unique: true })
    nombre!: string

    @Property({ type: 'string', nullable: false, unique: true })
    telefono!: string

    @Property({ type: 'string', nullable: true })
    ciudad?: string

    @Property({ type: 'string', nullable: true })
    alias?: string

    @Property({ type: 'string', nullable: true })
    cbu?: string

    @OneToMany(() => ItemCarta, (itemCarta) => itemCarta.uploaderVendedor)
    itemCartas = new Collection<ItemCarta>(this)

    @ManyToMany(() => TiendaRetiro, undefined, { owner: true })
    tiendasRetiro = new Collection<TiendaRetiro>(this)
}
```

- [ ] **Step 3: Sincronizar schema**

```bash
cd backend
pnpm schema:update
```

El `updateSchema({ dropTables: false })` no elimina columnas automáticamente. Las columnas `email`, `password`, `reset_password_token`, `reset_password_expires` quedan en la tabla sin uso pero no rompen nada. Para eliminarlas manualmente si se desea:

```bash
psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw -c "
  ALTER TABLE vendedor
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS password,
    DROP COLUMN IF EXISTS reset_password_token,
    DROP COLUMN IF EXISTS reset_password_expires;
"
```

- [ ] **Step 4: Verificar que el servidor compila**

```bash
cd backend
pnpm start:dev
```

Expected: compila sin errores de TypeScript. Puede haber errores en `vendedor.controller.ts` que se resolverán en Task 8 — están bien por ahora si el servidor arranca.

- [ ] **Step 5: Commit**

```bash
git add backend/src/vendedor/vendedores.entity.ts
git commit -m "feat(db): remove duplicate fields from Vendedor entity (phase 2)"
```

---

## Task 8: Actualizar el controlador de Vendedor

**Files:**
- Modify: `backend/src/vendedor/vendedor.controller.ts`

Se elimina el uso de `email`/`password` del Vendedor; se bloquea la creación directa; se depreca el login.

- [ ] **Step 1: Reemplazar el contenido completo del archivo**

Reemplazar `backend/src/vendedor/vendedor.controller.ts` con:

```typescript
import { Request, Response, NextFunction } from 'express';
import { orm } from '../shared/db/orm.js';
import { wrap } from '@mikro-orm/core';
import { Vendedor } from './vendedores.entity.js'
import { Compra } from '../compra/compra.entity.js';
import { TiendaRetiro } from '../tiendaRetiro/tiendaRetiro.entity.js';
import { sendEmail } from '../shared/mailer.js';

const em = orm.em

function sanitiseVendedorInput(
    req: Request,
    res: Response,
    next: NextFunction
) {
    req.body.sanitisedInput = {
        nombre: req.body.nombre,
        telefono: req.body.telefono,
        ciudad: req.body.ciudad,
        alias: req.body.alias,
        cbu: req.body.cbu,
    };

    Object.keys(req.body.sanitisedInput).forEach(key => {
        if (req.body.sanitisedInput[key] === undefined) {
            delete req.body.sanitisedInput[key];
        }
    })
    next()
}

async function findAll(req: Request, res: Response) {
    try {
        const vendedores = await em.find(
            Vendedor,
            {},
            { populate: ['itemCartas', 'user'] }
        )
        res.status(200).json({ message: 'Found all vendedores', data: vendedores })
    } catch (error) {
        res.status(500).json({ message: 'Error fetching vendedores', error })
    }
}

async function findOne(req: Request, res: Response) {
    try {
        const id = Number.parseInt(req.params.id as string)
        const vendedor = await em.findOne(Vendedor, { id }, { populate: ['itemCartas', 'itemCartas.cartas', 'user'] })
        res.status(200).json({ message: 'Found one vendedor', data: vendedor })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

// Registro directo de Vendedor deshabilitado. Usar el flujo BUYER → SELLER en /api/seller.
async function add(_req: Request, res: Response) {
    res.status(410).json({ message: 'Registro directo como vendedor deshabilitado. Usá el flujo de upgrade desde tu perfil de comprador.' })
}

async function update(req: Request, res: Response) {
    try {
        const id = Number.parseInt(req.params.id as string)
        const vendedorToUpdate = await em.findOneOrFail(Vendedor, { id })
        em.assign(vendedorToUpdate, req.body.sanitisedInput)
        await em.flush()
        res.status(200).json({ message: 'Vendedor updated', data: vendedorToUpdate })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

async function remove(req: Request, res: Response) {
    try {
        const id = Number.parseInt(req.params.id as string)
        const vendedor = await em.getReference(Vendedor, id)
        await em.removeAndFlush(vendedor)
        res.status(200).json({ message: 'Vendedor deleted' })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

// Login de Vendedor deprecado. Usar POST /api/users/login.
async function login(_req: Request, res: Response) {
    res.status(410).json({ message: 'Login de vendedor deprecado. Usá POST /api/users/login con tu email y contraseña.' })
}

async function logout(_req: Request, res: Response) {
    res.status(200).json({ message: 'Logout successful' })
}

async function getVentas(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const compras = await em.find(Compra, {
            itemCartas: {
                uploaderVendedor: { id },
            }
        }, {
            populate: ['itemCartas', 'itemCartas.cartas', 'comprador', 'envio', 'envio.intermediario', 'envio.intermediario.direccion', 'tiendaRetiro']
        });

        const result = compras.map(c => {
            const myItems = c.itemCartas.getItems().filter(item =>
                item.uploaderVendedor?.id === id
            );
            if (myItems.length === 0) return null;

            return {
                id: c.id,
                fecha: c.createdAt,
                total: c.total,
                estado: c.estado,
                comprador: {
                    id: c.comprador?.id,
                    nombre: c.comprador?.username || c.nombre || 'Usuario',
                    email: c.comprador?.email || c.email
                },
                items: myItems.map(i => ({
                    id: i.id,
                    name: i.cartas[0]?.name,
                    image: i.cartas[0]?.image,
                    price: i.cartas[0]?.price
                })),
                tiendaRetiro: c.tiendaRetiro
                    ? {
                        id: c.tiendaRetiro.id,
                        nombre: c.tiendaRetiro.nombre,
                        direccion: c.tiendaRetiro.direccion,
                        horario: c.tiendaRetiro.horario,
                    }
                    : null,
                envio: c.envio ? {
                    id: c.envio.id,
                    estado: c.envio.estado,
                    intermediario: c.envio.intermediario ? {
                        nombre: c.envio.intermediario.nombre,
                        direccion: c.envio.intermediario.direccion ?
                            `${c.envio.intermediario.direccion.calle} ${c.envio.intermediario.direccion.altura}, ${c.envio.intermediario.direccion.ciudad}`
                            : 'Dirección pendiente'
                    } : null
                } : null
            };
        }).filter(Boolean);

        res.json({ data: result });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
}

async function markSent(req: Request, res: Response) {
    try {
        const compraId = Number(req.params.compraId);
        const vendedorId = Number(req.params.id);

        const compra = await em.findOneOrFail(Compra, { id: compraId }, { populate: ['envio', 'itemCartas.cartas'] });

        const isVendor = compra.itemCartas.getItems().some(item =>
            item.uploaderVendedor?.id === vendedorId
        );

        if (!isVendor) return res.status(403).json({ message: 'No eres vendedor en esta compra' });
        if (!compra.envio) return res.status(400).json({ message: 'Compra sin envío asignado' });

        compra.estado = 'ENVIADO_A_INTERMEDIARIO';
        await em.flush();

        res.json({ message: 'Envío marcado como enviado al intermediario' });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

async function entregarTienda(req: Request, res: Response) {
    try {
        const compraId = Number(req.params.compraId);
        const vendedorId = Number(req.params.id);

        const compra = await em.findOne(
            Compra,
            { id: compraId },
            { populate: ['itemCartas', 'itemCartas.cartas', 'comprador', 'tiendaRetiro'] }
        );

        if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

        const isVendor = compra.itemCartas.getItems().some(item =>
            item.uploaderVendedor?.id === vendedorId
        );
        if (!isVendor) return res.status(403).json({ message: 'No eres vendedor en esta compra' });

        if (compra.estado !== 'pendiente') {
            return res.status(400).json({ message: 'La compra no está en estado pendiente' });
        }

        compra.estado = 'entregado_a_tienda';
        await em.flush();

        const tienda = compra.tiendaRetiro;
        const nombreComprador = compra.comprador?.username || compra.nombre || 'comprador';

        if (tienda?.email) {
            const html = `
        <h2>Nuevo pedido en camino a tu tienda</h2>
        <p>El pedido <strong>#${compra.id}</strong> está en camino a tu tienda.</p>
        <p><strong>Comprador:</strong> ${nombreComprador}</p>
        <p>Cuando lo recibas, marcalo como <strong>"En tienda"</strong> desde tu panel.</p>
      `;
            sendEmail(
                tienda.email,
                `Pedido #${compra.id} en camino a tu tienda`,
                `El pedido #${compra.id} está en camino`,
                html
            );
        }

        res.json({ message: 'Pedido marcado como entregado a tienda', data: compra });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

async function getTiendasRetiro(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const vendedor = await em.findOne(Vendedor, { id }, { populate: ['tiendasRetiro'] });
        if (!vendedor) return res.status(404).json({ message: 'Vendedor no encontrado' });
        res.json({ data: vendedor.tiendasRetiro.getItems() });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

async function updateTiendasRetiro(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const tiendaIds: number[] = Array.isArray(req.body.tiendaIds) ? req.body.tiendaIds.map(Number) : [];
        const vendedor = await em.findOne(Vendedor, { id }, { populate: ['tiendasRetiro'] });
        if (!vendedor) return res.status(404).json({ message: 'Vendedor no encontrado' });
        const tiendas = tiendaIds.length > 0 ? await em.find(TiendaRetiro, { id: { $in: tiendaIds } }) : [];
        vendedor.tiendasRetiro.set(tiendas);
        await em.flush();
        res.json({ data: vendedor.tiendasRetiro.getItems() });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

export { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent, entregarTienda, getTiendasRetiro, updateTiendasRetiro };
```

- [ ] **Step 2: Verificar compilación**

```bash
cd backend
pnpm start:dev
```

Expected: compilación sin errores.

- [ ] **Step 3: Commit**

```bash
git add backend/src/vendedor/vendedor.controller.ts
git commit -m "feat: update Vendedor controller — remove email/password, deprecate direct login"
```

---

## Task 9: Actualizar el middleware de autenticación

**Files:**
- Modify: `backend/src/shared/middleware/auth.ts`

El JWT para Vendedores ahora contiene `userId = user.id`. El middleware debe buscar `Vendedor` a través de esa FK.

- [ ] **Step 1: Modificar el bloque `if (decoded.role === 'vendedor')`**

En `backend/src/shared/middleware/auth.ts`, reemplazar:

```typescript
    if (decoded.role === 'vendedor') {
      actor = await em.findOne(Vendedor, { id: decoded.userId });
    } else if (decoded.role === 'intermediario') {
```

Con:

```typescript
    if (decoded.role === 'vendedor') {
      const vendedorUser = await em.findOne(User, { id: decoded.userId });
      actor = vendedorUser ? await em.findOne(Vendedor, { user: vendedorUser }) : null;
    } else if (decoded.role === 'intermediario') {
```

- [ ] **Step 2: Verificar compilación**

```bash
cd backend
pnpm start:dev
```

Expected: compilación sin errores de TypeScript.

- [ ] **Step 3: Verificar que un Vendedor migrado puede autenticarse**

Primero obtener un token de vendedor desde el nuevo login (Task 10). Luego:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/vendedores/<vendedor_id>/ventas
```

Expected: 200 con `data: [...]`

- [ ] **Step 4: Commit**

```bash
git add backend/src/shared/middleware/auth.ts
git commit -m "feat: update auth middleware — Vendedor lookup via User FK"
```

---

## Task 10: Actualizar el login de User para detectar Vendedores

**Files:**
- Modify: `backend/src/user/user.controler.ts`

El login unificado detecta si el user tiene un perfil de Vendedor y emite el JWT y los datos correctos.

- [ ] **Step 1: Agregar import de Vendedor en el controlador de User**

En `backend/src/user/user.controler.ts`, agregar `Vendedor` a los imports existentes. Cambiar la línea:

```typescript
import { Vendedor } from "../vendedor/vendedores.entity.js";
```

Este import ya existe en el archivo (`import { Vendedor } from "../vendedor/vendedores.entity.js"`). Si no está, agregarlo.

- [ ] **Step 2: Reemplazar la función `login`**

Localizar la función `login` en `backend/src/user/user.controler.ts` (líneas 144–168 aproximadamente). Reemplazarla por:

```typescript
async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const em = orm.em.fork();
    const user = await em.findOne(User, { email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const vendedor = await em.findOne(Vendedor, { user }, { populate: ['itemCartas', 'tiendasRetiro'] });
    const role = vendedor ? 'vendedor' : 'user';

    const token = jwt.sign(
      { userId: user.id, role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    if (vendedor) {
      const vendedorData = { ...vendedor, role: 'vendedor', email: user.email };
      return res.status(200).json({ message: 'Login successful', data: vendedorData, token, role });
    }

    res.status(200).json({ message: 'Login successful', data: user, token, role });
  } catch (error: any) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
}
```

- [ ] **Step 3: Verificar que el login funciona para un User sin Vendedor**

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<buyer_email>","password":"<password>"}'
```

Expected: `{ "data": { ...user }, "token": "...", "role": "user" }`

- [ ] **Step 4: Verificar login para un Vendedor migrado**

```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<vendedor_email>","password":"<password>"}'
```

Expected: `{ "data": { ...vendedor, "role": "vendedor", "email": "..." }, "token": "...", "role": "vendedor" }`

- [ ] **Step 5: Commit**

```bash
git add backend/src/user/user.controler.ts
git commit -m "feat: unified login detects Vendedor profile and emits correct JWT role"
```

---

## Task 11: Crear el módulo seller (rutas y controlador)

**Files:**
- Create: `backend/src/seller/seller.routes.ts`
- Create: `backend/src/seller/seller.controler.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Crear `seller.routes.ts`**

Crear `backend/src/seller/seller.routes.ts`:

```typescript
import { Router } from 'express';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';
import { sanitizeRequestOtp, requestOtp, sanitizeVerifyOtp, verifyOtp } from './seller.controler.js';

export const sellerRouter = Router();

sellerRouter.post('/request-otp', authenticate, authorizeRoles('user'), sanitizeRequestOtp, requestOtp);
sellerRouter.post('/verify-otp',  authenticate, authorizeRoles('user'), sanitizeVerifyOtp,  verifyOtp);
```

- [ ] **Step 2: Crear `seller.controler.ts`**

Crear `backend/src/seller/seller.controler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { orm } from '../shared/db/orm.js';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import { VerificationCode } from '../verification/verificationCode.entity.js';
import { whatsAppService } from '../shared/whatsapp.js';
import { AuthRequest } from '../shared/middleware/auth.js';

const PHONE_REGEX = /^\+54 9 \d{4} \d{4}$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export function sanitizeRequestOtp(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = { phone: req.body.phone };
  if (!req.body.sanitizedInput.phone) delete req.body.sanitizedInput.phone;
  next();
}

export function sanitizeVerifyOtp(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = { phone: req.body.phone, code: req.body.code };
  if (!req.body.sanitizedInput.phone) delete req.body.sanitizedInput.phone;
  if (!req.body.sanitizedInput.code) delete req.body.sanitizedInput.code;
  next();
}

export async function requestOtp(req: AuthRequest, res: Response) {
  const em = orm.em.fork();
  try {
    const user = req.actor as User;
    const { phone } = req.body.sanitizedInput;

    if (!phone) {
      return res.status(400).json({ message: 'El campo phone es requerido' });
    }

    const existingVendedor = await em.findOne(Vendedor, { user });
    if (existingVendedor) {
      return res.status(409).json({ message: 'Ya tenés un perfil de vendedor activo' });
    }

    if (!user.is_email_verified) {
      return res.status(403).json({ message: 'Necesitás verificar tu email antes de activar tu cuenta de vendedor' });
    }

    if (!PHONE_REGEX.test(phone)) {
      return res.status(400).json({ message: 'Formato de teléfono inválido. Usá: +54 9 XXXX XXXX' });
    }

    const phoneTaken = await em.findOne(Vendedor, { telefono: phone });
    if (phoneTaken) {
      return res.status(409).json({ message: 'Ese número de teléfono ya está en uso por otra cuenta' });
    }

    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
    const recentCodes = await em.count(VerificationCode, {
      user,
      purpose: 'seller_upgrade',
      createdAt: { $gt: oneHourAgo },
    });
    if (recentCodes >= RATE_LIMIT_MAX) {
      return res.status(429).json({ message: 'Demasiados intentos. Esperá una hora antes de pedir otro código' });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const codeHash = hashCode(otp);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    em.create(VerificationCode, { user, codeHash, purpose: 'seller_upgrade', expiresAt, used: false });
    await em.flush();

    await whatsAppService.send(phone, otp);

    res.status(200).json({ message: 'Código enviado por WhatsApp. Tenés 10 minutos para ingresarlo.' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function verifyOtp(req: AuthRequest, res: Response) {
  const em = orm.em.fork();
  try {
    const user = req.actor as User;
    const { phone, code } = req.body.sanitizedInput;

    if (!phone || !code) {
      return res.status(400).json({ message: 'phone y code son requeridos' });
    }

    const vc = await em.findOne(VerificationCode, {
      user,
      used: false,
      purpose: 'seller_upgrade',
      expiresAt: { $gt: new Date() },
    }, { orderBy: { createdAt: 'DESC' } });

    if (!vc) {
      return res.status(400).json({ message: 'No hay un código válido. Solicitá uno nuevo.' });
    }

    const isTestBypass = process.env.WHATSAPP_TEST_MODE === 'true' && code === '123456';
    if (!isTestBypass && hashCode(code) !== vc.codeHash) {
      return res.status(400).json({ message: 'Código incorrecto' });
    }

    const freshUser = await em.findOne(User, { id: user.id });
    if (!freshUser) return res.status(404).json({ message: 'Usuario no encontrado' });

    freshUser.is_phone_verified = true;
    vc.used = true;

    const vendedor = em.create(Vendedor, {
      user: freshUser,
      nombre: freshUser.username,
      telefono: phone,
    });

    await em.flush();

    const token = jwt.sign(
      { userId: freshUser.id, role: 'vendedor' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: '¡Perfil de vendedor activado con éxito!',
      token,
      role: 'vendedor',
      data: { ...vendedor, id: vendedor.id, email: freshUser.email },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
```

- [ ] **Step 3: Registrar el router en `app.ts`**

En `backend/src/app.ts`, agregar el import después de los imports de routers existentes:

```typescript
import { sellerRouter } from "./seller/seller.routes.js";
```

Y agregar la ruta antes del 404 fallback:

```typescript
app.use("/api/seller", sellerRouter);
```

- [ ] **Step 4: Verificar compilación y endpoints**

```bash
cd backend
pnpm start:dev
```

Probar request-otp (para un user con is_email_verified=true — setearlo manualmente en psql primero):

```bash
psql postgresql://postgres:post1234@localhost:5432/heroclash_dsw \
  -c "UPDATE \"user\" SET is_email_verified = true WHERE id = <user_id>;"
```

```bash
# Primero hacer login para obtener el token del user (rol='user'):
TOKEN=$(curl -s -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<email>","password":"<pass>"}' | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).token))")

# Pedir OTP:
curl -X POST http://localhost:3000/api/seller/request-otp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone":"+54 9 1122 3344"}'
```

Expected: `{ "message": "Código enviado por WhatsApp. Tenés 10 minutos para ingresarlo." }` y en consola del backend: `[WhatsApp TEST] OTP para +54 9 1122 3344: XXXXXX`

```bash
# Verificar OTP con código mágico de test:
curl -X POST http://localhost:3000/api/seller/verify-otp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"phone":"+54 9 1122 3344","code":"123456"}'
```

Expected: `{ "message": "¡Perfil de vendedor activado con éxito!", "token": "...", "role": "vendedor", "data": {...} }`

- [ ] **Step 5: Commit**

```bash
git add backend/src/seller/seller.routes.ts backend/src/seller/seller.controler.ts backend/src/app.ts
git commit -m "feat: add seller upgrade module with WhatsApp OTP flow"
```

---

## Task 12: Actualizar el UserContext del frontend

**Files:**
- Modify: `vite-project/vite-project-ts/src/context/user.tsx`

- [ ] **Step 1: Actualizar la interfaz `User`**

En `vite-project/vite-project-ts/src/context/user.tsx`, actualizar la interfaz `User`:

```typescript
export interface User {
  id?: number
  name: string
  email: string
  password: string
  role?: string
  is_email_verified?: boolean
  is_phone_verified?: boolean
  direcciones?: Direccion[]
  token?: string
}
```

- [ ] **Step 2: Agregar `upgradeToSeller` en el contexto**

En la interfaz `UserContextType`, agregar:

```typescript
upgradeToSeller: (token: string, vendedorData: Partial<User>) => void
```

En `UserProvider`, agregar la función después de `updateUser`:

```typescript
const upgradeToSeller = (token: string, vendedorData: Partial<User>) => {
  if (!user) return
  const upgraded = { ...user, ...vendedorData, token, role: 'vendedor' }
  setUser(upgraded)
  localStorage.setItem('user', JSON.stringify(upgraded))
}
```

Agregar `upgradeToSeller` al `value` del Provider:

```typescript
return (
  <UserContext.Provider value={{ user, login, logout, updateUser, upgradeToSeller, addDireccion, removeDireccion, loadDirecciones, getAuthHeaders }}>
    {children}
  </UserContext.Provider>
)
```

- [ ] **Step 3: Verificar que TypeScript compila**

```bash
cd vite-project/vite-project-ts
pnpm run build
```

Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/context/user.tsx
git commit -m "feat: add upgradeToSeller and verification flags to UserContext"
```

---

## Task 13: Crear el componente `SellerOnboarding`

**Files:**
- Create: `vite-project/vite-project-ts/src/components/SellerOnboarding.tsx`

- [ ] **Step 1: Crear el componente**

Crear `vite-project/vite-project-ts/src/components/SellerOnboarding.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import { useUser } from '../context/user'
import { api } from '../services/api'

type Step = 'IDLE' | 'EMAIL_GATE' | 'PHONE_INPUT' | 'OTP_INPUT' | 'SUCCESS'

export default function SellerOnboarding() {
  const { user, upgradeToSeller } = useUser()
  const [step, setStep] = useState<Step>('IDLE')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (secondsLeft <= 0 || step !== 'OTP_INPUT') return
    timerRef.current = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [secondsLeft, step])

  if (!user || user.role !== 'user') return null

  function startFlow() {
    if (!user?.is_email_verified) {
      setStep('EMAIL_GATE')
    } else {
      setStep('PHONE_INPUT')
    }
  }

  async function sendOtp() {
    setError('')
    setLoading(true)
    try {
      await api.post('/api/seller/request-otp', { phone })
      setStep('OTP_INPUT')
      setSecondsLeft(60)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al enviar el código')
    } finally {
      setLoading(false)
    }
  }

  async function resendOtp() {
    setError('')
    setLoading(true)
    try {
      await api.post('/api/seller/request-otp', { phone })
      setSecondsLeft(60)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al reenviar el código')
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/seller/verify-otp', { phone, code })
      upgradeToSeller(res.data.token, {
        id: res.data.data?.id,
        name: res.data.data?.nombre || user?.name,
        email: res.data.data?.email || user?.email,
        is_phone_verified: true,
      })
      setStep('SUCCESS')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Código incorrecto o expirado')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'IDLE') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">¿Querés vender cartas?</h2>
        <p className="text-sm text-gray-500 mb-4">Activá tu cuenta de vendedor verificando tu número de WhatsApp.</p>
        <button
          onClick={startFlow}
          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
        >
          Quiero vender
        </button>
      </div>
    )
  }

  if (step === 'EMAIL_GATE') {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-amber-800 mb-1">Verificá tu email primero</h2>
        <p className="text-sm text-amber-700">
          Para activar tu cuenta de vendedor necesitás tener el email verificado.
          Revisá tu casilla de correo y seguí el enlace de verificación.
        </p>
      </div>
    )
  }

  if (step === 'PHONE_INPUT') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Verificá tu WhatsApp</h2>
        <p className="text-sm text-gray-500 mb-4">Ingresá tu número para recibir el código de activación.</p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
        <input
          type="tel"
          placeholder="+54 9 1122 3344"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <button
          onClick={sendOtp}
          disabled={loading || !phone}
          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Enviando...' : 'Enviar código'}
        </button>
      </div>
    )
  }

  if (step === 'OTP_INPUT') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Ingresá el código</h2>
        <p className="text-sm text-gray-500 mb-4">
          Te enviamos un código de 6 dígitos por WhatsApp a {phone}.
        </p>
        <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
        <input
          type="text"
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-green-500 tracking-widest text-center text-xl"
        />
        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
        <div className="flex gap-3 items-center">
          <button
            onClick={verifyOtp}
            disabled={loading || code.length !== 6}
            className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Verificando...' : 'Confirmar'}
          </button>
          <button
            onClick={resendOtp}
            disabled={loading || secondsLeft > 0}
            className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
          >
            {secondsLeft > 0 ? `Reenviar en ${secondsLeft}s` : 'Reenviar código'}
          </button>
        </div>
      </div>
    )
  }

  if (step === 'SUCCESS') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-green-800 mb-1">¡Cuenta de vendedor activada!</h2>
        <p className="text-sm text-green-700 mb-4">Ya podés publicar cartas en HeroClash.</p>
        <a
          href="/publicar"
          className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors inline-block"
        >
          Publicar mi primera carta
        </a>
      </div>
    )
  }

  return null
}
```

- [ ] **Step 2: Verificar que TypeScript compila**

```bash
cd vite-project/vite-project-ts
pnpm run build
```

Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vite-project/vite-project-ts/src/components/SellerOnboarding.tsx
git commit -m "feat: add SellerOnboarding component with WhatsApp OTP flow"
```

---

## Task 14: Integrar `SellerOnboarding` en `UserProfilePage`

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/UserProfilePage.tsx`

- [ ] **Step 1: Agregar el import**

En `vite-project/vite-project-ts/src/pages/UserProfilePage.tsx`, agregar al inicio junto a los otros imports:

```typescript
import SellerOnboarding from '../components/SellerOnboarding'
```

- [ ] **Step 2: Renderizar el componente**

Dentro del JSX de la página, antes del primer bloque de información del usuario (o al comienzo del contenido principal), agregar:

```tsx
<SellerOnboarding />
```

El componente ya maneja internamente la condición `user.role === 'user'` para no mostrarse si ya es vendedor.

- [ ] **Step 3: Verificar en el browser**

1. Iniciar frontend: `cd vite-project/vite-project-ts && pnpm run dev`
2. Loguearse como un user con `role: 'user'`
3. Navegar a `/perfil` (o la ruta de UserProfilePage)
4. Expected: se muestra el bloque "¿Querés vender cartas?" con el botón "Quiero vender"
5. Hacer clic → si `is_email_verified = false`, muestra el mensaje de EMAIL_GATE
6. Setear `is_email_verified = true` manualmente en psql, re-loguearse
7. Hacer clic → se muestra el input de teléfono
8. Ingresar `+54 9 1122 3344` → click "Enviar código"
9. En la consola del backend: `[WhatsApp TEST] OTP para +54 9 1122 3344: XXXXXX`
10. Ingresar `123456` → click "Confirmar"
11. Expected: mensaje de éxito, el header debe actualizarse mostrando que ahora es vendedor

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/UserProfilePage.tsx
git commit -m "feat: integrate SellerOnboarding into UserProfilePage"
```

---

## Verificación Final

- [ ] Un User con `is_email_verified=false` ve el mensaje de EMAIL_GATE al intentar el upgrade.
- [ ] Un User con `is_email_verified=true` puede pedir un OTP.
- [ ] El backend imprime el OTP en consola (TEST_MODE).
- [ ] El código `123456` es aceptado como válido en TEST_MODE.
- [ ] El mismo teléfono no puede registrarse en dos cuentas (el segundo intento da 409).
- [ ] Más de 3 intentos en 1 hora devuelve 429.
- [ ] Un Vendedor migrado puede loguearse con `POST /api/users/login` y recibe `role: 'vendedor'` en la respuesta.
- [ ] Con el token de vendedor, `GET /api/vendedores/:id/ventas` funciona.
- [ ] `POST /api/vendedores/` (registro directo) devuelve 410.
- [ ] `POST /api/vendedores/login` devuelve 410.
