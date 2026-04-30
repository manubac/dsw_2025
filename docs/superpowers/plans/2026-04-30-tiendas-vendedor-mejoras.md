# Tiendas y Vendedor — Mejoras de Registro, Perfiles y Página Pública

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar horarios estructurados obligatorios al registro de tiendas, hacer CBU/alias obligatorios al convertirse en vendedor (paso inmediato post-OTP), crear la página pública `/tienda/:id` con mapa/publicaciones/valoraciones, y agregar filtros + scroll propio a la página pública del vendedor.

**Architecture:** Cuatro cambios independientes. (1) `HorarioSemanal` como `jsonb NOT NULL` en la entidad + componente `HorarioGrid` compartido entre formularios. (2) Nuevo paso `PAYMENT_INFO` en `SellerOnboarding.tsx`; la PATCH al vendedor usa el token del OTP response directamente. (3) Nueva página `TiendaProfile.tsx` en ruta pública; `GET /:id/publicaciones` se hace público. (4) Filtros locales + contenedor `overflow-y-auto` en `VendedorProfile.tsx`.

**Tech Stack:** Express 5 + MikroORM 6 + PostgreSQL (backend); React 19 + TypeScript + Tailwind CSS (frontend); pnpm como package manager.

---

### Task 1: Definir `HorarioSemanal` + actualizar entidad `TiendaRetiro`

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.entity.ts`

- [ ] **Step 1: Actualizar filas existentes en DB (evitar fallo NOT NULL)**

Conectarse a la DB `heroclash_dsw` y correr:

```sql
UPDATE tienda_retiro
SET horario = '{"lunes":{"abre":"09:00","cierra":"18:00","cerrado":false},"martes":{"abre":"09:00","cierra":"18:00","cerrado":false},"miercoles":{"abre":"09:00","cierra":"18:00","cerrado":false},"jueves":{"abre":"09:00","cierra":"18:00","cerrado":false},"viernes":{"abre":"09:00","cierra":"18:00","cerrado":false},"sabado":{"abre":"10:00","cierra":"14:00","cerrado":false},"domingo":{"abre":"00:00","cierra":"00:00","cerrado":true}}'::jsonb
WHERE horario IS NULL OR horario = '';
```

Verificar: `SELECT nombre, horario FROM tienda_retiro;`

- [ ] **Step 2: Reemplazar entidad con tipos exportados**

Reemplazar `backend/src/tiendaRetiro/tiendaRetiro.entity.ts` completo:

```typescript
import { Entity, Property } from "@mikro-orm/core";
import { BaseEntity } from "../shared/db/baseEntity.js";

export type HorarioDia = {
  abre: string;
  cierra: string;
  cerrado: boolean;
};

export type HorarioSemanal = {
  lunes:     HorarioDia;
  martes:    HorarioDia;
  miercoles: HorarioDia;
  jueves:    HorarioDia;
  viernes:   HorarioDia;
  sabado:    HorarioDia;
  domingo:   HorarioDia;
};

@Entity()
export class TiendaRetiro extends BaseEntity {
  @Property({ type: 'string' })
  nombre!: string;

  @Property({ type: 'string' })
  direccion!: string;

  @Property({ type: 'json', nullable: false })
  horario!: HorarioSemanal;

  @Property({ type: 'boolean', default: true })
  activo!: boolean;

  @Property({ type: 'string', nullable: false, unique: true })
  email!: string;

  @Property({ type: 'string', hidden: true, nullable: false })
  password!: string;

  @Property({ type: 'string', nullable: true })
  ciudad?: string;

  @Property({ type: 'string', nullable: true })
  telefono?: string;

  @Property({ type: 'text', nullable: true })
  descripcionCompra?: string;
}
```

- [ ] **Step 3: Aplicar migración**

```bash
cd backend
pnpm schema:update
```

Output esperado: lista el cambio de tipo de columna `horario` sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.entity.ts
git commit -m "feat: horario de tienda como jsonb estructurado (HorarioSemanal)"
```

---

### Task 2: Validar horario en `storeRegister.controller.ts` + tests

**Files:**
- Modify: `backend/src/storeRegister/storeRegister.controller.ts`
- Modify: `backend/src/storeRegister/__tests__/storeRegister.test.ts`

- [ ] **Step 1: Escribir tests que fallan para `isValidHorario`**

Agregar al final de `backend/src/storeRegister/__tests__/storeRegister.test.ts`:

