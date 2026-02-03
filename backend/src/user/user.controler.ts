import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { User } from "./user.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";
import { Valoracion } from "../valoracion/valoracion.entity.js";
import { Compra } from "../compra/compra.entity.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail } from '../shared/mailer.js';

const em = orm.em;

//  Sanitización
function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role,
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });

  next();
}

//  Obtener todos los usuarios
async function findAll(req: Request, res: Response) {
  try {
    const users = await em.find(User, {});
    res.status(200).json({ message: "Found all users", data: users });
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
}

//  Obtener un usuario por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.id as string);
    const user = await em.findOne(User, { id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "Found one user", data: user });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

//  Crear nuevo usuario
async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    if (!input.username || !input.email || !input.password) {
      return res
        .status(400)
        .json({ message: "username, email y password son obligatorios" });
    }

    const existing = await em.findOne(User, { email: input.email });
    if (existing) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    const saltRounds = 10;
    input.password = await bcrypt.hash(input.password, saltRounds);

    const user = em.create(User, input);
    await em.flush();

    res.status(201).json({ message: "User created", data: user });
  } catch (error: any) {
    res.status(500).json({ message: "Error creating user", error: error.message });
  }
}

//  Actualizar usuario
async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.id as string);
    const userToUpdate = await em.findOne(User, { id });
    if (!userToUpdate) {
      return res.status(404).json({ message: "User not found" });
    }

    em.assign(userToUpdate, req.body.sanitizedInput);
    await em.flush();

    res.status(200).json({ message: "User updated successfully", data: userToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

//  Eliminar usuario
async function remove(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.id as string);
    const user = await em.findOne(User, { id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Cascade delete: remove Valoraciones by this user
    const valoraciones = await em.find(Valoracion, { usuario: user });
    for (const v of valoraciones) {
      em.remove(v);
    }
    
    // Cascade delete: remove Compras by this user
    const compras = await em.find(Compra, { comprador: user });
    for (const c of compras) {
        em.remove(c);
    }
    // Flush to remove relations before removing user (sometimes needed if constraints are strict)
    // Actually removeAndFlush(user) might fail if we don't flush deletions of children first 
    // IF the DB constraints are set to RESTRICT.
    // Let's do a flush for the children first to be safe, or just queue them all and let ORM handle order (if it can).
    // Safest is to remove children, allow flush, then remove parent.
    
    // Queue removal of children
    valoraciones.forEach(v => em.remove(v));
    compras.forEach(c => em.remove(c));
    
    await em.flush();

    // Now remove user
    await em.removeAndFlush(user);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

//  Login
async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const user = await em.findOne(User, { email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '1h' });

    res.status(200).json({ message: "Login successful", data: user, token });
  } catch (error: any) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
}

async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    let user: any = await em.findOne(User, { email });
    if (!user) user = await em.findOne(Vendedor, { email });
    if (!user) user = await em.findOne(Intermediario, { email });

    // Security: don't reveal if user exists, but for debug/dev maybe we can be more verbose or generic.
    // Standard practice: "If the email is registered, you will receive a reset link."
    if (!user) {
         return res.status(200).json({ message: "Si el correo existe, recibirás un enlace." });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

    await em.flush();

    const resetUrl = `http://localhost:5173/reset-password?token=${token}`;
    const subject = "Recuperación de Contraseña";
    const text = `Para restablecer tu contraseña, haz clic en el siguiente enlace: ${resetUrl}`;
    const html = `<p>Para restablecer tu contraseña, haz clic en el siguiente enlace:</p><a href="${resetUrl}">Restablecer Contraseña</a>`;

    await sendEmail(user.email, subject, text, html);

    res.status(200).json({ message: "Si el correo existe, recibirás un enlace." });
  } catch (error: any) {
    res.status(500).json({ message: "Error sending recovery email", error: error.message });
  }
}

async function resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;
    
    // Find user/vendedor/intermediario with this token and ensure token hasn't expired
    const whereClause = { 
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: new Date() }
    };
    
    let user: any = await em.findOne(User, whereClause);
    if (!user) user = await em.findOne(Vendedor, whereClause);
    if (!user) user = await em.findOne(Intermediario, whereClause);

    if (!user) {
      return res.status(400).json({ message: "Token inválido o expirado." });
    }

    const saltRounds = 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    
    // Clear token fields
    user.resetPasswordToken = null; // MikroORM might prefer null over undefined for clearing
    user.resetPasswordExpires = null;

    await em.flush();

    res.status(200).json({ message: "Contraseña actualizada correctamente." });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeUserInput, findAll, findOne, add, update, remove, login, forgotPassword, resetPassword };
