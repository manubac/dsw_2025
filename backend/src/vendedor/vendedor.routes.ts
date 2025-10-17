import {Router} from 'express';
import { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout } from './vendedor.controller.js';

export const vendedorRouter = Router();

vendedorRouter.post('/login', login);
vendedorRouter.post('/logout', logout);
vendedorRouter.get('/', findAll);
vendedorRouter.get('/:id', findOne);
vendedorRouter.post('/', sanitiseVendedorInput, add);
vendedorRouter.put('/:id', sanitiseVendedorInput, update);
vendedorRouter.patch('/:id', sanitiseVendedorInput, update);
vendedorRouter.delete('/:id', remove);
