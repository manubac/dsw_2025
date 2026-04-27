import { Request, Response } from 'express';
import { orm } from '../shared/db/orm.js';
import { ItemCarta } from './itemCarta.entity.js';
import { Intermediario } from '../intermediario/intermediario.entity.js';
import { Carta } from './carta.entity.js';
import { Vendedor } from '../vendedor/vendedores.entity.js';

const em=orm.em

async function findAll(req: Request, res: Response) {
   try {
       const items = await em.find(ItemCarta, { estado: 'disponible' }, { populate: ['intermediarios.direccion', 'cartas', 'uploaderVendedor'] });
       // Formatear para cumplir con las expectativas del frontend
       const parseCartaPrice = (p?: string) => p ? parseFloat(p.replace(/[^0-9.]/g, '')) || 0 : 0;
       const itemsFormateadas = items.map(item => {
         const cartaItems = item.cartas.getItems();
         const totalPrice = cartaItems.reduce((sum, c) => sum + parseCartaPrice(c.price), 0);
         return {
           id: item.id,
           title: item.name,
           thumbnail: cartaItems[0]?.image || undefined,
           price: totalPrice > 0 ? totalPrice : undefined,
           description: item.description,
           stock: item.stock,
           intermediarios: item.intermediarios,
           cartas: cartaItems.map(c => ({
             id: c.id,
             name: c.name,
             image: c.image,
             price: parseCartaPrice(c.price),
             rarity: c.rarity,
             setName: c.setName,
             cardNumber: c.cardNumber,
             lang: c.lang ?? null,
           })),
           uploader: item.uploaderVendedor,
           type: 'bundle',
         };
       });
       res.status(200).json({message: 'foundAll OK', data: itemsFormateadas});
   } catch (error: any) {
       res.status(500).json({message: error.message || 'Internal server error'});
   }
}

async function findOne(req: Request, res: Response) {
    try {
        const id=Number(req.params.id)
        const item = await em.findOneOrFail(ItemCarta, { id }, { populate: ['intermediarios.direccion', 'cartas', 'uploaderVendedor'] });
        const parseCartaPrice = (p?: string) => p ? parseFloat(p.replace(/[^0-9.]/g, '')) || 0 : 0;
        const cartaItems = item.cartas.getItems();
        const totalPrice = cartaItems.reduce((sum, c) => sum + parseCartaPrice(c.price), 0);
        const itemFormateado = {
          id: item.id,
          title: item.name,
          thumbnail: cartaItems[0]?.image || null,
          price: totalPrice,
          description: item.description,
          stock: item.stock,
          cartas: cartaItems.map(c => ({
            id: c.id,
            name: c.name,
            image: c.image ?? null,
            price: parseCartaPrice(c.price),
            rarity: c.rarity ?? null,
            setName: c.setName ?? null,
            cardNumber: c.cardNumber ?? null,
            lang: c.lang ?? null,
          })),
          uploader: item.uploaderVendedor
            ? { id: item.uploaderVendedor.id, nombre: (item.uploaderVendedor as any).nombre ?? null }
            : null,
          type: 'bundle',
        };
        res.status(200).json({message: 'found item', data: itemFormateado});
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'});
    }
}

async function add(req: Request, res: Response) {
    const emReq = orm.em.fork();
    try {
        const { intermediariosIds, cartasIds, uploaderId, ...itemData } = req.body;

        // Registro diagnóstico para ayudar a identificar fallos en las subidas
        try {
            console.log('itemCarta.add payload summary:', {
                nameLength: itemData.name ? String(itemData.name).length : 0,
                intermediariosCount: Array.isArray(intermediariosIds) ? intermediariosIds.length : 0,
                cartasCount: Array.isArray(cartasIds) ? cartasIds.length : 0,
                uploaderId
            });
        } catch (logErr) {
            console.warn('Failed to log itemCarta payload summary', logErr);
        }

        // Validar uploaderId temprano para evitar errores 500 ambiguos
        if (!uploaderId) {
            return res.status(400).json({ message: 'uploaderId is required. Are you logged in as a vendedor?' });
        }

        // Buscar el cargador (solo un Vendedor puede subir items)
        const uploader = await emReq.findOne(Vendedor, { id: uploaderId });

        if (!uploader) {
            return res.status(400).json({ message: 'Uploader not found or not a vendedor' });
        }

        const item = emReq.create(ItemCarta, {
            ...itemData,
            stock: itemData.stock || 1,
            estado: 'disponible',
            uploaderVendedor: uploader
        });
        if (intermediariosIds && Array.isArray(intermediariosIds)) {
            const intermediarios = await emReq.find(Intermediario, { id: { $in: intermediariosIds } });
            item.intermediarios.set(intermediarios);
        }
        if (cartasIds && Array.isArray(cartasIds)) {
            const cartas = await emReq.find(Carta, { id: { $in: cartasIds } });
            // Actualizar lado propietario (Carta -> ItemCarta)
            for (const carta of cartas) {
                carta.items.add(item);
            }
        }
        await emReq.flush();
        res.status(201).json({message: 'Item created', data: item});
    } catch (error: any) {
        console.error('[itemCarta.add] ERROR:', error);
        res.status(500).json({message: error.message || 'Internal server error'});
    }
}

async function update(req: Request, res: Response) {
    const emReq = orm.em.fork();
    try {
        const id=Number.parseInt(req.params.id as string)
        const { userId, intermediariosIds, cartasIds, ...updateData } = req.body;

        const item = await emReq.findOneOrFail(ItemCarta, { id }, { populate: ['uploaderVendedor'] });

        // Verificar si el usuario es el cargador
        if (!userId || !item.uploaderVendedor || item.uploaderVendedor.id !== userId) {
            return res.status(403).json({ message: 'Only the uploader can edit this item' });
        }

        emReq.assign(item, updateData);
        if (intermediariosIds !== undefined && Array.isArray(intermediariosIds)) {
            const intermediarios = await emReq.find(Intermediario, { id: { $in: intermediariosIds } });
            item.intermediarios.set(intermediarios);
        }
        if (cartasIds !== undefined && Array.isArray(cartasIds)) {
            // Actualizar lado propietario (Carta -> ItemCarta)
            // 1. Remover item de cartas que no están en la nueva lista
            const currentCartas = await emReq.find(Carta, { items: item }, { populate: ['items'] });
            for (const carta of currentCartas) {
                if (!cartasIds.includes(carta.id)) {
                    carta.items.remove(item);
                }
            }

            // 2. Agregar item a cartas en la nueva lista
            const targetCartas = await emReq.find(Carta, { id: { $in: cartasIds } }, { populate: ['items'] });
            for (const carta of targetCartas) {
                 if (!carta.items.contains(item)) {
                     carta.items.add(item);
                 }
            }
        }
        await emReq.flush()
        res
            .status(200)
            .json({message: 'Item updated', data: item})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

async function remove(req: Request, res: Response) {
    const emReq = orm.em.fork();
    try {
        const id=Number.parseInt(req.params.id as string)
        const item = emReq.getReference(ItemCarta, id)
        await emReq.removeAndFlush(item)
        res.status(200).json({message: 'Item removed', data: item})
    } catch (error: any) {
        res.status(500).json({message: error.message || 'Internal server error'})
    }
}

export {  findAll, findOne, add, update, remove }
