import { Request, Response } from "express";
import { orm } from "../shared/db/orm.js"; 
import { CartaClass } from "./cartaClass.entity.js";

const em = orm.em 


async function findAll(req: Request, res: Response) {
    try {
        const cartaClasses = await em.find(CartaClass, {});
        res.status(200).json({message: 'found all carta classes', data:cartaClasses});
    } catch (error: any) {
        res.status(500).json({message: error.message});
    }
}

async function findOne (req: Request, res: Response) {
   try {
       const id = Number.parseInt(req.params.id as string)
       const cartaClass = await em.findOneOrFail(CartaClass, {id})
         res.status(200).json({message: 'found one carta class', data: cartaClass})

    }catch (error: any) {
    res.status(500).json({message: error.message})
    }
}

async function add(req: Request, res: Response) {
   try {
    const cartaClass = em.create(CartaClass, req.body)
    await em.flush() 
    res.status(201).json({message: 'carta class created', data: cartaClass})
   } catch (error: any) {
    res.status(500).json({message: error.message})
   }
}

async function update(req: Request, res: Response) {
    try {
        const id = Number.parseInt(req.params.id as string)
        const cartaClass = await em.getReference(CartaClass, id)
        em.assign(cartaClass, req.body)
        await em.flush()
        res.status(200).json({message: 'carta class updated'})
    }catch (error: any) {
        res.status(500).json({message: error.message})
}
}

async function remove(req: Request, res: Response) {
   try{
    const id = Number.parseInt(req.params.id as string)
    const cartaClass = await em.getReference(CartaClass, id)
    await em.removeAndFlush(cartaClass)
    res.status(200).json({message: 'carta class removed'})
   } catch (error: any) {
    res.status(500).json({message: error.message})
   }
}

export { findAll, findOne, add, update, remove };

