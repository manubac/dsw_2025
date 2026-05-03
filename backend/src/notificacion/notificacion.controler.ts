import { Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { Notificacion } from './notificacion.entity.js';
import { AuthRequest } from '../shared/middleware/auth.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';

function resolveUserId(req: AuthRequest): number | null {
  if (req.actorRole === 'vendedor') {
    return ((req.actor as Vendedor) as any).user?.id ?? null;
  }
  return req.actor?.id ?? null;
}

export async function getUnread(req: AuthRequest, res: Response) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const em = orm.em.fork();
    const notifs = await em.find(
      Notificacion,
      { userId, leida: false },
      { orderBy: { createdAt: 'DESC' } }
    );
    res.json({ data: notifs });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function getCount(req: AuthRequest, res: Response) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const em = orm.em.fork();
    const count = await em.count(Notificacion, { userId, leida: false });
    res.json({ count });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function marcarLeidas(req: AuthRequest, res: Response) {
  try {
    const userId = resolveUserId(req);
    if (!userId) return res.status(401).json({ message: 'No autenticado' });
    const compraId = Number(req.body.compraId);
    if (!compraId) return res.status(400).json({ message: 'compraId requerido' });
    const em = orm.em.fork();
    const notifs = await em.find(Notificacion, { userId, compraId, leida: false });
    notifs.forEach((n) => { n.leida = true; });
    await em.flush();
    res.json({ updated: notifs.length });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
