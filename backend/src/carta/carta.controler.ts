import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Carta } from "./carta.entity.js";
import { CartaClass } from "./cartaClass.entity.js";
import { Vendedor } from "../vendedor/vendedores.entity.js";
import { Valoracion } from "../valoracion/valoracion.entity.js";
import { Compra } from "../compra/compra.entity.js";
import { resolveNamesAcrossLanguages, getSetAbbreviations } from "../identify/services/translationService.js";
import axios from "axios";
import puppeteer, { type Browser } from "puppeteer";
import { notifyWishlistSubscribers } from "../wishlist/wishlistNotifier.js";


const em = orm.em;

// Middleware para sanitizar la entrada
function sanitizeCartaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitisedInput = {
    name: req.body.name?.trim().replace(/\s+/g, ' '),
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
    const cartas = await em.find(Carta, {}, { populate: ["cartaClass", "items", "items.cartas", "items.intermediarios.direccion", "uploader"] });

    // Bulk-fetch set abbreviations (TCGdex slug → official abbr, e.g. "sv3pt5" → "MEW")
    const setCodes = [...new Set(
      cartas.map(c => c.setCode).filter((s): s is string => !!s)
    )];
    const abbrMap = await getSetAbbreviations(setCodes);

    // Bulk-fetch vendor ratings for all uploaders
    const uploaderIds: number[] = [...new Set(
      cartas
        .filter(c => (c as any).uploader?.id != null)
        .map(c => (c as any).uploader.id as number)
    )];
    const ratingMap = new Map<number, { sum: number; count: number }>();
    if (uploaderIds.length > 0) {
      const allValoraciones = await em.find(Valoracion, { tipoObjeto: 'vendedor', objetoId: { $in: uploaderIds } });
      for (const v of allValoraciones) {
        const existing = ratingMap.get(v.objetoId) ?? { sum: 0, count: 0 };
        existing.sum += v.puntuacion;
        existing.count += 1;
        ratingMap.set(v.objetoId, existing);
      }
    }

    // Mapear campos de la carta para coincidir con las expectativas del frontend (title, thumbnail, etc.)
    const cartasFormateadas = cartas
        .filter(carta => carta.items.getItems().every(item => item.cartas.getItems().length < 2))
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
            setCode: carta.setCode ? (abbrMap.get(carta.setCode) ?? carta.setCode) : null,
            cardNumber: carta.cardNumber ?? null,
            rarity: carta.rarity,
            link: carta.link,
            cartaClass: carta.cartaClass,
            items: carta.items,
            intermediarios,
            lang: carta.lang ?? null,
        };

        if (carta.uploader) {
            const uploaderId = carta.uploader.id as number;
            const ratings = ratingMap.get(uploaderId) ?? { sum: 0, count: 0 };
            cartaFormateada.uploader = {
                id: uploaderId,
                nombre: (carta.uploader as any).nombre,
                rating: ratings.count > 0 ? ratings.sum / ratings.count : 0,
                reviewsCount: ratings.count,
            };
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
    // Usamos el em global (no fork) para reutilizar entidades ya cacheadas en el identity map
    // (vendedor, cartaClass) y evitar SQL fresco que podría fallar si el schema está desactualizado.
    const carta = await em.findOneOrFail(Carta, { id }, { populate: ["cartaClass", "items", "uploader"] });

    // Mapear items a objetos planos para evitar referencias circulares en JSON.stringify
    // (ItemCarta.cartas apunta de vuelta a Carta cuando está inicializado por findAll)
    const items = carta.items.getItems().map(item => ({
      id: item.id,
      description: item.description,
      stock: item.stock,
      estado: item.estado,
    }));

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
      rating: null,
      stock: items.reduce((sum, item) => sum + item.stock, 0),
      cartaClass: carta.cartaClass,
      items,
      lang: carta.lang ?? null,
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
  const emReq = orm.em.fork();
  try {
    console.log("Sanitised input:", req.body.sanitisedInput);

    const cartaData = { ...req.body.sanitisedInput };

    if (cartaData.cartaClass) {
      const classId = typeof cartaData.cartaClass === 'object'
        ? Number((cartaData.cartaClass as any).id)
        : Number(cartaData.cartaClass);
      if (!isNaN(classId)) {
        cartaData.cartaClass = emReq.getReference(CartaClass, classId);
      } else {
        delete cartaData.cartaClass;
      }
    }

    // Si el frontend proporcionó vendedorId (vendedor logueado), enlazar uploader
    const vendedorId = req.body.userId ?? req.body.vendedorId;
    if (vendedorId) {
      cartaData.uploader = emReq.getReference(Vendedor, Number(vendedorId));
    }

    const carta = emReq.create(Carta, cartaData);
    await emReq.flush();

    // Fire-and-forget: el notifier carga la carta completa con su propio EM
    if (carta.id) notifyWishlistSubscribers(orm.em.fork(), carta.id).catch(console.error);

    res.status(201).json({ message: "Carta created", data: { id: carta.id, name: carta.name } });
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
      const classId = typeof cartaData.cartaClass === 'object'
        ? Number((cartaData.cartaClass as any).id)
        : Number(cartaData.cartaClass);
      if (!isNaN(classId)) {
        cartaData.cartaClass = em.getReference(CartaClass, classId);
      } else {
        delete cartaData.cartaClass;
      }
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
// Endpoints para la HomePage
// ============================

function buildGameFilter(game: string): any {
  if (game === 'all') return {};
  // Cartas sin cartaClass se tratan como pokémon (mismo criterio que CardsPage)
  if (game === 'pokemon') {
    return { $or: [{ cartaClass: null }, { cartaClass: { name: { $ilike: 'pokemon' } } }] };
  }
  return { cartaClass: { name: { $ilike: game } } };
}

async function getPopulares(req: Request, res: Response) {
  try {
    const game = (req.query.game as string) || 'pokemon';
    const limit = Math.min(Number(req.query.limit) || 10, 20);

    const emFork = orm.em.fork();
    const cartas = await emFork.find(Carta, buildGameFilter(game), {
      populate: ['cartaClass', 'uploader'],
      orderBy: [{ viewCount: 'DESC' }, { createdAt: 'DESC' }],
      limit,
    });

    const data = cartas.map(c => ({
      id: c.id,
      title: c.name,
      thumbnail: c.image,
      price: c.price ? parseFloat(c.price.replace(/[^0-9.]/g, '')) : 0,
      rarity: c.rarity,
      set: c.setName,
      viewCount: c.viewCount ?? 0,
      cartaClass: c.cartaClass ? { name: (c.cartaClass as any).name } : null,
      uploader: c.uploader ? { id: c.uploader.id, nombre: (c.uploader as any).nombre } : null,
    }));

    res.json({ data });
  } catch (error: any) {
    console.error('Error fetching populares:', error);
    res.status(500).json({ message: 'Error fetching populares', error: error.message });
  }
}

async function getMejoresVendedores(req: Request, res: Response) {
  try {
    const game = (req.query.game as string) || 'pokemon';
    const limit = Math.min(Number(req.query.limit) || 8, 20);

    const emFork = orm.em.fork();

    // Traer cartas del juego seleccionado que tengan uploader (publicaciones individuales)
    const gameFilter = { ...buildGameFilter(game), uploader: { $ne: null } };
    const cartas = await emFork.find(Carta, gameFilter, {
      populate: ['cartaClass', 'uploader'],
      limit: 100,
    });

    if (cartas.length === 0) return res.json({ data: [] });

    // Obtener ratings solo de los uploaders presentes
    const uploaderIds = [...new Set(
      cartas.map(c => c.uploader?.id).filter((id): id is number => id != null)
    )];

    const valoraciones = await emFork.find(Valoracion, {
      tipoObjeto: 'vendedor',
      objetoId: { $in: uploaderIds },
    });

    const ratingMap = new Map<number, { sum: number; count: number }>();
    for (const v of valoraciones) {
      const existing = ratingMap.get(v.objetoId) ?? { sum: 0, count: 0 };
      existing.sum += v.puntuacion;
      existing.count++;
      ratingMap.set(v.objetoId, existing);
    }

    // Ordenar cartas por rating del uploader (desc), solo vendedores con al menos 1 reseña
    const cartasOrdenadas = cartas
      .map(c => {
        const uid = c.uploader?.id;
        const r = uid != null ? ratingMap.get(uid) : undefined;
        return { c, uid, avg: r ? r.sum / r.count : -1, hasRating: !!r };
      })
      .filter(x => x.hasRating)
      .sort((a, b) => b.avg - a.avg);

    const uploaderCount = new Map<number, number>();
    const result: any[] = [];

    for (const { c, avg, uid } of cartasOrdenadas) {
      if (result.length >= limit) break;
      if (uid == null) continue;
      const seen = uploaderCount.get(uid) ?? 0;
      if (seen >= 2) continue;
      uploaderCount.set(uid, seen + 1);
      const rd = ratingMap.get(uid)!;
      result.push({
        id: c.id,
        title: c.name,
        thumbnail: c.image,
        price: c.price ? parseFloat(c.price.replace(/[^0-9.]/g, '')) : 0,
        rarity: c.rarity,
        set: c.setName,
        cartaClass: c.cartaClass ? { name: (c.cartaClass as any).name } : null,
        uploader: {
          id: uid,
          nombre: (c.uploader as any).nombre,
          rating: avg,
          reviewsCount: rd.count,
        },
      });
    }

    res.json({ data: result });
  } catch (error: any) {
    console.error('Error fetching mejores vendedores:', error);
    res.status(500).json({ message: 'Error fetching mejores vendedores', error: error.message });
  }
}

async function incrementViewCount(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const emFork = orm.em.fork();
    const carta = await emFork.findOne(Carta, { id });
    if (!carta) return res.status(404).json({ message: 'Not found' });
    carta.viewCount = (carta.viewCount ?? 0) + 1;
    await emFork.flush();
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
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

async function fetchPrecioTCGPlayer(nombre: string, setName?: string, cardNumber?: string): Promise<string | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const query = [nombre, setName].filter(Boolean).join(' ');
    // Buscar en sección general Pokemon (incluye cartas japonesas)
    const url = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(query)}&view=grid`;
    console.log(`[TCGPlayer] buscando: "${query}"`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });

    try {
      await page.waitForSelector('.product-card__market-price--value, [data-testid="market-price"]', { timeout: 8000 });
    } catch { /* continuar con lo que hay */ }
    await new Promise(r => setTimeout(r, 1500));

    const numOnly = cardNumber?.split('/')[0].trim();
    const price = await page.evaluate((num: string | undefined): number | null => {
      const priceSelectors = [
        '.product-card__market-price--value',
        '[data-testid="market-price"]',
        '.listing-item__listed-price',
        '.search-result__market-price',
      ];
      const cards = Array.from(document.querySelectorAll('.product-card, .search-result-grid-item, [data-testid="product-result"]'));
      const pool = cards.length > 0 ? cards : [document.body];

      for (const card of pool) {
        if (num && !(card.textContent ?? '').includes(num)) continue;
        for (const sel of priceSelectors) {
          const el = card.querySelector(sel) as HTMLElement | null ?? (pool.length === 1 ? document.querySelector(sel) as HTMLElement | null : null);
          if (!el) continue;
          const m = (el.textContent ?? '').match(/\$\s*([\d,]+\.?\d{0,2})/);
          if (m) return parseFloat(m[1].replace(/,/g, ''));
        }
      }
      // Fallback: primer precio en la página
      for (const sel of priceSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const m = (el.textContent ?? '').match(/\$\s*([\d,]+\.?\d{0,2})/);
          if (m) return parseFloat(m[1].replace(/,/g, ''));
        }
      }
      return null;
    }, numOnly);

    console.log(`[TCGPlayer] precio=${price}`);
    if (price !== null && price > 0) return `$${price.toFixed(2)}`;
    console.log(`[TCGPlayer] sin precio`);
    return null;
  } catch (err: unknown) {
    console.error(`[TCGPlayer] error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    await page.close();
  }
}