```typescript
import { isValidHorario } from '../storeRegister.controller.js';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

const horarioValido = Object.fromEntries(
  DIAS.map(d => [d, { abre: '09:00', cierra: '18:00', cerrado: false }])
);

describe('isValidHorario', () => {
  it('acepta horario con los 7 días completos', () => {
    expect(isValidHorario(horarioValido)).toBe(true);
  });

  it('acepta día cerrado', () => {
    const h = { ...horarioValido, domingo: { abre: '00:00', cierra: '00:00', cerrado: true } };
    expect(isValidHorario(h)).toBe(true);
  });

  it('rechaza null', () => {
    expect(isValidHorario(null)).toBe(false);
  });

  it('rechaza objeto sin todos los días', () => {
    const { domingo: _d, ...sinDomingo } = horarioValido as any;
    expect(isValidHorario(sinDomingo)).toBe(false);
  });

  it('rechaza día con campo faltante', () => {
    const h = { ...horarioValido, lunes: { abre: '09:00', cierra: '18:00' } };
    expect(isValidHorario(h)).toBe(false);
  });

  it('rechaza día con cerrado no booleano', () => {
    const h = { ...horarioValido, lunes: { abre: '09:00', cierra: '18:00', cerrado: 'no' } };
    expect(isValidHorario(h)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr tests para verificar que fallan**

```bash
cd backend
pnpm test -- --testPathPattern=storeRegister
```

Expected: FAIL — `isValidHorario is not a function`

- [ ] **Step 3: Agregar `isValidHorario` al controller**

En `backend/src/storeRegister/storeRegister.controller.ts`:

1. Agregar import después de los imports existentes:
```typescript
import { HorarioSemanal } from '../tiendaRetiro/tiendaRetiro.entity.js';
```

2. Agregar estas dos declaraciones después de la función `isHardcodedCode`:
```typescript
const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

