# WebSockets Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el polling REST de 4 segundos en Chat.tsx con push en tiempo real via socket.io, manteniendo la persistencia en PostgreSQL.

**Architecture:** El POST REST sigue persistiendo mensajes en DB. Tras `em.flush()`, el servidor emite `nuevo_mensaje` a la room `compra-{id}` via socket.io. El frontend se conecta al montar, se une a la room, y escucha el evento para actualizar el state sin polling.

**Tech Stack:** socket.io v4 (backend), socket.io-client v4 (frontend), JWT para auth del handshake

---

## File Map

| Action | File |
|--------|------|
| Modify | `backend/src/server.ts` |
| Create | `backend/src/socket/index.ts` |
| Modify | `backend/src/mensaje/mensaje.routes.ts` |
| Modify | `vite-project/vite-project-ts/src/components/Chat.tsx` |

---

### Task 1: Instalar dependencias

**Files:**
- Modify: `backend/package.json` (via pnpm)
- Modify: `vite-project/vite-project-ts/package.json` (via pnpm)

- [ ] **Step 1: Instalar socket.io en backend**

```bash
cd backend && pnpm add socket.io
```

Expected: `socket.io` aparece en `dependencies` de `backend/package.json`.

- [ ] **Step 2: Instalar socket.io-client en frontend**

```bash
cd vite-project/vite-project-ts && pnpm add socket.io-client
```

Expected: `socket.io-client` aparece en `dependencies` del frontend.

- [ ] **Step 3: Commit**

```bash
git add backend/package.json backend/pnpm-lock.yaml vite-project/vite-project-ts/package.json vite-project/vite-project-ts/pnpm-lock.yaml
git commit -m "chore: add socket.io and socket.io-client dependencies"
```

---

### Task 2: Crear módulo socket.io en backend

**Files:**
- Create: `backend/src/socket/index.ts`

- [ ] **Step 1: Crear el archivo `backend/src/socket/index.ts`**

```typescript
import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

export let io: Server;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('No token'));
    try {
      jwt.verify(token, process.env.JWT_SECRET || 'default_secret');
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('join_compra', (compraId: number) => {
      socket.join(`compra-${compraId}`);
    });
  });

  return io;
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/socket/index.ts
git commit -m "feat: add socket.io server module with JWT auth"
```

---

### Task 3: Actualizar server.ts para usar http.Server

**Files:**
- Modify: `backend/src/server.ts`

- [ ] **Step 1: Reemplazar contenido de `backend/src/server.ts`**

```typescript
import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './socket/index.js';

const PORT = 3000;

async function startServer() {
  try {
    console.log('DB schema sync completed');
  } catch (err) {
    console.error('Error syncing DB schema on startup:', err);
  }

  const httpServer = createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

startServer();
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: attach socket.io to http server"
```

---

### Task 4: Emitir evento en mensaje.routes.ts tras flush

**Files:**
- Modify: `backend/src/mensaje/mensaje.routes.ts`

- [ ] **Step 1: Reemplazar contenido de `backend/src/mensaje/mensaje.routes.ts`**

