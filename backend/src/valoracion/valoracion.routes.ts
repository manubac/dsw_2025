import { Router } from 'express';
import { createValoracion, getValoracionesByObjeto, getAverageRating } from './valoracion.controller.js';
import { authenticate, authorizeRoles } from '../shared/middleware/auth.js';

const router = Router();

// Solo los compradores autenticados (users) pueden dejar una valoración
router.post('/', authenticate, authorizeRoles('user'), createValoracion);

// Público – cualquiera puede leer valoraciones y promedios
router.get('/:tipoObjeto/:objetoId', getValoracionesByObjeto);
router.get('/:tipoObjeto/:objetoId/average', getAverageRating);

export default router;