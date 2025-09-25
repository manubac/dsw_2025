import { Router } from "express";
import { findAll, findOne, add, update, remove } from "./cartaClass.controler.js";

export const cartaClassRouter = Router();

cartaClassRouter.get('/', findAll);
cartaClassRouter.get('/:id', findOne);
cartaClassRouter.post('/', add);
cartaClassRouter.put('/:id', update);
cartaClassRouter.delete('/:id', remove);