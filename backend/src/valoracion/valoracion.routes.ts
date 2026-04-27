import { Router } from 'express';
import { createValoracion, getMyValoraciones, getValoracionesByObjeto, getAverageRating } from './valoracion.controller.js';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';

const router = Router();

router.post('/', authenticate, authorizeRoles('user', 'vendedor'), createValoracion);

// Must be before /:tipoObjeto/:objetoId to avoid route collision
router.get('/mias', authenticate, authorizeRoles('user', 'vendedor'), getMyValoraciones);

// Público – cualquiera puede leer valoraciones y promedios
router.get('/:tipoObjeto/:objetoId', getValoracionesByObjeto);
router.get('/:tipoObjeto/:objetoId/average', getAverageRating);

export default router;