export function isValidHorario(horario: unknown): horario is HorarioSemanal {
  if (!horario || typeof horario !== 'object') return false;
  const h = horario as Record<string, unknown>;
  return DIAS_SEMANA.every(dia => {
    const entry = h[dia];
    if (!entry || typeof entry !== 'object') return false;
    const { abre, cierra, cerrado } = entry as Record<string, unknown>;
    return typeof abre === 'string' && typeof cierra === 'string' && typeof cerrado === 'boolean';
  });
}
```

3. Reemplazar `completeRegistration` completo:
```typescript
export async function completeRegistration(req: Request, res: Response) {
  try {
    const {
      token, nombreTienda, email, password, telefono,
      ciudad, direccion, horario,
    } = req.body;

    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);

    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!invite.emailVerified) return res.status(403).json({ message: 'Email no verificado' });
    if (!invite.phoneVerified) return res.status(403).json({ message: 'Teléfono no verificado' });

    if (!nombreTienda || !email || !password || !telefono || !direccion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    if (!horario) {
      return res.status(400).json({ message: 'El horario es obligatorio' });
    }
    if (!isValidHorario(horario)) {
      return res.status(400).json({ message: 'Formato de horario inválido' });
    }
    if (!isValidPhone(telefono)) {
      return res.status(400).json({ message: 'Formato de teléfono inválido. Usá +54 9 XXXX XXXX' });
    }

    const existingEmail = await em.findOne(TiendaRetiro, { email });
    if (existingEmail) return res.status(409).json({ message: 'El email ya está registrado' });

    const existingNombre = await em.findOne(TiendaRetiro, { nombre: nombreTienda });
    if (existingNombre) return res.status(409).json({ message: 'El nombre de tienda ya está en uso' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const tienda = em.create(TiendaRetiro, {
      nombre: nombreTienda,
      email,
      password: hashedPassword,
      telefono,
      ciudad: ciudad || undefined,
      direccion,
      activo: true,
      horario,
    });

    invite.used = true;
    await em.flush();

    const jwtToken = jwt.sign(
      { userId: tienda.id, role: 'tiendaRetiro' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Cuenta de tienda creada',
      token: jwtToken,
      role: 'tiendaRetiro',
      data: {
        id: tienda.id,
        name: tienda.nombre,
        email: tienda.email,
        is_email_verified: true,
        is_phone_verified: true,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 4: Correr tests**

```bash
cd backend
pnpm test -- --testPathPattern=storeRegister
```

Expected: PASS — todos los tests de `isValidHorario`, `isValidPhone`, `isHardcodedCode`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/storeRegister/storeRegister.controller.ts backend/src/storeRegister/__tests__/storeRegister.test.ts
git commit -m "feat: validar horario estructurado en registro de tienda"
```

---

### Task 3: Crear componente compartido `HorarioGrid`

**Files:**
- Create: `vite-project/vite-project-ts/src/components/HorarioGrid.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
export type HorarioDia = {
  abre: string;
  cierra: string;
  cerrado: boolean;
};

export type HorarioSemanal = {
  lunes:     HorarioDia;
  martes:    HorarioDia;
  miercoles: HorarioDia;
  jueves:    HorarioDia;
  viernes:   HorarioDia;
  sabado:    HorarioDia;
  domingo:   HorarioDia;
};

export const HORARIO_DEFAULT: HorarioSemanal = {
  lunes:     { abre: '09:00', cierra: '18:00', cerrado: false },
  martes:    { abre: '09:00', cierra: '18:00', cerrado: false },
  miercoles: { abre: '09:00', cierra: '18:00', cerrado: false },
  jueves:    { abre: '09:00', cierra: '18:00', cerrado: false },
  viernes:   { abre: '09:00', cierra: '18:00', cerrado: false },
  sabado:    { abre: '10:00', cierra: '14:00', cerrado: false },
  domingo:   { abre: '00:00', cierra: '00:00', cerrado: true  },
};

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
type Dia = typeof DIAS[number];

const LABELS: Record<Dia, string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

interface HorarioGridProps {
  value: HorarioSemanal;
  onChange: (h: HorarioSemanal) => void;
  disabled?: boolean;
}

export function HorarioGrid({ value, onChange, disabled = false }: HorarioGridProps) {
  function update(dia: Dia, field: 'abre' | 'cierra' | 'cerrado', val: string | boolean) {
    onChange({ ...value, [dia]: { ...value[dia], [field]: val } });
  }

  return (
    <div className="space-y-2">
      {DIAS.map(dia => (
        <div key={dia} className="flex items-center gap-3 text-sm flex-wrap">
          <span className="w-24 font-medium text-gray-700">{LABELS[dia]}</span>
          <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={value[dia].cerrado}
              onChange={e => update(dia, 'cerrado', e.target.checked)}
              disabled={disabled}
              className="accent-orange-500"
            />
            Cerrado
          </label>
          <input
            type="time"
            value={value[dia].abre}
            onChange={e => update(dia, 'abre', e.target.value)}
            disabled={disabled || value[dia].cerrado}
            className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40 focus:outline-none focus:border-orange-400"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="time"
            value={value[dia].cierra}
            onChange={e => update(dia, 'cierra', e.target.value)}
            disabled={disabled || value[dia].cerrado}
            className="border border-gray-300 rounded px-2 py-1 text-xs disabled:opacity-40 focus:outline-none focus:border-orange-400"
          />
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/components/HorarioGrid.tsx
git commit -m "feat: componente HorarioGrid para edición de horarios de tienda"
```

---

### Task 4: Integrar `HorarioGrid` en `StoreRegistrationPage.tsx`

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/StoreRegistrationPage.tsx`

- [ ] **Step 1: Agregar import**

Al inicio del archivo, después de los imports existentes:

```typescript
import { HorarioGrid, HorarioSemanal, HORARIO_DEFAULT } from '../components/HorarioGrid';
```

- [ ] **Step 2: Agregar `horario` a la interfaz `FormData`**

En la interfaz `FormData` (línea ~88), agregar al final:

```typescript
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
  horario: HorarioSemanal;
}
```

- [ ] **Step 3: Agregar `horario` al estado inicial**

En el `useState<FormData>` (línea ~113), agregar `horario: HORARIO_DEFAULT`:

```typescript
const [form, setForm] = useState<FormData>({
  nombreTienda: '', email: '', confirmEmail: '', password: '',
  confirmPassword: '', telefono: '', ciudad: '', provincia: '',
  direccion: '', piso: '', departamento: '', alias: '', cbu: '', descripcion: '',
  horario: HORARIO_DEFAULT,
});
```

- [ ] **Step 4: Incluir `horario` en el POST de `handlePhoneCode`**

En `handlePhoneCode` (línea ~191), agregar `horario: form.horario` al `body`:

```typescript
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
  horario: form.horario,
}),
```

- [ ] **Step 5: Agregar `HorarioGrid` al JSX del formulario**

En el paso `'FORM'`, después del campo de descripción (textarea), agregar:

```tsx
{/* Horarios */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Horarios de atención <span className="text-red-500">*</span>
  </label>
  <HorarioGrid
    value={form.horario}
    onChange={horario => setForm(prev => ({ ...prev, horario }))}
  />
</div>
```

- [ ] **Step 6: Verificar en browser**

```bash
# Terminal 1
cd backend && pnpm start:dev
# Terminal 2
cd vite-project/vite-project-ts && pnpm run dev
```

Navegar a `/register-store?token=<token_válido>`. Verificar que la grilla de 7 días aparece, que los checkboxes y time-inputs funcionan, y que al enviar el formulario los horarios se incluyen en el payload (usar DevTools → Network → payload del POST a `/api/store-register/complete`).

- [ ] **Step 7: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/StoreRegistrationPage.tsx
git commit -m "feat: formulario de registro de tienda incluye horario estructurado"
```

---

### Task 5: Reemplazar edición de horario en `MiPerfilTiendaRetiroPage.tsx`

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx`

- [ ] **Step 1: Agregar import**

Al inicio del archivo:

```typescript
import { HorarioGrid, HorarioSemanal, HORARIO_DEFAULT } from '../components/HorarioGrid';
```

- [ ] **Step 2: Cambiar tipo de `horario` en el estado del formulario**

Buscar `const [formData, setFormData] = useState({` (línea ~16). Cambiar `horario: ''` por `horario: HORARIO_DEFAULT as HorarioSemanal`.

- [ ] **Step 3: Cambiar tipo de `horarioDraft`**

Buscar `const [horarioDraft, setHorarioDraft] = useState('')` (línea ~30). Cambiar por:

```typescript
const [horarioDraft, setHorarioDraft] = useState<HorarioSemanal>(HORARIO_DEFAULT);
```

- [ ] **Step 4: Actualizar carga de datos en `useEffect`**

En el `useEffect` donde se carga la tienda, cambiar:
- `horario: t?.horario ?? ''` → `horario: t?.horario ?? HORARIO_DEFAULT`
- `setHorarioDraft(t?.horario ?? '')` → `setHorarioDraft(t?.horario ?? HORARIO_DEFAULT)`

- [ ] **Step 5: Quitar el campo `horario` del formulario general**

Buscar en el array de campos del formulario (línea ~447) la entrada:
```typescript
{ name: 'horario', label: 'Horario', type: 'text' },
```
Eliminar esa línea. El horario se gestiona en su propia sección debajo.

- [ ] **Step 6: Reemplazar el input de texto por `HorarioGrid` en la sección de edición**

Buscar el bloque `{editingHorario ? (` (línea ~520). Reemplazar el `<input type="text">` y sus botones por:

```tsx
{editingHorario ? (
  <div className="space-y-3">
    <HorarioGrid
      value={horarioDraft}
      onChange={setHorarioDraft}
      disabled={horarioSaving}
    />
    <div className="flex gap-2 mt-2">
      <button
        onClick={saveHorario}
        disabled={horarioSaving}
        className="bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
      >
        {horarioSaving ? 'Guardando...' : 'Guardar'}
      </button>
      <button
        onClick={() => { setEditingHorario(false); setHorarioDraft(tienda.horario ?? HORARIO_DEFAULT); setHorarioMsg(null); }}
        className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-lg transition"
      >
        Cancelar
      </button>
    </div>
  </div>
) : (
```

- [ ] **Step 7: Reemplazar la vista de solo lectura del horario**

Justo después del bloque `else` (`) : (`), reemplazar la vista de string por:

```tsx
) : (
  <div className="space-y-1">
    {tienda.horario
      ? Object.entries(tienda.horario as HorarioSemanal).map(([dia, h]) => (
          <div key={dia} className="flex gap-2 text-xs text-gray-700">
            <span className="capitalize w-20 font-medium">{dia}</span>
            {(h as any).cerrado
              ? <span className="text-gray-400 italic">Cerrado</span>
              : <span>{(h as any).abre} – {(h as any).cierra}</span>
            }
          </div>
        ))
      : <span className="text-gray-400 italic text-xs">Sin horario cargado</span>
    }
    <button
      onClick={() => { setEditingHorario(true); setHorarioMsg(null); }}
      className="mt-2 text-xs text-orange-600 hover:underline block"
    >
      Editar horario
    </button>
  </div>
)}
```

- [ ] **Step 8: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/MiPerfilTiendaRetiroPage.tsx
git commit -m "feat: edición de horario en perfil de tienda usa grilla estructurada"
```

---

### Task 6: Paso `PAYMENT_INFO` en `SellerOnboarding.tsx`

**Files:**
- Modify: `vite-project/vite-project-ts/src/components/SellerOnboarding.tsx`

**Nota de arquitectura:** `PATCH /api/vendedores/:id` requiere token de rol `'vendedor'`. En este paso el usuario aún tiene token `'user'`. La solución es pasar el token del OTP response directamente en el header de la PATCH call, y llamar a `upgradeToSeller` solo después de que la PATCH sea exitosa. Para que el componente no se desmonte al cambiar el rol, la guardia del componente se relaja para los pasos `'PAYMENT_INFO'` y `'SUCCESS'`.

- [ ] **Step 1: Reemplazar el contenido completo de `SellerOnboarding.tsx`**

```tsx
import { useState, useEffect } from 'react'
import { useUser } from '../context/user'
import { api } from '../services/api'

type Step = 'IDLE' | 'EMAIL_GATE' | 'PHONE_INPUT' | 'OTP_INPUT' | 'PAYMENT_INFO' | 'SUCCESS'

const PHONE_REGEX = /^\+54 9 \d{4} \d{4}$/
const CBU_REGEX   = /^\d{22}$/
const ALIAS_REGEX = /^[a-zA-Z0-9.]{6,20}$/

export default function SellerOnboarding() {
  const { user, upgradeToSeller } = useUser()
  const [step, setStep]           = useState<Step>('IDLE')
  const [phone, setPhone]         = useState('')
  const [code, setCode]           = useState('')
  const [cbu, setCbu]             = useState('')
  const [alias, setAlias]         = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)

  const [pendingVendedorId, setPendingVendedorId] = useState<number | null>(null)
  const [pendingToken, setPendingToken]             = useState<string>('')
  const [pendingData, setPendingData]               = useState<any>(null)

  useEffect(() => {
    if (step !== 'OTP_INPUT' || secondsLeft === 0) return
    const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(id)
  }, [step, secondsLeft])

  if (!user) return null
  if (user.role !== 'user' && step !== 'PAYMENT_INFO' && step !== 'SUCCESS') return null

  function handleWantToSell() {
    if (!user!.is_email_verified) {
      setStep('EMAIL_GATE')
    } else {
      setStep('PHONE_INPUT')
    }
  }

  async function handleRequestOtp() {
    if (!PHONE_REGEX.test(phone)) {
      setError('Formato inválido. Usá +54 9 XXXX XXXX')
      return
    }
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

  async function handleResendOtp() {
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

  async function handleVerifyOtp() {
    if (code.length !== 6) {
      setError('Ingresá los 6 dígitos del código')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/seller/verify-otp', { phone, code })
      setPendingVendedorId(res.data.data.id)
      setPendingToken(res.data.token)
      setPendingData(res.data.data)
      setStep('PAYMENT_INFO')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Código incorrecto o expirado')
    } finally {
      setLoading(false)
    }
  }

  async function handleSavePaymentInfo() {
    if (!CBU_REGEX.test(cbu)) {
      setError('El CBU debe tener exactamente 22 dígitos numéricos')
      return
    }
    if (!ALIAS_REGEX.test(alias)) {
      setError('El alias debe tener entre 6 y 20 caracteres (letras, números y puntos)')
      return
    }
    setError('')
    setLoading(true)
    try {
      await api.patch(
        `/api/vendedores/${pendingVendedorId}`,
        { cbu, alias },
        { headers: { Authorization: `Bearer ${pendingToken}` } }
      )
      upgradeToSeller(pendingToken, { ...pendingData, cbu, alias })
      setStep('SUCCESS')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Error al guardar datos de pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-3">Activar cuenta de vendedor</h3>

      {step === 'IDLE' && (
        <button
          onClick={handleWantToSell}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Quiero vender
        </button>
      )}

      {step === 'EMAIL_GATE' && (
        <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
          Necesitás verificar tu email antes de activar tu cuenta de vendedor.
        </p>
      )}

      {step === 'PHONE_INPUT' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Ingresá tu número de WhatsApp para recibir el código de verificación.
          </p>
          <div>
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setError('') }}
              placeholder="+54 9 XXXX XXXX"
              className={`w-full border rounded px-3 py-2 text-sm ${
                phone && !PHONE_REGEX.test(phone) ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {phone && !PHONE_REGEX.test(phone) && (
              <p className="text-xs text-red-500 mt-1">Formato: +54 9 XXXX XXXX</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleRequestOtp}
            disabled={loading || !PHONE_REGEX.test(phone)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? 'Enviando...' : 'Enviar código'}
          </button>
        </div>
      )}

      {step === 'OTP_INPUT' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Ingresá el código de 6 dígitos que enviamos a tu WhatsApp.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
            placeholder="123456"
            className="w-32 border border-gray-300 rounded px-3 py-2 text-center text-lg tracking-widest"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 items-center">
            <button
              onClick={handleVerifyOtp}
              disabled={loading || code.length !== 6}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
            <button
              onClick={handleResendOtp}
              disabled={secondsLeft > 0 || loading}
              className="text-sm text-blue-600 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              {secondsLeft > 0 ? `Reenviar en ${secondsLeft}s` : 'Reenviar código'}
            </button>
          </div>
        </div>
      )}

      {step === 'PAYMENT_INFO' && (
        <div className="space-y-3">
          <p className="text-sm text-green-700 font-medium">
            ¡Teléfono verificado! Ingresá tus datos de cobro para completar el registro.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">CBU (22 dígitos)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={22}
              value={cbu}
              onChange={e => { setCbu(e.target.value.replace(/\D/g, '')); setError('') }}
              placeholder="0000000000000000000000"
              className={`w-full border rounded px-3 py-2 text-sm ${
                cbu && !CBU_REGEX.test(cbu) ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {cbu && !CBU_REGEX.test(cbu) && (
              <p className="text-xs text-red-500 mt-1">El CBU debe tener exactamente 22 dígitos</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Alias (6–20 caracteres)</label>
            <input
              type="text"
              value={alias}
              onChange={e => { setAlias(e.target.value); setError('') }}
              placeholder="mi.alias.pago"
              className={`w-full border rounded px-3 py-2 text-sm ${
                alias && !ALIAS_REGEX.test(alias) ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {alias && !ALIAS_REGEX.test(alias) && (
              <p className="text-xs text-red-500 mt-1">Solo letras, números y puntos (6–20 caracteres)</p>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={handleSavePaymentInfo}
            disabled={loading || !CBU_REGEX.test(cbu) || !ALIAS_REGEX.test(alias)}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition"
          >
            {loading ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </div>
      )}

      {step === 'SUCCESS' && (
        <div className="space-y-3">
          <p className="text-green-700 font-medium">
            ¡Perfil de vendedor activado! Ya podés publicar cartas.
          </p>
          <a
            href="/publicar"
            className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
          >
            Ir a publicar
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/components/SellerOnboarding.tsx
git commit -m "feat: paso PAYMENT_INFO con CBU y alias al convertirse en vendedor"
```

---

### Task 7: Hacer `GET /tiendas/:id/publicaciones` público

**Files:**
- Modify: `backend/src/tiendaRetiro/tiendaRetiro.routes.ts`

- [ ] **Step 1: Quitar guards de auth del GET de publicaciones**

En `backend/src/tiendaRetiro/tiendaRetiro.routes.ts`, reemplazar la línea:

```typescript
// Antes:
tiendaRouter.get("/:id/publicaciones", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getPublicaciones);

// Después:
tiendaRouter.get("/:id/publicaciones", getPublicaciones);
```

El controlador `getPublicaciones` solo usa `req.params.id` — no accede a `req.actor`.

- [ ] **Step 2: Verificar con curl**

Con el backend corriendo:

```bash
curl http://localhost:3000/api/tiendas/1/publicaciones
```

Expected: `{"data":[...]}` sin requerir Authorization header.

- [ ] **Step 3: Commit**

```bash
git add backend/src/tiendaRetiro/tiendaRetiro.routes.ts
git commit -m "feat: GET /tiendas/:id/publicaciones es público"
```

---

### Task 8: Crear página pública `TiendaProfile.tsx`

**Files:**
- Create: `vite-project/vite-project-ts/src/pages/TiendaProfile.tsx`

- [ ] **Step 1: Crear el archivo**

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { HorarioSemanal } from '../components/HorarioGrid';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const LABELS: Record<typeof DIAS[number], string> = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};

export function TiendaProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [tienda, setTienda]           = useState<any>(null);
  const [publicaciones, setPublicaciones] = useState<any[]>([]);
  const [reviews, setReviews]         = useState<any[]>([]);
  const [average, setAverage]         = useState(0);
  const [loading, setLoading]         = useState(true);

  const [searchName, setSearchName]         = useState('');
  const [filterEstado, setFilterEstado]     = useState<'all' | 'disponible' | 'pausado'>('all');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterRareza, setFilterRareza]     = useState('');
  const [filterSet, setFilterSet]           = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [tiendaRes, pubRes, reviewsRes, avgRes] = await Promise.all([
          api.get(`/api/tiendas/${id}`),
          api.get(`/api/tiendas/${id}/publicaciones`),
          api.get(`/api/valoraciones/tiendaRetiro/${id}`),
          api.get(`/api/valoraciones/tiendaRetiro/${id}/average`),
        ]);
        setTienda(tiendaRes.data.data);
        setPublicaciones(pubRes.data.data ?? []);
        const rd = reviewsRes.data;
        setReviews(Array.isArray(rd) ? rd : (rd.data ?? []));
        setAverage(Number(avgRes.data.average) || 0);
      } catch (err) {
        console.error('Error fetching tienda profile:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando perfil...</div>;
  if (!tienda)  return <div className="p-10 text-center text-red-500">Tienda no encontrada</div>;

  const horario = tienda.horario as HorarioSemanal | undefined;

  const filteredPubs = publicaciones.filter((carta: any) => {
    const item  = carta.items?.[0];
    const estado = item?.estado ?? 'disponible';
    const precio = Number(carta.price ?? 0);
    if (searchName && !carta.name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    if (filterEstado === 'all') {
      if (estado === 'pausado' || (item?.stock ?? 0) <= 0) return false;
    } else {
      if (estado !== filterEstado) return false;
    }
    if (filterMinPrice && precio < Number(filterMinPrice)) return false;
    if (filterMaxPrice && precio > Number(filterMaxPrice)) return false;
    if (filterRareza && !carta.rarity?.toLowerCase().includes(filterRareza.toLowerCase())) return false;
    if (filterSet && !carta.setName?.toLowerCase().includes(filterSet.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-green-50 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* HEADER */}
        <div className="flex items-center gap-6 bg-white p-8 rounded-2xl shadow-md border border-green-200">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-full flex items-center justify-center text-4xl font-bold shadow">
            {tienda.nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-800">{tienda.nombre}</h1>
            <p className="inline-block bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-sm font-semibold mt-1">
              Tienda Verificada
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="text-yellow-400 text-lg tracking-wider">
                {'★'.repeat(Math.round(average))}{'☆'.repeat(5 - Math.round(average))}
              </div>
              <span className="text-gray-600 font-medium">
                ({average.toFixed(1)}) · {reviews.length} valoraciones
              </span>
            </div>
          </div>
        </div>

        {/* INFO + MAPA */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white border border-green-200 rounded-2xl p-6 shadow-sm space-y-3">
            <h2 className="text-lg font-semibold text-green-800">Información</h2>
            {tienda.ciudad    && <p className="text-sm text-gray-700">📍 {tienda.ciudad}</p>}
            {tienda.telefono  && <p className="text-sm text-gray-700">📞 {tienda.telefono}</p>}
            {tienda.direccion && <p className="text-sm text-gray-700">🏠 {tienda.direccion}</p>}
            {tienda.descripcionCompra && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Instrucciones de retiro</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{tienda.descripcionCompra}</p>
              </div>
            )}
            {horario && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Horarios</p>
                <div className="space-y-1">
                  {DIAS.map(dia => (
                    <div key={dia} className="flex gap-2 text-xs text-gray-700">
                      <span className="w-24 font-medium">{LABELS[dia]}</span>
                      {horario[dia].cerrado
                        ? <span className="text-gray-400 italic">Cerrado</span>
                        : <span>{horario[dia].abre} – {horario[dia].cierra}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {tienda.direccion && (
            <div className="bg-white border border-green-200 rounded-2xl overflow-hidden shadow-sm">
              <iframe
                title="Ubicación de la tienda"
                width="100%"
                height="100%"
                style={{ minHeight: '300px', border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(
                  [tienda.direccion, tienda.ciudad].filter(Boolean).join(', ')
                )}&output=embed`}
              />
            </div>
          )}
        </div>

        {/* PUBLICACIONES */}
        <div className="bg-white border border-green-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-green-800 border-b border-green-200 pb-2 mb-4">
            Publicaciones de la Tienda
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text" value={searchName} placeholder="Buscar por nombre..."
              onChange={e => setSearchName(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-400"
            />
            <select
              value={filterEstado}
              onChange={e => setFilterEstado(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-400"
            >
              <option value="all">Todos</option>
              <option value="disponible">Disponible</option>
              <option value="pausado">Pausado</option>
            </select>
            <input type="number" value={filterMinPrice} placeholder="Precio mín"
              onChange={e => setFilterMinPrice(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
            />
            <input type="number" value={filterMaxPrice} placeholder="Precio máx"
              onChange={e => setFilterMaxPrice(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
            />
            <input type="text" value={filterRareza} placeholder="Rareza..."
              onChange={e => setFilterRareza(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
            />
            <input type="text" value={filterSet} placeholder="Set..."
              onChange={e => setFilterSet(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
            />
          </div>
          {filteredPubs.length === 0 ? (
            <p className="text-center text-gray-500 italic py-10 bg-green-50 rounded-xl">
              {publicaciones.length === 0
                ? 'Esta tienda no tiene publicaciones.'
                : 'Ninguna publicación coincide con los filtros.'}
            </p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto pr-1">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                {filteredPubs.map((carta: any) => (
                  <div key={carta.id} className="bg-white border border-green-200 rounded-xl p-3 shadow-sm hover:shadow-md transition">
                    {carta.image && (
                      <img src={carta.image} alt={carta.name} className="w-full h-[140px] object-contain" />
                    )}
                    <h4 className="mt-2 font-semibold text-gray-800 text-sm">{carta.name}</h4>
                    <p className="text-green-600 font-bold text-sm">${carta.price}</p>
                    {carta.rarity  && <p className="text-xs text-gray-400">{carta.rarity}</p>}
                    {carta.setName && <p className="text-xs text-gray-400">{carta.setName}</p>}
                    <p className="text-xs text-gray-500 mt-1">Stock: {carta.items?.[0]?.stock ?? '-'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* VALORACIONES */}
        <div className="bg-white border border-green-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-green-800 border-b border-green-200 pb-2 mb-4">
            Valoraciones
          </h2>
          {reviews.length === 0 ? (
            <p className="text-center text-gray-500 italic py-10 bg-green-50 rounded-xl">
              Esta tienda aún no tiene valoraciones.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {reviews.map((review: any) => (
                <div key={review.id} className="bg-white p-5 rounded-xl border border-green-200 shadow-sm">
                  <div className="flex justify-between mb-1">
                    <span className="font-semibold text-gray-800">
                      {review.usuario?.nombre ?? 'Usuario'}
                    </span>
                    <div className="text-yellow-400 text-sm">
                      {'★'.repeat(review.puntuacion)}{'☆'.repeat(5 - review.puntuacion)}
                    </div>
                  </div>
                  {review.comentario && (
                    <p className="text-gray-600 italic">"{review.comentario}"</p>
                  )}
                  {review.createdAt && (
                    <small className="text-gray-400 text-xs block mt-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </small>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => navigate(-1)}
          className="bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-2 rounded-lg transition"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/TiendaProfile.tsx
git commit -m "feat: página pública de tienda con mapa, publicaciones y valoraciones"
```

---

### Task 9: Registrar ruta `/tienda/:id` en `App.tsx`

**Files:**
- Modify: `vite-project/vite-project-ts/src/App.tsx`

- [ ] **Step 1: Agregar import**

Junto al import de `VendedorProfile` (línea ~27):

```typescript
import { TiendaProfile } from "./pages/TiendaProfile";
```

- [ ] **Step 2: Agregar ruta**

Inmediatamente después de la ruta `vendedor/:id` (línea ~142):

```tsx
{/* Perfil Público de Tienda */}
<Route path="tienda/:id" element={<TiendaProfile />} />
```

- [ ] **Step 3: Verificar en browser**

Navegar a `http://localhost:5173/tienda/1` (usar el id de una tienda existente). Verificar que carga el perfil con mapa embed, tabla de horarios, publicaciones con filtros y valoraciones.

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/App.tsx
git commit -m "feat: ruta pública /tienda/:id"
```

---

### Task 10: Filtros + scroll propio en `VendedorProfile.tsx`

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/VendedorProfile.tsx`

- [ ] **Step 1: Agregar estado de filtros**

Después de `const [loading, setLoading] = useState(true);` (línea ~13):

```typescript
const [searchName, setSearchName]         = useState('');
const [filterEstado, setFilterEstado]     = useState<'all' | 'disponible' | 'pausado'>('all');
const [filterMinPrice, setFilterMinPrice] = useState('');
const [filterMaxPrice, setFilterMaxPrice] = useState('');
const [filterRareza, setFilterRareza]     = useState('');
const [filterSet, setFilterSet]           = useState('');
```

- [ ] **Step 2: Agregar lógica de filtrado justo antes del `return`**

```typescript
const filteredItems = (vendedor?.itemCartas ?? []).filter((item: any) => {
  const carta = item.cartas?.[0];
  if (!carta) return false;
  const precio = Number(carta.price ?? 0);
  if (filterEstado === 'all') {
    if (item.estado === 'pausado' || item.stock <= 0) return false;
  } else {
    if (item.estado !== filterEstado) return false;
  }
  if (searchName && !carta.name?.toLowerCase().includes(searchName.toLowerCase())) return false;
  if (filterMinPrice && precio < Number(filterMinPrice)) return false;
  if (filterMaxPrice && precio > Number(filterMaxPrice)) return false;
  if (filterRareza && !carta.rarity?.toLowerCase().includes(filterRareza.toLowerCase())) return false;
  if (filterSet && !carta.setName?.toLowerCase().includes(filterSet.toLowerCase())) return false;
  return true;
});
```

- [ ] **Step 3: Reemplazar la sección `{/* PUBLICACIONES */}` en el JSX**

Reemplazar el bloque de publicaciones (líneas ~88-138) con:

```tsx
{/* PUBLICACIONES */}
<div className="mb-10">
  <h2 className="text-xl font-semibold text-green-800 border-b border-green-200 pb-2 mb-4">
    Publicaciones del Vendedor
  </h2>

  {/* Filtros */}
  <div className="flex flex-wrap gap-2 mb-4">
    <input
      type="text" value={searchName} placeholder="Buscar por nombre..."
      onChange={e => setSearchName(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-400"
    />
    <select
      value={filterEstado}
      onChange={e => setFilterEstado(e.target.value as any)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-green-400"
    >
      <option value="all">Todos</option>
      <option value="disponible">Disponible</option>
      <option value="pausado">Pausado</option>
    </select>
    <input type="number" value={filterMinPrice} placeholder="Precio mín"
      onChange={e => setFilterMinPrice(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
    />
    <input type="number" value={filterMaxPrice} placeholder="Precio máx"
      onChange={e => setFilterMaxPrice(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
    />
    <input type="text" value={filterRareza} placeholder="Rareza..."
      onChange={e => setFilterRareza(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
    />
    <input type="text" value={filterSet} placeholder="Set..."
      onChange={e => setFilterSet(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-28 focus:outline-none focus:border-green-400"
    />
  </div>

  {filteredItems.length === 0 ? (
    <p className="text-center text-gray-500 italic py-10 bg-green-50 rounded-xl">
      {(!vendedor?.itemCartas || vendedor.itemCartas.length === 0)
        ? 'Este vendedor no tiene cartas publicadas.'
        : 'Ninguna publicación coincide con los filtros.'}
    </p>
  ) : (
    <div className="max-h-[600px] overflow-y-auto pr-1">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {filteredItems.map((item: any) => {
          const carta = item.cartas?.[0];
          if (!carta) return null;
          return (
            <div
              key={item.id}
              className="bg-white border border-green-200 rounded-xl p-3 shadow-sm hover:shadow-md transition"
            >
              {carta.image && (
                <img src={carta.image} alt={carta.name} className="w-full h-[150px] object-contain" />
              )}
              <h4 className="mt-2 font-semibold text-gray-800">{carta.name}</h4>
              <p className="text-green-600 font-bold">${carta.price}</p>
              <p className="text-sm text-gray-500 mb-2">Stock: {item.stock}</p>
              <button
                onClick={() => navigate(`/card/${carta.id}`)}
                className="w-full bg-green-500 hover:bg-green-600 text-white py-1 rounded-md transition"
              >
                Ver Detalle
              </button>
            </div>
          );
        })}
      </div>
    </div>
  )}
</div>
```

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/VendedorProfile.tsx
git commit -m "feat: filtros y scroll propio en página pública del vendedor"
```

---

## Resumen de archivos

| Archivo | Acción |
|---|---|
| `backend/src/tiendaRetiro/tiendaRetiro.entity.ts` | Modificar: `horario` → `jsonb NOT NULL`, exportar `HorarioSemanal` / `HorarioDia` |
| `backend/src/storeRegister/storeRegister.controller.ts` | Modificar: `isValidHorario` + `horario` en `completeRegistration` |
| `backend/src/storeRegister/__tests__/storeRegister.test.ts` | Modificar: agregar tests de `isValidHorario` |
| `backend/src/tiendaRetiro/tiendaRetiro.routes.ts` | Modificar: quitar auth de `GET /:id/publicaciones` |
| `vite-project/.../components/HorarioGrid.tsx` | Crear: componente editable de horario + tipos + default |
| `vite-project/.../pages/StoreRegistrationPage.tsx` | Modificar: `horario` en form + `HorarioGrid` en JSX |
| `vite-project/.../pages/MiPerfilTiendaRetiroPage.tsx` | Modificar: reemplazar edición de horario por `HorarioGrid` |
| `vite-project/.../components/SellerOnboarding.tsx` | Modificar: paso `PAYMENT_INFO` con CBU/alias |
| `vite-project/.../pages/TiendaProfile.tsx` | Crear: página pública de tienda |
| `vite-project/.../App.tsx` | Modificar: ruta `tienda/:id` |
| `vite-project/.../pages/VendedorProfile.tsx` | Modificar: filtros + scroll |
