import { Router, Response } from "express";
import { orm } from "../shared/db/orm.js";
import { Mensaje } from "./mensaje.entity.js";
import { Compra } from "../compra/compra.entity.js";
import { authenticate, AuthRequest } from "../shared/middleware/auth.js";
import { io } from "../socket/index.js";
import { crearNotificacionesMensaje } from '../notificacion/notificacion.service.js';

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

    crearNotificacionesMensaje(compraId, req.actorRole ?? 'user', actor.id).catch(() => {});

    res.status(201).json({ data: mensaje });
  } catch (error: any) {
    res.status(500).json({ message: "Error al enviar mensaje", error: error.message });
  }
});
