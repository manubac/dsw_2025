# Flujo de entrega a tienda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el flujo pendiente → entregado_a_tienda → retirado, con email al comprador cuando el vendedor marca la entrega y botón de confirmación para el comprador.

**Architecture:** Dos endpoints PATCH nuevos siguiendo el patrón existente de `markSent`. El vendedor llama a su endpoint desde `MisVentasPage`; el comprador llama al suyo desde `Purchases`. El email se dispara fire-and-forget dentro del handler del vendedor.

**Tech Stack:** Express 5, MikroORM 6, TypeScript, React 19, Tailwind CSS, nodemailer (ya configurado en `backend/src/shared/mailer.ts`), axios (`api` de `src/services/api.ts`)

---

## File Map

| Archivo | Cambio |
|---------|--------|
| `backend/src/vendedor/vendedor.controller.ts` | Agregar función `entregarTienda` |
| `backend/src/vendedor/vendedor.routes.ts` | Registrar `PATCH /:id/ventas/:compraId/entregar-tienda` |
| `backend/src/compra/compra.controler.ts` | Agregar función `retirar` |
| `backend/src/compra/compra.routes.ts` | Registrar `PATCH /:id/retirar` |
| `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx` | Botón "Entregar a tienda" + badges de estado |
| `vite-project/vite-project-ts/src/pages/Purchases.tsx` | Botón "Confirmar retiro" + badge "Retirado" |

---

## Task 1: Función `entregarTienda` en el controller del vendedor

**Files:**
- Modify: `backend/src/vendedor/vendedor.controller.ts`

- [ ] **Step 1: Agregar la función `entregarTienda` al final del archivo, antes del `export`**

Abrir `backend/src/vendedor/vendedor.controller.ts`. Ubicar el bloque `export { ... }` al final (línea ~221). Insertar la siguiente función **antes** de ese export:

