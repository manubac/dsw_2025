import { Router, Response } from "express";
import { orm } from "../shared/db/orm.js";
import { Wishlist } from "./wishlist.entity.js";
import { CartaClass } from "../carta/cartaClass.entity.js";
import { Carta } from "../carta/carta.entity.js";
import { Valoracion } from "../valoracion/valoracion.entity.js";
import { authenticate, AuthRequest } from "../shared/middleware/auth.js";

export const wishlistRouter = Router();

async function buildCartaRow(em: any, carta: any) {
  const stock = carta.items.getItems().reduce((sum: number, item: any) => sum + item.stock, 0);
  let rating = 0;
  let reviewsCount = 0;
  if (carta.uploader) {
    const valoraciones = await em.find(Valoracion, {
      tipoObjeto: "vendedor",
      objetoId: carta.uploader.id,
    });
    reviewsCount = valoraciones.length;
    rating = reviewsCount > 0
      ? valoraciones.reduce((acc: number, v: any) => acc + v.puntuacion, 0) / reviewsCount
      : 0;
  }
  return {
    id: carta.id,
    name: carta.name,
    price: carta.price ? parseFloat(carta.price.replace(/[^0-9.]/g, "")) : 0,
    rarity: carta.rarity,
    setName: carta.setName,
    image: carta.image,
    stock,
    uploader: carta.uploader
      ? { id: carta.uploader.id, nombre: carta.uploader.nombre, rating, reviewsCount }
      : null,
  };
}

// GET /api/wishlist — favoritos del usuario autenticado
wishlistRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const userId = actor.id;

    const entries = await em.find(
      Wishlist,
      { userId },
      { populate: ["cartaClass"] }
    );

    const result = await Promise.all(
      entries.map(async (entry) => {
        const base = {
          id: entry.id,
          notificar: entry.notificar,
          idioma: entry.idioma ?? null,
          ciudad: entry.ciudad ?? null,
          precioMax: entry.precioMax ?? null,
        };

        // Entrada por CartaClass (modo comparación)
        if (entry.cartaClass) {
          const cartaFilter: any = { cartaClass: entry.cartaClass };
          if (entry.idioma) cartaFilter.lang = entry.idioma;

          let cartas = await em.find(
            Carta,
            cartaFilter,
            { populate: ["items", "uploader"] }
          );
          if (entry.ciudad) {
            const ciudadNorm = entry.ciudad.toLowerCase();
            cartas = cartas.filter((c: any) => c.uploader?.ciudad?.toLowerCase() === ciudadNorm);
          }
          let cartasFormateadas = await Promise.all(cartas.map((c: any) => buildCartaRow(em, c)));
          if (entry.precioMax) {
            cartasFormateadas = cartasFormateadas.filter(c => c.price <= entry.precioMax!);
          }
          return {
            ...base,
            disponible: true,
            cartaClass: {
              id: entry.cartaClass.id,
              name: entry.cartaClass.name,
              description: entry.cartaClass.description,
            },
            cartaId: null,
            cartas: cartasFormateadas.sort((a, b) => a.price - b.price),
          };
        }

        // Entrada por CartaId (busca todas las cartas del mismo nombre)
        if (entry.cartaId) {
          const carta = await em.findOne(
            Carta,
            { id: entry.cartaId },
            { populate: ["items", "uploader"] }
          );
          if (!carta) {
            return { ...base, disponible: false, cartaClass: null, cartaId: entry.cartaId, cartas: [] };
          }
          const cartaFilter: any = { name: carta.name };
          if (entry.idioma) cartaFilter.lang = entry.idioma;

          let mismoNombre = await em.find(
            Carta,
            cartaFilter,
            { populate: ["items", "uploader"] }
          );
          if (entry.ciudad) {
            const ciudadNorm = entry.ciudad.toLowerCase();
            mismoNombre = mismoNombre.filter((c: any) => c.uploader?.ciudad?.toLowerCase() === ciudadNorm);
          }
          let cartasFormateadas = await Promise.all(mismoNombre.map((c: any) => buildCartaRow(em, c)));
          if (entry.precioMax) {
            cartasFormateadas = cartasFormateadas.filter(c => c.price <= entry.precioMax!);
          }
          const sorted = cartasFormateadas.sort((a, b) => a.price - b.price);
          return {
            ...base,
            disponible: sorted.some(c => c.stock > 0),
            cartaClass: null,
            cartaId: entry.cartaId,
            cartaNombre: carta.name,
            cartaImage: carta.image ?? null,
            cartas: sorted,
          };
        }

        return { ...base, disponible: false, cartaClass: null, cartaId: null, cartas: [] };
      })
    );

    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener favoritos", error: error.message });
  }
});

