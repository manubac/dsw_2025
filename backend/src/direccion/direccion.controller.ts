import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Direccion } from "./direccion.entity.js";
import { User } from "../user/user.entity.js";
import { Intermediario } from "../intermediario/intermediario.entity.js";

const em = orm.em;

// Middleware de saneamiento
function sanitizeDireccionInput(req: Request, res: Response, next: NextFunction) {
  const {
    usuarioId,
    intermediarioId,
    provincia,
    ciudad,
    codigoPostal,
    calle,
    altura,
    departamento,
  } = req.body;

  req.body.sanitizedInput = {
    usuarioId,
    intermediarioId,
    provincia,
    ciudad,
    codigoPostal,
    calle,
    altura,
    departamento,
  };

  next();
}

// Obtener todas las direcciones
async function findAll(req: Request, res: Response) {
  try {
    const { usuarioId, intermediarioId } = req.query;

    // Si se proporciona usuarioId o intermediarioId, filtrar por ese usuario/intermediario
    let whereClause: any = {};
    if (usuarioId) {
      whereClause.usuario = { id: Number(usuarioId) };
    }
    if (intermediarioId) {
      whereClause.intermediario = { id: Number(intermediarioId) };
    }

    const direcciones = await em.find(Direccion, whereClause, { populate: ["usuario", "intermediario"] });
    res.status(200).json({ message: "Found all direcciones", data: direcciones });
  } catch (error) {
    res.status(500).json({ message: "Error fetching direcciones", error });
  }
}

// Obtener direccion por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { usuarioId, intermediarioId } = req.query;

    const direccion = await em.findOne(Direccion, { id }, { populate: ["usuario", "intermediario"] });

    if (!direccion) return res.status(404).json({ message: "Direccion not found" });

    // Verificar que la dirección pertenece al usuario o intermediario autenticado
    if (usuarioId && direccion.usuario?.id !== Number(usuarioId)) {
      return res.status(403).json({ message: "No tienes permiso para acceder a esta dirección" });
    }
    if (intermediarioId && direccion.intermediario?.id !== Number(intermediarioId)) {
      return res.status(403).json({ message: "No tienes permiso para acceder a esta dirección" });
    }

    res.status(200).json({ message: "Found one direccion", data: direccion });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear nueva direccion
async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    // Validar que se proporcione exactamente uno de usuarioId o intermediarioId
    if ((!input.usuarioId && !input.intermediarioId) || (input.usuarioId && input.intermediarioId)) {
      return res.status(400).json({ message: "Debe proporcionar exactamente uno de: usuarioId o intermediarioId" });
    }

    let usuario = null;
    let intermediario = null;

    if (input.usuarioId) {
      usuario = await em.findOne(User, { id: input.usuarioId });
      if (!usuario) {
        return res.status(400).json({ message: "Usuario no encontrado" });
      }
    }

    if (input.intermediarioId) {
      intermediario = await em.findOne(Intermediario, { id: input.intermediarioId });
      if (!intermediario) {
        return res.status(400).json({ message: "Intermediario no encontrado" });
      }
    }

    const direccion = em.create(Direccion, {
      usuario,
      intermediario,
      provincia: input.provincia,
      ciudad: input.ciudad,
      codigoPostal: input.codigoPostal,
      calle: input.calle,
      altura: input.altura,
      departamento: input.departamento,
    });

    await em.flush();

    res.status(201).json({ message: "Direccion creada con éxito", data: direccion });
  } catch (error: any) {
    console.error("Error creando direccion:", error);
    res.status(500).json({ message: "Error creando direccion", error: error.message });
  }
}

// Actualizar direccion
async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { usuarioId, intermediarioId } = req.query;

    const direccion = await em.findOne(Direccion, { id }, { populate: ["usuario", "intermediario"] });

    if (!direccion) return res.status(404).json({ message: "Direccion not found" });

    // Verificar que la dirección pertenece al usuario o intermediario autenticado
    if (usuarioId && direccion.usuario?.id !== Number(usuarioId)) {
      return res.status(403).json({ message: "No tienes permiso para modificar esta dirección" });
    }
    if (intermediarioId && direccion.intermediario?.id !== Number(intermediarioId)) {
      return res.status(403).json({ message: "No tienes permiso para modificar esta dirección" });
    }

    const input = req.body.sanitizedInput;

    if (input.usuarioId) direccion.usuario = em.getReference(User, input.usuarioId);
    if (input.intermediarioId) direccion.intermediario = em.getReference(Intermediario, input.intermediarioId);
    direccion.provincia = input.provincia ?? direccion.provincia;
    direccion.ciudad = input.ciudad ?? direccion.ciudad;
    direccion.codigoPostal = input.codigoPostal ?? direccion.codigoPostal;
    direccion.calle = input.calle ?? direccion.calle;
    direccion.altura = input.altura ?? direccion.altura;
    direccion.departamento = input.departamento ?? direccion.departamento;

    await em.flush();
    res.status(200).json({ message: "Direccion actualizada con éxito", data: direccion });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Eliminar direccion
async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { usuarioId, intermediarioId } = req.query;

    const direccion = await em.findOne(Direccion, { id }, { populate: ["usuario", "intermediario"] });

    if (!direccion) return res.status(404).json({ message: "Direccion not found" });

    // Verificar que la dirección pertenece al usuario o intermediario autenticado
    if (usuarioId && direccion.usuario?.id !== Number(usuarioId)) {
      return res.status(403).json({ message: "No tienes permiso para eliminar esta dirección" });
    }
    if (intermediarioId && direccion.intermediario?.id !== Number(intermediarioId)) {
      return res.status(403).json({ message: "No tienes permiso para eliminar esta dirección" });
    }

    await em.removeAndFlush(direccion);
    res.status(200).json({ message: "Direccion eliminada con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeDireccionInput, findAll, findOne, add, update, remove };