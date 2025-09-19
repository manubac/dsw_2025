import { Request, Response, NextFunction } from 'express';
import { orm } from '../shared/db/orm.js';
import { Vendedor } from './vendedores.entity.js'


function sanitiseVendedorInput(
    req: Request, 
    res: Response, 
    next: NextFunction
) {
    req.body.sanitisedInput = {
        nombre: req.body.nombre,
        email: req.body.email,
        telefono: req.body.telefono,
        items: req.body.items
    };
    //more checks here

    Object.keys(req.body.sanitisedInput).forEach(key => {
        if (req.body.sanitisedInput[key] === undefined || req.body.sanitisedInput[key] === null) {
        delete req.body[key];
        }
    })
    next()
}

async function findAll(req: Request, res: Response) {
    res.status(500).json({message:'Funcionalidad no implementada'})
}

async function findOne(req: Request, res: Response) {
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

export { sanitiseVendedorInput, findAll, findOne, add, update, remove };

