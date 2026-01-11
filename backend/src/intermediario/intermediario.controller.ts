import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Intermediario } from "./intermediario.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";

const em = orm.em;

// Middleware de saneamiento
function sanitizeIntermediarioInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nombre: req.body.nombre,
    email: req.body.email,
    password: req.body.password,
    telefono: req.body.telefono,
    descripcion: req.body.descripcion,
    activo: req.body.activo,
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });

  next();
}

// Obtener todos los intermediarios
async function findAll(req: Request, res: Response) {
  try {
    const intermediarios = await em.find(Intermediario, {}, { populate: ["direcciones"] });
    res.status(200).json({ message: "Found all intermediarios", data: intermediarios });
  } catch (error) {
    res.status(500).json({ message: "Error fetching intermediarios", error });
  }
}

// Obtener intermediario por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const intermediario = await em.findOne(Intermediario, { id }, { populate: ["direcciones"] });

    if (!intermediario) return res.status(404).json({ message: "Intermediario not found" });

    res.status(200).json({ message: "Found one intermediario", data: intermediario });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear nuevo intermediario
async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    if (!input.nombre || !input.email || !input.password || !input.telefono) {
      return res.status(400).json({ message: "nombre, email, password y telefono son obligatorios" });
    }

    const existing = await em.findOne(Intermediario, { email: input.email });
    if (existing) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    const intermediario = em.create(Intermediario, input);
    await em.flush();

    res.status(201).json({ message: "Intermediario created", data: intermediario });
  } catch (error: any) {
    res.status(500).json({ message: "Error creating intermediario", error: error.message });
  }
}

// Actualizar intermediario
async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const intermediarioToUpdate = await em.findOne(Intermediario, { id });
    if (!intermediarioToUpdate) {
      return res.status(404).json({ message: "Intermediario not found" });
    }

    em.assign(intermediarioToUpdate, req.body.sanitizedInput);
    await em.flush();

    res.status(200).json({ message: "Intermediario updated successfully", data: intermediarioToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Eliminar intermediario
async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const intermediario = await em.findOne(Intermediario, { id });
    if (!intermediario) {
      return res.status(404).json({ message: "Intermediario not found" });
    }

    await em.removeAndFlush(intermediario);
    res.status(200).json({ message: "Intermediario deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const intermediario = await em.findOne(Intermediario, { email }, { populate: ['direcciones'] });
    if (!intermediario) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Cast to any to access the password field on the loaded entity without type errors
    if ((intermediario as any).password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Add role field for frontend
    const intermediarioWithRole = {
      ...intermediario,
      role: 'intermediario'
    };

    res.status(200).json({ message: 'Login successful', data: intermediarioWithRole });
  } catch (error: any) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
}

export { sanitizeIntermediarioInput, findAll, findOne, add, update, remove, login };