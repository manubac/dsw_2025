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
// Búsqueda de cartas por juego usando APIs públicas
// ============================
const JUEGOS_VALIDOS = ["pokemon", "magic", "yugioh", "digimon"] as const;
type Juego = (typeof JUEGOS_VALIDOS)[number];

// Elimina acentos y normaliza el texto para búsquedas más flexibles
function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Deduplica por nombre solamente: muestra una carta por nombre único.
// Así "Jolteon", "Jolteon-GX" y "Jolteon-EX" aparecen como entradas separadas
// en lugar de mostrar 8 copias de "Jolteon" de distintas colecciones.
function deduplicarPorNombre(cartas: any[]): any[] {
  const seen = new Set<string>();
  return cartas.filter(c => {
    // Deduplicar por nombre + set: "Pikachu ex" en PAR y en SV3 son entradas distintas
    const key = `${c.name.toLowerCase()}|${(c.setId || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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

const PAGE_SIZE = 8;
const POKEMON_PAGE_SIZE = 20;
const POKEMON_FETCH_SIZE = POKEMON_PAGE_SIZE * 3;

// Construye la query para la Pokemon TCG API.
// Busca por nombre de carta. Si se especifica un set (nombre o código), lo agrega como filtro AND.
function buildPokemonQuery(nombre: string, set?: string): string {
  // Normaliza espacios y guiones a wildcards: "pikachu ex" → "pikachu*ex*" → matchea "Pikachu-EX", "Pikachu EX", etc.
  const nombreFuzzy = nombre.trim().replace(/[-\s]+/g, "*");
  const conditions = [`name:*${nombreFuzzy}*`];
  if (set) {
    const s = normalizar(set);
    // set.ptcgoCode es el código de deck builder (PAR, PAF…); set.id es el ID interno (sv4, sv4pt5…)
    conditions.push(`(set.name:*${s}* OR set.id:*${s}* OR set.ptcgoCode:"${s}")`);
  }
  return conditions.join(" ");
}

export async function scrapeCartas(req: Request, res: Response) {
  try {
    const nombreRaw = req.params.nombre as string;
    const juego = (req.params.juego as string)?.toLowerCase() as Juego;
    const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));

    if (!nombreRaw) {
      return res.status(400).json({ message: "Debe indicar un nombre de carta." });
    }
    if (!JUEGOS_VALIDOS.includes(juego)) {
      return res.status(400).json({ message: `Juego inválido. Opciones: ${JUEGOS_VALIDOS.join(", ")}` });
    }

    const nombre = normalizar(nombreRaw);
    const setFiltro = req.query.set as string | undefined;
    let cartas: any[] = [];
    let hasMore = false;

    if (juego === "pokemon") {
      const q = buildPokemonQuery(nombre, setFiltro);
      const r = await axios.get(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=${POKEMON_FETCH_SIZE}&page=${page}`
      );
      const totalCount: number = r.data.totalCount ?? 0;
      const raw = (r.data.data || []).map((card: any) => ({
        name: card.name,
        image: card.images?.small,
        setName: card.set?.name,
        setId: card.set?.id,
      }));
      // Misma carta en el mismo set con distintas rarezas = 1 entrada
      const unicos = deduplicarPorNombre(raw);
      cartas = unicos.slice(0, POKEMON_PAGE_SIZE);
      hasMore = unicos.length > POKEMON_PAGE_SIZE || page * POKEMON_FETCH_SIZE < totalCount;

    } else if (juego === "magic") {
      // Scryfall entiende texto libre: nombres, set codes (e:m10), nombres de set (s:"10th Edition")
      const r = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(nombre)}&unique=cards&page=${page}`
      );
      cartas = (r.data.data || []).map((card: any) => ({
        name: card.name,
        image: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal,
        rarity: card.rarity,
        setName: card.set_name,
      }));
      hasMore = r.data.has_more ?? false;

    } else if (juego === "yugioh") {
      const offset = (page - 1) * PAGE_SIZE;
      const r = await axios.get(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(nombre)}&num=${PAGE_SIZE}&offset=${offset}`
      );
      cartas = (r.data.data || []).map((card: any) => ({
        name: card.name,
        image: card.card_images?.[0]?.image_url,
        rarity: card.card_sets?.[0]?.set_rarity ?? card.type,
        setName: card.card_sets?.[0]?.set_name,
      }));
      const meta = r.data.meta;
      hasMore = meta ? offset + PAGE_SIZE < meta.total_rows : false;

    } else {
      const r = await axios.get(
        `https://digi-api.com/api/v1/digimon?name=${encodeURIComponent(nombre)}&pageSize=${PAGE_SIZE}&page=${page - 1}`
      );
      cartas = (r.data.content || []).map((digi: any) => ({
        name: digi.name,
        image: digi.image,
        rarity: undefined,
        setName: undefined,
      }));
      hasMore = !(r.data.pageable?.last ?? true);
    }

    if (cartas.length === 0 && page === 1) {
      return res.status(404).json({ message: "No se encontraron cartas con ese nombre." });
    }

    return res.status(200).json({ data: cartas, hasMore, page });
  } catch (error: any) {
    console.error("Error durante la búsqueda:", error.message);
    if (error.response?.status === 404) {
      return res.status(404).json({ message: "No se encontraron cartas con ese nombre." });
    }
    return res.status(500).json({ message: "Error al buscar cartas.", error: error.message });
  }
}

