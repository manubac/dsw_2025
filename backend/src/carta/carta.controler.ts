import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Carta } from "./carta.entity.js";
import { CartaClass } from "./cartaClass.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";
import { Valoracion } from "../valoracion/valoracion.entity.js";
import { Compra } from "../compra/compra.entity.js";
import axios from "axios";


const em = orm.em;

// Middleware para sanitizar la entrada
function sanitizeCartaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitisedInput = {
    name: req.body.name,
    price: req.body.price,
    image: req.body.image,
    link: req.body.link,
    rarity: req.body.rarity,
    setName: req.body.setName,
    setCode: req.body.setCode,
    cardNumber: req.body.cardNumber,
    cartaClass: req.body.cartaClass,
    level: req.body.level,
    hp: req.body.hp,
    mana: req.body.mana,
    attack: req.body.attack,
    items: req.body.items,
  };

  // Eliminar claves undefined
  Object.keys(req.body.sanitisedInput).forEach((key) => {
    if (req.body.sanitisedInput[key] === undefined) {
      delete req.body.sanitisedInput[key];
    }
  });

  next();
}

// Obtener todas las cartas
async function findAll(req: Request, res: Response) {
  try {
    const cartas = await em.find(Carta, {}, { populate: ["cartaClass", "items", "items.intermediarios.direccion", "uploader"] });
    
    // Mapear campos de la carta para coincidir con las expectativas del frontend (title, thumbnail, etc.)
    const cartasFormateadas = cartas
        .map(carta => {
        // Recolectar todos los intermediarios de todos los items vinculados a esta carta (deduplicados)
        const interMap = new Map<number, any>();
        carta.items.getItems().forEach(item =>
            item.intermediarios.getItems().forEach(i => {
                if (i.id == null) return;
                interMap.set(i.id, {
                    id: i.id,
                    nombre: i.nombre,
                    direccion: i.direccion ? {
                        ciudad: i.direccion.ciudad,
                        provincia: i.direccion.provincia,
                    } : undefined,
                });
            })
        );
        const intermediarios = Array.from(interMap.values());
        
        const cartaFormateada: any = {
            id: carta.id,
            title: carta.name,
            thumbnail: carta.image,
            price: carta.price ? parseFloat(carta.price.replace(/[^0-9.]/g, '')) : 0,
            description: carta.rarity || "Carta coleccionable",
            set: carta.setName || "Unknown Set",
            rarity: carta.rarity,
            link: carta.link,
            cartaClass: carta.cartaClass,
            items: carta.items,
            intermediarios,
        };
        
        if (carta.uploader) {
            cartaFormateada.uploader = { id: carta.uploader.id}
        }
        
        // Calcular el stock total sumando todos los items
        cartaFormateada.stock = carta.items.getItems().reduce((sum, item) => sum + item.stock, 0);

        return cartaFormateada;
    });
    
    res.status(200).json({ message: "Found all cartas", data: cartasFormateadas });
  } catch (error: any) {
    console.error("Error fetching cartas:", error);
    res.status(500).json({ message: "Error fetching cartas", error: error.message });
  }
}

// Obtener una carta por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const carta = await em.findOneOrFail(Carta, { id }, { populate: ["cartaClass", "items", "uploader"] });
    
    // Mapear campos de la carta para coincidir con las expectativas del frontend
    const cartaFormateada = {
      id: carta.id,
      title: carta.name,
      thumbnail: carta.image,
      images: carta.image ? [carta.image] : [],
      price: carta.price ? parseFloat(carta.price.replace(/[^0-9.]/g, '')) : 0,
      description: carta.rarity || "Carta coleccionable",
      set: carta.setName || "Unknown Set",
      rarity: carta.rarity,
      link: carta.link,
      brand: "Pokémon TCG",
      category: "trading-cards",
      rating: null, // Rating de la carta eliminado, usar uploader.rating
      stock: carta.items.getItems().reduce((sum, item) => sum + item.stock, 0),
      cartaClass: carta.cartaClass,
      items: carta.items,
      uploader: undefined as any
    } as any;

    // incluir id y nombre del uploader si está presente junto con su rating
    if ((carta as any).uploader) {
       const uploaderId = (carta as any).uploader.id;
       const valoraciones = await em.find(Valoracion, { tipoObjeto: 'vendedor', objetoId: uploaderId });
       const avg = valoraciones.length > 0 
          ? valoraciones.reduce((acc, v) => acc + v.puntuacion, 0) / valoraciones.length 
          : 0;

      cartaFormateada.uploader = { 
        id: uploaderId,
        nombre: (carta as any).uploader.nombre,
        rating: avg,
        reviewsCount: valoraciones.length
      };
    }
    
    res.status(200).json({ message: "Found one carta", data: cartaFormateada });
  } catch (error: any) {
    console.error("Error fetching carta:", error);
    res.status(500).json({ message: "Error fetching carta", error: error.message });
  }
}

