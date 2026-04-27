import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { orm } from '../db/orm.js';
import { User } from '../../user/user.entity.js';
import { Vendedor } from '../../vendedor/vendedores.entity.js';
import { Intermediario } from '../../intermediario/intermediario.entity.js';
import { TiendaRetiro } from '../../tiendaRetiro/tiendaRetiro.entity.js';

export type Role = 'user' | 'vendedor' | 'intermediario' | 'tiendaRetiro';
export type ActorEntity = User | Vendedor | Intermediario | TiendaRetiro;

export interface AuthRequest extends Request {
  actor?: ActorEntity;
  actorRole?: Role;
}

/**
 * Verifica el JWT y adjunta la entidad autenticada (User, Vendedor o
 * Intermediario) en `req.actor` y el rol en `req.actorRole`.
 * El token DEBE contener un campo `role` establecido durante el login.
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Fork por request para evitar que el identity map global quede corrupto
  // entre requests fallidos y afecte la autenticación siguiente.
  const em = orm.em.fork();
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default_secret'
    ) as { userId: number; role: Role };

    let actor: ActorEntity | null = null;

    if (decoded.role === 'vendedor') {
      actor = await em.findOne(Vendedor, { id: decoded.userId });
    } else if (decoded.role === 'intermediario') {
      actor = await em.findOne(Intermediario, { id: decoded.userId });
    } else if (decoded.role === 'tiendaRetiro') {
      actor = await em.findOne(TiendaRetiro, { id: decoded.userId });
    } else {
      // Rol por defecto 'user' – también maneja tokens anteriores sin campo role
      actor = await em.findOne(User, { id: decoded.userId });
    }

    if (!actor) {
      return res.status(401).json({ message: 'Authenticated entity not found' });
    }

    req.actor = actor;
    req.actorRole = decoded.role ?? 'user';
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

/**
 * Fábrica de middleware – restringe una ruta a uno o más roles.
 * Debe usarse DESPUÉS de `authenticate`.
 *
 * @example  router.delete('/:id', authenticate, authorizeRoles('vendedor'), remove)
 */
export const authorizeRoles = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.actorRole || !roles.includes(req.actorRole)) {
      return res.status(403).json({ message: 'Acceso denegado: permisos insuficientes' });
    }
    next();
  };
};

/**
 * Middleware – verifica que el actor autenticado es la misma entidad referenciada
 * por `:id` en la URL. Debe usarse DESPUÉS de `authenticate` (y generalmente
 * también después de `authorizeRoles`).
 *
 * @example  router.put('/:id', authenticate, authorizeRoles('vendedor'), authorizeSelf, update)
 */
export const authorizeSelf = (req: AuthRequest, res: Response, next: NextFunction) => {
  const paramId = Number(req.params.id);
  const actorId = Number(req.actor?.id);

  if (!req.actor || actorId !== paramId) {
    return res.status(403).json({ message: 'Acceso denegado: solo puedes modificar tus propios datos' });
  }
  next();
};