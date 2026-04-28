# BUYER → SELLER Upgrade via WhatsApp OTP — Diseño

**Fecha:** 2026-04-27

---

## Resumen

Implementar el flujo de conversión de un usuario comprador (role `'user'`) a vendedor (role `'vendedor'`) mediante verificación de número de teléfono vía OTP de WhatsApp. Se refactoriza la entidad `Vendedor` para convertirla en un "perfil de vendedor" vinculado 1:1 a la entidad `User`, eliminando los campos duplicados de identidad.

---

## Arquitectura General

```
User (identidad principal)
  ├── is_email_verified: boolean
  ├── is_phone_verified: boolean
  └── vendedor: Vendedor? (relación 1:1, puede ser null)

Vendedor (perfil comercial)
  ├── user: User (FK requerida, única)
  ├── nombre, telefono, ciudad, alias, cbu
  ├── itemCartas, tiendasRetiro
  └── [sin email, password, resetToken — viven en User]

VerificationCode (TTL 10 min)
  ├── user: User
  ├── codeHash: string (SHA-256)
  ├── purpose: 'seller_upgrade'
  ├── expiresAt: Date
  └── used: boolean
```

---

## Sección 1 — Base de Datos

### 1.1 Cambios en `User` entity

Agregar dos campos al final de `user.entity.ts`:

```typescript
@Property({ type: 'boolean', default: false })
is_email_verified!: boolean;

@Property({ type: 'boolean', default: false })
is_phone_verified!: boolean;
```

### 1.2 Refactor de `Vendedor` entity

**Campos eliminados** (pasan a vivir en `User`):
- `email`
- `password`
- `resetPasswordToken`
- `resetPasswordExpires`

**Campo agregado:**
```typescript
@OneToOne(() => User, { owner: true, unique: true, nullable: false })
user!: User;
```

El campo `nombre` se mantiene (puede diferir del `username` de User; representa el nombre comercial).

**Cambio en `telefono`:** agregar `unique: true` a nivel de entidad (constraint en DB) para garantizar unicidad incluso ante requests concurrentes:
```typescript
@Property({ type: 'string', unique: true })
telefono!: string;
```

**Campos que permanecen sin cambios:** `ciudad`, `alias`, `cbu`, `itemCartas`, `tiendasRetiro`.

### 1.3 Nueva entidad `VerificationCode`

Archivo: `backend/src/verification/verificationCode.entity.ts`

```typescript
@Entity()
export class VerificationCode extends BaseEntity {
  @ManyToOne(() => User)
  user!: User;

  @Property({ type: 'string' })
  codeHash!: string;

  @Property({ type: 'string' })
  purpose!: string;             // 'seller_upgrade'

  @Property({ type: 'datetime' })
  expiresAt!: Date;

  @Property({ type: 'boolean', default: false })
  used!: boolean;
}
```

Registrar en `orm.ts` junto al resto de entidades.

### 1.4 Script de migración de datos existentes

Archivo: `backend/src/scripts/migrate_vendedores_to_users.ts`

Por cada `Vendedor` existente sin `user_id`:
1. Verificar que no exista un `User` con el mismo email.
2. Si no existe: `em.create(User, { username: vendedor.nombre, email: vendedor.email, password: vendedor.password, role: 'user', is_email_verified: true })`.
3. `vendedor.user = newUser`.
4. `em.flush()`.

Ejecución: `pnpm run migrate:sellers`  
Script npm a agregar en `backend/package.json`:
```json
"migrate:sellers": "tsx src/scripts/migrate_vendedores_to_users.ts"
```

---

## Sección 2 — Backend

### 2.1 Servicio WhatsApp

Archivo: `backend/src/shared/whatsapp.ts`

```typescript
import twilio from 'twilio';

export class WhatsAppService {
  async send(phone: string, code: string): Promise<void> {
    if (process.env.WHATSAPP_TEST_MODE === 'true') {
      console.log(`[WhatsApp TEST] OTP para ${phone}: ${code}`);
      return;
    }
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${phone}`,
      body: `Tu código para activar tu cuenta de vendedor en HeroClash: ${code}. Válido por 10 minutos.`,
    });
  }
}

export const whatsAppService = new WhatsAppService();
```

Variables de entorno necesarias en `backend/.env`:
```
WHATSAPP_TEST_MODE=true
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=
```

En TEST_MODE, el valor `'123456'` es siempre aceptado como válido (se verifica en el controller antes de comparar el hash, cortocircuitando la validación de hash).

### 2.2 Nuevo módulo `seller/`

#### `seller.routes.ts`

```typescript
import { Router } from 'express';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';
import { requestOtp, verifyOtp, sanitizeRequestOtp, sanitizeVerifyOtp } from './seller.controler.js';

