import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Envio, EstadoEnvio } from "./envio.entity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";
import { Compra } from "../compra/compra.entity.js";

const em = orm.em;

// Middleware de saneamiento
function sanitizeEnvioInput(req: Request, res: Response, next: NextFunction) {
  const {
    intermediarioId,
    destinoIntermediarioId,
    estado,
    fechaEnvio,
    fechaEntrega,
    notas,
    minimoCompras,
    precioPorCompra,
  } = req.body;

  req.body.sanitizedInput = {
    intermediarioId,
    destinoIntermediarioId,
    estado,
    fechaEnvio,
    fechaEntrega,
    notas,
    minimoCompras,
    precioPorCompra,
  };

  next();
}

// Obtener todos los envios
async function findAll(req: Request, res: Response) {
  try {
    const { intermediarioId, intermediarios, estado } = req.query;

    let whereClause: any = {};
    if (intermediarioId) {
      whereClause.intermediario = { id: Number(intermediarioId) };
    }
    if (intermediarios) {
      const ids = (intermediarios as string).split(',').map(id => Number(id));
      whereClause.intermediario = { id: { $in: ids } };
    }
    if (estado) {
        whereClause.estado = estado;
    }

    const envios = await em.find(Envio, whereClause, {
      populate: ["intermediario", "destinoIntermediario", "destinoIntermediario.direccion", "compras", "compras.comprador", "compras.itemCartas"]
    });

    res.status(200).json({ message: "Found all envios", data: envios });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Obtener un envio por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { intermediarioId } = req.query;

    const envio = await em.findOne(Envio, { id }, {
      populate: ["intermediario", "compras", "compras.comprador", "compras.itemCartas"]
    });

    if (!envio) return res.status(404).json({ message: "Envio not found" });

    // Verificar que el envio pertenece al intermediario autenticado
    if (intermediarioId && envio.intermediario.id !== Number(intermediarioId)) {
      return res.status(403).json({ message: "No tienes permiso para acceder a este envio" });
    }

    res.status(200).json({ message: "Found one envio", data: envio });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear nuevo envio
async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    // Validar que el intermediario existe
    const intermediario = await em.findOne(Intermediario, { id: input.intermediarioId });
    if (!intermediario) {
      return res.status(400).json({ message: "Intermediario no encontrado" });
    }

    let destinoIntermediario;
    if (input.destinoIntermediarioId) {
      destinoIntermediario = await em.findOne(Intermediario, { id: input.destinoIntermediarioId });
      if (!destinoIntermediario) {
        return res.status(400).json({ message: "Destino intermediario no encontrado" });
      }
    }

    const envio = em.create(Envio, {
      intermediario,
      destinoIntermediario,
      estado: input.estado || EstadoEnvio.ORDEN_GENERADA,
      fechaEnvio: input.fechaEnvio ? new Date(input.fechaEnvio) : undefined,
      fechaEntrega: input.fechaEntrega ? new Date(input.fechaEntrega) : undefined,
      notas: input.notas,
      minimoCompras: input.minimoCompras,
      precioPorCompra: input.precioPorCompra,
      compras: [], // Inicializar colección vacía
    });

    await em.flush();

    res.status(201).json({ message: "Envio creado con éxito", data: envio });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Actualizar envio
async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { intermediarioId } = req.query;

    const envio = await em.findOne(Envio, { id }, { populate: ["intermediario"] });

    if (!envio) return res.status(404).json({ message: "Envio not found" });

    // Verificar que el envio pertenece al intermediario autenticado
    if (intermediarioId && envio.intermediario.id !== Number(intermediarioId)) {
      return res.status(403).json({ message: "No tienes permiso para modificar este envio" });
    }

    const input = req.body.sanitizedInput;

    envio.estado = input.estado ?? envio.estado;
    envio.fechaEnvio = input.fechaEnvio ? new Date(input.fechaEnvio) : envio.fechaEnvio;
    envio.fechaEntrega = input.fechaEntrega ? new Date(input.fechaEntrega) : envio.fechaEntrega;
    envio.notas = input.notas ?? envio.notas;

    await em.flush();

    res.status(200).json({ message: "Envio actualizado con éxito", data: envio });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Eliminar envio
async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { intermediarioId } = req.query;

    const envio = await em.findOne(Envio, { id }, { populate: ["intermediario"] });

    if (!envio) return res.status(404).json({ message: "Envio not found" });

    // Verificar que el envio pertenece al intermediario autenticado
    if (intermediarioId && envio.intermediario.id !== Number(intermediarioId)) {
      return res.status(403).json({ message: "No tienes permiso para eliminar este envio" });
    }

    await em.removeAndFlush(envio);
    res.status(200).json({ message: "Envio eliminado con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Agregar compra a envio
async function addCompra(req: Request, res: Response) {
  try {
    const envioId = Number(req.params.id);
    const { compraId } = req.body;

    const envio = await em.findOne(Envio, { id: envioId });
    if (!envio) return res.status(404).json({ message: "Envio not found" });

    const compra = await em.findOne(Compra, { id: compraId });
    if (!compra) return res.status(404).json({ message: "Compra not found" });

    // Verificar que la compra no esté ya en otro envio
    if (compra.envio) {
      return res.status(400).json({ message: "La compra ya está asignada a otro envio" });
    }

    compra.envio = envio;
    await em.flush();

    res.status(200).json({ message: "Compra agregada al envio con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Remover compra de envio
async function removeCompra(req: Request, res: Response) {
  try {
    const envioId = Number(req.params.id);
    const { compraId } = req.body;

    const envio = await em.findOne(Envio, { id: envioId });
    if (!envio) return res.status(404).json({ message: "Envio not found" });

    const compra = await em.findOne(Compra, { id: compraId });
    if (!compra) return res.status(404).json({ message: "Compra not found" });

    if (compra.envio?.id !== envioId) {
      return res.status(400).json({ message: "La compra no pertenece a este envio" });
    }

    compra.envio = undefined;
    await em.flush();

    res.status(200).json({ message: "Compra removida del envio con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Planificar un envio
async function planEnvio(req: Request, res: Response) {
  try {
    const { intermediarioId, destinoIntermediarioId, minimoCompras, precioPorCompra, fechaEnvio } = req.body;

    const intermediario = await em.findOne(Intermediario, { id: intermediarioId });
    if (!intermediario) {
      return res.status(400).json({ message: "Intermediario no encontrado" });
    }

    const destinoIntermediario = await em.findOne(Intermediario, { id: destinoIntermediarioId });
    if (!destinoIntermediario) {
      return res.status(400).json({ message: "Destino intermediario no encontrado" });
    }

    const envio = em.create(Envio, {
      intermediario,
      destinoIntermediario,
      estado: EstadoEnvio.PLANIFICADO,
      minimoCompras,
      precioPorCompra,
      fechaEnvio: fechaEnvio ? new Date(fechaEnvio) : undefined,
      compras: [],
    });

    await em.flush();
    res.status(201).json({ message: "Envio planificado con éxito", data: envio });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Activar un envio planificado
async function activateEnvio(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const envio = await em.findOne(Envio, { id }, { populate: ['compras'] });

    if (!envio) return res.status(404).json({ message: "Envio not found" });

    if (envio.estado !== EstadoEnvio.PLANIFICADO) {
      return res.status(400).json({ message: "El envio no está planificado" });
    }

    if (!envio.minimoCompras || envio.compras.length < envio.minimoCompras) {
      return res.status(400).json({ message: "No hay suficientes compras para activar el envio" });
    }

    envio.estado = EstadoEnvio.ACTIVO;
    await em.flush();

    res.status(200).json({ message: "Envio activado con éxito", data: envio });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeEnvioInput, findAll, findOne, add, update, remove, addCompra, removeCompra, planEnvio, activateEnvio };