import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Compra } from "./compra.entity.js";
import { User } from "../user/user.entity.js";
import { Carta } from "../carta/carta.entity.js";

const em = orm.em;

function sanitizeCompraInput(req: Request, res: Response, next: NextFunction) {
  const { compradorId, cartasIds, total, estado } = req.body;

  req.body.sanitizedInput = {
    compradorId,
    cartasIds,
    total,
    estado,
  };

  next();
}

// Obtener todas las compras
async function findAll(req: Request, res: Response) {
  try {
    const compras = await em.find(Compra, {}, { populate: ["comprador", "cartas", "cartas.uploader"] });
    res.status(200).json({ message: "Found all compras", data: compras });
  } catch (error) {
    res.status(500).json({ message: "Error fetching compras", error });
  }
}

// Obtener una compra por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const compra = await em.findOne(Compra, { id }, { populate: ["comprador", "cartas", "cartas.uploader"] });

    if (!compra) return res.status(404).json({ message: "Compra not found" });

    res.status(200).json({ message: "Found one compra", data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear una nueva compra
async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    const comprador = await em.findOne(User, { id: input.compradorId });
    const cartas = await em.find(Carta, { id: { $in: input.cartasIds } });

    if (!comprador || cartas.length === 0) {
      return res.status(400).json({ message: "Datos inválidos: faltan comprador o cartas" });
    }

    const total = input.total ?? cartas.reduce((sum, c) => sum + Number(c.price || 0), 0);

    const compra = em.create(Compra, {
      comprador,
      cartas,
      total,
      estado: input.estado || "pendiente",
    });

    await em.flush();

    res.status(201).json({ message: "Compra creada con éxito", data: compra });
  } catch (error: any) {
    res.status(500).json({ message: "Error creando compra", error: error.message });
  }
}

// Actualizar compra
async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const compra = await em.findOne(Compra, { id }, { populate: ["cartas"] });

    if (!compra) return res.status(404).json({ message: "Compra not found" });

    const input = req.body.sanitizedInput;

    if (input.compradorId) compra.comprador = em.getReference(User, input.compradorId);
    if (input.cartasIds?.length) {
      const cartas = await em.find(Carta, { id: { $in: input.cartasIds } });
      compra.cartas.removeAll();
      cartas.forEach((c) => compra.cartas.add(c));
    }
    if (input.total !== undefined) compra.total = input.total;
    if (input.estado) compra.estado = input.estado;

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
    const compra = await em.findOne(Compra, { id });

    if (!compra) return res.status(404).json({ message: "Compra not found" });

    await em.removeAndFlush(compra);
    res.status(200).json({ message: "Compra eliminada con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeCompraInput, findAll, findOne, add, update, remove };