export const sellerRouter = Router();

sellerRouter.post('/request-otp', authenticate, authorizeRoles('user'), sanitizeRequestOtp, requestOtp);
sellerRouter.post('/verify-otp',  authenticate, authorizeRoles('user'), sanitizeVerifyOtp,  verifyOtp);
```

Registrar en `app.ts`: `app.use('/api/seller', sellerRouter)`.

#### `seller.controler.ts`

**`sanitizeRequestOtp`:** whitelist `{ phone }`.  
**`sanitizeVerifyOtp`:** whitelist `{ phone, code }`.

**`requestOtp`:**
```
1. req.actor es User (role='user')
2. ¿Vendedor con user=actor ya existe? → 409 'Ya tenés un perfil de vendedor'
3. ¿actor.is_email_verified === false? → 403 'Verificá tu email antes de continuar'
4. Validar phone: /^\+54 9 \d{4} \d{4}$/ → 400 si falla
5. ¿Vendedor con telefono=phone ya existe? → 409 'Ese teléfono ya está en uso'
6. Rate limit: COUNT(VerificationCode WHERE user=actor AND createdAt > now-1h AND purpose='seller_upgrade') >= 3 → 429
7. OTP = crypto.randomInt(100000, 999999).toString()
8. codeHash = sha256(otp)
9. em.create(VerificationCode, { user: actor, codeHash, purpose: 'seller_upgrade', expiresAt: now+10min })
10. em.flush()
11. await whatsAppService.send(phone, otp)
12. res.200 { message: 'Código enviado por WhatsApp' }
```

**`verifyOtp`:**
```
1. req.actor es User
2. Buscar VerificationCode: { user: actor, used: false, purpose: 'seller_upgrade', expiresAt: { $gt: new Date() } }
   ORDER BY createdAt DESC LIMIT 1
3. Si no hay código válido → 400 'Código expirado o inválido'
4. TEST_MODE + code === '123456' → saltar verificación de hash
   Caso normal: sha256(code) !== vc.codeHash → 400 'Código incorrecto'
5. Transacción atómica (todo en un solo em.flush):
   a. actor.is_phone_verified = true
   b. vc.used = true
   c. vendedor = em.create(Vendedor, { user: actor, nombre: actor.username, telefono: sanitizedInput.phone })
6. em.flush()
7. Generar nuevo JWT: { userId: actor.id, role: 'vendedor' }, expiresIn: '7d'
8. res.200 { message: 'Perfil de vendedor creado', token, data: vendedor }
```

### 2.3 Cambios en `shared/middleware/auth.ts`

**Caso `role: 'vendedor'`** — el `userId` del JWT ahora apunta a `User.id` (no a `Vendedor.id`):

```typescript
if (decoded.role === 'vendedor') {
  const user = await em.findOne(User, { id: decoded.userId });
  actor = user ? await em.findOne(Vendedor, { user }) : null;
}
```

`req.actor` sigue siendo de tipo `Vendedor`, por lo que todas las rutas existentes de vendedor funcionan sin cambios. El `actorRole` continúa siendo `'vendedor'`.

**`authorizeSelf`** — sin cambios. El `req.params.id` en las rutas de vendedor es el `Vendedor.id`, que es el mismo `req.actor.id`.

### 2.4 Cambios en `user.controler.ts` — Login

Después de verificar las credenciales, detectar si el usuario tiene un perfil de vendedor y emitir el JWT correspondiente:

```typescript
const vendedor = await em.findOne(Vendedor, { user });
const role = vendedor ? 'vendedor' : 'user';
const token = jwt.sign({ userId: user.id, role }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '7d' });
res.status(200).json({ message: 'Login successful', data: user, token, role });
```

**Endpoint `/api/vendedores/login`:** queda deprecado. Redirigir a `/api/users/login` o mantenerlo como alias que llama al mismo controller. No eliminar hasta que el frontend esté actualizado.

### 2.5 Sanitización en módulos afectados

Todos los controladores que lean de `Vendedor` y accedan a `.email` o `.password` deberán pasar a leerlos de `vendedor.user.email`. Módulos a revisar: `vendedor.controller.ts`, rutas que populen el actor con sus datos.

---

## Sección 3 — Frontend

### 3.1 Componente `SellerOnboarding`

Archivo: `vite-project/vite-project-ts/src/components/SellerOnboarding.tsx`

**Estados del flujo (máquina de estados simple):**

```
IDLE → EMAIL_GATE → PHONE_INPUT → OTP_INPUT → SUCCESS
```

- **IDLE:** botón "Quiero vender" visible cuando `user.role === 'user'`
- **EMAIL_GATE:** si `user.is_email_verified === false`, mostrar mensaje:  
  `"Necesitás verificar tu email antes de activar tu cuenta de vendedor."` (sin botón de acción por ahora; dejar placeholder para cuando se implemente email verification)
- **PHONE_INPUT:** input de teléfono (`+54 9 XXXX XXXX`), botón "Enviar código". Validación visual en tiempo real con regex.
- **OTP_INPUT:** 6 inputs de un dígito cada uno (o un input de 6 chars), timer de reenvío de 60 segundos. Botón "Reenviar" deshabilitado mientras corre el timer.
- **SUCCESS:** "¡Perfil de vendedor activado! Ya podés publicar cartas." Con botón que redirige a `/publicar`.

### 3.2 Integración en `UserProfilePage`

Importar y renderizar `<SellerOnboarding />` condicionalmente cuando `user.role === 'user'` (el componente maneja internamente la lógica de estados).

### 3.3 Actualización del UserContext

Después del `verify-otp` exitoso, el backend devuelve un nuevo JWT. El frontend debe:
1. Sobrescribir el token en `localStorage['user']` con el nuevo.
2. Llamar a la función de actualización del contexto para reflejar `role: 'vendedor'`.

La forma más limpia es agregar una función `refreshAuth(newToken)` en `context/user.tsx` que parsee el token JWT, actualice el estado y el localStorage.

### 3.4 Timer de reenvío

```typescript
const [secondsLeft, setSecondsLeft] = useState(60);

