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
    planEnvio,            // NEW
    updateCompraStatus,    // NEW
    deleteEnvio
} from "./intermediario.controller.js";

export const intermediarioRouter = Router();

intermediarioRouter.get("/", findAll);
intermediarioRouter.post("/", sanitizeIntermediarioInput, add);
intermediarioRouter.post("/login", login);

// Routes with :id param
intermediarioRouter.get("/:id", findOne);
intermediarioRouter.put("/:id", sanitizeIntermediarioInput, update);
intermediarioRouter.patch("/:id", sanitizeIntermediarioInput, update);
intermediarioRouter.delete("/:id", remove);

// New Routes for Envios (Use generic resource paths where possible or scoped)
intermediarioRouter.get("/:id/envios", getEnvios); // ?type=origen|destino

// Actions
intermediarioRouter.post("/envios/plan", planEnvio); // /api/intermediarios/... doesn't match easily if not scoped, so maybe move this to Envio Controller? 
// Actually, let's keep it here but route it via app.ts or just use specific paths
// Since app.ts mounts this on /api/intermediarios, we need to handle "plan" carefully or put it on POST /:id/envios

// Let's use specific paths as called in frontend
intermediarioRouter.post("/compras/:compraId/status", updateCompraStatus);
intermediarioRouter.post("/envios/:envioId/despachar", dispatchEnvio);
intermediarioRouter.post("/envios/:envioId/recibir", receiveEnvio);
intermediarioRouter.put("/envios/:envioId", updateEnvioDetails);
intermediarioRouter.delete("/envios/:envioId", deleteEnvio);
