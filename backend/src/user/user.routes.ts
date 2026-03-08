import { Router } from "express";
import {
  sanitizeUserInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  login,
  forgotPassword,
  resetPassword
} from "./user.controler.js";
import { authenticate, authorizeRoles, authorizeSelf } from "../shared/middleware/auth.js";

export const userRouter = Router();

// Rutas públicas
userRouter.post("/login", login);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.post("/", sanitizeUserInput, add);          // registro

// Rutas autenticadas
userRouter.get("/", authenticate, findAll);
userRouter.get("/:id", authenticate, findOne);

// Solo el propio usuario puede modificar o eliminar su cuenta
userRouter.put("/:id", authenticate, authorizeRoles('user'), authorizeSelf, sanitizeUserInput, update);
userRouter.patch("/:id", authenticate, authorizeRoles('user'), authorizeSelf, sanitizeUserInput, update);
userRouter.delete("/:id", authenticate, authorizeRoles('user'), authorizeSelf, remove);