useEffect(() => {
  if (step !== 'OTP_INPUT' || secondsLeft === 0) return;
  const id = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
  return () => clearTimeout(id);
}, [step, secondsLeft]);
```

---

## Sección 4 — Seguridad y casos borde

| Caso | Comportamiento |
|---|---|
| User ya tiene Vendedor asociado | 409 en `request-otp` |
| Email no verificado | 403 en `request-otp` |
| Teléfono duplicado en tabla vendedor | 409 en `request-otp` |
| Más de 3 OTPs en 1 hora | 429 en `request-otp` |
| Código expirado (> 10 min) | 400 en `verify-otp` |
| Código incorrecto | 400 en `verify-otp` |
| Código ya usado | 400 en `verify-otp` (el campo `used` es true) |
| Token inválido / no es 'user' | 401/403 vía middleware existente |
| TEST_MODE: código '123456' | Bypass de hash, siempre válido |
| JWT antiguo de Vendedor (anterior a migración) | Inválido tras `em.findOne(Vendedor, { user })` retornar null → 401. Usuario debe re-loguearse. |

---

## Sección 5 — Deuda técnica y fuera de scope

- **Email verification flow:** se agrega el campo `is_email_verified` y el check, pero el flujo de envío de email de verificación **no** se implementa en este sprint. Para testing: `UPDATE "user" SET is_email_verified = true WHERE id = X;`
- **`/api/vendedores/login` deprecado:** se mantiene sin eliminar hasta que el frontend esté migrado.
- **Twilio sandbox:** para producción, el número de WhatsApp de Twilio debe estar aprobado por Meta. En dev/testing, usar `WHATSAPP_TEST_MODE=true`.
- **Formato de teléfono:** se valida el patrón `+54 9 XXXX XXXX`. Si el proyecto expande a otros países, la validación debe generalizarse.

---

## Archivos afectados (resumen)

### Backend
| Archivo | Tipo de cambio |
|---|---|
| `user/user.entity.ts` | Agregar `is_email_verified`, `is_phone_verified` |
| `vendedor/vendedores.entity.ts` | Agregar FK `user`, eliminar `email`/`password`/reset tokens |
| `shared/middleware/auth.ts` | Cambiar lookup de `'vendedor'` (User → Vendedor vía user) |
| `user/user.controler.ts` | Login detecta vendedor, emite role correcto en JWT |
| `app.ts` | Registrar `sellerRouter` y `VerificationCode` en ORM |
| `shared/db/orm.ts` | Agregar `VerificationCode` a entidades |
| `seller/seller.routes.ts` | **Nuevo** |
| `seller/seller.controler.ts` | **Nuevo** |
| `shared/whatsapp.ts` | **Nuevo** |
| `verification/verificationCode.entity.ts` | **Nuevo** |
| `scripts/migrate_vendedores_to_users.ts` | **Nuevo** |

### Frontend
| Archivo | Tipo de cambio |
|---|---|
| `components/SellerOnboarding.tsx` | **Nuevo** |
| `pages/UserProfilePage.tsx` | Importar y renderizar `SellerOnboarding` |
| `context/user.tsx` | Agregar `refreshAuth(token)` |
