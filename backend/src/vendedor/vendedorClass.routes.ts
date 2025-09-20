import {Router} from 'express';
import {  findAll, findOne, add, update,remove } from './vendedorClass.controller.js';
import { vendedorRouter } from './vendedor.routes.js';

export const vendedorClassRouter = Router();

vendedorClassRouter.get('/', findAll);
vendedorClassRouter.get('/:id', findOne);
vendedorClassRouter.post('/',  add);
vendedorClassRouter.put('/:id',  update);
vendedorClassRouter.delete('/:id', remove);
