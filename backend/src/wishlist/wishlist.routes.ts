import { Router, Response } from "express";
import { orm } from "../shared/db/orm.js";
import { Wishlist } from "./wishlist.entity.js";
import { Carta } from "../carta/carta.entity.js";
import { Valoracion } from "../valoracion/valoracion.entity.js";
import { authenticate, AuthRequest } from "../shared/middleware/auth.js";
import { parsePrice } from "../shared/parsePrice.js";

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
    price: parsePrice(carta.price),
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

    const entries = await em.find(
      Wishlist,
      { userId: actor.id },
      { populate: ["carta", "carta.items", "carta.uploader"] }
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

        if (!entry.carta) {
          return { ...base, disponible: false, cartaId: null, cartas: [] };
        }

        // Buscar todas las cartas del mismo nombre para comparar vendedores
        const cartaFilter: any = { name: entry.carta.name };
        if (entry.idioma) cartaFilter.lang = entry.idioma;

        let mismoNombre = await em.find(Carta, cartaFilter, { populate: ["items", "uploader"] });

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
          cartaId: entry.carta.id,
          cartaNombre: entry.carta.name,
          cartaRarity: entry.carta.rarity ?? null,
          cartaImage: entry.carta.image ?? null,
          cartas: sorted,
        };
      })
    );

    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ message: "Error al obtener favoritos", error: error.message });
  }
});

// POST /api/wishlist — agregar a favoritos por cartaId
wishlistRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const { cartaId, idioma, ciudad, notificar, precioMax } = req.body;

    if (!cartaId) {
      return res.status(400).json({ message: "cartaId requerido" });
    }

    const existing = await em.findOne(Wishlist, { userId: actor.id, carta: { id: Number(cartaId) } });
    if (existing) return res.status(200).json({ data: existing, message: "Ya está en favoritos" });

    const carta = await em.findOne(Carta, { id: Number(cartaId) });
    if (!carta) return res.status(404).json({ message: "Carta no encontrada" });

    const entry = em.create(Wishlist, {
      userId: actor.id,
      carta,
      idioma: idioma || undefined,
      ciudad: ciudad || undefined,
      notificar: notificar !== false,
      precioMax: precioMax ? Number(precioMax) : undefined,
    });
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
    const id = Number(req.params.id);

    const entry = await em.findOne(Wishlist, { id, userId: actor.id });
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

// DELETE /api/wishlist/:id — eliminar por id de entrada de wishlist
wishlistRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const em = orm.em;
    const actor = req.actor as any;
    const id = Number(req.params.id);

    const entry = await em.findOne(Wishlist, { id, userId: actor.id });
    if (!entry) return res.status(404).json({ message: "Favorito no encontrado" });

    await em.removeAndFlush(entry);
    res.json({ message: "Eliminado de favoritos" });
  } catch (error: any) {
    res.status(500).json({ message: "Error al eliminar favorito", error: error.message });
  }
});
