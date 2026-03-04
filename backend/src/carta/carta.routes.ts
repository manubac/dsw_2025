import { Router } from "express";
import {
  sanitizeCartaInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  // findFromAPI,  // deshabilitado
  // scrapeCartas, // deshabilitado
} from "./carta.controler.js";

export const cartaRouter = Router();

// Scraping con Puppeteer — deshabilitado, se suben manualmente
// cartaRouter.get("/scrape/:nombre", scrapeCartas);

// Buscar Pokémon desde PokeAPI — deshabilitado
// cartaRouter.get("/search/:nombre", findFromAPI);

// CRUD básico
cartaRouter.get("/", findAll);
cartaRouter.get("/:id", findOne);
cartaRouter.post("/", sanitizeCartaInput, add);
cartaRouter.put("/:id", sanitizeCartaInput, update);
cartaRouter.patch("/:id", sanitizeCartaInput, update);
cartaRouter.delete("/:id", remove);
