import { Request, Response, NextFunction } from "express";
import { UserRepository } from "./users.repository.js";
import { User } from "./user.entity.js";

// /api/users/
const repository = new UserRepository();

// 🧼 Función básica de sanitización
function sanitizeUserInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    role: req.body.role,
  };

  // Eliminar campos undefined
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });

  next();
}

// 📌 Obtener todos los usuarios
function findAll(req: Request, res: Response) {
  res.json({ data: repository.findAll() });
}

// 📌 Obtener un usuario por ID
function findOne(req: Request, res: Response) {
  const id = req.params.id;
  const user = repository.findOne({ id });
  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }
  res.json({ data: user });
}

// ➕ Registrar usuario nuevo
function add(req: Request, res: Response) {
  const input = req.body.sanitizedInput;

  // Validación simple
  if (!input.username || !input.email || !input.password) {
    return res.status(400).send({ message: "username, email y password son obligatorios" });
  }

  // Chequear duplicado por email
  const existing = repository.findByEmail(input.email);
  if (existing) {
    return res.status(400).send({ message: "El email ya está registrado" });
  }

  const userInput = new User(
    input.username,
    input.email,
    input.password,
    input.role ?? "user"
  );

  const user = repository.add(userInput);
  return res.status(201).send({ message: "User created", data: user });
}

// ✍️ Actualizar usuario
function update(req: Request, res: Response) {
  req.body.sanitizedInput.id = req.params.id;
  const user = repository.update(req.body.sanitizedInput);
  if (!user) {
    return res.status(404).send({ message: "User not found" });
  }
  return res.status(200).send({ message: "User updated successfully", data: user });
}

// ❌ Eliminar usuario
function remove(req: Request, res: Response) {
  const id = req.params.id;
  const deleted = repository.delete({ id });

  if (!deleted) {
    res.status(404).send({ message: "User not found" });
  } else {
    res.status(200).send({ message: "User deleted successfully" });
  }
}

// 🔐 Inicio de sesión básico
function login(req: Request, res: Response) {
  const { email, password } = req.body;

  const user = repository.findByEmail(email);
  if (!user || user.password !== password) {
    return res.status(401).send({ message: "Invalid credentials" });
  }

  return res.status(200).send({ message: "Login successful", data: user });
}

export {
  sanitizeUserInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  login
};