// Devuelve todas las rarezas disponibles para una carta en un set específico
// Query params: nombre, set
export async function buscarRarezas(req: Request, res: Response) {
  try {
    const juego = (req.params.juego as string)?.toLowerCase() as Juego;
    const nombreRaw = req.query.nombre as string;
    const setNameRaw = req.query.set as string;

    if (!nombreRaw || !JUEGOS_VALIDOS.includes(juego)) {
      return res.status(400).json({ message: "Parámetros inválidos." });
    }

    const nombre = normalizar(nombreRaw);
    const setName = setNameRaw ? normalizar(setNameRaw) : null;
    let rarezas: any[] = [];

    // Rarezas que tienen versión Reverse Holo en el TCG de Pokemon
    const RAREZAS_CON_REVERSE = new Set([
      "common", "uncommon", "rare", "rare holo",
      "rare holo v", "rare holo vmax", "rare holo vstar",
      "trainer gallery rare holo",
    ]);

    if (juego === "pokemon") {
      // Busca exactamente esta carta en este set
      let query = `name:"${nombre}"`;
      if (setName) query += ` set.name:"${setName}"`;
      const r = await axios.get(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=30`
      );
      // La API de Pokemon TCG trata el guión como separador de tokens (Lucene), por lo que
      // name:"Charizard-EX" también matchea "M Charizard-EX". Filtramos por nombre exacto.
      const cards: any[] = (r.data.data || []).filter(
        (card: any) => normalizar(card.name).toLowerCase() === nombre.toLowerCase()
      );
      rarezas = cards.map((card: any) => ({
        cardId: card.id,
        rarity: card.rarity ?? "Desconocida",
        number: card.number,
        image: card.images?.small,
      }));

      // Agregar la versión Reverse Holo para cada carta que la admite
      // (la API no las lista por separado, pero existen físicamente)
      const reversas = cards
        .filter(card => RAREZAS_CON_REVERSE.has((card.rarity ?? "").toLowerCase()))
        .map(card => ({
          cardId: `${card.id}-reverse`,
          rarity: "Reverse Holo",
          number: card.number,
          image: card.images?.small,
        }));

      rarezas = [...rarezas, ...reversas];

    } else if (juego === "magic") {
      // En Magic (nombre + set) ya determina una única rareza, pero puede haber foil/non-foil
      let q = `!"${nombre}"`;
      if (setName) q += ` s:"${setName}"`;
      const r = await axios.get(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}&unique=prints&page=1`
      );
      rarezas = (r.data.data || []).map((card: any) => ({
        cardId: card.id,
        rarity: card.rarity,
        number: card.collector_number,
        image: card.image_uris?.small ?? card.card_faces?.[0]?.image_uris?.small,
        finish: card.finishes?.join(", "),
        setName: card.set_name,
      }));

    } else if (juego === "yugioh") {
      // Para YGO: buscar la carta y filtrar sus card_sets por el set elegido
      const r = await axios.get(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(nombre)}`
      );
      const card = r.data.data?.[0];
      if (card) {
        const sets: any[] = card.card_sets || [];
        const filtrados = setName
          ? sets.filter(s => normalizar(s.set_name).toLowerCase() === setName.toLowerCase())
          : sets;
        rarezas = filtrados.map((s: any) => ({
          cardId: `${card.id}-${s.set_num}`,
          rarity: s.set_rarity,
          number: s.set_num,
          image: card.card_images?.[0]?.image_url_small,
          setName: s.set_name,
        }));
      }

    } else {
      // Digimon no tiene distinción de rareza
      rarezas = [{ cardId: "unique", rarity: null, image: null }];
    }

    return res.status(200).json({ data: rarezas });
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.status(404).json({ message: "No se encontraron rarezas." });
    }
    return res.status(500).json({ message: "Error al buscar rarezas.", error: error.message });
  }
}

// Resuelve una carta por su identificador canónico (set+número, passcode, id)
// Pokemon:  ?set=PAR&number=239
// Magic:    ?set=ltr&number=149
// YuGiOh:  ?passcode=89631139
// Digimon: ?id=BT1-009  |  ?name=Agumon
export async function resolveCartaByCode(req: Request, res: Response) {
  try {
    const juego = (req.params.juego as string)?.toLowerCase() as Juego;
    if (!JUEGOS_VALIDOS.includes(juego)) {
      return res.status(400).json({ message: "Juego inválido." });
    }

    if (juego === "pokemon") {
      const set       = req.query.set    as string;
      const number    = req.query.number as string;
      const nameHint  = req.query.name   as string | undefined;
      if (!set || !number) return res.status(400).json({ message: "Faltan parámetros set y number." });

      const toCardData = (c: any) => ({
        name:    c.name,
        image:   c.images?.large,
        rarity:  c.rarity,
        setName: c.set?.name,
        setId:   c.set?.id,
        number:  c.number,
      });

      // Paso 1: resolver ptcgoCode → set.id real en pokemontcg.io
      let setId = set.toLowerCase();
      let setResolved = false;
      try {
        const setsRes = await axios.get(
          `https://api.pokemontcg.io/v2/sets?q=ptcgoCode:${encodeURIComponent(set)}&pageSize=1`
        );
        const foundSet = setsRes.data.data?.[0];
        if (foundSet?.id) { setId = foundSet.id; setResolved = true; }
      } catch { /* usamos el código tal cual */ }

      // Paso 2: buscar por set.id + número (todas las variantes de padding)
      const nParsed  = parseInt(number, 10);
      const numVars  = [...new Set([number, String(nParsed), String(nParsed).padStart(2, '0'), String(nParsed).padStart(3, '0')])];
      let card: any  = null;
      for (const num of numVars) {
        try {
          const q = `set.id:${setId} number:${num}`;
          const r = await axios.get(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`);
          card = r.data.data?.[0] ?? null;
          if (card) break;
        } catch { /* continúa */ }
      }

      if (card) return res.json({ data: toCardData(card) });

      // Paso 3: fallback por nombre+número — SOLO cuando el set no fue reconocido por pokemontcg.io.
      // Si el set sí fue reconocido (setResolved=true) pero no hay carta con ese número,
      // no hacemos fallback: evita devolver otra carta con mismo número de distinta colección.
      if (!setResolved && nameHint) {
        const seen = new Map<string, any>();
        for (const num of numVars) {
          try {
            const q2 = `name:"${nameHint}" number:${num}`;
            const r2 = await axios.get(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q2)}&pageSize=20`);
            for (const c of r2.data.data ?? []) seen.set(c.id, c);
          } catch { /* continúa */ }
        }
        const unique = [...seen.values()];
        if (unique.length === 1) return res.json({ data: toCardData(unique[0]) });
        if (unique.length  > 1) return res.json({ candidates: unique.map(toCardData) });
      }

      return res.status(404).json({ message: "Carta no encontrada." });
    }

    if (juego === "magic") {
      const set = (req.query.set as string)?.toLowerCase();
      const number = req.query.number as string;
      if (!set || !number) return res.status(400).json({ message: "Faltan parámetros set y number." });

      const r = await axios.get(`https://api.scryfall.com/cards/${set}/${number}`);
      const card = r.data;
      return res.json({
        data: {
          name: card.name,
          image: card.image_uris?.large ?? card.card_faces?.[0]?.image_uris?.large,
          rarity: card.rarity,
          setName: card.set_name,
          setId: card.set,
        },
      });
    }

    if (juego === "yugioh") {
      const passcode = req.query.passcode as string;
      if (!passcode) return res.status(400).json({ message: "Falta parámetro passcode." });

      const r = await axios.get(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${encodeURIComponent(passcode)}`
      );
      const card = r.data.data?.[0];
      if (!card) return res.status(404).json({ message: "Carta no encontrada." });
      return res.json({
        data: {
          name: card.name,
          image: card.card_images?.[0]?.image_url,
          rarity: card.card_sets?.[0]?.set_rarity ?? card.type,
          setName: card.card_sets?.[0]?.set_name,
        },
      });
    }

    if (juego === "digimon") {
      const id = req.query.id as string;
      const name = req.query.name as string;
      if (!id && !name) return res.status(400).json({ message: "Falta parámetro id o name." });

      // Intentar lookup por cardNumber; si no existe, buscar por nombre
      const url = id
        ? `https://digi-api.com/api/v1/digimon?cardNumber=${encodeURIComponent(id)}&pageSize=1`
        : `https://digi-api.com/api/v1/digimon?name=${encodeURIComponent(name)}&pageSize=1`;
      const r = await axios.get(url);
      const card = r.data.content?.[0];
      if (!card) return res.status(404).json({ message: "Carta no encontrada." });
      return res.json({
        data: {
          name: card.name,
          image: card.image,
          rarity: undefined,
          setName: undefined,
        },
      });
    }
  } catch (error: any) {
    if (error.response?.status === 404) {
      return res.status(404).json({ message: "Carta no encontrada." });
    }
    return res.status(500).json({ message: "Error al resolver la carta.", error: error.message });
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