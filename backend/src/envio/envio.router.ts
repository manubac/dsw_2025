import { Router } from "express";
import { sanitizeEnvioInput, findAll, findOne, add, update, remove, addCompra, removeCompra, planEnvio, activateEnvio } from "./envio.controller.js";
import { authenticate, authorizeRoles } from "../shared/middleware/auth.js";

const envioRouter = Router();

// Público: el checkout necesita listar envíos disponibles sin autenticación
envioRouter.get("/", findAll);
// Gestión autenticada (solo intermediarios)
envioRouter.get("/:id", authenticate, authorizeRoles('intermediario'), findOne);
envioRouter.post("/", authenticate, authorizeRoles('intermediario'), sanitizeEnvioInput, add);
envioRouter.put("/:id", authenticate, authorizeRoles('intermediario'), sanitizeEnvioInput, update);
envioRouter.delete("/:id", authenticate, authorizeRoles('intermediario'), remove);
envioRouter.post("/plan", authenticate, authorizeRoles('intermediario'), planEnvio);
envioRouter.post("/:id/activate", authenticate, authorizeRoles('intermediario'), activateEnvio);
envioRouter.post("/:id/compras", authenticate, authorizeRoles('intermediario'), addCompra);
envioRouter.delete("/:id/compras", authenticate, authorizeRoles('intermediario'), removeCompra);

export default envioRouter;