// POST /api/wishlist — agregar a favoritos (acepta cartaClassId o cartaId)
wishlistRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const userId = actor.id;
    const { cartaClassId, cartaId, idioma, ciudad, notificar, precioMax } = req.body;

    if (!cartaClassId && !cartaId) {
      return res.status(400).json({ message: "cartaClassId o cartaId requerido" });
    }

    const prefs = {
      idioma: idioma || undefined,
      ciudad: ciudad || undefined,
      notificar: notificar !== false,
      precioMax: precioMax ? Number(precioMax) : undefined,
    };

    if (cartaClassId) {
      const existing = await em.findOne(Wishlist, { userId, cartaClass: { id: Number(cartaClassId) } });
      if (existing) return res.status(200).json({ data: existing, message: "Ya está en favoritos" });

      const cartaClass = await em.findOne(CartaClass, { id: Number(cartaClassId) });
      if (!cartaClass) return res.status(404).json({ message: "CartaClass no encontrada" });

      const entry = em.create(Wishlist, { userId, cartaClass, ...prefs });
      await em.flush();
      return res.status(201).json({ data: entry });
    }

    // Fallback por cartaId
    const existing = await em.findOne(Wishlist, { userId, cartaId: Number(cartaId) });
    if (existing) return res.status(200).json({ data: existing, message: "Ya está en favoritos" });

    const carta = await em.findOne(Carta, { id: Number(cartaId) });
    if (!carta) return res.status(404).json({ message: "Carta no encontrada" });

    const entry = em.create(Wishlist, { userId, cartaId: Number(cartaId), ...prefs });
    await em.flush();
    return res.status(201).json({ data: entry });
  } catch (error: any) {
    res.status(500).json({ message: "Error al agregar a favoritos", error: error.message });
  }
});

// PATCH /api/wishlist/:id — actualizar preferencias de notificación
wishlistRouter.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const userId = actor.id;
    const id = Number(req.params.id);

    const entry = await em.findOne(Wishlist, { id, userId });
    if (!entry) return res.status(404).json({ message: "Favorito no encontrado" });

    const { idioma, ciudad, notificar, precioMax } = req.body;

    if (idioma !== undefined) entry.idioma = idioma || undefined;
    if (ciudad !== undefined) entry.ciudad = ciudad || undefined;
    if (notificar !== undefined) entry.notificar = Boolean(notificar);
    if (precioMax !== undefined) {
      entry.precioMax = precioMax !== '' && precioMax !== null ? Number(precioMax) : undefined;
    }

    await em.flush();
    res.json({ data: entry });
  } catch (error: any) {
    res.status(500).json({ message: "Error al actualizar favorito", error: error.message });
  }
});

// DELETE /api/wishlist/carta/:cartaId — eliminar entrada por cartaId (MUST be before /:cartaClassId)
wishlistRouter.delete("/carta/:cartaId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const userId = actor.id;
    const cartaId = Number(req.params.cartaId);

    const entry = await em.findOne(Wishlist, { userId, cartaId });
    if (!entry) return res.status(404).json({ message: "Favorito no encontrado" });

    await em.removeAndFlush(entry);
    res.json({ message: "Eliminado de favoritos" });
  } catch (error: any) {
    res.status(500).json({ message: "Error al eliminar favorito", error: error.message });
  }
});

// DELETE /api/wishlist/:cartaClassId — eliminar entrada por cartaClass
wishlistRouter.delete("/:cartaClassId", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const userId = actor.id;
    const cartaClassId = Number(req.params.cartaClassId);

    const entry = await em.findOne(Wishlist, { userId, cartaClass: { id: cartaClassId } });
    if (!entry) return res.status(404).json({ message: "Favorito no encontrado" });

    await em.removeAndFlush(entry);
    res.json({ message: "Eliminado de favoritos" });
  } catch (error: any) {
    res.status(500).json({ message: "Error al eliminar favorito", error: error.message });
  }
});
