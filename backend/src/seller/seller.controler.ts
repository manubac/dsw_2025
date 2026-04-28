import { Request, Response, NextFunction } from 'express';
import { orm } from '../shared/db/orm.js';
import { User } from '../user/user.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';
import { VerificationCode } from '../verification/verificationCode.entity.js';
import { whatsAppService } from '../shared/whatsapp.js';
import { AuthRequest } from '../shared/middleware/auth.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function sanitizeRequestOtp(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    phone: req.body.phone,
  };
  Object.keys(req.body.sanitizedInput).forEach(key => {
    if (req.body.sanitizedInput[key] === undefined) delete req.body.sanitizedInput[key];
  });
  next();
}

export function sanitizeVerifyOtp(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    phone: req.body.phone,
    code: req.body.code,
  };
  Object.keys(req.body.sanitizedInput).forEach(key => {
    if (req.body.sanitizedInput[key] === undefined) delete req.body.sanitizedInput[key];
  });
  next();
}

export async function requestOtp(req: AuthRequest, res: Response) {
  try {
    const em = orm.em.fork();
    const actorId = req.actor!.id as number;
    const { phone } = req.body.sanitizedInput;

    const user = em.getReference(User, actorId);

    // Already has a seller profile
    const existingVendedor = await em.findOne(Vendedor, { user });
    if (existingVendedor) {
      return res.status(409).json({ message: 'Ya tenés un perfil de vendedor' });
    }

    // Email must be verified
    const fullUser = await em.findOneOrFail(User, { id: actorId });
    if (!fullUser.is_email_verified) {
      return res.status(403).json({ message: 'Verificá tu email antes de continuar' });
    }

    // Validate phone format: +54 9 XXXX XXXX
    if (!/^\+54 9 \d{4} \d{4}$/.test(phone)) {
      return res.status(400).json({ message: 'Formato de teléfono inválido. Usá +54 9 XXXX XXXX' });
    }

    // Phone must be unique
    const phoneInUse = await em.findOne(Vendedor, { telefono: phone });
    if (phoneInUse) {
      return res.status(409).json({ message: 'Ese teléfono ya está en uso' });
    }

    // Rate limit: max 3 OTP requests per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await em.count(VerificationCode, {
      user,
      purpose: 'seller_upgrade',
      createdAt: { $gt: oneHourAgo },
    });
    if (recentCount >= 3) {
      return res.status(429).json({ message: 'Demasiados intentos. Esperá una hora antes de pedir otro código.' });
    }

    // Generate OTP, hash, persist
    const otp = crypto.randomInt(100000, 999999).toString();
    const codeHash = sha256(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    em.create(VerificationCode, { user, codeHash, purpose: 'seller_upgrade', expiresAt });
    await em.flush();

    await whatsAppService.send(phone, otp);

    res.status(200).json({ message: 'Código enviado por WhatsApp' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export async function verifyOtp(req: AuthRequest, res: Response) {
  try {
    const em = orm.em.fork();
    const actorId = req.actor!.id as number;
    const { phone, code } = req.body.sanitizedInput;

    const user = em.getReference(User, actorId);

    // Find latest valid verification code
    const vc = await em.findOne(
      VerificationCode,
      { user, used: false, purpose: 'seller_upgrade', expiresAt: { $gt: new Date() } },
      { orderBy: { createdAt: 'DESC' } }
    );

    if (!vc) {
      return res.status(400).json({ message: 'Código expirado o inválido' });
    }

    // Verify code (TEST_MODE bypass: '123456' is always valid)
    const isTestBypass = process.env.WHATSAPP_TEST_MODE === 'true' && code === '123456';
    if (!isTestBypass && sha256(code) !== vc.codeHash) {
      return res.status(400).json({ message: 'Código incorrecto' });
    }

    // Atomic: mark code used, set phone verified, create Vendedor
    const fullUser = await em.findOneOrFail(User, { id: actorId });
    vc.used = true;
    fullUser.is_phone_verified = true;
    const vendedor = em.create(Vendedor, {
      user: fullUser,
      nombre: fullUser.username,
      telefono: phone,
    });
    await em.flush();

    const token = jwt.sign(
      { userId: fullUser.id, role: 'vendedor' },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({ message: 'Perfil de vendedor creado', token, data: vendedor });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}
