import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { StoreInvite } from './storeInvite.entity.js';
import { TiendaRetiro } from '../tiendaRetiro/tiendaRetiro.entity.js';
import { HorarioSemanal } from '../tiendaRetiro/tiendaRetiro.entity.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function isValidPhone(phone: string): boolean {
  return /^\+54 9 \d{4} \d{4}$/.test(phone);
}

export function isHardcodedCode(code: string): boolean {
  return code === '123456';
}

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;
const TIME_REGEX = /^\d{2}:\d{2}$/;

export function isValidHorario(horario: unknown): horario is HorarioSemanal {
  if (!horario || typeof horario !== 'object') return false;
  const h = horario as Record<string, unknown>;
  return DIAS_SEMANA.every(dia => {
    const entry = h[dia];
    if (!entry || typeof entry !== 'object') return false;
    const { abre, cierra, cerrado } = entry as Record<string, unknown>;
    if (typeof abre !== 'string' || typeof cierra !== 'string' || typeof cerrado !== 'boolean') return false;
    if (!cerrado && (!TIME_REGEX.test(abre) || !TIME_REGEX.test(cierra))) return false;
    return true;
  });
}

async function getValidInvite(token: string, em: ReturnType<typeof orm.em.fork>) {
  if (!token) return null;
  return em.findOne(StoreInvite, { token, used: false });
}

export async function validateToken(req: Request, res: Response) {
  try {
    const token = req.query.token as string;
    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);
    if (!invite) return res.status(400).json({ valid: false, message: 'Token inválido o ya utilizado' });
    res.json({ valid: true });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function verifyEmail(req: Request, res: Response) {
  try {
    const { token, code } = req.body;
    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);
    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!isHardcodedCode(code)) return res.status(400).json({ message: 'Código de email incorrecto' });
    invite.emailVerified = true;
    await em.flush();
    res.json({ message: 'Email verificado' });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function verifyPhone(req: Request, res: Response) {
  try {
    const { token, code } = req.body;
    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);
    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!isHardcodedCode(code)) return res.status(400).json({ message: 'Código de WhatsApp incorrecto' });
    invite.phoneVerified = true;
    await em.flush();
    res.json({ message: 'Teléfono verificado' });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function completeRegistration(req: Request, res: Response) {
  try {
    const {
      token, nombreTienda, email, password, telefono,
      ciudad, direccion, horario, googleMapsUrl, latitud, longitud,
    } = req.body;

    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);

    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!invite.emailVerified) return res.status(403).json({ message: 'Email no verificado' });
    if (!invite.phoneVerified) return res.status(403).json({ message: 'Teléfono no verificado' });

    if (!nombreTienda || !email || !password || !telefono || !direccion) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    if (latitud == null || longitud == null) {
      return res.status(400).json({ message: 'La ubicación en el mapa es obligatoria' });
    }
    if (!horario) {
      return res.status(400).json({ message: 'El horario es obligatorio' });
    }
    if (!isValidHorario(horario)) {
      return res.status(400).json({ message: 'Formato de horario inválido' });
    }
    if (!isValidPhone(telefono)) {
      return res.status(400).json({ message: 'Formato de teléfono inválido. Usá +54 9 XXXX XXXX' });
    }

    const existingEmail = await em.findOne(TiendaRetiro, { email });
    if (existingEmail) return res.status(409).json({ message: 'El email ya está registrado' });

    const existingNombre = await em.findOne(TiendaRetiro, { nombre: nombreTienda });
    if (existingNombre) return res.status(409).json({ message: 'El nombre de tienda ya está en uso' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const tienda = em.create(TiendaRetiro, {
      nombre: nombreTienda,
      email,
      password: hashedPassword,
      telefono,
      ciudad: ciudad || undefined,
      direccion,
      activo: true,
      horario,
      googleMapsUrl: googleMapsUrl || undefined,
      latitud: latitud ?? undefined,
      longitud: longitud ?? undefined,
    });

    invite.used = true;
    await em.flush();

    const jwtToken = jwt.sign(
      { userId: tienda.id, role: 'tiendaRetiro' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Cuenta de tienda creada',
      token: jwtToken,
      role: 'tiendaRetiro',
      data: {
        id: tienda.id,
        name: tienda.nombre,
        email: tienda.email,
        is_email_verified: true,
        is_phone_verified: true,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
