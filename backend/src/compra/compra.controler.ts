import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { AuthRequest } from "../shared/middleware/auth.js";
import { Compra } from "./compra.entity.js";
import { User } from "../user/user.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
import { Carta } from "../carta/carta.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { Envio } from "../envio/envio.entity.js";
import { TiendaRetiro } from "../tiendaRetiro/tiendaRetiro.entity.js";
import { Preference } from "mercadopago";
import mpClient from '../shared/mercadopago.js'
import { Valoracion } from "../valoracion/valoracion.entity.js";
import { crearNotificacionesEstado } from '../notificacion/notificacion.service.js';

// Resuelve el User comprador para vendedores (tienen un User vinculado) y users normales.
// Devuelve null para tiendas de retiro, que usan compradorTienda en su lugar.
function resolveCompradorUser(req: AuthRequest): User | null {
  if (req.actorRole === 'vendedor') {
    return (req.actor as Vendedor).user as User;
  }
  if (req.actorRole === 'tiendaRetiro') {
    return null;
  }
  return req.actor as User;
}

// Where clause para filtrar las compras del actor autenticado.
function compradorWhereClause(req: AuthRequest): Record<string, any> {
  if (req.actorRole === 'tiendaRetiro') {
    return { compradorTienda: { id: req.actor!.id } };
  }
  const user = resolveCompradorUser(req);
  return { comprador: { id: user!.id } };
}

const em = orm.em;

// Middleware de saneamiento
function sanitizeCompraInput(req: Request, res: Response, next: NextFunction) {
  const {
    compradorId,
    total,
    estado,
    nombre,
    email,
    telefono,
    direccionEntregaId,
    metodoPago,
    envioId,
    tiendaRetiroId,
    tiendaRetiroPorVendedor,
    items,
  } = req.body;

  const cartasIds = items && Array.isArray(items) ? items.map((item: any) => item.cartaId) : [];

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
    envioId,
    tiendaRetiroId,
    tiendaRetiroPorVendedor,
    items,
  };

  next();
}

const MOTIVOS_VALIDOS = [
  'sin_stock', 'error_precio', 'producto_daniado', 'no_respondio',
  'cambio_decision', 'sospecha_fraude', 'problema_tienda', 'otro',
] as const;

function sanitizeCancelacionInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitizedInput = { motivo: req.body.motivo };
  Object.keys(req.body.sanitizedInput).forEach((key) => {
    if (req.body.sanitizedInput[key] === undefined) delete req.body.sanitizedInput[key];
  });
  next();
}

// Obtener todas las compras
async function findAll(req: AuthRequest, res: Response) {
  try {
    const whereClause = compradorWhereClause(req);

    const compras = await em.find(Compra, whereClause, {
        populate: [
            "comprador",
            "compradorTienda",
            "itemCartas",
            "itemCartas.cartas",
            "itemCartas.uploaderVendedor",
            "itemCartas.uploaderTienda",
            "direccionEntrega",
            "envio",
            "tiendaRetiro",
        ]
    });
    res.status(200).json({ message: "Found all compras", data: compras });
  } catch (error) {
    res.status(500).json({ message: "Error fetching compras", error });
  }
}

// Obtener compra por ID
async function findOne(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);

    const whereClause = { id, ...compradorWhereClause(req) };

    const compra = await em.findOne(Compra, whereClause, {
        populate: [
            "comprador",
            "compradorTienda",
            "itemCartas",
            "itemCartas.cartas",
            "itemCartas.uploaderVendedor",
            "direccionEntrega",
            "envio",
            "tiendaRetiro",
        ]
    });

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    res.status(200).json({ message: "Found one compra", data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear nueva compra — genera una Compra por cada vendedor distinto en el carrito
async function add(req: AuthRequest, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    const compradorUser = resolveCompradorUser(req);
    const compradorTienda = req.actorRole === 'tiendaRetiro' ? req.actor as TiendaRetiro : undefined;

    const direccionEntrega = input.direccionEntregaId
      ? await em.findOne(Direccion, { id: input.direccionEntregaId })
      : undefined;
    const envio =
      input.envioId && input.envioId !== 'direct'
        ? await em.findOne(Envio, { id: input.envioId })
        : undefined;

    // Las tiendas de retiro solo pueden elegir su propia tienda como punto de retiro
    const tiendaRetiroGlobal = compradorTienda
      ? compradorTienda
      : input.tiendaRetiroId
        ? await em.findOne(TiendaRetiro, { id: Number(input.tiendaRetiroId) })
        : undefined;
    const tiendaRetiroPorVendedor: Record<string, number | null> = input.tiendaRetiroPorVendedor ?? {};

    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      return res.status(400).json({ message: "No se proporcionaron items válidos para la compra" });
    }

    // Agrupar items por vendedor
    const vendorMap = new Map<number, { itemCartas: ItemCarta[]; items: any[] }>();
    const tiendaMap = new Map<number, { tienda: TiendaRetiro; itemCartas: ItemCarta[]; items: any[] }>();

    for (const reqItem of input.items) {
      const requestedQty = reqItem.quantity || 1;

      if (reqItem.itemCartaId) {
        // Bundle: look up ItemCarta directly
        const itemCarta = await em.findOne(
          ItemCarta,
          { id: reqItem.itemCartaId },
          { populate: ['uploaderVendedor'] }
        );

        if (!itemCarta) {
          return res.status(400).json({ message: `Bundle con ID ${reqItem.itemCartaId} no encontrado` });
        }

        if (itemCarta.stock < requestedQty) {
          return res.status(400).json({
            message: `No hay suficiente stock para el bundle (Solicitado: ${requestedQty})`,
          });
        }

        itemCarta.stock -= requestedQty;
        if (itemCarta.stock < 0) itemCarta.stock = 0;

        const vendorId = itemCarta.uploaderVendedor?.id ?? 0;

        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, { itemCartas: [], items: [] });
        }
        const group = vendorMap.get(vendorId)!;
        group.itemCartas.push(itemCarta);
        group.items.push({
          itemCartaId: reqItem.itemCartaId,
          quantity: reqItem.quantity,
          price: reqItem.price,
          title: reqItem.title,
        });
      } else {
        // Carta individual
        const carta = await em.findOne(
          Carta,
          { id: reqItem.cartaId },
          { populate: ['items', 'items.uploaderVendedor', 'items.uploaderTienda', 'uploader', 'uploaderTienda'] }
        );

        if (!carta) {
          return res.status(400).json({ message: `Carta con ID ${reqItem.cartaId} no encontrada` });
        }

        const availableItem = carta.items.getItems().find(item => item.stock >= requestedQty);

        if (!availableItem) {
          return res.status(400).json({
            message: `No hay suficiente stock para la carta: ${carta.name} (Solicitado: ${requestedQty})`,
          });
        }

        availableItem.stock -= requestedQty;
        if (availableItem.stock < 0) availableItem.stock = 0;

        // Detectar si es item de tienda
        const tiendaUploader = (availableItem as any).uploaderTienda ?? (carta as any).uploaderTienda;

        if (tiendaUploader?.id) {
          const tiendaId = tiendaUploader.id as number;
          if (!tiendaMap.has(tiendaId)) {
            tiendaMap.set(tiendaId, { tienda: tiendaUploader as TiendaRetiro, itemCartas: [], items: [] });
          }
          const tGroup = tiendaMap.get(tiendaId)!;
          tGroup.itemCartas.push(availableItem);
          tGroup.items.push({
            cartaId:  reqItem.cartaId,
            quantity: reqItem.quantity,
            price:    reqItem.price,
            title:    reqItem.title,
          });
        } else {
          const vendorId = availableItem.uploaderVendedor?.id ?? carta.uploader?.id ?? 0;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, { itemCartas: [], items: [] });
          }
          const group = vendorMap.get(vendorId)!;
          group.itemCartas.push(availableItem);
          group.items.push({
            cartaId:  reqItem.cartaId,
            quantity: reqItem.quantity,
            price:    reqItem.price,
            title:    reqItem.title,
          });
        }
      }
    }

    // Crear una Compra por cada vendedor
    const compras: Compra[] = [];

    for (const [vendorId, group] of vendorMap) {
      const vendorTotal = group.items.reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 1),
        0
      );

      // Tienda específica del vendedor, o la global como fallback
      const tiendaIdParaVendor = tiendaRetiroPorVendedor[String(vendorId)] ?? null;
      const tiendaRetiro = tiendaIdParaVendor
        ? await em.findOne(TiendaRetiro, { id: Number(tiendaIdParaVendor) })
        : tiendaRetiroGlobal;

      const compra = em.create(Compra, {
        ...(compradorUser ? { comprador: compradorUser } : {}),
        ...(compradorTienda ? { compradorTienda } : {}),
        itemCartas: group.itemCartas,
        total: vendorTotal,
        estado: input.estado || 'pendiente',
        nombre: input.nombre,
        email: input.email,
        telefono: input.telefono,
        direccionEntrega,
        envio,
        tiendaRetiro: tiendaRetiro ?? undefined,
        metodoPago: input.metodoPago,
        items: group.items,
      });

      compras.push(compra);
    }

    // Crear una Compra por cada tienda (venta directa)
    for (const [, tGroup] of tiendaMap) {
      const tiendaTotal = tGroup.items.reduce(
        (sum, i) => sum + (Number(i.price) || 0) * (i.quantity || 1),
        0
      );

      const compra = em.create(Compra, {
        ...(compradorUser   ? { comprador: compradorUser }   : {}),
        ...(compradorTienda ? { compradorTienda }            : {}),
        itemCartas:   tGroup.itemCartas,
        total:        tiendaTotal,
        estado:       'pendiente',
        nombre:       input.nombre,
        email:        input.email,
        telefono:     input.telefono,
        tiendaRetiro: tGroup.tienda,
        metodoPago:   input.metodoPago,
        items:        tGroup.items,
      });

      compras.push(compra);
    }

    await em.flush();

    res.status(201).json({ message: "Compras creadas con éxito", data: compras });
  } catch (error: any) {
    console.error("Error creando compra:", error);
    res.status(500).json({ message: "Error creando compra", error: error.message });
  }
}

async function createPreference(req: AuthRequest, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    const compradorUser = resolveCompradorUser(req);
    const compradorTienda = req.actorRole === 'tiendaRetiro' ? req.actor as TiendaRetiro : undefined;

    if (!input.items || input.items.length === 0) {
      return res.status(400).json({ message: "Compra sin items" });
    }

    // ======================
    // CREAR COMPRA PENDIENTE
    // ======================

    const compra = em.create(Compra, {
      ...(compradorUser ? { comprador: compradorUser } : {}),
      ...(compradorTienda ? { compradorTienda } : {}),
      total: input.total,
      estado: "pendiente",
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono,
      metodoPago: "mercadopago",
      items: input.items,
    });

    await em.flush();

    // ======================
    // ITEMS PARA MERCADOPAGO
    // ======================

const mpItems = input.items.map((item: any) => ({
  title: item.title || "Carta Pokémon",
  quantity: Number(item.quantity) || 1,
  unit_price: Math.round(Number(item.price)) || 1,
  currency_id: "ARS",
}));
    // ======================
    // CREAR PREFERENCE
    // ======================

const preference = new Preference(mpClient);

const result = await preference.create({
  body: {
    items: mpItems,
    metadata: {
      compraId: compra.id,
    },
    back_urls: {
      success: "https://dsw-2025-frontend.onrender.com/pago-exitoso",
      failure: "https://dsw-2025-frontend.onrender.com/pago-error",
      pending: "https://dsw-2025-frontend.onrender.com/pago-pendiente"
    },
    auto_return: "approved",
  }
});

    // En test se usa sandbox_init_point, en producción init_point
    const isTest = (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-');
    res.status(200).json({
      init_point: isTest ? result.sandbox_init_point : result.init_point,
    });

  } catch (error: any) {
    console.error("Error creando preferencia MP:", error);
    res.status(500).json({ message: error.message });
  }
}

// Actualizar compra
async function update(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);

    const compra = await em.findOne(Compra, { id, ...compradorWhereClause(req) }, { populate: ["itemCartas", "direccionEntrega"] });

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    const input = req.body.sanitizedInput;

    // No se permiten cambios de compradorId (evita transferencia de propiedad)
    if (input.cartasIds?.length) {
      const itemCartas = await em.find(ItemCarta, { id: { $in: input.cartasIds } });
      compra.itemCartas.removeAll();
      itemCartas.forEach((ic) => compra.itemCartas.add(ic));
    }

    // update items JSON if provided
    if (input.items) {
      compra.items = input.items;
    }

    const estadoAnterior = compra.estado;
    compra.total = input.total ?? compra.total;
    compra.estado = input.estado ?? compra.estado;
    compra.nombre = input.nombre ?? compra.nombre;
    compra.email = input.email ?? compra.email;
    compra.telefono = input.telefono ?? compra.telefono;
    if (input.direccionEntregaId) compra.direccionEntrega = em.getReference(Direccion, input.direccionEntregaId);
    compra.metodoPago = input.metodoPago ?? compra.metodoPago;

    await em.flush();

    if (input.estado && input.estado !== estadoAnterior) {
      crearNotificacionesEstado(id, compra.estado).catch(() => {});
    }

    res.status(200).json({ message: "Compra actualizada con éxito", data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Eliminar compra
async function remove(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);

    const compra = await em.findOne(Compra, { id, ...compradorWhereClause(req) });

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    await em.removeAndFlush(compra);
    res.status(200).json({ message: "Compra eliminada con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function cancelarCompra(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);
    const { motivo } = req.body.sanitizedInput;

    if (!motivo || !MOTIVOS_VALIDOS.includes(motivo as any)) {
      return res.status(400).json({ message: 'Motivo de cancelación inválido o faltante' });
    }

    const emFork = orm.em.fork();
    const compra = await emFork.findOne(Compra, { id }, {
      populate: [
        'comprador', 'compradorTienda',
        'itemCartas', 'itemCartas.uploaderVendedor', 'itemCartas.uploaderTienda',
        'tiendaRetiro',
      ],
    });

    if (!compra) return res.status(404).json({ message: 'Compra no encontrada' });

    if (compra.estado === 'finalizado' || compra.estado === 'cancelado') {
      return res.status(400).json({ message: `No se puede cancelar una compra en estado "${compra.estado}"` });
    }

    let canceladoPorRol: 'comprador' | 'vendedor' | 'tienda' | null = null;
    let canceladoPorId: number | null = null;
    let canceladoPorActorTipo: string | null = null;

    if (req.actorRole === 'user') {
      const user = req.actor as User;
      if (compra.comprador?.id === user.id) {
        canceladoPorRol = 'comprador';
        canceladoPorId = user.id ?? null;
        canceladoPorActorTipo = 'user';
      }
    } else if (req.actorRole === 'vendedor') {
      const vendedor = req.actor as Vendedor;
      const vendedorUserId = (vendedor.user as any)?.id;
      if (vendedorUserId && compra.comprador?.id === vendedorUserId) {
        canceladoPorRol = 'comprador';
        canceladoPorId = vendedor.id ?? null;
        canceladoPorActorTipo = 'vendedor';
      } else if (compra.itemCartas.getItems().some(ic => (ic as any).uploaderVendedor?.id === vendedor.id)) {
        canceladoPorRol = 'vendedor';
        canceladoPorId = vendedor.id ?? null;
        canceladoPorActorTipo = 'vendedor';
      }
    } else if (req.actorRole === 'tiendaRetiro') {
      const tienda = req.actor as TiendaRetiro;
      if (compra.compradorTienda?.id === tienda.id) {
        canceladoPorRol = 'comprador';
        canceladoPorId = tienda.id ?? null;
        canceladoPorActorTipo = 'tiendaRetiro';
      } else if (
        compra.tiendaRetiro?.id === tienda.id ||
        compra.itemCartas.getItems().some(ic => (ic as any).uploaderTienda?.id === tienda.id)
      ) {
        canceladoPorRol = 'tienda';
        canceladoPorId = tienda.id ?? null;
        canceladoPorActorTipo = 'tiendaRetiro';
      }
    }

    if (!canceladoPorRol || canceladoPorId === null) {
      return res.status(403).json({ message: 'No tenés acceso para cancelar esta compra' });
    }

    compra.estadoAntesCancelacion = compra.estado;
    compra.estado = 'cancelado';
    compra.canceladoPorRol = canceladoPorRol;
    compra.canceladoPorId = canceladoPorId;
    compra.canceladoPorActorTipo = canceladoPorActorTipo!;
    compra.motivoCancelacion = motivo;
    compra.fechaCancelacion = new Date();

    await emFork.flush();
    crearNotificacionesEstado(id, 'cancelado').catch(() => {});
    res.json({ message: 'Compra cancelada exitosamente', data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

async function getCancelacionStats(req: Request, res: Response) {
  try {
    const { actorTipo, actorId: actorIdStr } = req.query as { actorTipo: string; actorId: string };
    const actorId = Number(actorIdStr);

    if (!actorTipo || !actorId) {
      return res.status(400).json({ message: 'actorTipo y actorId son obligatorios' });
    }

    const emFork = orm.em.fork();

    const cancelaciones = await emFork.find(Compra, {
      estado: 'cancelado',
      canceladoPorId: actorId,
      canceladoPorActorTipo: actorTipo,
    });

    const comoComprador = cancelaciones.filter(c => c.canceladoPorRol === 'comprador').length;
    const comoVendedor  = cancelaciones.filter(c => c.canceladoPorRol === 'vendedor').length;
    const comoTienda    = cancelaciones.filter(c => c.canceladoPorRol === 'tienda').length;

    let totalCompras = 0;
    let totalVentas = 0;

    if (actorTipo === 'vendedor') {
      totalVentas = await emFork.count(Compra, { itemCartas: { uploaderVendedor: { id: actorId } } });
      const vendedor = await emFork.findOne(Vendedor, { id: actorId }, { populate: ['user'] });
      totalCompras = vendedor?.user
        ? await emFork.count(Compra, { comprador: { id: (vendedor.user as any).id } })
        : 0;
    } else if (actorTipo === 'user') {
      totalCompras = await emFork.count(Compra, { comprador: { id: actorId } });
    } else if (actorTipo === 'tiendaRetiro') {
      const asSellerCount = await emFork.count(Compra, { itemCartas: { uploaderTienda: { id: actorId } } });
      const asIntermCount = await emFork.count(Compra, { tiendaRetiro: { id: actorId } });
      totalVentas = asSellerCount + asIntermCount;
      totalCompras = await emFork.count(Compra, { compradorTienda: { id: actorId } });
    }

    const totalOperaciones = totalCompras + totalVentas;
    const comprasCanceladas = comoComprador;
    const ventasCanceladas = comoVendedor + comoTienda;
    const totalCancelaciones = cancelaciones.length;
    const porcentajeCancelacion = totalOperaciones > 0
      ? Math.round((totalCancelaciones / totalOperaciones) * 1000) / 10
      : 0;

    const tipoObjetoRating = `cancelacion_${actorTipo}`;
    const valoraciones = await emFork.find(Valoracion, { tipoObjeto: tipoObjetoRating, objetoId: actorId });
    const ratingCancelaciones = valoraciones.length > 0
      ? Math.round(valoraciones.reduce((s, v) => s + v.puntuacion, 0) / valoraciones.length * 10) / 10
      : null;

    const badge = porcentajeCancelacion >= 10 ? 'red'
      : porcentajeCancelacion >= 5 ? 'yellow'
      : 'none';

    res.json({
      data: {
        totalCompras,
        totalVentas,
        totalOperaciones,
        comprasCanceladas,
        ventasCanceladas,
        totalCancelaciones,
        porcentajeCancelacion,
        comoComprador,
        comoVendedor,
        comoTienda,
        ratingCancelaciones,
        totalRatingsCancelacion: valoraciones.length,
        badge,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeCompraInput, sanitizeCancelacionInput, findAll, findOne, add, update, remove, createPreference, cancelarCompra, getCancelacionStats };
