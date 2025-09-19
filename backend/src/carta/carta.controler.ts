import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Carta } from "./carta.entity.js";

function sanitizeCartaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name: req.body.name,
    cartaClass: req.body.cartaClass,
    level: req.body.level,
    hp: req.body.hp,
    mana: req.body.mana,
    attack: req.body.attack,
    items: req.body.items,
  }
  next();
}

async function findAll(req: Request, res: Response) {
   res.status(500).json({message:'Funcionalidad no implementada'})
}

async function findOne (req: Request, res: Response) {
   res.status(500).json({message:'Funcionalidad no implementada'})
}




async function add(req: Request, res: Response) {
   res.status(500).json({message:'Funcionalidad no implementada'})
}

async function update(req: Request, res: Response) {
  res.status(500).json({message:'Funcionalidad no implementada'})

}

async function remove(req: Request, res: Response) {
   res.status(500).json({message:'Funcionalidad no implementada'})
}

export { sanitizeCartaInput, findAll, findOne, add, update, remove };

