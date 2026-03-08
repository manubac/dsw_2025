import { Router } from "express";
import { 
    sanitizeIntermediarioInput, 
    findAll, 
    findOne, 
    add, 
    update, 
    remove, 
    login, 
    getEnvios, 
    receiveEnvio, 
    dispatchEnvio, 
    updateEnvioDetails,
    planEnvio,
    updateCompraStatus,
    deleteEnvio
} from "./intermediario.controller.js";
import { authenticate, authorizeRoles, authorizeSelf } from "../shared/middleware/auth.js";

export const intermediarioRouter = Router();

// Rutas públicas
intermediarioRouter.get("/", findAll);
intermediarioRouter.post("/", sanitizeIntermediarioInput, add);   // registro
intermediarioRouter.post("/login", login);
intermediarioRouter.get("/:id", findOne);

// Solo el propio intermediario puede modificar o eliminar su perfil
intermediarioRouter.put("/:id", authenticate, authorizeRoles('intermediario'), authorizeSelf, sanitizeIntermediarioInput, update);
intermediarioRouter.patch("/:id", authenticate, authorizeRoles('intermediario'), authorizeSelf, sanitizeIntermediarioInput, update);
intermediarioRouter.delete("/:id", authenticate, authorizeRoles('intermediario'), authorizeSelf, remove);

// Solo el propio intermediario puede ver sus envíos
intermediarioRouter.get("/:id/envios", authenticate, authorizeRoles('intermediario'), authorizeSelf, getEnvios);

// Gestión de envíos – cualquier intermediario autenticado
intermediarioRouter.post("/envios/plan", authenticate, authorizeRoles('intermediario'), planEnvio);
intermediarioRouter.post("/compras/:compraId/status", authenticate, authorizeRoles('intermediario'), updateCompraStatus);
intermediarioRouter.post("/envios/:envioId/despachar", authenticate, authorizeRoles('intermediario'), dispatchEnvio);
intermediarioRouter.post("/envios/:envioId/recibir", authenticate, authorizeRoles('intermediario'), receiveEnvio);
intermediarioRouter.put("/envios/:envioId", authenticate, authorizeRoles('intermediario'), updateEnvioDetails);
intermediarioRouter.delete("/envios/:envioId", authenticate, authorizeRoles('intermediario'), deleteEnvio);
