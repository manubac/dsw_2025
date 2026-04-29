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
  finalizarDirecto,
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

// Publicaciones propias de la tienda
tiendaRouter.get("/:id/publicaciones", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getPublicaciones);
tiendaRouter.post("/:id/publicaciones", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizePublicacionTiendaInput, addPublicacion);
tiendaRouter.patch("/:id/publicaciones/:cartaId", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, sanitizePublicacionTiendaInput, updatePublicacion);
tiendaRouter.delete("/:id/publicaciones/:cartaId", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, removePublicacion);

// Ventas directas (2 actores: tienda vende directamente)
tiendaRouter.get("/:id/ventas-directas", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, getVentasDirectas);
tiendaRouter.patch("/:id/ventas/:compraId/finalizar-directo", authenticate, authorizeRoles("tiendaRetiro"), authorizeSelf, finalizarDirecto);
