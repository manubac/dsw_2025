import { Request, Response, NextFunction } from 'express';
import { orm } from '../shared/db/orm.js';
import { wrap } from '@mikro-orm/core';
import { Vendedor } from './vendedores.entity.js'
import { Compra } from '../compra/compra.entity.js';
import { TiendaRetiro } from '../tiendaRetiro/tiendaRetiro.entity.js';
import { sendEmail } from '../shared/mailer.js';

const em= orm.em

function sanitiseVendedorInput(
    req: Request,
    res: Response,
    next: NextFunction
) {
    req.body.sanitisedInput = {
        nombre: req.body.nombre,
        telefono: req.body.telefono,
        ciudad: req.body.ciudad,
        alias: req.body.alias,
        cbu: req.body.cbu,
        items: req.body.items
    };

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
            {populate:['user', 'itemCartas']}
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
        const vendedor = await em.findOne(Vendedor, {id}, {populate:['user', 'itemCartas', 'itemCartas.cartas']})
        res.status(200).json({message:'Found one vendedor', data:vendedor})
    } catch (error: any) {
        res.status(500).json({message: error.message})
    }
}

async function add(req: Request, res: Response) {
    return res.status(410).json({ message: 'Registro directo deshabilitado. Usá el flujo de upgrade desde tu perfil de comprador.' });
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
    return res.status(410).json({ message: 'Login deprecado. Usá POST /api/users/login' });
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
                uploaderVendedor: { id },
            }
        }, {
             populate: ['itemCartas', 'itemCartas.cartas', 'itemCartas.uploaderVendedor', 'comprador', 'envio', 'envio.intermediario', 'envio.intermediario.direccion', 'tiendaRetiro']
        });

        const result = compras.map(c => {
             const myItems = c.itemCartas.getItems().filter(item =>
                 item.uploaderVendedor?.id === id
             );
             if (myItems.length === 0) return null;

             return {
                 id: c.id,
                 fecha: c.createdAt,
                 total: c.total,
                 estado: c.estado,
                 comprador: {
                     id: c.comprador?.id,
                     nombre: c.comprador?.username || c.nombre || "Usuario",
                     email: c.comprador?.email || c.email
                 },
                 items: myItems.map(i => ({
                     id: i.id,
                     name: i.cartas[0]?.name,
                     image: i.cartas[0]?.image,
                     price: i.cartas[0]?.price
                 })),
                 tiendaRetiro: c.tiendaRetiro
                     ? {
                         id: c.tiendaRetiro.id,
                         nombre: c.tiendaRetiro.nombre,
                         direccion: c.tiendaRetiro.direccion,
                         horario: c.tiendaRetiro.horario,
                       }
                     : null,
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

       const compra = await em.findOneOrFail(Compra, { id: compraId }, { populate: ['envio', 'itemCartas', 'itemCartas.uploaderVendedor'] });

       const isVendor = compra.itemCartas.getItems().some(item =>
           item.uploaderVendedor?.id === vendedorId
       );

       if (!isVendor) return res.status(403).json({ message: "No eres vendedor en esta compra" });

       if (!compra.envio) return res.status(400).json({ message: "Compra sin envío asignado" });

       compra.estado = 'ENVIADO_A_INTERMEDIARIO';
       await em.flush();

       res.json({ message: "Envío marcado como enviado al intermediario" });
   } catch(e: any) {
       res.status(500).json({ message: e.message });
   }
}

async function entregarTienda(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const vendedorId = Number(req.params.id);

    const compra = await em.findOne(
      Compra,
      { id: compraId },
      { populate: ['itemCartas', 'itemCartas.cartas', 'itemCartas.uploaderVendedor', 'comprador', 'tiendaRetiro'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

    const isVendor = compra.itemCartas.getItems().some(item =>
      item.uploaderVendedor?.id === vendedorId
    );
    if (!isVendor) return res.status(403).json({ message: 'No eres vendedor en esta compra' });

    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'entregado_a_tienda';
    await em.flush();

    const tienda = compra.tiendaRetiro;
    const nombreVendedor = compra.itemCartas.getItems()[0]?.uploaderVendedor?.nombre
      || `Vendedor #${vendedorId}`;
    const nombreComprador = compra.comprador?.username || compra.nombre || 'comprador';

    if (tienda?.email) {
      const html = `
        <h2>Nuevo pedido en camino a tu tienda</h2>
        <p>El vendedor indica que el pedido <strong>#${compra.id}</strong> está en camino a tu tienda.</p>
        <p><strong>Comprador:</strong> ${nombreComprador}</p>
        <p>Cuando lo recibas, marcalo como <strong>"En tienda"</strong> desde tu panel para notificar al comprador.</p>
      `;
      sendEmail(
        tienda.email,
        `Pedido #${compra.id} en camino a tu tienda`,
        `El pedido #${compra.id} está en camino`,
        html
      );
    }

    res.json({ message: 'Pedido marcado como entregado a tienda', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

async function getTiendasRetiro(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const vendedor = await em.findOne(Vendedor, { id }, { populate: ['tiendasRetiro'] });
    if (!vendedor) return res.status(404).json({ message: 'Vendedor no encontrado' });
    res.json({ data: vendedor.tiendasRetiro.getItems() });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

async function updateTiendasRetiro(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tiendaIds: number[] = Array.isArray(req.body.tiendaIds) ? req.body.tiendaIds.map(Number) : [];
    const vendedor = await em.findOne(Vendedor, { id }, { populate: ['tiendasRetiro'] });
    if (!vendedor) return res.status(404).json({ message: 'Vendedor no encontrado' });
    const tiendas = tiendaIds.length > 0 ? await em.find(TiendaRetiro, { id: { $in: tiendaIds } }) : [];
    vendedor.tiendasRetiro.set(tiendas);
    await em.flush();
    res.json({ data: vendedor.tiendasRetiro.getItems() });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export { sanitiseVendedorInput, findAll, findOne, add, update, remove, login, logout, getVentas, markSent, entregarTienda, getTiendasRetiro, updateTiendasRetiro };
