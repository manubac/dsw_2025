import {Router} from 'express';
import { findAll, findOne, add, update, remove } from './itemCarta.controler.js';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';

export const itemCartaRouter = Router();

// Público
itemCartaRouter.get('/', findAll);
itemCartaRouter.get('/:id', findOne);

// Vendedores y tiendas de retiro pueden crear, actualizar o eliminar publicaciones de items
itemCartaRouter.post('/', authenticate, authorizeRoles('vendedor', 'tiendaRetiro'), add);
itemCartaRouter.put('/:id', authenticate, authorizeRoles('vendedor', 'tiendaRetiro'), update);
itemCartaRouter.delete('/:id', authenticate, authorizeRoles('vendedor', 'tiendaRetiro'), remove);
