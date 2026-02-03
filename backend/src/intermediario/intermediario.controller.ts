import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Intermediario } from "./intermediario.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { Envio, EstadoEnvio } from "../envio/envio.entity.js";
import { Compra } from "../compra/compra.entity.js";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const em = orm.em;

// Middleware de saneamiento
function sanitizeIntermediarioInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nombre: req.body.nombre,
    email: req.body.email,
    password: req.body.password,
    telefono: req.body.telefono,
    descripcion: req.body.descripcion,
    activo: req.body.activo,
  };

  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });

  next();
}

// Obtener todos los intermediarios
async function findAll(req: Request, res: Response) {
  try {
    const intermediarios = await em.find(Intermediario, {}, { populate: ["direccion"] });
    res.status(200).json({ message: "Found all intermediarios", data: intermediarios });
  } catch (error) {
    res.status(500).json({ message: "Error fetching intermediarios", error });
  }
}

// Obtener intermediario por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const intermediario = await em.findOne(Intermediario, { id }, { populate: ["direccion"] });

    if (!intermediario) return res.status(404).json({ message: "Intermediario not found" });

    res.status(200).json({ message: "Found one intermediario", data: intermediario });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear nuevo intermediario
async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    if (!input.nombre || !input.email || !input.password || !input.telefono) {
      return res.status(400).json({ message: "nombre, email, password y telefono son obligatorios" });
    }

    const existing = await em.findOne(Intermediario, { email: input.email });
    if (existing) {
      return res.status(400).json({ message: "El email ya está registrado" });
    }

    const saltRounds = 10;
    input.password = await bcrypt.hash(input.password, saltRounds);

    const intermediario = em.create(Intermediario, input);
    await em.flush();

    res.status(201).json({ message: "Intermediario created", data: intermediario });
  } catch (error: any) {
    res.status(500).json({ message: "Error creating intermediario", error: error.message });
  }
}

// Actualizar intermediario
async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const intermediarioToUpdate = await em.findOne(Intermediario, { id });
    if (!intermediarioToUpdate) {
      return res.status(404).json({ message: "Intermediario not found" });
    }

    em.assign(intermediarioToUpdate, req.body.sanitizedInput);
    await em.flush();

    res.status(200).json({ message: "Intermediario updated successfully", data: intermediarioToUpdate });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Eliminar intermediario y sus envíos asociados
async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const intermediario = await em.findOne(Intermediario, { id });
    if (!intermediario) {
      return res.status(404).json({ message: "Intermediario not found" });
    }

    // 1. Gestionar Envios donde es Origen (dueño)
    const enviosOrigen = await em.find(Envio, { intermediario: { id } }, { populate: ['compras'] });
    for (const envio of enviosOrigen) {
        // Desvincular compras para no eliminarlas (o eliminarlas si es regla de negocio, pero mejor preservar compras)
        for (const compra of envio.compras) {
            compra.envio = undefined; 
        }
        em.remove(envio);
    }

    // 2. Gestionar Envios donde es Destino
    const enviosDestino = await em.find(Envio, { destinoIntermediario: { id } });
    for (const envio of enviosDestino) {
        envio.destinoIntermediario = undefined; 
    }

    // 3. Eliminar Intermediario
    await em.removeAndFlush(intermediario); // Flushes all changes above too
    res.status(200).json({ message: "Intermediario y sus datos asociados eliminados correctamente" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const intermediario = await em.findOne(Intermediario, { email }, { populate: ['direccion'] });
    if (!intermediario) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Check hash
    const isMatch = await bcrypt.compare(password, intermediario.password);
    if (!isMatch) {
       // Fallback check
       if (intermediario.password !== password) {
          return res.status(401).json({ message: 'Invalid credentials' });
       }
    }

    // Agregar campo de rol para el frontend
    const intermediarioWithRole = {
      ...intermediario,
      role: 'intermediario'
    };

    const token = jwt.sign({ userId: intermediario.id }, process.env.JWT_SECRET || 'default_secret', { expiresIn: '1h' });

    res.status(200).json({ message: 'Login successful', data: intermediarioWithRole, token });
  } catch (error: any) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
}

