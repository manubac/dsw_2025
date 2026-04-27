import { Router } from "express";
import {
  sanitizeTiendaRetiroInput,
  findAll,
  findOne,
  add,
  login,
  update,
  getVentas,
  marcarEnTienda,
  finalizarCompra,
} from "./tiendaRetiro.controller.js";
import { authenticate, authorizeRoles, authorizeSelf } from "../shared/middleware/auth.js";

export const tiendaRouter = Router();

tiendaRouter.get("/", findAll);
tiendaRouter.post("/", sanitizeTiendaRetiroInput, add);
tiendaRouter.post("/login", login);
tiendaRouter.get("/:id", findOne);
tiendaRouter.patch("/:id", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizeTiendaRetiroInput, update);
tiendaRouter.get("/:id/ventas", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getVentas);
tiendaRouter.patch("/:id/ventas/:compraId/en-tienda", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, marcarEnTienda);
tiendaRouter.patch("/:id/ventas/:compraId/finalizar", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, finalizarCompra);