```typescript
import { Router, Response } from "express";
import { orm } from "../shared/db/orm.js";
import { Mensaje } from "./mensaje.entity.js";
import { Compra } from "../compra/compra.entity.js";
import { authenticate, AuthRequest } from "../shared/middleware/auth.js";
import { io } from "../socket/index.js";

export const mensajeRouter = Router();

// GET /api/mensajes/:compraId — historial de mensajes de una compra
mensajeRouter.get("/:compraId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const compraId = Number(req.params.compraId);
    const mensajes = await em.find(
      Mensaje,
      { compra: { id: compraId } },
      { orderBy: { createdAt: 'ASC' } }
    );
    res.json({ data: mensajes });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener mensajes", error: error.message });
  }
});

// POST /api/mensajes/:compraId — enviar un mensaje
mensajeRouter.post("/:compraId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const compraId = Number(req.params.compraId);
    const { texto } = req.body;

    if (!texto?.trim()) {
      return res.status(400).json({ message: "El mensaje no puede estar vacío" });
    }

    const compra = await em.findOne(Compra, { id: compraId });
    if (!compra) {
      return res.status(404).json({ message: "Compra no encontrada" });
    }

    const actor = req.actor as any;
    const senderNombre = actor.username || actor.nombre || "Usuario";

    const mensaje = em.create(Mensaje, {
      compra,
      senderId: actor.id,
      senderRole: req.actorRole ?? 'user',
      senderNombre,
      texto: texto.trim(),
    });

    await em.flush();

    io.to(`compra-${compraId}`).emit('nuevo_mensaje', mensaje);

    res.status(201).json({ data: mensaje });
  } catch (error: any) {
    res.status(500).json({ message: "Error al enviar mensaje", error: error.message });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/mensaje/mensaje.routes.ts
git commit -m "feat: emit nuevo_mensaje socket event after DB persist"
```

---

### Task 5: Actualizar Chat.tsx para usar socket.io-client

**Files:**
- Modify: `vite-project/vite-project-ts/src/components/Chat.tsx`

- [ ] **Step 1: Reemplazar contenido de `vite-project/vite-project-ts/src/components/Chat.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { io as socketIO } from 'socket.io-client'
import { useUser } from '../context/user'
import { fetchApi } from '../services/api'

interface Mensaje {
  id: number
  senderId: number
  senderRole: string
  senderNombre: string
  texto: string
  createdAt: string
}

interface ChatProps {
  compraId: number
}

export function Chat({ compraId }: ChatProps) {
  const { user } = useUser()
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    const token = stored ? JSON.parse(stored)?.token : undefined

    const socket = socketIO('http://localhost:3000', {
      auth: { token },
    })

    socket.on('connect', () => {
      socket.emit('join_compra', compraId)
    })

    socket.on('nuevo_mensaje', (msg: Mensaje) => {
      setMensajes((prev) => [...prev, msg])
    })

    fetchApi(`/api/mensajes/${compraId}`)
      .then((res) => res.json())
      .then((json) => setMensajes(json.data || []))
      .catch(() => {})

    return () => {
      socket.disconnect()
    }
  }, [compraId])

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [mensajes])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!texto.trim() || enviando) return

    setEnviando(true)
    try {
      await fetchApi(`/api/mensajes/${compraId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      setTexto('')
    } catch {
      // silencioso
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-orange-50 px-4 py-2 border-b border-gray-200">
        <h4 className="text-sm font-semibold text-orange-700">Chat — Acordar punto de encuentro</h4>
      </div>

      <div ref={containerRef} className="h-52 overflow-y-auto p-3 space-y-2 bg-white">
        {mensajes.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-6">
            Aún no hay mensajes. ¡Iniciá la conversación!
          </p>
        )}
        {mensajes.map((m) => {
          const myRole = user?.role === 'usuario' ? 'user' : (user?.role ?? 'user')
          const esMio = Number(m.senderId) === Number(user?.id) && m.senderRole === myRole
          return (
            <div key={m.id} className={`flex ${esMio ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                  esMio
                    ? 'bg-orange-500 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}
              >
                {!esMio && (
                  <p className="text-xs font-semibold mb-1 text-gray-500">{m.senderNombre}</p>
                )}
                <p>{m.texto}</p>
                <p className={`text-xs mt-1 ${esMio ? 'text-orange-100' : 'text-gray-400'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSend} className="flex gap-2 p-3 bg-gray-50 border-t border-gray-200">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí un mensaje..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-1.5 text-sm focus:outline-none focus:border-orange-400"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-full text-sm disabled:opacity-40 transition"
        >
          Enviar
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add vite-project/vite-project-ts/src/components/Chat.tsx
git commit -m "feat: replace polling with socket.io real-time in Chat"
```
