import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { Valoracion } from './valoracion.entity.js';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import { Compra } from '../compra/compra.entity.js';
import { AuthRequest } from '../shared/middleware/auth.js';

export const createValoracion = async (req: AuthRequest, res: Response) => {
  const em = orm.em.fork();
  try {
    const { puntuacion, comentario, tipoObjeto, objetoId, compraId } = req.body;

    if (!puntuacion || puntuacion < 1 || puntuacion > 5) {
      return res.status(400).json({ message: 'Puntuacion must be between 1 and 5' });
    }
    if (!tipoObjeto || !objetoId) {
      return res.status(400).json({ message: 'tipoObjeto y objetoId son obligatorios' });
    }

    // Duplicate check per (actor, compra, tipoObjeto, objetoId)
    const dupFilter: any = { tipoObjeto, objetoId: Number(objetoId) };
    if (compraId) dupFilter.compra = Number(compraId);

    if (req.actorRole === 'user') {
      dupFilter.usuario = (req.actor as User).id;
    } else if (req.actorRole === 'vendedor') {
      dupFilter.vendedor = (req.actor as Vendedor).id;
    }

    const existing = await em.findOne(Valoracion, dupFilter);
    if (existing) {
      return res.status(409).json({ message: 'Ya enviaste una valoración para este pedido' });
    }

    const data: any = {
      puntuacion: Number(puntuacion),
      tipoObjeto,
      objetoId: Number(objetoId),
    };
    if (comentario) data.comentario = comentario;
    if (compraId) data.compra = em.getReference(Compra, Number(compraId));

    if (req.actorRole === 'user') {
      data.usuario = em.getReference(User, (req.actor as User).id!);
    } else if (req.actorRole === 'vendedor') {
      data.vendedor = em.getReference(Vendedor, (req.actor as Vendedor).id!);
    }

    const valoracion = em.create(Valoracion, data);
    await em.persistAndFlush(valoracion);
    res.status(201).json(valoracion);
  } catch (error: any) {
    console.error('[createValoracion]', error?.message ?? error);
    res.status(500).json({ message: 'Error creating valoracion', detail: error?.message });
  }
};

export const getMyValoraciones = async (req: AuthRequest, res: Response) => {
  const em = orm.em.fork();
  try {
    const filter: any = {};
    if (req.actorRole === 'user') {
      filter.usuario = (req.actor as User).id;
    } else if (req.actorRole === 'vendedor') {
      filter.vendedor = (req.actor as Vendedor).id;
    } else {
      return res.json({ data: [] });
    }
    const valoraciones = await em.find(Valoracion, filter, { populate: ['compra'] });
    res.json({ data: valoraciones });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching my valoraciones', detail: error?.message });
  }
};

export const getValoracionesByObjeto = async (req: Request, res: Response) => {
  const em = orm.em.fork();
  try {
    const { tipoObjeto, objetoId } = req.params;
    const valoraciones = await em.find(
      Valoracion,
      { tipoObjeto, objetoId: Number(objetoId) },
      { populate: ['usuario'] }
    );
    res.json({ message: "Reviews fetched", data: valoraciones });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching valoraciones', detail: error?.message });
  }
};

export const getAverageRating = async (req: Request, res: Response) => {
  const em = orm.em.fork();
  try {
    const { tipoObjeto, objetoId } = req.params;
    const valoraciones = await em.find(Valoracion, { tipoObjeto, objetoId: Number(objetoId) });
    if (valoraciones.length === 0) return res.json({ average: 0, count: 0 });
    const sum = valoraciones.reduce((acc, v) => acc + v.puntuacion, 0);
    res.json({ average: sum / valoraciones.length, count: valoraciones.length });
  } catch (error: any) {
    res.status(500).json({ message: 'Error calculating average', detail: error?.message });
  }
};
