
export interface ParsedCard {
  quantity: number;
  name: string;
  set?: string;       // Pokemon: "PAR" / Magic: "ltr"
  number?: string;    // Pokemon: "239" / Magic: "149" or "149a"
  id?: string;        // Digimon: "BT1-009"
  passcode?: number;  // YuGiOh: Konami numeric ID
}

export type DetectedFormat = "pokemon" | "magic" | "yugioh" | "digimon";

export interface ParseError {
  line: number;
  content: string;
}

export interface ParseResult {
  format: DetectedFormat;
  cards: ParsedCard[];
  errors: ParseError[];
}

export function parseDeck(text: string): ParseResult {
  const lines = text.split("\n").map((l) => l.trim());

  if (lines.some((l) => l === "Pokémon:" || l === "Pokemon:" || l === "Trainer:" || l === "Energy:")) {
    return parsePokemon(lines);
  }
  if (lines.some((l) => l === "#main")) {
    return parseYugioh(lines);
  }
  if (lines.some((l) => l === "Deck")) {
    return parseMagic(lines);
  }
  if (lines.some((l) => l.startsWith("//") || /^\[.+\]$/.test(l))) {
    return parseDigimon(lines);
  }

  throw new Error(
    "No se pudo identificar el formato. Verificá que sea un mazo exportado de:\n" +
      "• Pokémon TCG Live  (secciones: Pokémon:, Trainer:, Energy:)\n" +
      "• Yu-Gi-Oh! Master Duel  (línea: #main)\n" +
      "• Magic Arena  (línea: Deck)\n" +
      "• Digimon Card Game Online  (comentarios // o secciones [Main Deck])"
  );
}

function parsePokemon(lines: string[]): ParseResult {
  const SECTIONS = new Set(["Pokémon:", "Pokemon:", "Trainer:", "Energy:"]);
  const cards: ParsedCard[] = [];
  const errors: ParseError[] = [];
  let inSection = false;

  lines.forEach((line, idx) => {
    if (!line) return;
    if (SECTIONS.has(line)) { inSection = true; return; }
    if (line.startsWith("Total Cards:")) return;
    if (!inSection) return;

    // CANTIDAD NOMBRE SET NÚMERO  — SET = 2-4 uppercase letters
    const m = line.match(/^(\d+)\s+(.+?)\s+([A-Z]{2,4})\s+(\d+)$/);
    if (!m) { errors.push({ line: idx + 1, content: line }); return; }
    cards.push({ quantity: +m[1], name: m[2].trim(), set: m[3], number: m[4] });
  });

  return { format: "pokemon", cards, errors };
}

function parseYugioh(lines: string[]): ParseResult {
  const cards: ParsedCard[] = [];
  const errors: ParseError[] = [];
  let inDeck = false;
  const countMap = new Map<number, number>();

  lines.forEach((line, idx) => {
    if (!line) return;
    if (line === "#main" || line === "#extra") { inDeck = true; return; }
    if (line === "#side" || line === "!side") { inDeck = false; return; }
    if (!inDeck) return;

    if (!/^\d+$/.test(line)) { errors.push({ line: idx + 1, content: line }); return; }
    const p = +line;
    countMap.set(p, (countMap.get(p) ?? 0) + 1);
  });

  for (const [passcode, quantity] of countMap) {
    cards.push({ quantity, name: "", passcode });
  }

  return { format: "yugioh", cards, errors };
}

function parseMagic(lines: string[]): ParseResult {
  const cards: ParsedCard[] = [];
  const errors: ParseError[] = [];
  let inDeck = false;

  lines.forEach((line, idx) => {
    if (!line) return;
    if (line === "Deck") { inDeck = true; return; }
    if (line === "Sideboard") return;
    if (!inDeck) return;

    // CANTIDAD NOMBRE (SET) NÚMERO — SET entre paréntesis, NÚMERO puede tener sufijo "a"/"b"
    const m = line.match(/^(\d+)\s+(.+?)\s+\(([A-Z0-9]{2,5})\)\s+(\d+[a-z]?)$/);
    if (!m) { errors.push({ line: idx + 1, content: line }); return; }
    // Scryfall espera set codes en minúsculas
    cards.push({ quantity: +m[1], name: m[2].trim(), set: m[3].toLowerCase(), number: m[4] });
  });

  return { format: "magic", cards, errors };
}

function parseDigimon(lines: string[]): ParseResult {
  const cards: ParsedCard[] = [];
  const errors: ParseError[] = [];

  lines.forEach((line, idx) => {
    if (!line || line.startsWith("//") || /^\[.+\]$/.test(line)) return;

    // ID CANTIDAD NOMBRE  —  ID: letras+dígitos-dígitos (ej: BT1-009, EX2-043)
    const m = line.match(/^([A-Z]{1,4}\d{0,3}-\d{3,4})\s+(\d+)\s+(.+)$/);
    if (!m) { errors.push({ line: idx + 1, content: line }); return; }
    cards.push({ quantity: +m[2], name: m[3].trim(), id: m[1] });
  });

  return { format: "digimon", cards, errors };
}