async function fetchPrecioCardMarket(nombre: string, setName?: string, cardNumber?: string): Promise<string | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    });

    const numOnly = cardNumber?.split('/')[0].trim();

    // Dismissir popup de cookies GDPR
    const dismissGDPR = async () => {
      try {
        await page.waitForSelector(
          '#didomi-notice-agree-button, .btn-success[data-action="didomi.notices.agree"], button[aria-label*="Accept"], #cookieConsentAcceptAll',
          { timeout: 4000 }
        );
        await page.click('#didomi-notice-agree-button, .btn-success[data-action="didomi.notices.agree"], button[aria-label*="Accept"], #cookieConsentAcceptAll');
        await new Promise(r => setTimeout(r, 800));
      } catch { /* sin popup */ }
    };

    // Extraer "30-days average price" de la página de producto actual
    const extract30dAvg = async (): Promise<number | null> => {
      await new Promise(r => setTimeout(r, 2000));
      return page.evaluate((): number | null => {
        const parseEuro = (text: string): number | null => {
          const m = text.match(/([\d.,]+)\s*€/);
          if (!m) return null;
          let s = m[1];
          if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
          else if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
          const v = parseFloat(s);
          return (!isNaN(v) && v > 0) ? v : null;
        };
        // <dt>30 days average price</dt><dd>X,XX €</dd>
        for (const dt of Array.from(document.querySelectorAll('dt'))) {
          const t = (dt.textContent ?? '').toLowerCase();
          if (t.includes('30') && (t.includes('day') || t.includes('average'))) {
            const dd = dt.nextElementSibling;
            if (dd?.tagName === 'DD') {
              const v = parseEuro(dd.textContent ?? '');
              if (v !== null) return v;
            }
          }
        }
        // Fallback: escanear body text
        const body = document.body.innerText ?? '';
        const idx = body.search(/30.{0,5}days?.{0,10}average/i);
        if (idx >= 0) {
          const m = body.slice(idx, idx + 150).match(/([\d.,]+)\s*€/);
          if (m) {
            let s = m[1];
            if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
            else if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
            const v = parseFloat(s);
            if (!isNaN(v) && v > 0) return v;
          }
        }
        return null;
      });
    };

    // --- Intento 1: URL directa /Singles/{setSlug}/{cardSlug} ---
    if (setName) {
      const setSlug = setName.replace(/\s+/g, '-');
      const cardSlug = nombre.replace(/\s+/g, '-');
      const directUrl = `https://www.cardmarket.com/en/Pokemon/Products/Singles/${setSlug}/${cardSlug}`;
      console.log(`[CardMarket] URL directa: ${directUrl}`);
      try {
        await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await dismissGDPR();
        const finalUrl = page.url();
        if (finalUrl.includes('/Singles/') && !finalUrl.includes('/Search')) {
          const price = await extract30dAvg();
          if (price !== null) {
            console.log(`[CardMarket] precio directo: ${price}`);
            return `€${price.toFixed(2)}`;
          }
        }
      } catch { /* continuar */ }
    }

    // --- Intento 2: búsqueda con solo el nombre (sin número para más resultados) ---
    const searchUrl = `https://www.cardmarket.com/en/Pokemon/Products/Search?searchString=${encodeURIComponent(nombre)}&inStock=0`;
    console.log(`[CardMarket] búsqueda: "${nombre}"`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await dismissGDPR();

    // Esperar a que aparezcan links a productos (el JS los renderiza después del DOM)
    try {
      await page.waitForSelector('a[href*="Singles"]', { timeout: 8000 });
    } catch { /* sin resultados o estructura diferente */ }
    await new Promise(r => setTimeout(r, 1000));

    // Buscar link al primer producto relevante (intentar múltiples patrones de href)
    const productLink = await page.evaluate((num: string | undefined): string | null => {
      const selectors = [
        'a[href*="/Pokemon/Products/Singles/"]',
        'a[href*="/Pokemon/Singles/"]',
        'a[href*="Singles"][href*="Pokemon"]',
      ];
      for (const sel of selectors) {
        const links = Array.from(document.querySelectorAll(sel)) as HTMLAnchorElement[];
        if (links.length === 0) continue;
        if (num) {
          const hit = links.find(a =>
            (a.closest('div,tr,li,.row')?.textContent ?? a.textContent ?? '').includes(num)
          );
          if (hit) return hit.href;
        }
        return links[0].href;
      }
      // Último recurso: cualquier link que tenga "Singles" en el href
      const any = document.querySelector('a[href*="Singles"]') as HTMLAnchorElement | null;
      return any ? any.href : null;
    }, numOnly);

    if (!productLink) {
      console.log(`[CardMarket] sin links de producto (url=${page.url()}, html snippet="${(await page.content()).substring(0, 200).replace(/\s+/g, ' ')}")`);
      return null;
    }
    console.log(`[CardMarket] producto: ${productLink}`);

    await page.goto(productLink, { waitUntil: 'domcontentloaded', timeout: 25000 });
    const price = await extract30dAvg();
    console.log(`[CardMarket] 30d avg precio=${price}`);
    if (price !== null) return `€${price.toFixed(2)}`;
    return null;
  } catch (err: unknown) {
    console.error(`[CardMarket] error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  } finally {
    await page.close();
  }
}

const COOLSTUFF_HEADERS = {
  ...SCRAPER_HEADERS,
  "Referer": "https://www.coolstuffinc.com/",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive",
};

function extractCoolStuffPrice(html: string): string | null {
  // El precio en CoolStuffInc aparece como <b>$4.49</b> en la página de producto
  const patterns = [
    /<b>\$\s*([\d,]+\.?\d{0,2})<\/b>/i,                                                          // <b>$4.49</b>  ← formato principal
    /class="[^"]*our-price[^"]*"[^>]*>\s*\$\s*([\d,]+\.?\d{0,2})/i,
    /class="[^"]*(?:regular-price|product-price|item-price)[^"]*"[^>]*>\s*\$\s*([\d,]+\.?\d{0,2})/i,
    /data-(?:regular-)?price="([\d.]+)"/i,
    /"price"\s*:\s*"?\$?\s*([\d.]+)"?/,
    /\$\s*([\d,]+\.\d{2})/,
  ];
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      const val = parseFloat(m[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && val < 100000) return `$${val.toFixed(2)}`;
    }
  }
  return null;
}

async function fetchPrecioCoolStuff(nombre: string, setName?: string, cardNumber?: string): Promise<string | null> {
  try {
    console.log(`[CoolStuff] buscando: "${nombre}" set="${setName}" num="${cardNumber}"`);

    // Intento 1: URL de producto directa con número completo (095/088)
    // La página de PRODUCTO es accesible sin bot-detection; la de búsqueda sí está protegida.
    if (cardNumber && cardNumber.includes('/')) {
      const namePart = nombre.replace(/ /g, '+');
      const numPart = cardNumber.replace('/', '%2F');
      const productUrl = `https://www.coolstuffinc.com/p/Pokemon/${namePart}+-+${numPart}`;
      console.log(`[CoolStuff] URL directa: ${productUrl}`);
      try {
        const r = await axios.get(productUrl, { headers: COOLSTUFF_HEADERS, timeout: 12000, maxRedirects: 5 });
        const html: string = r.data ?? '';
        console.log(`[CoolStuff] producto directo len=${html.length}`);
        const price = extractCoolStuffPrice(html);
        if (price) return price;
      } catch { /* continuar */ }
    }

    // Intento 2: URL con número parcial (sin total)
    const numOnly = cardNumber?.split('/')[0].trim();
    if (numOnly) {
      const namePart = nombre.replace(/ /g, '+');
      const productUrlPartial = `https://www.coolstuffinc.com/p/Pokemon/${namePart}+-+${numOnly}`;
      console.log(`[CoolStuff] URL parcial: ${productUrlPartial}`);
      try {
        const r = await axios.get(productUrlPartial, { headers: COOLSTUFF_HEADERS, timeout: 12000, maxRedirects: 5 });
        const html: string = r.data ?? '';
        console.log(`[CoolStuff] parcial len=${html.length}`);
        const price = extractCoolStuffPrice(html);
        if (price) return price;
      } catch { /* continuar */ }
    }

    // Intento 3: DuckDuckGo HTML para encontrar la URL del producto en CoolStuffInc
    // DDG devuelve los links como redirect: //duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.coolstuffinc.com%2F...
    // Un solo decodeURIComponent() da la URL correcta de CoolStuffInc (con %2F preservado para la /)
    const ddgQuery = `site:coolstuffinc.com/p/Pokemon "${nombre}" ${numOnly ?? ''}`.trim();
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(ddgQuery)}`;
    console.log(`[CoolStuff] DuckDuckGo: ${ddgQuery}`);
    try {
      const rDdg = await axios.get(ddgUrl, {
        headers: { ...SCRAPER_HEADERS, 'Referer': 'https://duckduckgo.com/' },
        timeout: 12000,
        maxRedirects: 3,
      });
      const ddgHtml: string = rDdg.data ?? '';
      console.log(`[CoolStuff] DDG len=${ddgHtml.length} snippet="${ddgHtml.substring(0, 400).replace(/\s+/g, ' ')}"`);

      // DDG HTML Lite envuelve resultados como href="//duckduckgo.com/l/?uddg=URL-encoded&rut=..."
      // Capturar CUALQUIER uddg= y decodificar para ver si apunta a coolstuffinc
      const uddgMatches = [...ddgHtml.matchAll(/uddg=([^"&\s<>]+)/gi)];
      const productUrls = [...new Set(
        uddgMatches.flatMap(m => {
          try {
            const decoded = decodeURIComponent(m[1]);
            return decoded.includes('coolstuffinc.com') && decoded.includes('/p/Pokemon/') ? [decoded] : [];
          } catch { return []; }
        })
      )];
      console.log(`[CoolStuff] DDG encontró ${productUrls.length} URLs`);

      for (const productUrl of productUrls.slice(0, 3)) {
        try {
          const rp = await axios.get(productUrl, { headers: COOLSTUFF_HEADERS, timeout: 12000, maxRedirects: 5 });
          const productHtml: string = rp.data ?? '';
          console.log(`[CoolStuff] DDG producto len=${productHtml.length} url=${productUrl}`);
          const price = extractCoolStuffPrice(productHtml);
          if (price) return price;
        } catch { /* continuar */ }
      }
    } catch { /* DDG falló */ }

    console.log(`[CoolStuff] sin precio`);
    return null;
  } catch (err: unknown) {
    console.error(`[CoolStuff] error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
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
    const numOnly = cardNumber?.split('/')[0].trim();

    // TrollAndToad usa Shopify — la API predictive search devuelve JSON limpio sin bot-block
    // Los precios están en centavos (e.g. 1579 = $15.79) y persisten aunque esté sold out
    const apiUrl = `https://www.trollandtoad.com/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=20&resources[options][fields]=title,variants.title`;
    console.log(`[TrollAndToad] API q="${query}"`);
    const r = await axios.get(apiUrl, { headers: SCRAPER_HEADERS, timeout: 10000 });

    type TnTProduct = { title: string; price: string; url?: string };
    const products: TnTProduct[] = r.data?.resources?.results?.products ?? [];
    console.log(`[TrollAndToad] ${products.length} resultados`);

    if (products.length === 0) {
      console.log(`[TrollAndToad] sin resultados`);
      return null;
    }

    // Filtrar por número de carta si está disponible (buscar en título "095" o "095/088")
    let candidates = products;
    if (numOnly) {
      const filtered = products.filter(p => p.title.includes(numOnly));
      if (filtered.length > 0) candidates = filtered;
    }

    // Preferir Near Mint; si no hay, tomar el primero con precio válido
    const nmFirst = candidates.find(p => /near.?mint|nm/i.test(p.title)) ?? candidates[0];

    if (nmFirst?.price) {
      // suggest.json devuelve precio ya en dólares como string decimal: "13.49" → $13.49
      const val = parseFloat(nmFirst.price);
      if (!isNaN(val) && val > 0 && val < 100000) {
        console.log(`[TrollAndToad] "${nmFirst.title}" → $${val.toFixed(2)}`);
        return `$${val.toFixed(2)}`;
      }
    }

    console.log(`[TrollAndToad] sin precio válido`);
    return null;
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
      if (tienda === 'tcgplayer')
        return res.status(200).json({ tcgplayer: await fetchPrecioTCGPlayer(nombre, setName, cardNumber) });
      if (tienda === 'cardmarket')
        return res.status(200).json({ cardmarket: await fetchPrecioCardMarket(nombre, setName, cardNumber) });
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
  const [tcgplayer, cardmarket, coolstuff, ebay, pricecharting, trollandtoad] =
    await Promise.allSettled([
      fetchPrecioTCGPlayer(nombre, setName, cardNumber),
      fetchPrecioCardMarket(nombre, setName, cardNumber),
      fetchPrecioCoolStuff(nombre, setName, cardNumber),
      fetchPrecioEbay(nombre, setName, cardNumber),
      fetchPrecioPriceCharting(nombre, setName, cardNumber),
      fetchPrecioTrollandToad(nombre, setName, cardNumber),
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

// Devuelve todos los nombres equivalentes en cualquier idioma para un término de búsqueda.
// Permite encontrar "Scream Tail" buscando "colagrito" y viceversa.
async function resolveNames(req: Request, res: Response) {
  const q = (req.query.q as string ?? '').trim();
  const names = await resolveNamesAcrossLanguages(q);
  res.json({ names });
}

export {
  sanitizeCartaInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  resolveNames,
  getPopulares,
  getMejoresVendedores,
  incrementViewCount,
};