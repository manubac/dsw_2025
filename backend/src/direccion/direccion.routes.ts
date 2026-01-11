import { Router } from 'express';
import { sanitizeDireccionInput, findAll, findOne, add, update, remove } from './direccion.controller.js';

export const direccionRouter = Router();

direccionRouter.get('/', findAll);
direccionRouter.get('/:id', findOne);
direccionRouter.post('/', sanitizeDireccionInput, add);
direccionRouter.put('/:id', sanitizeDireccionInput, update);
direccionRouter.delete('/:id', remove);