import { Router } from "express";
import {
  sanitizeCartaInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  getPrecioCoolStuff,
  getPreciosPokemon,
  resolveNames,
  getPopulares,
  getMejoresVendedores,
  incrementViewCount,
} from "./carta.controler.js";
import { authenticate, authorizeRoles } from "../shared/middleware/auth.js";

export const cartaRouter = Router();

// Público – cualquiera puede consultar las cartas
cartaRouter.get("/", findAll);

// Endpoints para la HomePage (deben ir antes de /:id)
cartaRouter.get("/populares", getPopulares);
cartaRouter.get("/mejores-vendedores", getMejoresVendedores);

// Precios via scraping — solo se usan en /publicar (sin auth: son scrapers de sitios públicos)
cartaRouter.get("/precio-coolstuff", getPrecioCoolStuff);
cartaRouter.get("/precios-pokemon", getPreciosPokemon);

// Resolución multiidioma de nombres — usado por la búsqueda del marketplace
cartaRouter.get("/resolve-names", resolveNames);

cartaRouter.get("/:id", findOne);

// Incrementar viewCount (fire-and-forget, sin auth)
cartaRouter.post("/:id/view", incrementViewCount);

// Solo los vendedores pueden crear, editar o eliminar cartas
cartaRouter.post("/", authenticate, authorizeRoles('vendedor'), sanitizeCartaInput, add);
cartaRouter.put("/:id", authenticate, authorizeRoles('vendedor'), sanitizeCartaInput, update);
cartaRouter.patch("/:id", authenticate, authorizeRoles('vendedor'), sanitizeCartaInput, update);
cartaRouter.delete("/:id", authenticate, authorizeRoles('vendedor'), remove);
