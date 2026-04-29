import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { StoreInvite } from './storeInvite.entity.js';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export function isValidPhone(phone: string): boolean {
  return /^\+54 9 \d{4} \d{4}$/.test(phone);
}

export function isHardcodedCode(code: string): boolean {
  return code === '123456';
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
      ciudad, direccion, piso, departamento, alias, cbu, descripcion,
    } = req.body;

    const em = orm.em.fork();
    const invite = await getValidInvite(token, em);

    if (!invite) return res.status(400).json({ message: 'Token inválido o ya utilizado' });
    if (!invite.emailVerified) return res.status(403).json({ message: 'Email no verificado' });
    if (!invite.phoneVerified) return res.status(403).json({ message: 'Teléfono no verificado' });

    if (!nombreTienda || !email || !password || !telefono) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    if (!isValidPhone(telefono)) {
      return res.status(400).json({ message: 'Formato de teléfono inválido. Usá +54 9 XXXX XXXX' });
    }

    const existingUser = await em.findOne(User, { email });
    if (existingUser) return res.status(409).json({ message: 'El email ya está registrado' });

    const existingVendedor = await em.findOne(Vendedor, { nombre: nombreTienda });
    if (existingVendedor) return res.status(409).json({ message: 'El nombre de tienda ya está en uso' });

    const existingPhone = await em.findOne(Vendedor, { telefono });
    if (existingPhone) return res.status(409).json({ message: 'El teléfono ya está en uso' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = em.create(User, {
      username: nombreTienda,
      email,
      password: hashedPassword,
      role: 'vendedor',
      is_email_verified: true,
      is_phone_verified: true,
    });

    const vendedor = em.create(Vendedor, {
      user,
      nombre: nombreTienda,
      telefono,
      ciudad: ciudad || undefined,
      direccion: direccion || undefined,
      piso: piso || undefined,
      departamento: departamento || undefined,
      alias: alias || undefined,
      cbu: cbu || undefined,
      descripcionCompra: descripcion || undefined,
    });

    invite.used = true;
    await em.flush();

    const jwtToken = jwt.sign(
      { userId: user.id, role: 'vendedor' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Cuenta de vendedor creada',
      token: jwtToken,
      role: 'vendedor',
      data: {
        id: user.id,
        name: user.username,
        email: user.email,
        is_email_verified: true,
        is_phone_verified: true,
        vendedorId: vendedor.id,
      },
    });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