// Agregar una carta
async function add(req: Request, res: Response) {
  try {
    console.log("Sanitised input:", req.body.sanitisedInput);

    const cartaData = { ...req.body.sanitisedInput };

      if (cartaData.cartaClass) {
        cartaData.cartaClass = em.getReference(CartaClass, Number(cartaData.cartaClass));
      }

      // Si el frontend proporcionó vendedorId (vendedor logueado), enlazar uploader
      const vendedorId = req.body.userId ?? req.body.vendedorId;
      if (vendedorId) {
        cartaData.uploader = em.getReference(Vendedor, Number(vendedorId));
      }

      const carta = em.create(Carta, cartaData);
    await em.flush();

    res.status(201).json({ message: "Carta created", data: carta });
  } catch (error: any) {
    console.error("Error creating carta:", error);
    res.status(500).json({ message: "Error creating carta", error: error.message, details: error });
  }
}

// Actualizar una carta
async function update(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const carta = await em.findOneOrFail(Carta, { id });

    console.log("Updating carta:", id, req.body.sanitisedInput);

    const cartaData = { ...req.body.sanitisedInput };
    if (cartaData.cartaClass) {
      cartaData.cartaClass = em.getReference(CartaClass, Number(cartaData.cartaClass));
    }

    em.assign(carta, cartaData);
    await em.flush();

    res.status(200).json({ message: "Carta updated", data: carta });
  } catch (error: any) {
    console.error("Error updating carta:", error);
    res.status(500).json({ message: "Error updating carta", error: error.message });
  }
}

// Eliminar una carta
async function remove(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const vendedorId = Number(req.body.userId ?? req.body.vendedorId);
    if (!vendedorId) return res.status(400).json({ message: "vendedorId required for deletion" });

    // populate uploader and items to perform ownership and safety checks
    const carta = await em.findOneOrFail(Carta, { id }, { populate: ['uploader', 'items'] });

    if (!carta.uploader) {
      return res.status(403).json({ message: "You are not authorized to delete this carta" });
    }

    if (carta.uploader.id !== vendedorId) {
      return res.status(403).json({ message: "You are not authorized to delete this carta" });
    }

    // Check if any items are in existing compras referencing these items
    const items = carta.items.getItems();
    for (const item of items) {
      // safer to query by item id instead of passing the entity directly
      const count = await em.count(Compra, { itemCartas: { id: item.id } });
      if (count > 0) {
        return res.status(400).json({
          message: "No puedes eliminar esta carta porque tiene items asociados a compras existentes. La carta debe permanecer en el historial."
        });
      }
    }

    await em.removeAndFlush(carta);
    res.status(200).json({ message: "Carta deleted" });
  } catch (error: any) {
    console.error("Error deleting carta:", error);
    res.status(500).json({ message: "Error deleting carta", error: error.message });
  }
}







// ============================
// Precios via scraping (solo para /publicar)
// ============================

// Intenta obtener el precio de CoolStuffInc para una carta específica vía axios (sin browser)
async function fetchPrecioCoolStuff(nombre: string, setName?: string): Promise<string | null> {
  try {
    const query = setName ? `${nombre} ${setName}` : nombre;
    const url = `https://www.coolstuffinc.com/main_search.php?pa=searchOnName&page=1&resultsPerPage=10&q=${encodeURIComponent(query)}`;
    const r = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 10000,
    });
    const html: string = r.data;
    // Buscar el primer precio en el HTML (patrón $X.XX)
    const match = html.match(/\$\s*(\d+\.\d{2})/);
    return match ? `$${match[1]}` : null;
  } catch {
    return null;
  }
}

async function fetchPrecioTCGPlayer(nombre: string, setName?: string): Promise<string | null> {
  try {
    const query = setName ? `${nombre} ${setName}` : nombre;
    const url = `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(query)}&view=list`;
    const r = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 10000,
    });
    const html: string = r.data;
    const match = html.match(/"marketPrice":\s*"?(\d+\.?\d{2})"?/) ||
                  html.match(/["']price["']:\s*"?(\d+\.\d{2})"?/) ||
                  html.match(/\$\s*(\d+\.\d{2})/);
    return match ? `$${match[1]}` : null;
  } catch {
    return null;
  }
}

