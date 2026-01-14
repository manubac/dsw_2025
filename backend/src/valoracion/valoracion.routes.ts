import { Router } from 'express';
import { createValoracion, getValoracionesByObjeto, getAverageRating } from './valoracion.controller.js';
import { authenticate } from '../shared/middleware/auth.js';

const router = Router();

router.post('/', authenticate, createValoracion);
router.get('/:tipoObjeto/:objetoId', getValoracionesByObjeto);
router.get('/:tipoObjeto/:objetoId/average', getAverageRating);

export default router;