import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { ItemCarta } from './itemCarta.entity.js';
import { Intermediario } from '../intermediario/intermediario.entity.js';
import { Carta } from './carta.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';

const em=orm.em

async function findAll(req: Request, res: Response) {
   try {
       const items = await em.find(ItemCarta, { estado: 'disponible' }, { populate: ['intermediarios', 'cartas', 'uploaderVendedor'] });
       // Formatear para cumplir con las expectativas del frontend
       const itemsFormateadas = items.map(item => ({
         id: item.id,
         title: item.name,
         thumbnail: item.cartas[0]?.image || undefined,
         price: item.cartas[0]?.price ? parseFloat(item.cartas[0].price.replace('$', '')) : undefined,
         description: item.description,
         intermediarios: item.intermediarios,
         cartas: item.cartas,
         uploader: item.uploaderVendedor,
       }));
       res.status(200).json({message: 'foundAll OK', data: itemsFormateadas});
   } catch (error: any) {
       res.status(500).json({message: error.message || 'Internal server error'});
   }
}

async function findOne(req: Request, res: Response) {
    try {
        const id=Number(req.params.id)
        const item = await em.findOneOrFail(ItemCarta, { id }, { populate: ['intermediarios', 'cartas', 'uploaderVendedor'] });
        const itemFormateado = {
          id: item.id,
          title: item.name,
          thumbnail: item.cartas[0]?.image || undefined,
          price: item.cartas[0]?.price ? parseFloat(item.cartas[0].price.replace('$', '')) : undefined,
          description: item.description,
          intermediarios: item.intermediarios,
          cartas: item.cartas,
          uploader: item.uploaderVendedor,
        };
        res.status(200).json({message: 'found item', data: itemFormateado});
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'});
    }
}

async function add(req: Request, res: Response) {
    try {
        const { intermediariosIds, cartasIds, uploaderId, ...itemData } = req.body;
        
        // Buscar el cargador (solo un Vendedor puede subir items)
        const uploader = await em.findOne(Vendedor, { id: uploaderId });
        
        if (!uploader) {
            return res.status(400).json({ message: 'Uploader not found or not a vendedor' });
        }
        
        const item = em.create(ItemCarta, { 
            ...itemData, 
            stock: itemData.stock || 1,
            estado: 'disponible',
            uploaderVendedor: uploader
        });
        if (intermediariosIds && Array.isArray(intermediariosIds)) {
            const intermediarios = await em.find(Intermediario, { id: { $in: intermediariosIds } });
            item.intermediarios.set(intermediarios);
        }
        if (cartasIds && Array.isArray(cartasIds)) {
            const cartas = await em.find(Carta, { id: { $in: cartasIds } });
            // Actualizar lado propietario (Carta -> ItemCarta)
            for (const carta of cartas) {
                carta.items.add(item);
            }
        }
        await em.flush();
        res.status(201).json({message: 'Item created', data: item});
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'});
    }
}

async function update(req: Request, res: Response) {
    try {
        const id=Number.parseInt(req.params.id as string)
        const { userId, intermediariosIds, cartasIds, ...updateData } = req.body;
        
        const item = await em.findOneOrFail(ItemCarta, { id }, { populate: ['uploaderVendedor'] });
        
        // Verificar si el usuario es el cargador
        if (!userId || !item.uploaderVendedor || item.uploaderVendedor.id !== userId) {
            return res.status(403).json({ message: 'Only the uploader can edit this item' });
        }
        
        em.assign(item, updateData);
        if (intermediariosIds !== undefined && Array.isArray(intermediariosIds)) {
            const intermediarios = await em.find(Intermediario, { id: { $in: intermediariosIds } });
            item.intermediarios.set(intermediarios);
        }
        if (cartasIds !== undefined && Array.isArray(cartasIds)) {
            // Actualizar lado propietario (Carta -> ItemCarta)
            // 1. Remover item de cartas que no están en la nueva lista
            // Necesitamos popular 'items' (Collection<ItemCarta>) para verificar presencia/remover correctamente
            const currentCartas = await em.find(Carta, { items: item }, { populate: ['items'] });
            for (const carta of currentCartas) {
                if (!cartasIds.includes(carta.id)) {
                    carta.items.remove(item);
                }
            }
            
            // 2. Agregar item a cartas en la nueva lista
            // Popular 'items' aquí también para verificar si ya está presente
            const targetCartas = await em.find(Carta, { id: { $in: cartasIds } }, { populate: ['items'] });
            for (const carta of targetCartas) {
                 if (!carta.items.contains(item)) {
                     carta.items.add(item);
                 }
            }
        }
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
        const id=Number.parseInt(req.params.id as string)
        const item =  em.getReference(ItemCarta, id )
        await em.removeAndFlush(item)
        res.status(200).json({message: 'Item removed', data: item})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

export {  findAll, findOne, add, update, remove }