async function fetchPrecioCardmarket(nombre: string, setName?: string): Promise<string | null> {
  try {
    const query = setName ? `${nombre} ${setName}` : nombre;
    const url = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(query)}&sortBy=price_asc&perSite=4`;
    const r = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 10000,
    });
    const html: string = r.data;
    const match = html.match(/(\d+[,.]\d{2})\s*€/) ||
                  html.match(/€\s*(\d+[,.]?\d{2})/);
    if (!match) return null;
    const val = match[1].replace(',', '.');
    return `€${val}`;
  } catch {
    return null;
  }
}

async function fetchPrecioEbay(nombre: string, setName?: string): Promise<string | null> {
  try {
    const query = setName ? `${nombre} ${setName} pokemon card` : `${nombre} pokemon card`;
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_BIN=1&_sop=15`;
    const r = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 10000,
    });
    const html: string = r.data;
    const jsonLdMatch = html.match(/"price":\s*"(\d+\.?\d{0,2})"/);
    const plainMatch = html.match(/\$\s*(\d+\.\d{2})/);
    const match = jsonLdMatch || plainMatch;
    return match ? `$${match[1]}` : null;
  } catch {
    return null;
  }
}

async function fetchPrecioPriceCharting(nombre: string, setName?: string): Promise<string | null> {
  try {
    const query = setName ? `${nombre} ${setName}` : nombre;
    const url = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=card`;
    const r = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 10000,
    });
    const html: string = r.data;
    const match = html.match(/class="price[^"]*"[^>]*>\$\s*(\d+\.\d{2})/) ||
                  html.match(/\$\s*(\d+\.\d{2})/);
    return match ? `$${match[1]}` : null;
  } catch {
    return null;
  }
}

async function fetchPrecioTrollandToad(nombre: string, setName?: string): Promise<string | null> {
  try {
    const query = setName ? `${nombre} ${setName}` : nombre;
    const url = `https://www.trollandtoad.com/search?search_words=${encodeURIComponent(query)}&search=true&category_id=94`;
    const r = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 10000,
    });
    const html: string = r.data;
    const match = html.match(/\$\s*(\d+\.\d{2})/);
    return match ? `$${match[1]}` : null;
  } catch {
    return null;
  }
}

// Devuelve el precio sugerido de CoolStuffInc para una carta y set dados
export async function getPrecioCoolStuff(req: Request, res: Response) {
  const nombre = req.query.nombre as string;
  const setName = req.query.set as string | undefined;
  if (!nombre) return res.status(400).json({ message: "Falta el nombre de la carta." });

  const precio = await fetchPrecioCoolStuff(nombre, setName);
  return res.status(200).json({ precio });
}

// Devuelve precios de múltiples tiendas en paralelo — solo para Pokemon
export async function getPreciosPokemon(req: Request, res: Response) {
  const nombre = req.query.nombre as string;
  const setName = req.query.set as string | undefined;
  if (!nombre) return res.status(400).json({ message: "Falta el nombre de la carta." });

  const [coolstuff, tcgplayer, cardmarket, ebay, pricecharting, trollandtoad] =
    await Promise.allSettled([
      fetchPrecioCoolStuff(nombre, setName),
      fetchPrecioTCGPlayer(nombre, setName),
      fetchPrecioCardmarket(nombre, setName),
      fetchPrecioEbay(nombre, setName),
      fetchPrecioPriceCharting(nombre, setName),
      fetchPrecioTrollandToad(nombre, setName),
    ]);

  return res.status(200).json({
    coolstuff:     coolstuff.status     === "fulfilled" ? coolstuff.value     : null,
    tcgplayer:     tcgplayer.status     === "fulfilled" ? tcgplayer.value     : null,
    cardmarket:    cardmarket.status    === "fulfilled" ? cardmarket.value    : null,
    ebay:          ebay.status          === "fulfilled" ? ebay.value          : null,
    pricecharting: pricecharting.status === "fulfilled" ? pricecharting.value : null,
    trollandtoad:  trollandtoad.status  === "fulfilled" ? trollandtoad.value  : null,
  });
}

export {
  sanitizeCartaInput,
  findAll,
  findOne,
  add,
  update,
  remove,
};