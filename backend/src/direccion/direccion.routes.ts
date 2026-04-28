import { Router } from 'express';
import { sanitizeDireccionInput, findAll, findOne, add, update, remove } from './direccion.controller.js';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';

export const direccionRouter = Router();

// Solo los actores autenticados pueden leer sus propias direcciones
direccionRouter.get('/', authenticate, findAll);
direccionRouter.get('/:id', authenticate, findOne);

// Tanto users (dirección de entrega) como intermediarios (dirección de recogida) gestionan direcciones
direccionRouter.post('/', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro', 'intermediario'), sanitizeDireccionInput, add);
direccionRouter.put('/:id', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro', 'intermediario'), sanitizeDireccionInput, update);
direccionRouter.delete('/:id', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro', 'intermediario'), remove);