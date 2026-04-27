import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { wrap } from "@mikro-orm/core";
import { TiendaRetiro } from "./tiendaRetiro.entity.js";
import { Compra } from "../compra/compra.entity.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const em = orm.em;

export function sanitizeTiendaRetiroInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    nombre: req.body.nombre,
    email: req.body.email,
    // password excluida: se gestiona solo en add/login (nunca en update)
    direccion: req.body.direccion,
    horario: req.body.horario,
    ciudad: req.body.ciudad,
    activo: req.body.activo,
  };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

export async function findAll(_req: Request, res: Response) {
  try {
    const tiendas = await em.find(TiendaRetiro, { activo: true }, { orderBy: { nombre: "ASC" } });
    res.json({ data: tiendas });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tienda = await em.findOne(TiendaRetiro, { id });
    if (!tienda) return res.status(404).json({ message: "Tienda not found" });
    res.json({ data: tienda });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function add(req: Request, res: Response) {
  try {
    const input = req.body.sanitizedInput;
    const password = req.body.password; // leído directo, no pasa por sanitizedInput
    if (!input.nombre || !input.email || !password || !input.direccion) {
      return res.status(400).json({ message: "nombre, email, password y direccion son obligatorios" });
    }
    const existing = await em.findOne(TiendaRetiro, { email: input.email });
    if (existing) return res.status(400).json({ message: "El email ya está registrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const tienda = em.create(TiendaRetiro, { ...input, password: hashedPassword });
    await em.flush();
    res.status(201).json({ message: "TiendaRetiro creada", data: tienda });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    const tienda = await em.findOne(TiendaRetiro, { email });
    if (!tienda) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, tienda.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { userId: tienda.id, role: "tiendaRetiro" },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "7d" }
    );
    const tiendaData = { ...(wrap(tienda).toJSON() as any), role: "tiendaRetiro" };
    res.json({ message: "Login successful", data: tiendaData, token });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const tienda = await em.findOne(TiendaRetiro, { id });
    if (!tienda) return res.status(404).json({ message: "Tienda not found" });
    em.assign(tienda, req.body.sanitizedInput);
    await em.flush();
    res.json({ message: "Tienda actualizada", data: tienda });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function getVentas(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const compras = await em.find(
      Compra,
      { tiendaRetiro: { id } },
      {
        populate: ["comprador", "itemCartas", "itemCartas.uploaderVendedor"],
        orderBy: { createdAt: "DESC" },
      }
    );

    const data = compras.map((compra) => {
      const vendedoresMap = new Map<number, { nombre: string; alias: string | null; cbu: string | null }>();
      for (const itemCarta of compra.itemCartas) {
        const v = (itemCarta as any).uploaderVendedor;
        if (v && !vendedoresMap.has(v.id)) {
          vendedoresMap.set(v.id, { nombre: v.nombre, alias: v.alias ?? null, cbu: v.cbu ?? null });
        }
      }

      const items = (compra.items ?? []).map((i) => ({
        cartaNombre: i.title ?? `Carta #${i.cartaId}`,
        cantidad: i.quantity,
        precio: i.price ?? 0,
      }));

      return {
        id: compra.id,
        estado: compra.estado,
        total: compra.total,
        createdAt: compra.createdAt,
        comprador: {
          nombre: (compra.comprador as any)?.username || compra.nombre || "Comprador",
          email: (compra.comprador as any)?.email || compra.email || "",
        },
        vendedores: Array.from(vendedoresMap.values()),
        items,
      };
    });

    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}
