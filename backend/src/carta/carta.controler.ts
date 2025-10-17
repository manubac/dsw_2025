import { Request, Response, NextFunction } from "express";
import { orm } from "../shared/db/orm.js";
import { Carta } from "./carta.entity.js";
import { CartaClass } from "./cartaClass.entity.js";
import axios from "axios";

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
    console.log("Sanitised input:", req.body.sanitisedInput); // Log para debug

    const cartaData = { ...req.body.sanitisedInput };

    // Manejar relación con CartaClass
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

    // Si hay una nueva cartaClass, asignarla correctamente
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

async function findFromAPI(req: Request, res: Response) {
  try {
    const { nombre } = req.params;
    const url = `https://pokeapi.co/api/v2/pokemon/${nombre.toLowerCase()}`;

    const response = await axios.get(url);
    const p = response.data;

    // Adaptamos los datos a un formato "tipo carta"
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


export { sanitizeCartaInput, findAll, findOne, add, update, remove, findFromAPI };
