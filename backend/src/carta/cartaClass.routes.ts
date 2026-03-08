import { Router } from "express";
import { findAll, findOne, add, update, remove } from "./cartaClass.controler.js";
import { authenticate, authorizeRoles } from "../shared/middleware/auth.js";

export const cartaClassRouter = Router();

// Público
cartaClassRouter.get('/', findAll);
cartaClassRouter.get('/:id', findOne);

// Solo los vendedores pueden gestionar las clases de cartas
cartaClassRouter.post('/', authenticate, authorizeRoles('vendedor'), add);
cartaClassRouter.put('/:id', authenticate, authorizeRoles('vendedor'), update);
cartaClassRouter.delete('/:id', authenticate, authorizeRoles('vendedor'), remove);