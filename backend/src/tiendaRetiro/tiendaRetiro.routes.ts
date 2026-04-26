import { Router } from 'express';
import { orm } from '../shared/db/orm.js';
import { TiendaRetiro } from './tiendaRetiro.entity.js';

export const tiendaRouter = Router();

tiendaRouter.get('/', async (_req, res) => {
  try {
    const em = orm.em.fork();
    const tiendas = await em.find(TiendaRetiro, { activo: true }, { orderBy: { nombre: 'ASC' } });
    res.json({ data: tiendas });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
