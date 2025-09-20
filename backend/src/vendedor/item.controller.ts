import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { Item } from './item.entity.js'

const em=orm.em

async function findAll(req: Request, res: Response) {
   try {
       const items = await em.find(Item, {});
       res.status(200).json({message: 'foundAll OK', data: items});
   } catch (error: any) {
       res.status(500).json({message: error.message || 'Internal server error'});
   }
}

async function findOne(req: Request, res: Response) {
    try {
        const id=Number(req.params.id)
        const item = await em.findOneOrFail(Item, { id });
        res
            .status(200)
            .json({message: 'found item', data: item});
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'});
    }
}

async function add(req: Request, res: Response) {
    try {
        const item = em.create(Item, req.body)
        await em.flush()
        res.status(201).json({message: 'Item created', data: item})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

async function update(req: Request, res: Response) {
    try {
        const id=Number.parseInt(req.params.id)
        const item = await em.findOneOrFail(Item, { id })
        em.assign(item, req.body)
        await em.flush()
        res
            .status(200)
            .json({message: 'Item updated', data: item})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

async function remove(req: Request, res: Response) {
    try {
        const id=Number.parseInt(req.params.id)
        const item =  em.getReference(Item, id )
        await em.removeAndFlush(item)
        res.status(200).json({message: 'Item removed', data: item})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

export {  findAll, findOne, add, update, remove }

