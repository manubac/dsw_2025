import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Carta } from "./carta.entity.js";
import { CartaClass } from "./cartaClass.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";
import { Valoracion } from "../valoracion/valoracion.entity.js";
import { Compra } from "../compra/compra.entity.js";
import axios from "axios";
import puppeteer, { type Browser } from "puppeteer";
import { notifyWishlistSubscribers } from "../wishlist/wishlistNotifier.js";


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
    lang: req.body.lang,
    ciudad: req.body.ciudad,
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

    // Fire-and-forget: el notifier carga la carta completa con su propio EM
    if (carta.id) notifyWishlistSubscribers(orm.em.fork(), carta.id).catch(console.error);

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

// --- Puppeteer singleton ---
// Se inicia una sola vez y se reutiliza para no pagar el costo de lanzar Chrome en cada request.
let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
  }
  return _browser;
}

/** Obtiene el HTML final de una URL usando Chromium real (pasa anti-bot). */
async function fetchWithBrowser(url: string, waitMs = 1200): Promise<string> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    // Espera breve para que el JS termine de renderizar precios
    await new Promise(res => setTimeout(res, waitMs));
    return await page.content();
  } finally {
    await page.close();
  }
}

const SCRAPER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

/**
 * Fuente principal: Pokémon TCG API oficial (api.pokemontcg.io)
 * Devuelve precios TCGPlayer + Cardmarket en una sola llamada.
 * Incluye precios de cartas agotadas porque la API refleja el mercado secundario.
 */
