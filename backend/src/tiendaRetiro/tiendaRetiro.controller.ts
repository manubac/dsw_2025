import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { wrap } from "@mikro-orm/core";
import { TiendaRetiro } from "./tiendaRetiro.entity.js";
import { Compra } from "../compra/compra.entity.js";
import { sendEmail } from "../shared/mailer.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Carta } from "../carta/carta.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";

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
    alias: req.body.alias,
    cbu: req.body.cbu,
    descripcionCompra: req.body.descripcionCompra,
    googleMapsUrl: req.body.googleMapsUrl,
    latitud: req.body.latitud,
    longitud: req.body.longitud,
  };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) {
      delete req.body.sanitizedInput[key];
    }
  });
  next();
}

export function sanitizePublicacionTiendaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = {
    name:        req.body.name,
    price:       req.body.price,
    rarity:      req.body.rarity,
    setName:     req.body.setName,
    setCode:     req.body.setCode,
    cardNumber:  req.body.cardNumber,
    lang:        req.body.lang,
    description: req.body.description,
    stock:       req.body.stock,
    estado:      req.body.estado,
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
        populate: ["comprador", "itemCartas", "itemCartas.uploaderVendedor", "itemCartas.uploaderTienda"],
        orderBy: { createdAt: "DESC" },
      }
    );

    // Solo flujo 3 actores: items tienen uploaderVendedor
    const comprasFiltradas = compras.filter((c) =>
      c.itemCartas.getItems().some((ic) => (ic as any).uploaderVendedor?.id != null)
    );

    const data = comprasFiltradas.map((compra) => {
      const vendedoresMap = new Map<number, { id: number; nombre: string; alias: string | null; cbu: string | null }>();
      for (const itemCarta of compra.itemCartas) {
        const v = (itemCarta as any).uploaderVendedor;
        if (v && !vendedoresMap.has(v.id)) {
          vendedoresMap.set(v.id, { id: v.id, nombre: v.nombre, alias: v.alias ?? null, cbu: v.cbu ?? null });
        }
      }

      const items = (compra.items ?? []).map((i) => ({
        cartaNombre: i.title ?? `Carta #${i.cartaId}`,
        cantidad:    i.quantity,
        precio:      i.price ?? 0,
      }));

      return {
        id:        compra.id,
        estado:    compra.estado,
        total:     compra.total,
        createdAt: compra.createdAt,
        motivoCancelacion: compra.motivoCancelacion ?? null,
        canceladoPorRol: compra.canceladoPorRol ?? null,
        estadoAntesCancelacion: compra.estadoAntesCancelacion ?? null,
        comprador: {
          id:     (compra.comprador as any)?.id || null,
          nombre: (compra.comprador as any)?.username || compra.nombre || "Comprador",
          email:  (compra.comprador as any)?.email    || compra.email  || "",
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

export async function marcarEnTienda(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'tiendaRetiro', 'itemCartas', 'itemCartas.uploaderVendedor'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'en_tienda';
    await orm.em.flush();

    const tienda = compra.tiendaRetiro;
    const destinatario = (compra.comprador as any)?.email || compra.email;
    const nombreComprador = (compra.comprador as any)?.username || compra.nombre || 'comprador';

    const vendedor = compra.itemCartas.getItems().find((ic: any) => ic.uploaderVendedor)?.uploaderVendedor as any;
    const aliasInfo = vendedor?.alias ? `<p><strong>Alias:</strong> <span style="font-family:monospace">${vendedor.alias}</span></p>` : '';
    const cbuInfo   = vendedor?.cbu   ? `<p><strong>CBU:</strong> <span style="font-family:monospace">${vendedor.cbu}</span></p>` : '';

    if (destinatario && tienda) {
      const html = `
        <h2>¡Tu carta llegó al local, ${nombreComprador}!</h2>
        <p>La orden <strong>#${compra.id}</strong> está disponible en:</p>
        <p><strong>${tienda.nombre}</strong><br/>
        ${tienda.direccion}<br/>
        ${tienda.horario ? `🕐 ${tienda.horario}` : ''}</p>
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:6px;padding:12px;margin:12px 0;">
          <p style="font-weight:600;margin:0 0 8px;">⚠️ Para retirar tu carta, primero realizá el pago al vendedor:</p>
          ${aliasInfo}${cbuInfo}
          <p style="margin:8px 0 0;color:#78350f;font-size:0.9em;">
            Una vez que el vendedor confirme el pago en la plataforma, podrás retirar en la tienda.<br/>
            <strong>No es necesario mostrar comprobante físico</strong> — el vendedor lo confirma digitalmente.
          </p>
        </div>
      `;
      sendEmail(
        destinatario,
        `Tu carta #${compra.id} llegó al local`,
        `Tu carta llegó a ${tienda.nombre}`,
        html
      );
    }

    res.json({ message: 'Compra marcada como en tienda', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function finalizarCompra(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'tiendaRetiro', 'itemCartas', 'itemCartas.uploaderVendedor'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    if (compra.estado !== 'pago_confirmado') {
      return res.status(400).json({ message: 'El vendedor aún no confirmó el pago. No se puede finalizar hasta que el comprador pague y el vendedor lo confirme.' });
    }

    compra.estado = 'finalizado';
    await orm.em.flush();

    res.json({ message: 'Compra finalizada', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function marcarListoParaRetirar(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'tiendaRetiro', 'itemCartas', 'itemCartas.uploaderTienda'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    const esDirect = compra.itemCartas.getItems().some((ic: any) => ic.uploaderTienda?.id === tiendaId);
    if (!esDirect) return res.status(400).json({ message: 'Esta compra no es una venta directa de la tienda' });

    if (compra.estado !== 'pendiente') {
      return res.status(400).json({ message: 'La compra no está en estado pendiente' });
    }

    compra.estado = 'listo_para_retirar';
    await orm.em.flush();

    const tienda = compra.tiendaRetiro;
    const destinatario = (compra.comprador as any)?.email || compra.email;
    const nombreComprador = (compra.comprador as any)?.username || compra.nombre || 'comprador';

    if (destinatario && tienda) {
      const html = `
        <h2>¡Tu carta está lista para retirar, ${nombreComprador}!</h2>
        <p>La orden <strong>#${compra.id}</strong> ya está disponible en:</p>
        <p><strong>${tienda.nombre}</strong><br/>
        ${tienda.direccion}<br/>
        ${tienda.horario ? `🕐 ${tienda.horario}` : ''}</p>
        <p>Cuando vayas a retirarla, llevá el número de orden y completá el pago en la tienda.</p>
      `;
      sendEmail(
        destinatario,
        `Tu carta #${compra.id} está lista para retirar`,
        `Tu carta está lista en ${tienda.nombre}`,
        html
      );
    }

    res.json({ message: 'Compra marcada como lista para retirar', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function finalizarVentaDirecta(req: Request, res: Response) {
  try {
    const compraId = Number(req.params.compraId);
    const tiendaId = Number(req.params.id);

    const compra = await orm.em.findOne(
      Compra,
      { id: compraId, tiendaRetiro: { id: tiendaId } },
      { populate: ['comprador', 'itemCartas', 'itemCartas.uploaderTienda'] }
    );

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada o no pertenece a esta tienda' });

    const esDirect = compra.itemCartas.getItems().some((ic: any) => ic.uploaderTienda?.id === tiendaId);
    if (!esDirect) return res.status(400).json({ message: 'Esta compra no es una venta directa de la tienda' });

    if (compra.estado !== 'listo_para_retirar') {
      return res.status(400).json({ message: 'La compra no está en estado listo_para_retirar' });
    }

    compra.estado = 'finalizado';
    await orm.em.flush();

    res.json({ message: 'Venta directa finalizada', data: compra });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function getPublicaciones(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const cartas = await orm.em.find(
      Carta,
      { uploaderTienda: { id } },
      { populate: ['items'], orderBy: { id: 'DESC' } }
    );
    res.json({ data: cartas });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function addPublicacion(req: Request, res: Response) {
  try {
    const tiendaId = Number(req.params.id);
    const input = req.body.sanitizedInput;

    if (!input.name || input.price === undefined || input.stock === undefined) {
      return res.status(400).json({ message: 'name, price y stock son obligatorios' });
    }

    const tienda = await orm.em.findOne(TiendaRetiro, { id: tiendaId });
    if (!tienda) return res.status(404).json({ message: 'Tienda no encontrada' });

    const itemCarta = orm.em.create(ItemCarta, {
      name:          input.name,
      description:   input.description ?? '',
      stock:         Number(input.stock),
      estado:        input.estado ?? 'disponible',
      uploaderTienda: tienda,
    });

    const carta = orm.em.create(Carta, {
      name:           input.name,
      price:          String(input.price),
      rarity:         input.rarity,
      setName:        input.setName,
      setCode:        input.setCode,
      cardNumber:     input.cardNumber,
      lang:           input.lang,
      uploaderTienda: tienda,
      viewCount:      0,
    });
    carta.items.add(itemCarta);

    await orm.em.flush();
    res.status(201).json({ message: 'Publicación creada', data: carta });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function updatePublicacion(req: Request, res: Response) {
  try {
    const tiendaId = Number(req.params.id);
    const cartaId  = Number(req.params.cartaId);
    const input    = req.body.sanitizedInput;

    const carta = await orm.em.findOne(
      Carta,
      { id: cartaId, uploaderTienda: { id: tiendaId } },
      { populate: ['items'] }
    );
    if (!carta) return res.status(404).json({ message: 'Publicación no encontrada' });

    if (input.name       !== undefined) carta.name      = input.name;
    if (input.price      !== undefined) carta.price     = String(input.price);
    if (input.rarity     !== undefined) carta.rarity    = input.rarity;
    if (input.setName    !== undefined) carta.setName   = input.setName;
    if (input.setCode    !== undefined) carta.setCode   = input.setCode;
    if (input.cardNumber !== undefined) carta.cardNumber = input.cardNumber;

    const item = carta.items.getItems()[0];
    if (item) {
      if (input.description !== undefined) item.description = input.description;
      if (input.stock       !== undefined) item.stock       = Number(input.stock);
      if (input.estado      !== undefined) item.estado      = input.estado;
      if (input.name        !== undefined) item.name        = input.name;
    }

    await orm.em.flush();
    res.json({ message: 'Publicación actualizada', data: carta });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function removePublicacion(req: Request, res: Response) {
  try {
    const tiendaId = Number(req.params.id);
    const cartaId  = Number(req.params.cartaId);

    const carta = await orm.em.findOne(
      Carta,
      { id: cartaId, uploaderTienda: { id: tiendaId } },
      { populate: ['items', 'items.compras'] }
    );
    if (!carta) return res.status(404).json({ message: 'Publicación no encontrada' });

    const hasActive = carta.items.getItems().some((ic) =>
      ic.compras.getItems().some((c) => c.estado === 'pendiente')
    );
    if (hasActive) {
      return res.status(400).json({ message: 'No se puede eliminar una publicación con compras pendientes' });
    }

    await orm.em.removeAndFlush(carta);
    res.json({ message: 'Publicación eliminada' });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

export async function getVentasDirectas(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const compras = await orm.em.find(
      Compra,
      { tiendaRetiro: { id } },
      {
        populate: ['comprador', 'itemCartas', 'itemCartas.uploaderTienda'],
        orderBy: { createdAt: 'DESC' },
      }
    );

    const directas = compras.filter((c) =>
      c.itemCartas.getItems().some((ic) => (ic as any).uploaderTienda?.id === id)
    );

    const tienda = await orm.em.findOne(TiendaRetiro, { id });

    const data = directas.map((compra) => ({
      id:          compra.id,
      estado:      compra.estado,
      total:       compra.total,
      createdAt:   compra.createdAt,
      motivoCancelacion: compra.motivoCancelacion ?? null,
      canceladoPorRol: compra.canceladoPorRol ?? null,
      estadoAntesCancelacion: compra.estadoAntesCancelacion ?? null,
      compradorId: (compra.comprador as any)?.id || null,
      nombre:      (compra.comprador as any)?.username || compra.nombre || 'Comprador',
      email:       (compra.comprador as any)?.email    || compra.email  || '',
      telefono:    compra.telefono ?? '',
      alias:       tienda?.alias ?? null,
      cbu:         tienda?.cbu   ?? null,
      items:     (compra.items ?? []).map((i) => ({
        cartaNombre: i.title ?? `Carta #${i.cartaId}`,
        cantidad:    i.quantity,
        precio:      i.price ?? 0,
      })),
    }));

    res.json({ data });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
}

