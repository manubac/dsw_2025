import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Compra } from "./compra.entity.js";
import { User } from "../user/user.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";

const em = orm.em;

// Middleware de saneamiento
function sanitizeCompraInput(req: Request, res: Response, next: NextFunction) {
  const {
    compradorId,
    cartasIds,
    total,
    estado,
    nombre,
    email,
    telefono,
    direccionEntregaId,
    metodoPago,
    items,
  } = req.body;

  req.body.sanitizedInput = {
    compradorId,
    cartasIds,
    total,
    estado,
    nombre,
    email,
    telefono,
    direccionEntregaId,
    metodoPago,
      items,
  };

  next();
}

// Obtener todas las compras
async function findAll(req: Request, res: Response) {
  try {
    const { compradorId } = req.query;

    // Si se proporciona compradorId, filtrar por ese comprador
    const whereClause = compradorId ? { comprador: { id: Number(compradorId) } } : {};

    const compras = await em.find(Compra, whereClause, { populate: ["comprador", "itemCartas", "itemCartas.cartas", "direccionEntrega"] });
    res.status(200).json({ message: "Found all compras", data: compras });
  } catch (error) {
    res.status(500).json({ message: "Error fetching compras", error });
  }
}

// Obtener compra por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { compradorId } = req.query;

    // Build where clause to ensure user can only access their own purchases
    const whereClause: any = { id };
    if (compradorId) {
      whereClause.comprador = { id: Number(compradorId) };
    }

    const compra = await em.findOne(Compra, whereClause, { populate: ["comprador", "itemCartas", "itemCartas.cartas", "direccionEntrega"] });

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    res.status(200).json({ message: "Found one compra", data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear nueva compra
async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    const comprador = await em.findOne(User, { id: input.compradorId });
    const itemCartas = await em.find(ItemCarta, { id: { $in: input.cartasIds } });
    const direccionEntrega = input.direccionEntregaId ? await em.findOne(Direccion, { id: input.direccionEntregaId }) : undefined;

    if (!comprador || itemCartas.length === 0) {
      return res.status(400).json({ message: "Datos inválidos: faltan comprador o cartas" });
    }

    const total = input.total ?? itemCartas.reduce((sum, ic) => sum + Number(ic.cartas[0]?.price || 0), 0);

    const compra = em.create(Compra, {
      comprador,
      itemCartas,
      total,
      estado: input.estado || "pendiente",
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono,
      direccionEntrega,
      metodoPago: input.metodoPago,
      items: input.items ?? undefined,
    });

    await em.flush();

    res.status(201).json({ message: "Compra creada con éxito", data: compra });
  } catch (error: any) {
  console.error("Error creando compra:", error);
    res.status(500).json({ message: "Error creando compra", error: error.message });
  }
}

// Actualizar compra
async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { compradorId } = req.query;

    // Build where clause to ensure user can only update their own purchases
    const whereClause: any = { id };
    if (compradorId) {
      whereClause.comprador = { id: Number(compradorId) };
    }

    const compra = await em.findOne(Compra, whereClause, { populate: ["itemCartas", "direccionEntrega"] });

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    const input = req.body.sanitizedInput;

    if (input.compradorId) compra.comprador = em.getReference(User, input.compradorId);
    if (input.cartasIds?.length) {
      const itemCartas = await em.find(ItemCarta, { id: { $in: input.cartasIds } });
      compra.itemCartas.removeAll();
      itemCartas.forEach((ic) => compra.itemCartas.add(ic));
    }

    // update items JSON if provided
    if (input.items) {
      compra.items = input.items;
    }

    compra.total = input.total ?? compra.total;
    compra.estado = input.estado ?? compra.estado;
    compra.nombre = input.nombre ?? compra.nombre;
    compra.email = input.email ?? compra.email;
    compra.telefono = input.telefono ?? compra.telefono;
    if (input.direccionEntregaId) compra.direccionEntrega = em.getReference(Direccion, input.direccionEntregaId);
    compra.metodoPago = input.metodoPago ?? compra.metodoPago;

    await em.flush();
    res.status(200).json({ message: "Compra actualizada con éxito", data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Eliminar compra
async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const { compradorId } = req.query;

    // Build where clause to ensure user can only delete their own purchases
    const whereClause: any = { id };
    if (compradorId) {
      whereClause.comprador = { id: Number(compradorId) };
    }

    const compra = await em.findOne(Compra, whereClause);

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    await em.removeAndFlush(compra);
    res.status(200).json({ message: "Compra eliminada con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeCompraInput, findAll, findOne, add, update, remove };
