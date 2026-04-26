import { Router } from "express";
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
import { authenticate, authorizeRoles } from "../shared/middleware/auth.js";

export const compraRouter = Router();

// Todas las rutas de compra están restringidas a compradores (users) – los demás roles tienen sus propios endpoints
compraRouter.get("/", authenticate, authorizeRoles('user'), findAll);
compraRouter.get("/:id", authenticate, authorizeRoles('user'), findOne);
compraRouter.post("/", authenticate, authorizeRoles('user'), sanitizeCompraInput, add);
compraRouter.post("/preference", authenticate, authorizeRoles('user'), sanitizeCompraInput, createPreference);
compraRouter.put("/:id", authenticate, authorizeRoles('user'), sanitizeCompraInput, update);
compraRouter.patch("/:id/retirar", authenticate, authorizeRoles('user'), retirar);
compraRouter.patch("/:id", authenticate, authorizeRoles('user'), sanitizeCompraInput, update);
compraRouter.delete("/:id", authenticate, authorizeRoles('user'), remove);