```typescript
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
      item.cartas.getItems().some(card => card.uploader?.id === vendedorId)
    );
    if (!isVendor) return res.status(403).json({ message: 'No eres vendedor en esta compra' });

    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'entregado_a_tienda';
    await em.flush();

    // Email fire-and-forget
    const destinatario = compra.comprador?.email || compra.email;
    const nombreComprador = compra.comprador?.username || compra.nombre || 'comprador';
    const tienda = compra.tiendaRetiro;

    if (destinatario && tienda) {
      const html = `
        <h2>¡Buenas noticias, ${nombreComprador}!</h2>
        <p>Tu pedido <strong>#${compra.id}</strong> ya está disponible para retirar en:</p>
        <p><strong>${tienda.nombre}</strong><br/>
        ${tienda.direccion}<br/>
        ${tienda.horario ? `🕐 ${tienda.horario}` : ''}</p>
        <p>Cuando vayas a retirarlo, marcalo como completado desde <strong>"Mis Compras"</strong> en la web.</p>
      `;
      sendEmail(
        destinatario,
        `Tu pedido #${compra.id} está listo para retirar`,
        `Tu pedido #${compra.id} está listo para retirar en ${tienda.nombre}`,
        html
      );
    }

    res.json({ message: 'Pedido marcado como entregado a tienda', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 2: Agregar `entregarTienda` al export del archivo**

Localizar la línea:
```typescript
export { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent };
```
Reemplazarla por:
```typescript
export { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent, entregarTienda };
```

- [ ] **Step 3: Verificar que el archivo compila sin errores**

```bash
cd backend && pnpm tsc --noEmit
```
Esperado: sin errores de tipo.

---

## Task 2: Registrar la ruta en vendedor.routes.ts

**Files:**
- Modify: `backend/src/vendedor/vendedor.routes.ts`

- [ ] **Step 1: Importar `entregarTienda` en el router**

Localizar la línea de import:
```typescript
import { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent } from './vendedor.controller.js';
```
Reemplazarla por:
```typescript
import { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent, entregarTienda } from './vendedor.controller.js';
```

- [ ] **Step 2: Agregar la nueva ruta PATCH junto a la de `markSent`**

Localizar la línea:
```typescript
vendedorRouter.post('/:id/ventas/:compraId/enviar', authenticate, authorizeRoles('vendedor'), authorizeSelf, markSent);
```
Agregar inmediatamente después:
```typescript
vendedorRouter.patch('/:id/ventas/:compraId/entregar-tienda', authenticate, authorizeRoles('vendedor'), authorizeSelf, entregarTienda);
```

- [ ] **Step 3: Verificar compilación**

```bash
cd backend && pnpm tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 4: Probar el endpoint manualmente con curl (backend corriendo)**

Primero obtener un token de vendedor haciendo POST `/api/vendedores/login`. Luego:

```bash
curl -X PATCH http://localhost:3000/api/vendedores/<vendedorId>/ventas/<compraId>/entregar-tienda \
  -H "Authorization: Bearer <TOKEN>"
```

Caso exitoso → `200 { message: 'Pedido marcado como entregado a tienda', data: {...} }`  
Caso compra ya en estado distinto → `400 { message: 'La compra no está en estado pendiente' }`  
Caso vendedor incorrecto → `403`

- [ ] **Step 5: Commit**

```bash
git add backend/src/vendedor/vendedor.controller.ts backend/src/vendedor/vendedor.routes.ts
git commit -m "feat: endpoint PATCH entregar-tienda con email al comprador"
```

---

## Task 3: Función `retirar` en el controller de compras

**Files:**
- Modify: `backend/src/compra/compra.controler.ts`

- [ ] **Step 1: Agregar la función `retirar` antes del export al final del archivo**

Abrir `backend/src/compra/compra.controler.ts`. Ubicar el `export { ... }` final (línea ~366). Insertar antes:

```typescript
async function retirar(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);

    const compra = await em.findOne(
      Compra,
      { id, comprador: { id: req.actor!.id } },
      { populate: ['comprador'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o acceso denegado' });

    if (compra.estado !== 'entregado_a_tienda') {
      return res.status(400).json({ message: 'El pedido aún no fue entregado a la tienda' });
    }

    compra.estado = 'retirado';
    await em.flush();

    res.json({ message: 'Pedido marcado como retirado', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
```

- [ ] **Step 2: Agregar `retirar` al export del archivo**

Localizar:
```typescript
export { sanitizeCompraInput, findAll, findOne, add, update, remove, createPreference };
```
Reemplazar por:
```typescript
export { sanitizeCompraInput, findAll, findOne, add, update, remove, createPreference, retirar };
```

- [ ] **Step 3: Verificar compilación**

```bash
cd backend && pnpm tsc --noEmit
```
Esperado: sin errores.

---

## Task 4: Registrar la ruta PATCH /compras/:id/retirar

**Files:**
- Modify: `backend/src/compra/compra.routes.ts`

- [ ] **Step 1: Importar `retirar` en el router**

Localizar la línea de import:
```typescript
import {
  sanitizeCompraInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  createPreference,
} from "./compra.controler.js";
```
Reemplazar por:
```typescript
import {
  sanitizeCompraInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  createPreference,
  retirar,
} from "./compra.controler.js";
```

- [ ] **Step 2: Agregar la ruta al router**

Localizar la última línea del archivo:
```typescript
compraRouter.delete("/:id", authenticate, authorizeRoles('user'), remove);
```
Agregar después:
```typescript
compraRouter.patch("/:id/retirar", authenticate, authorizeRoles('user'), retirar);
```

**Nota:** Esta ruta debe ir **antes** del `patch("/:id", ...)` genérico existente, pero como esa ruta usa `sanitizeCompraInput` y `update` y tiene un segmento más específico (`/retirar` vs. `/:id`), Express la resuelve correctamente en cualquier orden. Aún así, por claridad, colocarla antes del patch genérico.

- [ ] **Step 3: Verificar compilación y probar manualmente**

```bash
cd backend && pnpm tsc --noEmit
```

Probar con curl (token de usuario comprador):
```bash
# Estado distinto a 'entregado_a_tienda' → debe retornar 400
curl -X PATCH http://localhost:3000/api/compras/<compraId>/retirar \
  -H "Authorization: Bearer <TOKEN_USUARIO>"

# Después de que el vendedor marcó 'entregado_a_tienda' → debe retornar 200
curl -X PATCH http://localhost:3000/api/compras/<compraId>/retirar \
  -H "Authorization: Bearer <TOKEN_USUARIO>"
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/compra/compra.controler.ts backend/src/compra/compra.routes.ts
git commit -m "feat: endpoint PATCH /compras/:id/retirar con validacion de estado"
```

---

## Task 5: Actualizar MisVentasPage — botón y badges del vendedor

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/MisVentasPage.tsx`

- [ ] **Step 1: Agregar el handler `handleEntregarTienda`**

En `MisVentasPage.tsx`, localizar la función `handleMarkSent` (línea ~38). Agregar inmediatamente después:

```typescript
const handleEntregarTienda = async (compraId: number) => {
  try {
    if (!confirm('¿Confirmás que dejaste el pedido en la tienda?')) return;
    await api.patch(`/api/vendedores/${user?.id}/ventas/${compraId}/entregar-tienda`);
    alert('Pedido marcado como entregado a tienda. El comprador fue notificado por email.');
    await fetchVentas();
  } catch (err: any) {
    alert('Error: ' + (err.response?.data?.message || err.message));
  }
};
```

- [ ] **Step 2: Reemplazar el bloque del botón de acción de tienda**

Localizar el bloque condicional que muestra el botón de intermediario (aproximadamente líneas 159–169):
```typescript
{venta.envio &&
  venta.estado !== 'ENVIADO_A_INTERMEDIARIO' &&
  venta.estado !== 'ENTREGADO' &&
  venta.estado !== 'entregado' && (
    <button
      className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
      onClick={() => handleMarkSent(venta.id)}
    >
      Ya envié el paquete al Intermediario
    </button>
  )}
```

Reemplazar por este bloque que maneja AMBOS casos (tienda y intermediario) sin borrar la lógica existente de intermediario:

```typescript
{/* Acciones para retiro en tienda */}
{venta.tiendaRetiro && venta.estado === 'pendiente' && (
  <button
    className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
    onClick={() => handleEntregarTienda(venta.id)}
  >
    Entregar a tienda
  </button>
)}
{venta.tiendaRetiro && venta.estado === 'entregado_a_tienda' && (
  <div className="w-full mt-4 bg-blue-100 text-blue-800 font-semibold py-2 px-4 rounded-lg text-center">
    Entregado a tienda ✓
  </div>
)}
{venta.estado === 'retirado' && (
  <div className="w-full mt-4 bg-green-100 text-green-800 font-semibold py-2 px-4 rounded-lg text-center">
    Retirado ✓
  </div>
)}

{/* Acción para envío por intermediario (lógica existente, sin cambios) */}
{venta.envio &&
  venta.estado !== 'ENVIADO_A_INTERMEDIARIO' &&
  venta.estado !== 'ENTREGADO' &&
  venta.estado !== 'entregado' && (
    <button
      className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
      onClick={() => handleMarkSent(venta.id)}
    >
      Ya envié el paquete al Intermediario
    </button>
  )}
```

- [ ] **Step 3: Verificar que el frontend compila sin errores de tipo**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 4: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/MisVentasPage.tsx
git commit -m "feat: MisVentasPage - boton entregar a tienda y badges de estado"
```

---

## Task 6: Actualizar Purchases — botón de retiro y badge para el comprador

**Files:**
- Modify: `vite-project/vite-project-ts/src/pages/Purchases.tsx`

- [ ] **Step 1: Agregar el handler `handleRetirar`**

En `Purchases.tsx`, localizar la función `handleOpenReview` (línea ~21). Agregar después de ella y antes del `useEffect`:

```typescript
const handleRetirar = async (compraId: number) => {
  try {
    if (!confirm('¿Confirmás que retiraste el pedido de la tienda?')) return;
    await fetchApi(`/api/compras/${compraId}/retirar`, { method: 'PATCH' });
    // Recargar compras
    const res = await fetchApi(`/api/compras?compradorId=${user!.id}`);
    const json = await res.json();
    setCompras(json.data || []);
  } catch (err: any) {
    alert('Error: ' + err.message);
  }
};
```

- [ ] **Step 2: Agregar botón "Confirmar retiro" y badge "Retirado" en la sección de tiendaRetiro**

Localizar el bloque condicional de `tiendaRetiro` (aproximadamente líneas 136–163):
```tsx
{comp.tiendaRetiro ? (
  <div style={{ ... }}>
    <p ...>📍 Retiro en tienda: {comp.tiendaRetiro.nombre}</p>
    <p ...>{comp.tiendaRetiro.direccion}</p>
    {comp.tiendaRetiro.horario && (
      <p ...>🕐 {comp.tiendaRetiro.horario}</p>
    )}
  </div>
) : (
  <p ...>💬 Entrega a coordinar con el vendedor via chat</p>
)}
```

Reemplazar el lado del `true` (solo el `<div>` interior, no el `comp.tiendaRetiro ?` en sí) para agregar el botón condicionalmente:

```tsx
{comp.tiendaRetiro ? (
  <div
    style={{
      background: '#fff7ed',
      border: '1px solid #fed7aa',
      borderRadius: '0.5rem',
      padding: '0.6rem 0.9rem',
      marginBottom: '0.5rem',
    }}
  >
    <p style={{ fontWeight: 600, margin: 0, color: '#92400e' }}>
      📍 Retiro en tienda: {comp.tiendaRetiro.nombre}
    </p>
    <p style={{ fontSize: '0.85rem', color: '#78350f', margin: '0.15rem 0 0' }}>
      {comp.tiendaRetiro.direccion}
    </p>
    {comp.tiendaRetiro.horario && (
      <p style={{ fontSize: '0.8rem', color: '#92400e', margin: '0.1rem 0 0' }}>
        🕐 {comp.tiendaRetiro.horario}
      </p>
    )}

    {comp.estado === 'entregado_a_tienda' && (
      <button
        onClick={() => handleRetirar(comp.id)}
        style={{
          marginTop: '0.75rem',
          width: '100%',
          background: '#16a34a',
          color: 'white',
          border: 'none',
          borderRadius: '0.4rem',
          padding: '0.5rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Confirmar retiro
      </button>
    )}

    {comp.estado === 'retirado' && (
      <p style={{ marginTop: '0.5rem', color: '#15803d', fontWeight: 600 }}>
        ✓ Retirado
      </p>
    )}
  </div>
) : (
  <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
    💬 Entrega a coordinar con el vendedor via chat
  </p>
)}
```

- [ ] **Step 3: Actualizar el badge de estado en el header de la orden**

Localizar el `<span>` que muestra `{comp.estado}` (aproximadamente línea 109):
```tsx
<span className="bg-gray-100 px-2 py-1 rounded text-xs">
  {comp.estado}
</span>
```
Reemplazar por:
```tsx
<span className={`px-2 py-1 rounded text-xs font-medium ${
  comp.estado === 'retirado'
    ? 'bg-green-100 text-green-800'
    : comp.estado === 'entregado_a_tienda'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-gray-100 text-gray-700'
}`}>
  {comp.estado === 'retirado'
    ? 'Retirado'
    : comp.estado === 'entregado_a_tienda'
    ? 'Listo para retirar'
    : comp.estado}
</span>
```

- [ ] **Step 4: Verificar compilación TypeScript**

```bash
cd vite-project/vite-project-ts && pnpm tsc --noEmit
```
Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add vite-project/vite-project-ts/src/pages/Purchases.tsx
git commit -m "feat: Purchases - boton confirmar retiro y badge de estado"
```

---

## Task 7: Smoke test end-to-end manual

- [ ] **Step 1: Levantar backend y frontend**

```bash
# Terminal 1
cd backend && pnpm start:dev

# Terminal 2
cd vite-project/vite-project-ts && pnpm run dev
```

- [ ] **Step 2: Flujo completo como vendedor**

1. Loguearse como vendedor en `http://localhost:5173`
2. Ir a "Mis Ventas"
3. Buscar una venta que tenga `tiendaRetiro` y estado `pendiente`
4. Hacer clic en "Entregar a tienda" → confirmar el diálogo
5. Verificar: el botón desaparece y aparece el badge azul "Entregado a tienda ✓"
6. Verificar en la bandeja de entrada del comprador que llegó el email con nombre/dirección/horario de la tienda

- [ ] **Step 3: Flujo completo como comprador**

1. Loguearse como el comprador correspondiente
2. Ir a "Mis Compras"
3. Verificar: la orden muestra badge azul "Listo para retirar" y el botón verde "Confirmar retiro"
4. Hacer clic en "Confirmar retiro" → confirmar el diálogo
5. Verificar: el botón desaparece y aparece "✓ Retirado" en verde; el badge superior también es verde "Retirado"

- [ ] **Step 4: Verificar que el botón NO aparece si el estado no es correcto**

- Una orden en estado `pendiente` sin `tiendaRetiro`: no debe mostrar el botón "Entregar a tienda"
- Una orden en estado `pendiente` con `tiendaRetiro`: solo el vendedor ve "Entregar a tienda"; el comprador NO ve "Confirmar retiro"
- Llamar directamente a `PATCH /api/compras/:id/retirar` con una compra en estado `pendiente` → debe retornar `400`
