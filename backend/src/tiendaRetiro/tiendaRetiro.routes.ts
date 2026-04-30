import { Router } from "express";
import {
  sanitizeTiendaRetiroInput,
  sanitizePublicacionTiendaInput,
  findAll,
  findOne,
  add,
  login,
  update,
  getVentas,
  marcarEnTienda,
  finalizarCompra,
  getPublicaciones,
  addPublicacion,
  updatePublicacion,
  removePublicacion,
  getVentasDirectas,
  marcarListoParaRetirar,
  finalizarVentaDirecta,
} from "./tiendaRetiro.controller.js";
import { authenticate, authorizeRoles, authorizeSelf } from "../shared/middleware/auth.js";

export const tiendaRouter = Router();

tiendaRouter.get("/", findAll);
tiendaRouter.post("/", sanitizeTiendaRetiroInput, add);
tiendaRouter.post("/login", login);
tiendaRouter.get("/:id", findOne);
tiendaRouter.patch("/:id", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizeTiendaRetiroInput, update);

// Flujo 1: vendedor + tienda de retiro (3 actores)
tiendaRouter.get("/:id/ventas", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getVentas);
tiendaRouter.patch("/:id/ventas/:compraId/en-tienda", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, marcarEnTienda);
tiendaRouter.patch("/:id/ventas/:compraId/finalizar", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, finalizarCompra);

// Publicaciones propias de la tienda
tiendaRouter.get("/:id/publicaciones", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getPublicaciones);
tiendaRouter.post("/:id/publicaciones", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizePublicacionTiendaInput, addPublicacion);
tiendaRouter.patch("/:id/publicaciones/:cartaId", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizePublicacionTiendaInput, updatePublicacion);
tiendaRouter.delete("/:id/publicaciones/:cartaId", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, removePublicacion);

// Flujo 2: tienda vende directamente (2 actores)
tiendaRouter.get("/:id/ventas-directas", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getVentasDirectas);
tiendaRouter.patch("/:id/ventas-directas/:compraId/listo", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, marcarListoParaRetirar);
tiendaRouter.patch("/:id/ventas-directas/:compraId/finalizar", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, finalizarVentaDirecta);
