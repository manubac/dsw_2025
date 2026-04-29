# Store Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an invite-only store registration page at `/register-store?token=<uuid>` that creates a User + Vendedor after verifying email and phone (WhatsApp) with hardcoded code `123456`.

**Architecture:** A `StoreInvite` DB record tracks `emailVerified` / `phoneVerified` booleans; each verification endpoint updates the record; the `/complete` endpoint checks both flags then atomically creates User + Vendedor and marks the invite as used. The admin endpoint `POST /api/admin/store-invite` generates single-use invite links protected by an `x-admin-key` header.

**Tech Stack:** TypeScript, Express, MikroORM (PostgreSQL), React 18, Tailwind CSS, Vite, axios, React Router v6.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `backend/src/vendedor/vendedores.entity.ts` | Add `direccion`, `piso`, `departamento` fields |
| Create | `backend/src/storeRegister/storeInvite.entity.ts` | `StoreInvite` MikroORM entity |
| Modify | `backend/src/shared/db/orm.ts` | Register `StoreInvite` in entities list |
| Create | `backend/src/storeRegister/storeRegister.controller.ts` | All store-register endpoint handlers |
| Create | `backend/src/storeRegister/storeRegister.routes.ts` | Route definitions for `/api/store-register/*` |
| Create | `backend/src/admin/admin.routes.ts` | `POST /api/admin/store-invite` |
| Modify | `backend/src/app.ts` | Mount both new routers |
| Create | `backend/src/storeRegister/__tests__/storeRegister.test.ts` | Unit tests for pure validation helpers |
| Create | `vite-project/vite-project-ts/src/pages/StoreRegistrationPage.tsx` | 4-step wizard page |
| Modify | `vite-project/vite-project-ts/src/App.tsx` | Add public `/register-store` route |

---

## Task 1: Extend Vendedor entity with address fields

**Files:**
- Modify: `backend/src/vendedor/vendedores.entity.ts`

- [ ] **Step 1: Open `vendedores.entity.ts` and add three nullable fields after `descripcionCompra`**

```typescript
// backend/src/vendedor/vendedores.entity.ts
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

    @Property({ type: 'text', nullable: true })
    descripcionCompra?: string

    @Property({ type: 'string', nullable: true })
    direccion?: string

    @Property({ type: 'string', nullable: true })
    piso?: string

    @Property({ type: 'string', nullable: true })
    departamento?: string

    @OneToMany(() => ItemCarta, (itemCarta) => itemCarta.uploaderVendedor)
    itemCartas = new Collection<ItemCarta>(this)

    @ManyToMany(() => TiendaRetiro, undefined, { owner: true })
    tiendasRetiro = new Collection<TiendaRetiro>(this)
}
```

- [ ] **Step 2: Start the backend dev server to verify schema sync runs without errors**

```bash
cd backend
pnpm dev
```

Expected: console prints "Esquema de la base actualizado (dev)." with no errors. The `vendedor` table gains `direccion`, `piso`, `departamento` columns.

- [ ] **Step 3: Stop dev server (Ctrl+C) and commit**

```bash
git add backend/src/vendedor/vendedores.entity.ts
git commit -m "feat(vendedor): add direccion, piso, departamento nullable fields"
```

---

## Task 2: Create StoreInvite entity and register in ORM

**Files:**
- Create: `backend/src/storeRegister/storeInvite.entity.ts`
- Modify: `backend/src/shared/db/orm.ts`

- [ ] **Step 1: Create the entity file**

```typescript
// backend/src/storeRegister/storeInvite.entity.ts
import { Entity, Property } from '@mikro-orm/core';
import { BaseEntity } from '../shared/db/baseEntity.js';

@Entity()
export class StoreInvite extends BaseEntity {
  @Property({ type: 'string', unique: true })
  token!: string;

  @Property({ type: 'boolean', default: false })
  used!: boolean;

  @Property({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Property({ type: 'boolean', default: false })
  phoneVerified!: boolean;
}
```

- [ ] **Step 2: Register StoreInvite in `orm.ts`**

Add the import at the top alongside the other entity imports:
```typescript
import { StoreInvite } from "../../storeRegister/storeInvite.entity.js"
```

