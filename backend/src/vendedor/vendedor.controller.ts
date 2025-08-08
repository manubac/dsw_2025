import { Request, Response, NextFunction } from 'express';
import { VendedorRepository } from './vendedores.repository.js';
import { Vendedor } from './vendedores.entity.js';
const repository = new VendedorRepository();

function sanitiseVendedorInput(req: Request, res: Response, next: NextFunction) {
    req.body.sanitisedInput = {
        nombre: req.body.nombre,
        email: req.body.email,
        telefono: req.body.telefono,
    };
    //more checks here
    Object.keys(req.body.sanitisedInput).forEach(key => {
        if (req.body.sanitisedInput[key] === undefined || req.body.sanitisedInput[key] === null) {
        delete req.body[key];
        }
    });
    next();
}

function findAll(req: Request, res: Response) {
    res.json({data: repository.findAll()});
}

function findOne(req: Request, res: Response) {
    const id = req.params.id;
    const vendedor = repository.findOne({id});
    if (!vendedor) {
        return res.status(404).send('Vendedor no encontrado')
    } else {
        res.json(vendedor);
    } 
}

function add(req: Request, res: Response) {
    const input = req.body.sanitisedInput
    
    const vendedorInput = new Vendedor(
        input.nombre,
        input.email,
        input.telefono,
    )

    const vendedor = repository.add(vendedorInput);
    return res.status(201).send({ message: 'Vendedor creado correctamente', data: vendedor });
}

function update(req: Request, res: Response) {
    req.body.sanitisedInput.id = req.params.id
    const vendedor = repository.update(req.body.sanitisedInput)
    
    if (!vendedor) {
        res.status(404).send('Vendedor no encontrado');
        return;
    }
    
    return res.status(200).send({
        message: 'Vendedor actualizado correctamente',
        data: vendedor,
    })
}

function remove(req: Request, res: Response) {
    const id = req.params.id;
    const vendedor = repository.delete({id});
    if (!vendedor) {
        return res.status(404).send('Vendedor no encontrado');
    } else{
        res.status(200).send({message:'Vendedor eliminado correctamente'})
    }
}

export { sanitiseVendedorInput, findAll, findOne, add, update, remove };

