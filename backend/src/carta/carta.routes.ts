import { Router } from "express";
import {
  sanitizeCartaInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  scrapeCartas,
  buscarRarezas,
  getPrecioCoolStuff,
  getPreciosPokemon,
  resolveCartaByCode,
} from "./carta.controler.js";
import { authenticate, authorizeRoles } from "../shared/middleware/auth.js";

export const cartaRouter = Router();

// Público – cualquiera puede consultar las cartas
cartaRouter.get("/", findAll);

// Búsqueda de cartas por juego — requiere estar logueado (cualquier rol)
cartaRouter.get("/scrape/:juego/rarezas", authenticate, buscarRarezas);
cartaRouter.get("/scrape/:juego/:nombre", authenticate, scrapeCartas);
cartaRouter.get("/resolve/:juego", authenticate, resolveCartaByCode);
cartaRouter.get("/precio-coolstuff", authenticate, getPrecioCoolStuff);
cartaRouter.get("/precios-pokemon", authenticate, getPreciosPokemon);

cartaRouter.get("/:id", findOne);

// Solo los vendedores pueden crear, editar o eliminar cartas
cartaRouter.post("/", authenticate, authorizeRoles('vendedor'), sanitizeCartaInput, add);
cartaRouter.put("/:id", authenticate, authorizeRoles('vendedor'), sanitizeCartaInput, update);
cartaRouter.patch("/:id", authenticate, authorizeRoles('vendedor'), sanitizeCartaInput, update);
cartaRouter.delete("/:id", authenticate, authorizeRoles('vendedor'), remove);