Add `StoreInvite` to the `entities` array:
```typescript
entities: [Carta, CartaClass, ItemCarta, Compra, Vendedor, User, Direccion, Intermediario, Envio, Valoracion, StagePokemon, Mensaje, Wishlist, VerificationCode, StoreInvite],
```

- [ ] **Step 3: Start dev server to verify new table is created**

```bash
cd backend
pnpm dev
```

Expected: "Esquema de la base actualizado (dev)." — `store_invite` table appears in the DB.

- [ ] **Step 4: Stop dev server and commit**

```bash
git add backend/src/storeRegister/storeInvite.entity.ts backend/src/shared/db/orm.ts
git commit -m "feat(storeRegister): add StoreInvite entity"
```

---

## Task 3: Write unit tests for pure validation helpers

**Files:**
- Create: `backend/src/storeRegister/__tests__/storeRegister.test.ts`

The controller will expose two pure helpers: `isValidPhone(phone: string): boolean` and `isHardcodedCode(code: string): boolean`. Test these before implementing.

- [ ] **Step 1: Create the test file**

```typescript
// backend/src/storeRegister/__tests__/storeRegister.test.ts
import { isValidPhone, isHardcodedCode } from '../storeRegister.controller.js';

describe('isValidPhone', () => {
  it('accepts +54 9 XXXX XXXX format', () => {
    expect(isValidPhone('+54 9 1234 5678')).toBe(true);
  });

  it('rejects missing country code', () => {
    expect(isValidPhone('1234 5678')).toBe(false);
  });

  it('rejects wrong digit count', () => {
    expect(isValidPhone('+54 9 123 456')).toBe(false);
  });

  it('rejects letters', () => {
    expect(isValidPhone('+54 9 abcd efgh')).toBe(false);
  });
});

describe('isHardcodedCode', () => {
  it('accepts 123456', () => {
    expect(isHardcodedCode('123456')).toBe(true);
  });

  it('rejects any other value', () => {
    expect(isHardcodedCode('654321')).toBe(false);
    expect(isHardcodedCode('')).toBe(false);
    expect(isHardcodedCode('000000')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests — expect FAIL (controller not created yet)**

```bash
cd backend
pnpm jest src/storeRegister/__tests__/storeRegister.test.ts
```

Expected: FAIL — "Cannot find module '../storeRegister.controller.js'"

---

## Task 4: Create store-register controller

**Files:**
- Create: `backend/src/storeRegister/storeRegister.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// backend/src/storeRegister/storeRegister.controller.ts
import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { StoreInvite } from './storeInvite.entity.js';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function isValidPhone(phone: string): boolean {
  return /^\+54 9 \d{4} \d{4}$/.test(phone);
}

export function isHardcodedCode(code: string): boolean {
  return code === '123456';
}

async function getValidInvite(token: string, em: ReturnType<typeof orm.em.fork>) {
  if (!token) return null;
  return em.findOne(StoreInvite, { token, used: false });
}

