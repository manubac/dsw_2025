import { Router } from "express";
import {
  sanitizeCompraInput,
  findAll,
  findOne,
  add,
  update,
  remove,
} from "./compra.controler.js";

export const compraRouter = Router();

compraRouter.get("/", findAll);
compraRouter.get("/:id", findOne);
compraRouter.post("/", sanitizeCompraInput, add);
compraRouter.put("/:id", sanitizeCompraInput, update);
compraRouter.patch("/:id", sanitizeCompraInput, update);
compraRouter.delete("/:id", remove);
