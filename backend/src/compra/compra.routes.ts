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

// Compradores (user), vendedores y tiendas de retiro pueden gestionar compras
compraRouter.get("/", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), findAll);
compraRouter.get("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), findOne);
compraRouter.post("/", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, add);
compraRouter.post("/preference", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, createPreference);
compraRouter.put("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, update);
compraRouter.patch("/:id/retirar", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), retirar);
compraRouter.patch("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), sanitizeCompraInput, update);
compraRouter.delete("/:id", authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), remove);
