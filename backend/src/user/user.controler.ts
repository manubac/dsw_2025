import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { User } from "./user.entity.js";

const em = orm.em;

// 🧼 Sanitización
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

// 📌 Obtener todos los usuarios
async function findAll(req: Request, res: Response) {
  try {
    const users = await em.find(User, {});
    res.status(200).json({ message: "Found all users", data: users });
  } catch (error) {
    res.status(500).json({ message: "Error fetching users", error });
  }
}

// 📌 Obtener un usuario por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.id);
    const user = await em.findOne(User, { id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ message: "Found one user", data: user });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// ➕ Crear nuevo usuario
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

    const user = em.create(User, input);
    await em.flush();

    res.status(201).json({ message: "User created", data: user });
  } catch (error: any) {
    res.status(500).json({ message: "Error creating user", error: error.message });
  }
}

// ✍️ Actualizar usuario
async function update(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.id);
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

// ❌ Eliminar usuario
async function remove(req: Request, res: Response) {
  try {
    const id = Number.parseInt(req.params.id);
    const user = await em.findOne(User, { id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await em.removeAndFlush(user);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// 🔐 Login
async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const user = await em.findOne(User, { email });

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.status(200).json({ message: "Login successful", data: user });
  } catch (error: any) {
    res.status(500).json({ message: "Error logging in", error: error.message });
  }
}

export { sanitizeUserInput, findAll, findOne, add, update, remove, login };
