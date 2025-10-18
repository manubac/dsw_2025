import { Router } from "express";
import { sanitizeCartaInput, findAll, findOne, add, update, remove, findFromAPI} from "./carta.controler.js";

export const cartaRouter = Router();

// 👇 Cambiamos la ruta, sin el prefijo /api
cartaRouter.get("/search/:nombre", findFromAPI);

cartaRouter.get('/', findAll);
cartaRouter.get('/:id', findOne);
cartaRouter.post('/', sanitizeCartaInput, add);
cartaRouter.put('/:id', sanitizeCartaInput, update);
cartaRouter.patch('/:id', sanitizeCartaInput, update);
cartaRouter.delete('/:id', remove);