async function getEnvios(req: Request, res: Response) {
    try {
        const id = Number(req.params.id);
        const type = req.query.type as string; // 'origen' | 'destino'

        const where: any = {};
        if (type === 'origen') {
            where.intermediario = { id };
        } else if (type === 'destino') {
            where.destinoIntermediario = { id };
        } else {
            // Fallback: all involved
             where.$or = [
                 { intermediario: { id } },
                 { destinoIntermediario: { id } }
             ];
        }

        const envios = await em.find(Envio, where, {
            populate: [
                'intermediario',
                'destinoIntermediario',
                'compras',
                'compras.comprador',
                'compras.itemCartas',
                'compras.itemCartas.cartas',
                'compras.itemCartas.cartas.uploader'
            ]
        });

        const data = envios.map(envio => {
            return {
                id: envio.id,
                estado: envio.estado,
                fechaEnvio: envio.fechaEnvio,
                minimoCompras: envio.minimoCompras,
                precioPorCompra: envio.precioPorCompra,
                notas: envio.notas,
                intermediario: envio.intermediario ? {
                    id: envio.intermediario.id, 
                    nombre: envio.intermediario.nombre
                } : null,
                destinoIntermediario: envio.destinoIntermediario ? {
                    id: envio.destinoIntermediario.id, 
                    nombre: envio.destinoIntermediario.nombre
                } : null,
                items: envio.compras.map(compra => ({
                    compraId: compra.id,
                    estadoCompra: compra.estado,
                    titulo: compra.itemCartas[0]?.cartas[0]?.name || "Carta",
                    vendedor: compra.itemCartas[0]?.cartas[0]?.uploader?.nombre || "Vendedor",
                    comprador: compra.comprador?.username || compra.nombre || "Comprador",
                    compradorId: compra.comprador?.id
                }))
            };
        });

        res.json({ data });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

async function planEnvio(req: Request, res: Response) {
    try {
        const { intermediarioId, destinoIntermediarioId, minimoCompras, precioPorCompra, fechaEnvio } = req.body;
        
        const intermediario = await em.getReference(Intermediario, intermediarioId);
        const destino = await em.getReference(Intermediario, destinoIntermediarioId);

        const nuevoEnvio = em.create(Envio, {
            intermediario,
            destinoIntermediario: destino,
            minimoCompras: Number(minimoCompras),
            precioPorCompra: Number(precioPorCompra),
            fechaEnvio: new Date(fechaEnvio),
            estado: EstadoEnvio.PLANIFICADO, // "planificado"
            compras: []
        });

        await em.flush();
        res.status(201).json({ message: "Envio planificado", data: nuevoEnvio });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

async function updateCompraStatus(req: Request, res: Response) {
    try {
        const compraId = Number(req.params.compraId);
        const { status } = req.body; 
        // Expected: 'EN_MANOS_INTERMEDIARIO_ORIGEN', 'ENTREGADO'
        
        const compra = await em.findOneOrFail(Compra, { id: compraId });
        compra.estado = status;
        
        await em.flush();
        res.json({ message: "Estado de compra actualizado", data: compra });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

async function dispatchEnvio(req: Request, res: Response) {
    try {
        const envioId = Number(req.params.envioId);
        const envio = await em.findOneOrFail(Envio, { id: envioId }, { populate: ['compras'] });
        
        envio.estado = EstadoEnvio.INTERMEDIARIO_ENVIADO;
        if (req.body.notas) envio.notas = req.body.notas;
        
        // Implicitly update all compras to 'EN_CAMINO_A_DESTINO' ?
        // Or keep them as is and deduce from Envio status. 
        // Ideally update items for clarity.
        for (const compra of envio.compras) {
            if (compra.estado === 'EN_MANOS_INTERMEDIARIO_ORIGEN') {
                compra.estado = 'EN_CAMINO_A_DESTINO';
            }
        }

        await em.flush();
        
        res.json({ message: "Envío despachado al destino", data: envio });
    } catch (e: any) {
         res.status(500).json({ message: e.message });
    }
}

async function receiveEnvio(req: Request, res: Response) {
    try {
        const envioId = Number(req.params.envioId);
        const envio = await em.findOneOrFail(Envio, { id: envioId }, { populate: ['compras'] });
        
        envio.estado = EstadoEnvio.INTERMEDIARIO_RECIBIO; // Re-use this or create RECIBIDO_DESTINO
        
        for (const compra of envio.compras) {
             if (compra.estado === 'EN_CAMINO_A_DESTINO') {
                compra.estado = 'LISTO_PARA_RETIRO'; // Or "Recibido en destino"
             }
        }
        
        await em.flush();
        
        res.json({ message: "Envío recibido en destino", data: envio });
    } catch (e: any) {
         res.status(500).json({ message: e.message });
    }
}

async function updateEnvioDetails(req: Request, res: Response) {
    try {
        const envioId = Number(req.params.envioId);
        const { notas, fechaEnvio } = req.body;

        const envio = await em.findOneOrFail(Envio, { id: envioId });
        
        if (notas !== undefined) envio.notas = notas;
        if (fechaEnvio !== undefined) envio.fechaEnvio = new Date(fechaEnvio);

        await em.flush();
        res.json({ message: "Envio actualizado", data: envio });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

async function deleteEnvio(req: Request, res: Response) {
    try {
        const envioId = Number(req.params.envioId);
        
        const envio = await em.findOneOrFail(Envio, { id: envioId }, { populate: ['compras'] });

        if (envio.compras.length > 0) {
             return res.status(400).json({ message: "No se puede eliminar un envío que ya tiene compras asignadas." });
        }

        await em.removeAndFlush(envio);
        res.json({ message: "Envio eliminado" });
    } catch (e: any) {
        res.status(500).json({ message: e.message });
    }
}

export { 
    sanitizeIntermediarioInput, 
    findAll, 
    findOne, 
    add, 
    update, 
    remove, 
    login,
    getEnvios,
    planEnvio,            // NEW
    updateCompraStatus,   // NEW
    receiveEnvio,
    dispatchEnvio,
    updateEnvioDetails,
    deleteEnvio 
};