import { Router } from "express";
import { sanitizeIntermediarioInput, findAll, findOne, add, update, remove, login } from "./intermediario.controller.js";

export const intermediarioRouter = Router();

intermediarioRouter.get("/", findAll);
intermediarioRouter.get("/:id", findOne);
intermediarioRouter.post("/", sanitizeIntermediarioInput, add);
intermediarioRouter.post("/login", login);
intermediarioRouter.put("/:id", sanitizeIntermediarioInput, update);
intermediarioRouter.patch("/:id", sanitizeIntermediarioInput, update);
intermediarioRouter.delete("/:id", remove);