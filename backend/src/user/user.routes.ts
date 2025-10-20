import { Router } from "express";
import {
  sanitizeUserInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  login,
} from "./user.controler.js";

export const userRouter = Router();

userRouter.post("/login", login);
userRouter.get("/", findAll);
userRouter.get("/:id", findOne);
userRouter.post("/", sanitizeUserInput, add);
userRouter.put("/:id", sanitizeUserInput, update);
userRouter.patch("/:id", sanitizeUserInput, update);
userRouter.delete("/:id", remove);
