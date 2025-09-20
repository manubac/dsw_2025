import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { VendedorClass } from './vendedorClass.entity.js'

const em=orm.em

async function findAll(req: Request, res: Response) {
   try {
       const vendedorClasses = await em.find(VendedorClass, {});
       res.status(200).json({message: 'foundAll OK', data: vendedorClasses});
   } catch (error: any) {
       res.status(500).json({message: error.message || 'Internal server error'});
   }
}

async function findOne(req: Request, res: Response) {
    try {
        const id=Number(req.params.id)
        const vendedorClass = await em.findOneOrFail(VendedorClass, { id });
        res
            .status(200)
            .json({message: 'found vendedor class', data: vendedorClass});
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'});
    }
}

async function add(req: Request, res: Response) {
    try {
        const vendedorClass = em.create(VendedorClass, req.body)
        await em.flush()
        res.status(201).json({message: 'VendedorClass created', data: vendedorClass})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

async function update(req: Request, res: Response) {
    try {
        const id=Number.parseInt(req.params.id)
        const vendedorClass = await em.findOneOrFail(VendedorClass, { id })
        em.assign(vendedorClass, req.body)
        await em.flush()
        res
            .status(200)
            .json({message: 'VendedorClass updated', data: vendedorClass})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

async function remove(req: Request, res: Response) {
    try {
        const id=Number.parseInt(req.params.id)
        const vendedorClass =  em.getReference(VendedorClass, id )
        await em.removeAndFlush(vendedorClass)
        res.status(200).json({message: 'VendedorClass removed', data: vendedorClass})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

export {  findAll, findOne, add, update, remove }

