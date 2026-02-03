import { Request, Response, NextFunction } from 'express';
import { orm } from '../shared/db/orm.js';
import { Vendedor } from './vendedores.entity.js'
import { Compra } from '../compra/compra.entity.js';
import { EstadoEnvio } from '../envio/envio.entity.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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
            {populate:['items']}
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
        const id= Number.parseInt(req.params.id as string)
        const vendedor = await em.findOne(Vendedor, {id}, {populate:['items', 'itemCartas', 'itemCartas.cartas']})
        res.status(200).json({message:'Found one vendedor', data:vendedor})
    } catch (error: any) {
        res.status(500).json({message: error.message})
    }
}

async function add(req: Request, res: Response) {
    try{
        console.log('Sanitised input:', req.body.sanitisedInput); // Debug log
        
        const saltRounds = 10;
        req.body.sanitisedInput.password = await bcrypt.hash(req.body.sanitisedInput.password, saltRounds);

        const vendedor = em.create(Vendedor, req.body.sanitisedInput)
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
        const id= Number.parseInt(req.params.id as string)
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
        const id= Number.parseInt(req.params.id as string)
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
        const vendedor = await em.findOne(Vendedor, { email }, { populate: ['items'] })
        if (!vendedor) {
            return res.status(401).json({ message: 'Invalid credentials' })
        }
        
        const isMatch = await bcrypt.compare(password, vendedor.password);
        if (!isMatch) {
            // Fallback for migration (allow plain text temporarily if needed)
            if (vendedor.password !== password) {
                return res.status(401).json({ message: 'Invalid credentials' })
            }
        }
        
        // Add role field for frontend
        const vendedorWithRole = {
            ...vendedor,
            role: 'vendedor'
        }
        
        const token = jwt.sign({ userId: vendedor.id }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '1h' });
        
        res.status(200).json({ message: 'Login successful', data: vendedorWithRole, token })
    } catch (error: any) {
        res.status(500).json({ message: 'Error logging in', error: error.message })
    }
}

async function logout(req: Request, res: Response) {
    // For stateless logout, just return success
    res.status(200).json({ message: 'Logout successful' })
}

async function getVentas(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const compras = await em.find(Compra, {
            itemCartas: {
                cartas: { uploader: { id } },
            }
        }, {
             populate: ['itemCartas', 'itemCartas.cartas', 'comprador', 'envio', 'envio.intermediario', 'envio.intermediario.direccion']
        });

        const result = compras.map(c => {
             // Filter items for this vendor
             const myItems = c.itemCartas.getItems().filter(item => 
                 item.cartas.getItems().some(card => card.uploader?.id === id)
             );
             if (myItems.length === 0) return null;
             
             return {
                 id: c.id,
                 fecha: c.createdAt,
                 total: c.total,
                 estado: c.estado,
                 comprador: {
                     nombre: c.comprador?.username || c.nombre || "Usuario",
                     email: c.comprador?.email || c.email
                 },
                 items: myItems.map(i => ({
                     id: i.id,
                     name: i.cartas[0]?.name,
                     image: i.cartas[0]?.image,
                     price: i.cartas[0]?.price
                 })),
                 envio: c.envio ? {
                     id: c.envio.id,
                     estado: c.envio.estado,
                     intermediario: c.envio.intermediario ? {
                        nombre: c.envio.intermediario.nombre,
                        direccion: c.envio.intermediario.direccion ? 
                            `${c.envio.intermediario.direccion.calle} ${c.envio.intermediario.direccion.altura}, ${c.envio.intermediario.direccion.ciudad}` 
                            : "Dirección pendiente"
                     } : null
                 } : null
             };
        }).filter(Boolean);

        res.json({ data: result });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
}

async function markSent(req: Request, res: Response) {
   try {
       const compraId = Number(req.params.compraId);
       const vendedorId = Number(req.params.id);
       
       const compra = await em.findOneOrFail(Compra, { id: compraId }, { populate: ['envio', 'itemCartas.cartas'] });

       const isVendor = compra.itemCartas.getItems().some(item => 
           item.cartas.getItems().some(card => card.uploader?.id === vendedorId)
       );
       
       if (!isVendor) return res.status(403).json({ message: "No eres vendedor en esta compra" });

       if (!compra.envio) return res.status(400).json({ message: "Compra sin envío asignado" });

       // Actualizamos el estado de la compra individual, NO del envío masivo (Envio)
       compra.estado = 'ENVIADO_A_INTERMEDIARIO';
       await em.flush();
       
       res.json({ message: "Envío marcado como enviado al intermediario" });
   } catch(e: any) {
       res.status(500).json({ message: e.message });
   }
}

export { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent };

