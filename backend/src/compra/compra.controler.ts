import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { AuthRequest } from "../shared/middleware/auth.js";
import { Compra } from "./compra.entity.js";
import { User } from "../user/user.entity.js";
import { ItemCarta } from "../carta/itemCarta.entity.js";
import { Carta } from "../carta/carta.entity.js";
import { Direccion } from "../direccion/direccion.entity.js";
import { Envio } from "../envio/envio.entity.js";
import { sendEmail } from "../shared/mailer.js";
import { Preference } from "mercadopago";
import mpClient from '../shared/mercadopago.js'

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
    items,
  } = req.body;

  // Extraer cartasIds desde el array de items
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
    items,
  };

  next();
}

// Obtener todas las compras
async function findAll(req: AuthRequest, res: Response) {
  try {
    // Siempre filtrar por las compras del usuario autenticado
    const whereClause = { comprador: { id: req.actor!.id } };

    const compras = await em.find(Compra, whereClause, { 
        populate: [
            "comprador", 
            "itemCartas", 
            "itemCartas.cartas", 
            "itemCartas.uploaderVendedor", 
            "direccionEntrega", 
            "envio"
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

    // Verificar propiedad: el usuario solo puede acceder a sus propias compras
    const whereClause = { id, comprador: { id: req.actor!.id } };

    const compra = await em.findOne(Compra, whereClause, { 
        populate: [
            "comprador", 
            "itemCartas", 
            "itemCartas.cartas", 
            "itemCartas.uploaderVendedor",
            "direccionEntrega", 
            "envio"
        ] 
    });

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    res.status(200).json({ message: "Found one compra", data: compra });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Crear nueva compra
async function add(req: AuthRequest, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    // Usar el usuario autenticado como comprador – nunca confiar en el compradorId del cuerpo
    const comprador = req.actor as User;
    const direccionEntrega = input.direccionEntregaId ? await em.findOne(Direccion, { id: input.direccionEntregaId }) : undefined;
    const envio = input.envioId && input.envioId !== 'direct' ? await em.findOne(Envio, { id: input.envioId }) : undefined;

    const finalItemCartas: ItemCarta[] = [];

    // Validar y procesar stock para cada item solicitado
    if (input.items && Array.isArray(input.items) && input.items.length > 0) {
        for (const reqItem of input.items) {
           const requestedQty = reqItem.quantity || 1;
           const cartaId = reqItem.cartaId;
           
           // Buscar la Carta con sus items asociados
           const carta = await em.findOne(Carta, { id: cartaId }, { populate: ['items'] });
           
           if (!carta) {
               return res.status(400).json({ message: `Carta con ID ${cartaId} no encontrada` });
           }
           
           // Buscar un ItemCarta específico con suficiente stock
           const availableItem = carta.items.getItems().find(item => item.stock >= requestedQty && item.estado !== 'pausado');
           
           if (!availableItem) {
               return res.status(400).json({ message: `No hay suficiente stock para la carta: ${carta.name} (Solicitado: ${requestedQty})` });
           }
           
           // Descontar stock
           availableItem.stock -= requestedQty;
           if (availableItem.stock <= 0) {
               availableItem.stock = 0;
               availableItem.estado = 'pausado';
           }
           
           finalItemCartas.push(availableItem);
        }
    } else {
        return res.status(400).json({ message: "No se proporcionaron items válidos para la compra" });
    }

    const total = input.total ?? finalItemCartas.reduce((sum, ic) => sum + Number(ic.cartas[0]?.price || 0), 0); // Note: This total calc might need adjustment if Qty > 1 but frontend sends total usually.

    const compra = em.create(Compra, {
      comprador,
      itemCartas: finalItemCartas,
      total,
      estado: input.estado || "pendiente",
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono,
      direccionEntrega,
      envio,
      metodoPago: input.metodoPago,
      items: input.items ?? undefined,
    });

    await em.flush();

    // Enviar email de confirmación
    try {
        const emailSubject = `Confirmación de Compra #${compra.id}`;
        const itemsListHtml = (input.items || []).map((item: any) => 
            `<li>${item.quantity}x ${item.title || 'Carta'} - $${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</li>`
        ).join('');

        const emailHtml = `
            <h1>¡Gracias por tu compra, ${input.nombre || comprador.username}!</h1>
            <p>Hemos recibido tu pedido correctamente.</p>
            
            <h3>Detalle del pedido:</h3>
            <ul>${itemsListHtml}</ul>
            
            <p><strong>Total: $${total}</strong></p>
            <p><strong>Método de pago:</strong> ${input.metodoPago}</p>
            ${envio ? `<p><strong>Envío:</strong> ${envio.intermediario?.nombre || 'Directo'} (${envio.fechaEntrega ? new Date(envio.fechaEntrega).toLocaleDateString() : 'Pronto'})</p>` : ''}
            
            <p>Te notificaremos cuando tu pedido sea enviado.</p>
        `;

        // Send asynchronously without blocking the response
        sendEmail(input.email || comprador.email, emailSubject, "Gracias por tu compra", emailHtml);
    } catch (emailErr) {
        console.error("Error sending confirmation email:", emailErr);
    }

    res.status(201).json({ message: "Compra creada con éxito", data: compra });
  } catch (error: any) {
  console.error("Error creando compra:", error);
    res.status(500).json({ message: "Error creando compra", error: error.message });
  }
}

async function createPreference(req: AuthRequest, res: Response) {
  try {
    const input = req.body.sanitizedInput;

    // Use the authenticated user as the buyer
    const comprador = req.actor as User;

    if (!input.items || input.items.length === 0) {
      return res.status(400).json({ message: "Compra sin items" });
    }

    // ======================
    // CREAR COMPRA PENDIENTE
    // ======================

    const compra = em.create(Compra, {
      comprador,
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

    // Verificar propiedad mediante el token
    const whereClause = { id, comprador: { id: req.actor!.id } };

    const compra = await em.findOne(Compra, whereClause, { populate: ["itemCartas", "direccionEntrega"] });

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
async function remove(req: AuthRequest, res: Response) {
  try {
    const id = Number(req.params.id);

    // Verificar propiedad mediante el token
    const whereClause = { id, comprador: { id: req.actor!.id } };

    const compra = await em.findOne(Compra, whereClause);

    if (!compra) return res.status(404).json({ message: "Compra not found or access denied" });

    await em.removeAndFlush(compra);
    res.status(200).json({ message: "Compra eliminada con éxito" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

export { sanitizeCompraInput, findAll, findOne, add, update, remove, createPreference };
