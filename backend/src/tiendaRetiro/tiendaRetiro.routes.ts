import { Router } from "express";
import {
  sanitizeTiendaRetiroInput,
  findAll,
  findOne,
  add,
  login,
  update,
  getVentas,
} from "./tiendaRetiro.controller.js";
import { authenticate, authorizeRoles, authorizeSelf } from "../shared/middleware/auth.js";

export const tiendaRouter = Router();

tiendaRouter.get("/", findAll);
tiendaRouter.post("/", sanitizeTiendaRetiroInput, add);
tiendaRouter.post("/login", login);
tiendaRouter.get("/:id", findOne);
tiendaRouter.patch("/:id", authenticate, authorizeRoles("tiendaRetiro" as any), authorizeSelf, sanitizeTiendaRetiroInput, update);
tiendaRouter.get("/:id/ventas", authenticate, authorizeRoles("tiendaRetiro" as any), authorizeSelf, getVentas);
