import { Router, Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { StoreInvite } from '../storeRegister/storeInvite.entity.js';
import { randomUUID } from 'crypto';

export const adminRouter = Router();

adminRouter.post('/store-invite', async (req: Request, res: Response) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    const expectedKey = process.env.ADMIN_SECRET ?? 'admin123';

    if (adminKey !== expectedKey) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    const em = orm.em.fork();
    const token = randomUUID();
    em.create(StoreInvite, { token, used: false, emailVerified: false, phoneVerified: false });
    await em.flush();

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const link = `${frontendUrl}/register-store?token=${token}`;

    res.status(201).json({ link, token });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});