async function fetchPrecios_PokemonTCGApi(nombre: string, setName?: string, cardNumber?: string): Promise<{ tcgplayer: string | null; cardmarket: string | null }> {
  try {
    const parts: string[] = [`name:"${nombre}"`];
    if (setName) parts.push(`set.name:"${setName}"`);
    if (cardNumber) {
      const numOnly = cardNumber.split('/')[0].trim();
      if (numOnly) parts.push(`number:${numOnly}`);
    }
    const q = parts.join(' ');
    const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5&select=id,name,tcgplayer,cardmarket`;

    const headers: Record<string, string> = { "User-Agent": "DSW-Marketplace/1.0" };
    if (process.env.POKEMONTCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMONTCG_API_KEY;

    const r = await axios.get(url, { headers, timeout: 10000 });
    const cards = r.data?.data as Record<string, unknown>[] | undefined;
    if (!cards || cards.length === 0) {
      console.log(`[PokemonTCGApi] sin resultados para: ${q}`);
      return { tcgplayer: null, cardmarket: null };
    }

    const card = cards[0] as {
      id?: string; name?: string;
      tcgplayer?: { prices?: Record<string, { market?: number; mid?: number; low?: number }> };
      cardmarket?: { prices?: { averageSellPrice?: number; trendPrice?: number; lowPrice?: number } };
    };
    console.log(`[PokemonTCGApi] carta: ${card.id} "${card.name}"`);

    // TCGPlayer: priorizar holofoil > normal > cualquier tipo disponible
    let tcgplayer: string | null = null;
    if (card.tcgplayer?.prices) {
      const prices = card.tcgplayer.prices;
      const priority = ['holofoil', 'normal', '1stEditionHolofoil', 'reverseHolofoil', 'unlimitedHolofoil'];
      const allTypes = [...priority, ...Object.keys(prices).filter(k => !priority.includes(k))];
      for (const type of allTypes) {
        const p = prices[type];
        const val = p?.market ?? p?.mid ?? p?.low;
        if (val && val > 0) { tcgplayer = `$${val.toFixed(2)}`; break; }
      }
    }

    // Cardmarket: averageSellPrice > trendPrice > lowPrice
    let cardmarket: string | null = null;
    if (card.cardmarket?.prices) {
      const p = card.cardmarket.prices;
      const val = p.averageSellPrice ?? p.trendPrice ?? p.lowPrice;
      if (val && val > 0) cardmarket = `€${val.toFixed(2)}`;
    }

    console.log(`[PokemonTCGApi] tcgplayer=${tcgplayer} cardmarket=${cardmarket}`);
    return { tcgplayer, cardmarket };
  } catch (err: unknown) {
    console.error(`[PokemonTCGApi] error: ${err instanceof Error ? err.message : String(err)}`);
    return { tcgplayer: null, cardmarket: null };
  }
}

async function fetchPrecioCoolStuff(nombre: string, setName?: string, cardNumber?: string): Promise<string | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    const query = [nombre, setName, cardNumber].filter(Boolean).join(' ');
    console.log(`[CoolStuff] buscando: "${query}"`);

    // Paso 1: homepage para obtener cookies de sesión
    await page.goto('https://www.coolstuffinc.com/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await new Promise(r => setTimeout(r, 400));

    // Paso 2: navegar directamente a la URL de búsqueda (ya con cookies válidas)
    const searchUrl = `https://www.coolstuffinc.com/main_search.php?pa=searchOnName&q=${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 800));

    const finalUrl = page.url();
    const pageLen = (await page.content()).length;
    console.log(`[CoolStuff] URL=${finalUrl} len=${pageLen}`);

    // Extraer precio desde el DOM completamente renderizado
    const price = await page.evaluate((): number | null => {
      const priceSelectors = ['.our-price', '.regular-price', '.product-price', '[data-price]', '[data-regular-price]', '.price'];
      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const attr = el.getAttribute('data-price') ?? el.getAttribute('data-regular-price');
        if (attr) { const v = parseFloat(attr); if (v > 0) return v; }
        const m = (el.textContent ?? '').match(/\$\s*([\d,]+\.?\d{0,2})/);
        if (m) { const v = parseFloat(m[1].replace(/,/g, '')); if (v > 0) return v; }
      }
      // Fallback: primer nodo de texto que tenga $X.XX
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const m = (node.textContent ?? '').match(/\$\s*([\d,]+\.\d{2})/);
        if (m) { const v = parseFloat(m[1].replace(/,/g, '')); if (v > 0 && v < 100000) return v; }
      }
      return null;
    });

    if (price === null) { console.log(`[CoolStuff] sin precio`); return null; }
    return `$${price.toFixed(2)}`;
  } catch (err: unknown) {
    console.error(`[CoolStuff] error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    await page.close();
  }
}

async function fetchPrecioEbay(nombre: string, setName?: string, cardNumber?: string): Promise<string | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

    const query = [nombre, setName, cardNumber, 'pokemon card'].filter(Boolean).join(' ');
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_BIN=1&_sop=15&_ipg=10`;
    console.log(`[eBay] fetch: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 800));

    console.log(`[eBay] URL=${page.url()}`);

    // Extraer primer precio de la lista de resultados desde el DOM renderizado
    const price = await page.evaluate((): number | null => {
      const items = Array.from(document.querySelectorAll('.s-item'));
      // El primer .s-item suele ser un elemento fantasma/promocional — saltarlo
      for (const item of items.slice(1)) {
        const priceEl = item.querySelector('.s-item__price');
        if (!priceEl) continue;
        const text = (priceEl.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text.includes(' to ')) continue; // saltar rangos de precio
        const m = text.match(/\$\s*([\d,]+\.?\d{0,2})/);
        if (m) {
          const v = parseFloat(m[1].replace(/,/g, ''));
          if (v > 0 && v < 100000) return v;
        }
      }
      return null;
    });

    console.log(`[eBay] price=${price}`);
    if (price === null) { console.log(`[eBay] sin precio`); return null; }
    return `$${price.toFixed(2)}`;
  } catch (err: unknown) {
    console.error(`[eBay] error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    await page.close();
  }
}

async function fetchPrecioPriceCharting(nombre: string, setName?: string, cardNumber?: string): Promise<string | null> {
  try {
    const query = [nombre, setName, cardNumber].filter(Boolean).join(' ');
    const searchUrl = `https://www.pricecharting.com/search-products?q=${encodeURIComponent(query)}&type=card`;

    const r = await axios.get(searchUrl, { headers: SCRAPER_HEADERS, timeout: 14000, maxRedirects: 10 });
    let html: string = r.data ?? '';
    const finalUrl: string = String((r.request as { res?: { responseUrl?: string } } | undefined)?.res?.responseUrl ?? searchUrl);
    console.log(`[PriceCharting] status=${r.status} len=${html.length} finalUrl=${finalUrl}`);

    // Si la búsqueda no redirigió al producto, seguir el primer enlace de resultado
    if (!finalUrl.includes('/game/') && html.includes('href="/game/')) {
      const linkMatch = html.match(/href="(\/game\/[^"#?]+)"/);
      if (linkMatch) {
        const productUrl = `https://www.pricecharting.com${linkMatch[1]}`;
        console.log(`[PriceCharting] siguiendo primer resultado: ${productUrl}`);
        try {
          const r2 = await axios.get(productUrl, { headers: SCRAPER_HEADERS, timeout: 10000 });
          html = r2.data ?? html;
          console.log(`[PriceCharting] producto len=${html.length}`);
        } catch { /* usar html de búsqueda como fallback */ }
      }
    }

    // La página de producto tiene id="used_price" / "complete_price" / "new_price"
    const patterns = [
      /id="used_price"[^>]*>[\s\S]{0,300}?\$\s*(\d+\.\d{2})/i,
      /id="complete_price"[^>]*>[\s\S]{0,300}?\$\s*(\d+\.\d{2})/i,
      /id="new_price"[^>]*>[\s\S]{0,300}?\$\s*(\d+\.\d{2})/i,
      /class="[^"]*(?:js-price|price)[^"]*"[^>]*>\$\s*(\d+\.\d{2})/i,
      /\$\s*(\d+\.\d{2})/,
    ];
    for (const pat of patterns) {
      const m = html.match(pat);
      if (m) {
        const val = parseFloat(m[1]);
        if (!isNaN(val) && val > 0 && val < 50000) return `$${val.toFixed(2)}`;
      }
    }
    console.log(`[PriceCharting] sin precio en producto.`);
    return null;
  } catch (err: unknown) {
    console.error(`[PriceCharting] error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function fetchPrecioTrollandToad(nombre: string, setName?: string, cardNumber?: string): Promise<string | null> {
  try {
    const query = [nombre, setName].filter(Boolean).join(' ');
    const url = `https://www.trollandtoad.com/search?search_words=${encodeURIComponent(query)}&search=true&category_id=94&in-stock-only=false`;
    const r = await axios.get(url, { headers: SCRAPER_HEADERS, timeout: 14000, maxRedirects: 5 });
    const html: string = r.data;
    console.log(`[TrollAndToad] status=${r.status} len=${html.length} q="${query}"`);
    const m = html.match(/class="[^"]*(?:item-price|our-price|prod-qty-price)[^"]*"[^>]*>\s*\$\s*(\d+\.?\d{0,2})/i) ||
              html.match(/data-price="(\d+\.?\d{0,2})"/) ||
              html.match(/\$\s*(\d+\.\d{2})/);
    if (!m) { console.log(`[TrollAndToad] sin precio. muestra: ${html.substring(0, 200).replace(/\s+/g, ' ')}`); return null; }
    const val = parseFloat(m[1]);
    return (!isNaN(val) && val > 0) ? `$${val.toFixed(2)}` : null;
  } catch (err: unknown) {
    console.error(`[TrollAndToad] error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

// Devuelve el precio sugerido de CoolStuffInc para una carta y set dados
export async function getPrecioCoolStuff(req: Request, res: Response) {
  const nombre = req.query.nombre as string;
  const setName = req.query.set as string | undefined;
  const cardNumber = req.query.numero as string | undefined;
  if (!nombre) return res.status(400).json({ message: "Falta el nombre de la carta." });

  const precio = await fetchPrecioCoolStuff(nombre, setName, cardNumber);
  return res.status(200).json({ precio });
}

// Devuelve precios de tiendas — solo para Pokemon.
// Si se pasa ?tienda=<key>, solo se llama a esa fuente (ahorra recursos).
export async function getPreciosPokemon(req: Request, res: Response) {
  const nombre = req.query.nombre as string;
  const setName = req.query.set as string | undefined;
  const cardNumber = req.query.numero as string | undefined;
  const tienda = req.query.tienda as string | undefined;
  if (!nombre) return res.status(400).json({ message: "Falta el nombre de la carta." });

  // Modo single-tienda: solo llamar al scraper seleccionado
  if (tienda) {
    try {
      if (tienda === 'tcgplayer' || tienda === 'cardmarket') {
        const api = await fetchPrecios_PokemonTCGApi(nombre, setName, cardNumber);
        return res.status(200).json({ tcgplayer: api.tcgplayer, cardmarket: api.cardmarket });
      }
      if (tienda === 'coolstuff')
        return res.status(200).json({ coolstuff: await fetchPrecioCoolStuff(nombre, setName, cardNumber) });
      if (tienda === 'ebay')
        return res.status(200).json({ ebay: await fetchPrecioEbay(nombre, setName, cardNumber) });
      if (tienda === 'pricecharting')
        return res.status(200).json({ pricecharting: await fetchPrecioPriceCharting(nombre, setName, cardNumber) });
      if (tienda === 'trollandtoad')
        return res.status(200).json({ trollandtoad: await fetchPrecioTrollandToad(nombre, setName, cardNumber) });
    } catch (err: unknown) {
      console.error(`[getPreciosPokemon tienda=${tienda}] ${err instanceof Error ? err.message : String(err)}`);
      return res.status(200).json({ [tienda]: null });
    }
  }

  // Sin tienda: todas en paralelo (legacy / modal de rareza)
  const [apiResult, coolstuff, ebay, pricecharting, trollandtoad] =
    await Promise.allSettled([
      fetchPrecios_PokemonTCGApi(nombre, setName, cardNumber),
      fetchPrecioCoolStuff(nombre, setName, cardNumber),
      fetchPrecioEbay(nombre, setName, cardNumber),
      fetchPrecioPriceCharting(nombre, setName, cardNumber),
      fetchPrecioTrollandToad(nombre, setName, cardNumber),
    ]);

  const api = apiResult.status === "fulfilled" ? apiResult.value : { tcgplayer: null, cardmarket: null };

  return res.status(200).json({
    coolstuff:     coolstuff.status     === "fulfilled" ? coolstuff.value     : null,
    tcgplayer:     api.tcgplayer,
    cardmarket:    api.cardmarket,
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