import {Router} from 'express';
import { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent, entregarTienda } from './vendedor.controller.js';
import { authenticate, authorizeRoles, authorizeSelf } from '../shared/middleware/auth.js';

export const vendedorRouter = Router();

// Rutas públicas
vendedorRouter.post('/login', login);
vendedorRouter.post('/', sanitiseVendedorInput, add);                               // registro
vendedorRouter.get('/', findAll);
vendedorRouter.get('/:id', findOne);

// Autenticado – cualquier token válido puede cerrar sesión
vendedorRouter.post('/logout', authenticate, logout);

// Solo el propio vendedor puede acceder a sus ventas o marcar items como enviados
vendedorRouter.get('/:id/ventas', authenticate, authorizeRoles('vendedor'), authorizeSelf, getVentas);
vendedorRouter.post('/:id/ventas/:compraId/enviar', authenticate, authorizeRoles('vendedor'), authorizeSelf, markSent);
vendedorRouter.patch('/:id/ventas/:compraId/entregar-tienda', authenticate, authorizeRoles('vendedor'), authorizeSelf, entregarTienda);

// Solo el propio vendedor puede modificar o eliminar su perfil
vendedorRouter.put('/:id', authenticate, authorizeRoles('vendedor'), authorizeSelf, sanitiseVendedorInput, update);
vendedorRouter.patch('/:id', authenticate, authorizeRoles('vendedor'), authorizeSelf, sanitiseVendedorInput, update);
vendedorRouter.delete('/:id', authenticate, authorizeRoles('vendedor'), authorizeSelf, remove);
