import { Request, Response, NextFunction } from 'express';
import { orm } from '../shared/db/orm.js';
import { Vendedor } from './vendedores.entity.js'
import { VendedorClass } from './vendedorClass.entity.js'

const em= orm.em

function sanitiseVendedorInput(
    req: Request, 
    res: Response, 
    next: NextFunction
) {
    req.body.sanitisedInput = {
        nombre: req.body.nombre,
        email: req.body.email,
        password: req.body.password,
        telefono: req.body.telefono,
        ciudad: req.body.ciudad,
        vendedorClass: req.body.vendedorClass,
        items: req.body.items
    };
    //more checks here

    Object.keys(req.body.sanitisedInput).forEach(key => {
        if (req.body.sanitisedInput[key] === undefined) {
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
        console.log('Sanitised input:', req.body.sanitisedInput); // Debug log
        
        // Handle vendedorClass relationship
        const vendedorData = { ...req.body.sanitisedInput };
        if (vendedorData.vendedorClass) {
            vendedorData.vendedorClass = em.getReference(VendedorClass, Number(vendedorData.vendedorClass));
        }
        
        const vendedor = em.create(Vendedor, vendedorData)
        await em.flush()
        res
        .status(201)
        .json({message:'Vendedor created', data:vendedor})
    } catch (error:any) {
        console.error('Error creating vendedor:', error); // Debug log
        res
        .status(500)
        .json({message:'Error creating vendedor', error: error.message, details: error})
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

async function login(req: Request, res: Response) {
    try {
        const { email, password } = req.body
        const vendedor = await em.findOne(Vendedor, { email }, { populate: ['vendedorClass'] })
        if (!vendedor) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }
        if (vendedor.password !== password) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }
        res.status(200).json({ message: 'Login successful', data: vendedor })
    } catch (error: any) {
        res.status(500).json({ message: 'Error logging in', error: error.message })
    }
}

async function logout(req: Request, res: Response) {
    // For stateless logout, just return success
    res.status(200).json({ message: 'Logout successful' })
}




export { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout };

