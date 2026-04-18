# WebSockets Chat — Design Spec
**Date:** 2026-04-18  
**Approach:** Enfoque A — REST persiste, socket.io entrega en tiempo real

## Overview

Replace 4-second polling in `Chat.tsx` with socket.io push notifications. REST endpoints keep handling persistence; socket.io only delivers messages in real time.

## Backend Changes

### 1. `backend/src/server.ts`
- Wrap Express app with `http.createServer(app)`
- Initialize socket.io on the http server (imported from `src/socket/index.ts`)
- Replace `app.listen(PORT)` with `httpServer.listen(PORT)`

### 2. `backend/src/socket/index.ts` (new file)
- Create and export `io` (socket.io Server instance)
- CORS: `{ origin: '*' }` (consistent with existing Express CORS policy)
- Auth middleware: read JWT from `socket.handshake.auth.token`, verify with `jwt.verify`, store actor in `socket.data`
- On connection: listen for `join_compra` event → `socket.join('compra-{compraId}')`

### 3. `backend/src/mensaje/mensaje.routes.ts`
- Import `io` from `../socket/index.js`
- After `em.flush()` in POST handler, emit: `io.to('compra-${compraId}').emit('nuevo_mensaje', mensaje)`

## Frontend Changes

### 4. `vite-project/vite-project-ts/src/components/Chat.tsx`
- Install `socket.io-client`
- On mount: connect socket with `auth: { token }` from localStorage, emit `join_compra` with compraId
- Listen for `nuevo_mensaje` → append to mensajes state
- Remove `setInterval` polling entirely
- Cleanup: `socket.disconnect()` on unmount
- `handleSend` unchanged — still calls POST REST

## Dependencies

| Package | Where |
|---|---|
| `socket.io` | backend |
| `socket.io-client` | frontend (vite-project-ts) |

## Data Flow

```
User types → POST /api/mensajes/:compraId
  → em.flush() persists to DB
  → io.to('compra-X').emit('nuevo_mensaje', mensaje)
  → All connected clients in room receive message instantly
```

## What Does NOT Change
- UI design of Chat.tsx (identical appearance)
- REST endpoints (GET for history on mount, POST for sending)
- MikroORM entity (Mensaje)
- Auth system (JWT reused in socket handshake)
