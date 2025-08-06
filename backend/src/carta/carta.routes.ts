import { Router } from "express";
import { sanitizeCartaInput, findAll, findOne, add, update, remove } from "./carta.controler.js";

export const cartaRouter = Router();

cartaRouter.get('/', findAll);
cartaRouter.get('/:id', findOne);
cartaRouter.post('/', sanitizeCartaInput, add);
cartaRouter.put('/:id', sanitizeCartaInput, update);
cartaRouter.patch('/:id', sanitizeCartaInput, update);
cartaRouter.delete('/:id', remove);