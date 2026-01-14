import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { Valoracion } from './valoracion.entity.js';
import { User } from '../user/user.entity.js';
import { AuthRequest } from '../shared/middleware/auth.js';

const em = orm.em;

export const createValoracion = async (req: AuthRequest, res: Response) => {
  try {
    const { puntuacion, comentario, tipoObjeto, objetoId } = req.body;
    const usuario = req.user as User; // Assuming user is set by auth middleware

    if (puntuacion < 1 || puntuacion > 5) {
      return res.status(400).json({ message: 'Puntuacion must be between 1 and 5' });
    }

    const valoracion = em.create(Valoracion, {
      puntuacion,
      comentario,
      usuario,
      tipoObjeto,
      objetoId,
    });

    await em.persistAndFlush(valoracion);
    res.status(201).json(valoracion);
  } catch (error) {
    res.status(500).json({ message: 'Error creating valoracion', error });
  }
};

export const getValoracionesByObjeto = async (req: Request, res: Response) => {
  try {
    const { tipoObjeto, objetoId } = req.params;
    const valoraciones = await em.find(Valoracion, { tipoObjeto, objetoId: Number(objetoId) }, { populate: ['usuario'] });
    res.json(valoraciones);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching valoraciones', error });
  }
};

export const getAverageRating = async (req: Request, res: Response) => {
  try {
    const { tipoObjeto, objetoId } = req.params;
    const valoraciones = await em.find(Valoracion, { tipoObjeto, objetoId: Number(objetoId) });
    if (valoraciones.length === 0) {
      return res.json({ average: 0 });
    }
    const sum = valoraciones.reduce((acc, v) => acc + v.puntuacion, 0);
    const average = sum / valoraciones.length;
    res.json({ average });
  } catch (error) {
    res.status(500).json({ message: 'Error calculating average', error });
  }
};