export async function validateToken(req: Request, res: Response) {
  try {
    const token = req.query.token as string;
    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);
    if (!invite) return res.status(400).json({ valid: false, message: 'Token inválido o ya utilizado' });
    res.json({ valid: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token, code } = req.body;
    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);
    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!isHardcodedCode(code)) return res.status(400).json({ message: 'Código de email incorrecto' });
    invite.emailVerified = true;
    await em.flush();
    res.json({ message: 'Email verificado' });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function verifyPhone(req: Request, res: Response) {
  try {
    const { token, code } = req.body;
    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);
    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!isHardcodedCode(code)) return res.status(400).json({ message: 'Código de WhatsApp incorrecto' });
    invite.phoneVerified = true;
    await em.flush();
    res.json({ message: 'Teléfono verificado' });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function completeRegistration(req: Request, res: Response) {
  try {
    const {
      token, nombreTienda, email, password, telefono,
      ciudad, direccion, piso, departamento, alias, cbu, descripcion,
    } = req.body;

    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);

    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!invite.emailVerified) return res.status(403).json({ message: 'Email no verificado' });
    if (!invite.phoneVerified) return res.status(403).json({ message: 'Teléfono no verificado' });

    if (!nombreTienda || !email || !password || !telefono) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    if (!isValidPhone(telefono)) {
      return res.status(400).json({ message: 'Formato de teléfono inválido. Usá +54 9 XXXX XXXX' });
    }

    const existingUser = await em.findOne(User, { email });
    if (existingUser) return res.status(409).json({ message: 'El email ya está registrado' });

    const existingVendedor = await em.findOne(Vendedor, { nombre: nombreTienda });
    if (existingVendedor) return res.status(409).json({ message: 'El nombre de tienda ya está en uso' });

    const existingPhone = await em.findOne(Vendedor, { telefono });
    if (existingPhone) return res.status(409).json({ message: 'El teléfono ya está en uso' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = em.create(User, {
      username: nombreTienda,
      email,
      password: hashedPassword,
      is_email_verified: true,
      is_phone_verified: true,
    });

    const vendedor = em.create(Vendedor, {
      user,
      nombre: nombreTienda,
      telefono,
      ciudad: ciudad || undefined,
      direccion: direccion || undefined,
      piso: piso || undefined,
      departamento: departamento || undefined,
      alias: alias || undefined,
      cbu: cbu || undefined,
      descripcionCompra: descripcion || undefined,
    });

    invite.used = true;
    await em.flush();

    const jwtToken = jwt.sign(
      { userId: user.id, role: 'vendedor' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Cuenta de vendedor creada',
      token: jwtToken,
      role: 'vendedor',
      data: {
        id: user.id,
        name: user.username,
        email: user.email,
        is_email_verified: true,
        is_phone_verified: true,
        vendedorId: vendedor.id,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 2: Run unit tests — expect PASS**

```bash
cd backend
pnpm jest src/storeRegister/__tests__/storeRegister.test.ts
```

Expected: 7 tests PASS (`isValidPhone` × 4, `isHardcodedCode` × 3).

- [ ] **Step 3: Commit**

```bash
git add backend/src/storeRegister/storeRegister.controller.ts backend/src/storeRegister/__tests__/storeRegister.test.ts
git commit -m "feat(storeRegister): add controller with validation helpers and tests"
```

---

## Task 5: Create store-register routes

**Files:**
- Create: `backend/src/storeRegister/storeRegister.routes.ts`

- [ ] **Step 1: Create the routes file**

```typescript
// backend/src/storeRegister/storeRegister.routes.ts
import { Router } from 'express';
import { validateToken, verifyEmail, verifyPhone, completeRegistration } from './storeRegister.controller.js';

export const storeRegisterRouter = Router();

storeRegisterRouter.get('/validate', validateToken);
storeRegisterRouter.post('/verify-email', verifyEmail);
storeRegisterRouter.post('/verify-phone', verifyPhone);
storeRegisterRouter.post('/complete', completeRegistration);
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/storeRegister/storeRegister.routes.ts
git commit -m "feat(storeRegister): add routes"
```

---

## Task 6: Create admin routes (invite generation)

**Files:**
- Create: `backend/src/admin/admin.routes.ts`

- [ ] **Step 1: Create the admin router**

```typescript
// backend/src/admin/admin.routes.ts
import { Router, Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { StoreInvite } from '../storeRegister/storeInvite.entity.js';
import { randomUUID } from 'crypto';

export const adminRouter = Router();

adminRouter.post('/store-invite', async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_SECRET ?? 'admin123';

    if (adminKey !== expectedKey) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const em = orm.em.fork();
    const token = randomUUID();
    em.create(StoreInvite, { token, used: false, emailVerified: false, phoneVerified: false });
    await em.flush();

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const link = `${frontendUrl}/register-store?token=${token}`;

    res.status(201).json({ link, token });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/admin/admin.routes.ts
git commit -m "feat(admin): add store-invite generation endpoint"
```

---

## Task 7: Mount new routers in app.ts

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Add imports for the two new routers** (add after the existing `sellerRouter` import line):

```typescript
import { storeRegisterRouter } from './storeRegister/storeRegister.routes.js';
import { adminRouter } from './admin/admin.routes.js';
```

- [ ] **Step 2: Mount the routers** (add after the `app.use("/api/seller", sellerRouter);` line):

```typescript
app.use("/api/store-register", storeRegisterRouter);
app.use("/api/admin", adminRouter);
```

- [ ] **Step 3: Start the backend and verify all routes are reachable**

```bash
cd backend
pnpm dev
```

Then in a separate terminal, test:

```bash
# Should return { valid: false } (no token)
curl http://localhost:3000/api/store-register/validate

# Should return 401
curl -X POST http://localhost:3000/api/admin/store-invite

# Should return { link, token }
curl -X POST http://localhost:3000/api/admin/store-invite -H "x-admin-key: admin123"
```

Expected: all three respond without 404.

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.ts
git commit -m "feat(app): mount storeRegister and admin routers"
```

---

## Task 8: Manual backend end-to-end test

No new files — uses `.http` file pattern already established in the project.

- [ ] **Step 1: Create a temporary HTTP test file**

```
// backend/src/storeRegister/storeRegister.http

### Generate invite
POST http://localhost:3000/api/admin/store-invite
x-admin-key: admin123

### Validate token (replace TOKEN with value from previous response)
GET http://localhost:3000/api/store-register/validate?token=TOKEN

### Verify email (wrong code — expect 400)
POST http://localhost:3000/api/store-register/verify-email
Content-Type: application/json

{ "token": "TOKEN", "code": "999999" }

### Verify email (correct code)
POST http://localhost:3000/api/store-register/verify-email
Content-Type: application/json

{ "token": "TOKEN", "code": "123456" }

### Verify phone (correct code)
POST http://localhost:3000/api/store-register/verify-phone
Content-Type: application/json

{ "token": "TOKEN", "code": "123456" }

### Complete registration
POST http://localhost:3000/api/store-register/complete
Content-Type: application/json

{
  "token": "TOKEN",
  "nombreTienda": "Tienda Test",
  "email": "tienda@test.com",
  "password": "test123",
  "telefono": "+54 9 1234 5678",
  "ciudad": "Rosario",
  "direccion": "San Martín 1234",
  "piso": "2",
  "departamento": "B",
  "alias": "tiendatest",
  "cbu": "0000000000000000000000",
  "descripcion": "Descripción de prueba"
}
```

- [ ] **Step 2: Run each request in order and verify**

Expected results:
- `store-invite` → `{ link: "...register-store?token=<uuid>", token: "<uuid>" }`
- `validate` (with token) → `{ valid: true }`
- `verify-email` (wrong code) → 400 `{ message: "Código de email incorrecto" }`
- `verify-email` (correct) → 200 `{ message: "Email verificado" }`
- `verify-phone` (correct) → 200 `{ message: "Teléfono verificado" }`
- `complete` → 201 `{ message: "Cuenta de vendedor creada", token: "...", data: { ... } }`
- Second `validate` with same token → `{ valid: false }` (token now used)

- [ ] **Step 3: Commit the HTTP test file**

```bash
git add backend/src/storeRegister/storeRegister.http
git commit -m "test(storeRegister): add manual HTTP test file"
```

---

## Task 9: Frontend — StoreRegistrationPage

**Files:**
- Create: `vite-project/vite-project-ts/src/pages/StoreRegistrationPage.tsx`

This is a 4-step wizard. The `CityPicker` component is copied inline from `UserRegistration.tsx` (it's not exported from there).

- [ ] **Step 1: Create the page file**

```tsx
// vite-project/vite-project-ts/src/pages/StoreRegistrationPage.tsx
import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import { fetchApi } from '../services/api';

// ── CityPicker (same as UserRegistration.tsx) ──────────────────────────────
interface GeorefMunicipio {
  id: string;
  nombre: string;
  provincia: { nombre: string };
}

function CityPicker({ value, onChange }: { value: string; onChange: (city: string, province: string) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeorefMunicipio[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://apis.datos.gob.ar/georef/api/municipios?nombre=${encodeURIComponent(q)}&max=8&campos=id,nombre,provincia&orden=nombre`
        );
        const data = await res.json();
        setResults(data.municipios || []);
        setOpen(true);
      } catch { setResults([]); } finally { setLoading(false); }
    }, 300);
  };

  const select = (m: GeorefMunicipio) => {
    setQuery(`${m.nombre}, ${m.provincia.nombre}`);
    setOpen(false);
    onChange(m.nombre, m.provincia.nombre);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text" value={query} onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Ej: Rosario, Córdoba, La Plata..." autoComplete="off"
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition pr-8"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {results.map(m => (
            <li key={m.id} onMouseDown={() => select(m)}
              className="px-4 py-2.5 hover:bg-slate-50 cursor-pointer text-sm flex items-center gap-2 transition">
              <span className="font-medium text-gray-800">{m.nombre}</span>
              <span className="text-gray-400 text-xs">{m.provincia.nombre}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────
type Step = 'LOADING' | 'INVALID' | 'FORM' | 'EMAIL_CODE' | 'PHONE_CODE' | 'SUCCESS';

interface FormData {
  nombreTienda: string;
  email: string;
  confirmEmail: string;
  password: string;
  confirmPassword: string;
  telefono: string;
  ciudad: string;
  provincia: string;
  direccion: string;
  piso: string;
  departamento: string;
  alias: string;
  cbu: string;
  descripcion: string;
}

// ── Main component ──────────────────────────────────────────────────────────
export function StoreRegistrationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useUser();
  const token = searchParams.get('token') ?? '';

  const [step, setStep] = useState<Step>('LOADING');
  const [form, setForm] = useState<FormData>({
    nombreTienda: '', email: '', confirmEmail: '', password: '',
    confirmPassword: '', telefono: '', ciudad: '', provincia: '',
    direccion: '', piso: '', departamento: '', alias: '', cbu: '', descripcion: '',
  });
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── On mount: validate token ─────────────────────────────────────────────
  useEffect(() => {
    if (!token) { setStep('INVALID'); return; }
    fetchApi(`/api/store-register/validate?token=${token}`)
      .then(r => r.json())
      .then(data => setStep(data.valid ? 'FORM' : 'INVALID'))
      .catch(() => setStep('INVALID'));
  }, [token]);

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  // ── Password strength ────────────────────────────────────────────────────
  const passwordStrength = (p: string) => {
    if (!p) return null;
    if (p.length < 6) return { label: 'Muy corta', color: 'bg-red-400', width: 'w-1/4' };
    if (p.length < 8) return { label: 'Débil', color: 'bg-orange-400', width: 'w-2/4' };
    if (!/[A-Z]/.test(p) || !/[0-9]/.test(p)) return { label: 'Media', color: 'bg-yellow-400', width: 'w-3/4' };
    return { label: 'Fuerte', color: 'bg-green-400', width: 'w-full' };
  };
  const strength = passwordStrength(form.password);

  // ── Step 1: form validation ──────────────────────────────────────────────
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.email !== form.confirmEmail) { setError('Los emails no coinciden.'); return; }
    if (form.password !== form.confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (!/^\+54 9 \d{4} \d{4}$/.test(form.telefono)) {
      setError('Formato de teléfono inválido. Usá +54 9 XXXX XXXX'); return;
    }
    setStep('EMAIL_CODE');
  };

  // ── Step 2: verify email code ────────────────────────────────────────────
  const handleEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchApi('/api/store-register/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code: emailCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep('PHONE_CODE');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: verify phone code + complete ─────────────────────────────────
  const handlePhoneCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const phoneRes = await fetchApi('/api/store-register/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code: phoneCode }),
      });
      const phoneData = await phoneRes.json();
      if (!phoneRes.ok) throw new Error(phoneData.message);

      const completeRes = await fetchApi('/api/store-register/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          nombreTienda: form.nombreTienda,
          email: form.email,
          password: form.password,
          telefono: form.telefono,
          ciudad: form.ciudad,
          direccion: form.direccion,
          piso: form.piso,
          departamento: form.departamento,
          alias: form.alias,
          cbu: form.cbu,
          descripcion: form.descripcion,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) throw new Error(completeData.message);

      login(
        {
          id: completeData.data.id,
          name: completeData.data.name,
          email: completeData.data.email,
          password: '',
          role: 'vendedor',
          is_email_verified: true,
          is_phone_verified: true,
        },
        completeData.token
      );
      setStep('SUCCESS');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Shared input class ───────────────────────────────────────────────────
  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm transition disabled:opacity-50';

  // ── Render ───────────────────────────────────────────────────────────────
  if (step === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Validando invitación...</p>
      </div>
    );
  }

  if (step === 'INVALID') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link inválido</h1>
          <p className="text-gray-500 text-sm">Este link de registro no es válido o ya fue utilizado.</p>
        </div>
      </div>
    );
  }

  if (step === 'SUCCESS') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Cuenta creada!</h1>
          <p className="text-gray-500 text-sm mb-6">Tu cuenta de vendedor fue creada exitosamente.</p>
          <button
            onClick={() => navigate('/mi-perfil')}
            className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition text-sm"
          >
            Ir a mi perfil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">HeroClash</h1>
          <p className="text-gray-500 mt-1 text-sm">Registro de tienda vendedora</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

          {/* ── Step indicator ── */}
          <div className="flex items-center gap-2 mb-6">
            {(['FORM', 'EMAIL_CODE', 'PHONE_CODE'] as const).map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${
                step === s || (i === 0 && step === 'FORM') ||
                (i === 1 && step === 'EMAIL_CODE') ||
                (i === 2 && step === 'PHONE_CODE')
                  ? 'bg-primary'
                  : ['FORM', 'EMAIL_CODE', 'PHONE_CODE'].indexOf(step) > i
                    ? 'bg-primary'
                    : 'bg-gray-200'
              }`} />
            ))}
          </div>

          {/* ── FORM step ── */}
          {step === 'FORM' && (
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Datos de la tienda</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre de tienda</label>
                <input type="text" value={form.nombreTienda} onChange={set('nombreTienda')} required disabled={loading} placeholder="Ej: Cartas del Sur" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={set('email')} required disabled={loading} placeholder="tienda@ejemplo.com" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar email</label>
                <input
                  type="email" value={form.confirmEmail} onChange={set('confirmEmail')} required disabled={loading} placeholder="Repetí el email"
                  className={`${inputCls} ${form.confirmEmail && form.confirmEmail !== form.email ? 'border-red-300 focus:border-red-400' : ''}`}
                />
                {form.confirmEmail && form.confirmEmail !== form.email && (
                  <p className="text-xs text-red-500 mt-1">Los emails no coinciden</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                <input type="password" value={form.password} onChange={set('password')} required disabled={loading} placeholder="Mínimo 6 caracteres" className={inputCls} />
                {strength && (
                  <div className="mt-2 space-y-1">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`} />
                    </div>
                    <p className="text-xs text-gray-400">{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmar contraseña</label>
                <input
                  type="password" value={form.confirmPassword} onChange={set('confirmPassword')} required disabled={loading} placeholder="Repetí la contraseña"
                  className={`${inputCls} ${form.confirmPassword && form.confirmPassword !== form.password ? 'border-red-300 focus:border-red-400' : ''}`}
                />
                {form.confirmPassword && form.confirmPassword !== form.password && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Teléfono <span className="text-gray-400 font-normal">(WhatsApp)</span></label>
                <input type="text" value={form.telefono} onChange={set('telefono')} required disabled={loading} placeholder="+54 9 XXXX XXXX" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Localidad <span className="text-gray-400 font-normal">(Argentina)</span></label>
                <CityPicker
                  value={form.ciudad}
                  onChange={(city, province) => setForm(prev => ({ ...prev, ciudad: city, provincia: province }))}
                />
                {form.provincia && <p className="text-xs text-gray-400 mt-1">{form.provincia}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección</label>
                <input type="text" value={form.direccion} onChange={set('direccion')} required disabled={loading} placeholder="Ej: San Martín 1234" className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Piso <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input type="text" value={form.piso} onChange={set('piso')} disabled={loading} placeholder="Ej: 2" className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Departamento <span className="text-gray-400 font-normal">(opcional)</span></label>
                  <input type="text" value={form.departamento} onChange={set('departamento')} disabled={loading} placeholder="Ej: B" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alias <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={form.alias} onChange={set('alias')} disabled={loading} placeholder="Ej: tiendacartas" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CBU <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input type="text" value={form.cbu} onChange={set('cbu')} disabled={loading} placeholder="22 dígitos" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                <textarea value={form.descripcion} onChange={set('descripcion')} disabled={loading} rows={3} placeholder="Describí tu tienda..." className={`${inputCls} resize-none`} />
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

              <button type="submit" disabled={loading} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm mt-2">
                Continuar
              </button>
            </form>
          )}

          {/* ── EMAIL_CODE step ── */}
          {step === 'EMAIL_CODE' && (
            <form onSubmit={handleEmailCode} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Verificación de email</h2>
              <p className="text-sm text-gray-500">Ingresá el código enviado a <span className="font-medium text-gray-700">{form.email}</span>.</p>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">En modo testing, el código es siempre <strong>123456</strong>.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de 6 dígitos</label>
                <input
                  type="text" value={emailCode} onChange={e => setEmailCode(e.target.value)}
                  maxLength={6} required disabled={loading} placeholder="123456"
                  className={`${inputCls} tracking-widest text-center text-lg`}
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading || emailCode.length !== 6} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm">
                {loading ? 'Verificando...' : 'Verificar email'}
              </button>
              <button type="button" onClick={() => { setStep('FORM'); setError(null); }} className="w-full text-sm text-gray-400 hover:text-gray-600 mt-1">
                Volver
              </button>
            </form>
          )}

          {/* ── PHONE_CODE step ── */}
          {step === 'PHONE_CODE' && (
            <form onSubmit={handlePhoneCode} className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Verificación de WhatsApp</h2>
              <p className="text-sm text-gray-500">Ingresá el código enviado por WhatsApp a <span className="font-medium text-gray-700">{form.telefono}</span>.</p>
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">En modo testing, el código es siempre <strong>123456</strong>.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Código de 6 dígitos</label>
                <input
                  type="text" value={phoneCode} onChange={e => setPhoneCode(e.target.value)}
                  maxLength={6} required disabled={loading} placeholder="123456"
                  className={`${inputCls} tracking-widest text-center text-lg`}
                />
              </div>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}
              <button type="submit" disabled={loading || phoneCode.length !== 6} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm">
                {loading ? 'Creando cuenta...' : 'Verificar y crear cuenta'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/StoreRegistrationPage.tsx
git commit -m "feat(frontend): add StoreRegistrationPage 4-step wizard"
```

---

## Task 10: Add route in App.tsx

**Files:**
- Modify: `vite-project/vite-project-ts/src/App.tsx`

- [ ] **Step 1: Add the import** (alongside the other page imports at the top of App.tsx):

```typescript
import { StoreRegistrationPage } from './pages/StoreRegistrationPage';
```

- [ ] **Step 2: Add the route** (alongside the other auth routes — after the `register` route):

```tsx
<Route path="register-store" element={<StoreRegistrationPage />} />
```

- [ ] **Step 3: Start the frontend dev server and verify the page loads**

```bash
cd vite-project/vite-project-ts
pnpm dev
```

Then:
1. In a separate terminal, generate an invite: `curl -X POST http://localhost:3000/api/admin/store-invite -H "x-admin-key: admin123"`
2. Copy the `token` from the response
3. Open `http://localhost:5173/register-store?token=<TOKEN>` in the browser
4. Verify the form renders (Step 1)
5. Fill all required fields, click "Continuar"
6. Enter `123456` for email code → verify Step 3 appears
7. Enter `123456` for WhatsApp code → verify success screen appears
8. Verify redirect to `/mi-perfil` works and user is logged in as vendedor
9. Try the same token again → verify "Link inválido" screen appears

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/App.tsx
git commit -m "feat(router): add /register-store public route"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| StoreInvite entity with token, used, emailVerified, phoneVerified | Task 2 |
| POST /api/admin/store-invite with x-admin-key | Task 6 |
| GET /api/store-register/validate | Task 4 + 5 |
| POST /api/store-register/verify-email (hardcoded 123456) | Task 4 + 5 |
| POST /api/store-register/verify-phone (hardcoded 123456) | Task 4 + 5 |
| POST /api/store-register/complete → creates User + Vendedor, marks token used | Task 4 + 5 |
| Vendedor gets direccion, piso, departamento | Task 1 |
| Frontend wizard: LOADING, INVALID, FORM, EMAIL_CODE, PHONE_CODE, SUCCESS | Task 9 |
| CityPicker for localidad | Task 9 |
| Auto-login after complete | Task 9 |
| Public route /register-store | Task 10 |
| Token validated on page mount | Task 9 |
| Testing notes (amber banners, 123456) | Task 9 |

All spec requirements are covered. No placeholders or TBDs present.
