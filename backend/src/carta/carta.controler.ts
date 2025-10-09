import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Carta } from "./carta.entity.js";

const em = orm.em 

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
    try {
         const cartas = await em.find(Carta, {},{ populate: ['cartaClass', 'items'] });
         res.status(200).json({message: 'found all cartas' , data: cartas})
    }catch (error: any) {
    res.status(500).json({message: error.message})
}
}

async function findOne (req: Request, res: Response) {
   try {
         const id = Number.parseInt(req.params.id)
         const carta = await em.findOneOrFail(Carta, {id}, { populate: ['cartaClass', 'items'] })
         res.status(200).json({message: 'found one carta', data: carta}) 
   } catch (error: any) {
    res.status(500).json({message: error.message})
   }
}




async function add(req: Request, res: Response) {
   try {const carta = em.create(Carta, req.body.sanitizedInput)
   await em.flush()
   res.status(201).json({message: 'carta created', data: carta})}
   catch (error: any) {
      res.status(500).json({message: error.message})
   }
   
}

async function update(req: Request, res: Response) {
  try {
      const id = Number.parseInt(req.params.id)
      const cartaToUpdate = await em.findOneOrFail(Carta, {id})
      em.assign(cartaToUpdate, req.body.sanitizedInput)
      await em.flush()
      res.status(200).json({message: 'carta updated', data: cartaToUpdate}) 
  } catch (error: any) {
    res.status(500).json({message: error.message})}

}

async function remove(req: Request, res: Response) {
   try {
      const id = Number.parseInt(req.params.id)
      const carta = await em.getReference(Carta, id)
      await em.removeAndFlush(carta)
   }catch (error: any) {
    res.status(500).json({message: error.message})
   }
}

export { sanitizeCartaInput, findAll, findOne, add, update, remove };

