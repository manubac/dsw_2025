import { Request, Response, NextFunction } from 'express';
import { orm } from '../shared/db/orm.js';
import { Vendedor } from './vendedores.entity.js'

const em= orm.em

function sanitiseVendedorInput(
    req: Request, 
    res: Response, 
    next: NextFunction
) {
    req.body.sanitisedInput = {
        nombre: req.body.nombre,
        vendedorClass: req.body.vendedorClass,
        email: req.body.email,
        telefono: req.body.telefono,
        items: req.body.items
    };
    //more checks here

    Object.keys(req.body.sanitisedInput).forEach(key => {
        if (req.body.sanitisedInput[key] === undefined || req.body.sanitisedInput[key] === null) {
        delete req.body.sanitisedInput[key];
        }
    })
    next()
}

async function findAll(req: Request, res: Response) {
    try {
        const vendedores = await em.find(
            Vendedor, 
            {}, 
            {populate:['vendedorClass', 'items']}
        )
        res
        .status(200)
        .json({message:'Found all vendedores', data:vendedores})
    } catch (error) {
        res
        .status(500)
        .json({message:'Error fetching vendedores', error})
    }
}

async function findOne(req: Request, res: Response) {
    try {
        const id= Number.parseInt(req.params.id)
        const vendedor = await em.findOne(Vendedor, {id}, {populate:['vendedorClass', 'items']})
        res.status(200).json({message:'Found one vendedor', data:vendedor})
    } catch (error: any) {
        res.status(500).json({message: error.message})
    }
}

async function add(req: Request, res: Response) {
    try{
        const vendedor = em.create(Vendedor, req.body.sanitisedInput)
    await em.flush()
    res
    .status(201)
    .json({message:'Vendedor created', data:vendedor})
    } catch (error:any) {
        res
        .status(500)
        .json({message:'Error creating vendedor', error})
    }
}

async function update(req: Request, res: Response) {
    try {
        const id= Number.parseInt(req.params.id)
        const vendedorToUpdate = await em.findOneOrFail(Vendedor, {id})
        em.assign(vendedorToUpdate, req.body.sanitisedInput)
        await em.flush()
        res.status(200).json({message:'Vendedor updated', data:vendedorToUpdate})
    } catch (error:any) {
        res.status(500).json({message: error.message})
    }
}

async function remove(req: Request, res: Response) {
    try {
        const id= Number.parseInt(req.params.id)
        const vendedor = await em.getReference(Vendedor, id)
        await em.removeAndFlush(vendedor)
        res.status(200).json({message:'Vendedor deleted'})
    } catch (error:any) {
        res.status(500).json({message: error.message})
    }
}

export { sanitiseVendedorInput, findAll, findOne, add, update, remove };

