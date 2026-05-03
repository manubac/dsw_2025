import { Router } from 'express';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';
import { getUnread, getCount, marcarLeidas } from './notificacion.controler.js';

export const notificacionRouter = Router();

notificacionRouter.get('/', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), getUnread);
notificacionRouter.get('/count', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), getCount);
notificacionRouter.patch('/marcar-leidas', authenticate, authorizeRoles('user', 'vendedor', 'tiendaRetiro'), marcarLeidas);
