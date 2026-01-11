import { Router } from "express";
import { sanitizeEnvioInput, findAll, findOne, add, update, remove, addCompra, removeCompra } from "./envio.controller.js";

const envioRouter = Router();

// GET /api/envios - Obtener todos los envios (filtrado por intermediario opcional)
envioRouter.get("/", findAll);

// GET /api/envios/:id - Obtener un envio específico
envioRouter.get("/:id", findOne);

// POST /api/envios - Crear nuevo envio
envioRouter.post("/", sanitizeEnvioInput, add);

// PUT /api/envios/:id - Actualizar envio
envioRouter.put("/:id", sanitizeEnvioInput, update);

// DELETE /api/envios/:id - Eliminar envio
envioRouter.delete("/:id", remove);

// POST /api/envios/:id/compras - Agregar compra a envio
envioRouter.post("/:id/compras", addCompra);

// DELETE /api/envios/:id/compras - Remover compra de envio
envioRouter.delete("/:id/compras", removeCompra);

export default envioRouter;