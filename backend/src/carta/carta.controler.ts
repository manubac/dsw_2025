import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Carta } from "./carta.entity.js";
import { CartaClass } from "./cartaClass.entity.js";
import axios from "axios";
import puppeteer from "puppeteer-core";
import * as chrome from "chrome-launcher"; // ✅ Import correcto para ESM


import fs from "fs"; // opcional si querés guardar en archivo


const em = orm.em;

// Middleware para sanitizar la entrada
function sanitizeCartaInput(req: Request, res: Response, next: NextFunction) {
  req.body.sanitisedInput = {
    name: req.body.name,
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
    const cartas = await em.find(Carta, {}, { populate: ["cartaClass", "items"] });
    res.status(200).json({ message: "Found all cartas", data: cartas });
  } catch (error: any) {
    console.error("Error fetching cartas:", error);
    res.status(500).json({ message: "Error fetching cartas", error: error.message });
  }
}

// Obtener una carta por ID
async function findOne(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const carta = await em.findOneOrFail(Carta, { id }, { populate: ["cartaClass", "items"] });
    res.status(200).json({ message: "Found one carta", data: carta });
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
    const carta = await em.findOneOrFail(Carta, { id });

    await em.removeAndFlush(carta);
    res.status(200).json({ message: "Carta deleted" });
  } catch (error: any) {
    console.error("Error deleting carta:", error);
    res.status(500).json({ message: "Error deleting carta", error: error.message });
  }
}

// Buscar cartas Pokémon (PokeAPI)
async function findFromAPI(req: Request, res: Response) {
  try {
    const { nombre } = req.params;
    const url = `https://pokeapi.co/api/v2/pokemon/${nombre.toLowerCase()}`;

    const response = await axios.get(url);
    const p = response.data;

    const result = {
      nombre: p.name,
      tipo: p.types?.map((t: any) => t.type.name).join(", ") || "Desconocido",
      hp: p.stats?.find((s: any) => s.stat.name === "hp")?.base_stat || 0,
      ataque: p.stats?.find((s: any) => s.stat.name === "attack")?.base_stat || 0,
      defensa: p.stats?.find((s: any) => s.stat.name === "defense")?.base_stat || 0,
      velocidad: p.stats?.find((s: any) => s.stat.name === "speed")?.base_stat || 0,
      imagen: p.sprites?.other?.["official-artwork"]?.front_default || p.sprites?.front_default,
    };

    return res.json(result);
  } catch (error: any) {
    console.error("Error al buscar Pokémon en la API externa:", error.message);

    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: "No se encontró ningún Pokémon con ese nombre." });
    }

    return res.status(500).json({ message: "Error al consultar la API externa." });
  }
}









// ============================
// 🔹 Scrape cartas desde CoolStuffInc
// ============================
async function scrapeCartas(req: Request, res: Response) {
  try {
    const { nombre } = req.params;

    if (!nombre) {
      return res.status(400).json({ message: "Debe indicar un nombre de carta." });
    }

    const url = `https://www.coolstuffinc.com/main_search.php?pa=searchOnName&page=1&resultsPerPage=25&q=${encodeURIComponent(
      nombre
    )}`;

    console.log(`🔎 Buscando cartas con nombre "${nombre}" en CoolStuffInc...`);

    // Detectar instalación de Chrome
    const chromePaths = chrome.Launcher.getInstallations();
    if (!chromePaths.length) {
      return res.status(500).json({
        message: "No se encontró una instalación de Google Chrome en el sistema.",
      });
    }

    const chromePath = chromePaths[0];
    console.log("🟢 Chrome detectado en:", chromePath);

    // Iniciar Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: chromePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    console.log("⌛ Esperando que carguen los resultados...");
    await page.waitForSelector(".row.product-search-row.main-container", {
      timeout: 60000,
    });

    // =============================
    // 📦 Extraer datos
    // =============================
    const cartas = await page.evaluate(() => {
      const productos = document.querySelectorAll(
        ".row.product-search-row.main-container"
      );
      const resultados: any[] = [];

      productos.forEach((prod) => {
        const nombre =
          prod.querySelector(".product-name")?.textContent?.trim() ||
          prod.querySelector("img")?.alt?.trim() ||
          "Sin nombre";

        const precio =
          prod.querySelector(".darkred b")?.textContent?.trim() ||
          prod.querySelector(".price")?.textContent?.trim() ||
          "Sin precio";

        const enlace = (prod.querySelector(".productLink") as HTMLAnchorElement)?.href || "Sin enlace";
        const imagen = (prod.querySelector("img[itemprop='image']") as HTMLImageElement)?.src || null;

        // 🧩 Nuevo: nombre del set
        const setName =
          prod.querySelector(".breadcrumb-trail")?.textContent?.trim() || null;

        // 💎 Nuevo: rareza
        const rareza =
          prod.querySelector(".large-12.medium-12.small-12:nth-of-type(2)")?.textContent?.trim() || null;

        resultados.push({ nombre, precio, enlace, imagen, setName, rareza });
      });

      return resultados;
    });

    await browser.close();

    if (!cartas || cartas.length === 0) {
      return res.status(404).json({
        message: "No se encontraron cartas o cambió el selector en la web.",
      });
    }

    console.log(`✅ Se encontraron ${cartas.length} cartas para "${nombre}".`);

    return res.status(200).json({
      message: `Scraping completado (${cartas.length} resultados).`,
      data: cartas,
    });
  } catch (error: any) {
    console.error("❌ Error durante el scraping:", error.message);
    return res.status(500).json({
      message: "Error al realizar scraping de CoolStuffInc.",
      error: error.message,
    });
  }
}

 
export {
  sanitizeCartaInput,
  findAll,
  findOne,
  add,
  update,
  remove,
  findFromAPI,
  scrapeCartas,
};
