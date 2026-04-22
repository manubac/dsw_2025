
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "../context/user";
import { api, fetchApi } from "../services/api";
import { searchCards, getCardRarities, resolveCard, type GameSlug } from "../services/tcg";
import { CardScanner, type ScannedCard } from "../components/CardScanner/CardScanner";
import { ScanLine, ListPlus, X, ChevronRight, Loader2, CheckCircle2, AlertCircle, Upload, ExternalLink } from "lucide-react";
import { type ParsedCard, type DetectedFormat } from "../utils/deckParsers";

type Juego = "pokemon" | "magic" | "yugioh" | "digimon" | "riftbound";

interface CartaResultado {
  name: string;
  image?: string;
  rarity?: string;
  setName?: string;
  setId?: string;
  number?: string;
}

function toSlug(juego: Juego): GameSlug {
  return juego === "magic" ? "mtg" : juego === "yugioh" ? "ygo" : juego as GameSlug;
}

interface Rareza {
  cardId: string;
  rarity?: string;
  number?: string;
  image?: string;
  finish?: string;
  setName?: string;
}

interface CartaClass {
  id: number;
  name: string;
}

interface QueueItem {
  uid: string;
  parsed: ParsedCard;
  format: DetectedFormat;
  status: "loading" | "found" | "not_found" | "ambiguous";
  carta?: CartaResultado & { rarity?: string };
  candidates?: CartaResultado[];
  price: string;
  quantity: number;
  checked: boolean;
  published?: boolean;
  publishError?: string;
  rarezas?: Rareza[];
  rarezasLoading?: boolean;
  rarezaElegida?: Rareza | null;
}

type PriceSiteKey = "coolstuff" | "tcgplayer" | "cardmarket" | "ebay" | "pricecharting" | "trollandtoad";
const PRICE_SITES: { key: PriceSiteKey; label: string }[] = [
  { key: "coolstuff",    label: "CoolStuffInc" },
  { key: "tcgplayer",   label: "TCGPlayer" },
  { key: "cardmarket",  label: "Cardmarket" },
  { key: "ebay",        label: "eBay" },
  { key: "pricecharting", label: "PriceCharting" },
  { key: "trollandtoad", label: "Troll & Toad" },
];

const JUEGOS: { value: Juego; label: string }[] = [
  { value: "pokemon",   label: "Pokémon TCG"         },
  { value: "magic",     label: "Magic: The Gathering" },
  { value: "yugioh",    label: "Yu-Gi-Oh!"            },
  { value: "digimon",   label: "Digimon TCG"          },
  { value: "riftbound", label: "Riftbound (LoL)"      },
];

const PLACEHOLDERS: Record<Juego, string> = {
  pokemon:   "Pikachu, Charizard...",
  magic:     "Lightning Bolt, Black Lotus...",
  yugioh:    "Blue-Eyes, Dark Magician...",
  digimon:   "Agumon, Gabumon...",
  riftbound: "Jinx, Yasuo, Ahri...",
};

export default function PublicarCartaPage() {
  const [juego, setJuego] = useState<Juego>("pokemon");
  const [nombre, setNombre] = useState("");
  const [expansion, setExpansion] = useState("");
  const [resultados, setResultados] = useState<CartaResultado[]>([]);
  const [nombresVistos, setNombresVistos] = useState<Set<string>>(new Set());
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [cartaClasses, setCartaClasses] = useState<CartaClass[]>([]);

  // Modal de rarezas
  const [modalCarta, setModalCarta] = useState<CartaResultado | null>(null);
  const [rarezas, setRarezas] = useState<Rareza[]>([]);
  const [cargandoRarezas, setCargandoRarezas] = useState(false);
  const [rarezaElegida, setRarezaElegida] = useState<Rareza | null>(null);
  const [precioCoolStuff, setPrecioCoolStuff] = useState<string | null | "cargando">(null);

  type PreciosPokemon = { coolstuff: string | null; tcgplayer: string | null; cardmarket: string | null; ebay: string | null; pricecharting: string | null; trollandtoad: string | null; };
  const [preciosPokemon, setPreciosPokemon] = useState<PreciosPokemon | "cargando" | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [identifyCardId, setIdentifyCardId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Cola de importación masiva ---
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [applyingPrices, setApplyingPrices] = useState(false);
  const [bulkPublishing, setBulkPublishing] = useState(false);
  const [bundleAll, setBundleAll] = useState(false);
  const rarezasLoadingSet = useRef(new Set<string>());

  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [cargandoSugerencias, setCargandoSugerencias] = useState(false);

  const [selectedPriceSite, setSelectedPriceSite] = useState<PriceSiteKey>("coolstuff");

  // Estado del popup de rareza (hold-to-open)
  interface RarityPopupState { uid: string; anchorRect: DOMRect; hoveredIdx: number | null; rarezas: Rareza[]; }
  const [rarityPopup, setRarityPopup] = useState<RarityPopupState | null>(null);
  const rarityHoveredRef = useRef<{ idx: number | null; rareza: Rareza | null }>({ idx: null, rareza: null });
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdFiredRef = useRef(false);

  const busquedaRef = useRef({ nombre: "", juego: "pokemon" as Juego, expansion: "" });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sugerenciasRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const { user } = useUser();

  useEffect(() => {
    fetchApi("/api/cartas/classes")
      .then(r => r.json())
      .then(d => setCartaClasses(d.data ?? []))
      .catch(() => {});
  }, []);

  const cargarPagina = useCallback(async (
    nombreBusqueda: string,
    juegoBusqueda: Juego,
    expansionBusqueda: string,
    pagina: number,
    reemplazar: boolean,
    vistos: Set<string>
  ) => {
    if (reemplazar) setCargando(true);
    else setCargandoMas(true);

    try {
      const result = await searchCards(toSlug(juegoBusqueda), nombreBusqueda, {
        set: expansionBusqueda.trim() || undefined,
        page: pagina,
      });

      const cardKey = (c: CartaResultado) =>
        `${c.name.toLowerCase()}|${(c.setId ?? "").toLowerCase()}`;
      const nuevas: CartaResultado[] = result.cards
        .map(c => ({ name: c.name, image: c.imageUrl, rarity: c.rarity, setName: c.setName, setId: c.set, number: c.number }))
        .filter(c => !vistos.has(cardKey(c)));

      if (nuevas.length === 0 && pagina === 1) {
        if (reemplazar) setMensaje("No se encontraron resultados.");
        setHasMore(false);
        return;
      }

      const nuevosVistos = new Set(vistos);
      nuevas.forEach(c => nuevosVistos.add(cardKey(c)));

      setResultados(prev => reemplazar ? nuevas : [...prev, ...nuevas]);
      setNombresVistos(nuevosVistos);
      setHasMore(result.hasMore);
      setPage(pagina);
    } catch {
      if (reemplazar) setMensaje("No se pudo conectar con la API de cartas.");
    } finally {
      setCargando(false);
      setCargandoMas(false);
    }
  }, []);

  // Autocomplete: debounce de 350ms, mínimo 2 caracteres
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = nombre.trim();
    if (trimmed.length < 2) {
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setCargandoSugerencias(true);
      try {
        const result = await searchCards(toSlug(juego), trimmed, { page: 1 });
        const nombres = [...new Set<string>(result.cards.map(c => c.name))].slice(0, 8);
        setSugerencias(nombres);
        setMostrarSugerencias(nombres.length > 0);
      } catch {
        setSugerencias([]);
      } finally {
        setCargandoSugerencias(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [nombre, juego]);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sugerenciasRef.current && !sugerenciasRef.current.contains(e.target as Node)) {
        setMostrarSugerencias(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-carga rarezas cuando una carta pasa a "found" (Pokémon)
  useEffect(() => {
    const toLoad = queue.filter(it =>
      it.format === "pokemon" &&
      it.status === "found" &&
      it.carta &&
      !it.rarezas &&
      !it.rarezasLoading &&
      !rarezasLoadingSet.current.has(it.uid)
    );
    toLoad.forEach(it => {
      rarezasLoadingSet.current.add(it.uid);
      loadRarezas(it.uid, it.carta!).finally(() => rarezasLoadingSet.current.delete(it.uid));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  // Popup de rareza: seleccionar al soltar el mouse
  useEffect(() => {
    if (!rarityPopup) return;
    const handleMouseUp = () => {
      const { rareza } = rarityHoveredRef.current;
      const uid = rarityPopup.uid;
      if (rareza) {
        setQueue(prev => prev.map(it => it.uid === uid ? { ...it, rarezaElegida: rareza } : it));
      }
      rarityHoveredRef.current = { idx: null, rareza: null };
      setRarityPopup(null);
    };
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rarityPopup?.uid]);

  const buscarCartas = async (nombreOverride?: string) => {
    const n = (nombreOverride ?? nombre).trim();
    if (!n) return;
    setMostrarSugerencias(false);
    setResultados([]);
    setNombresVistos(new Set());
    setMensaje("");
    setHasMore(false);

    // Detectar patrón con código de set → intentar resolve directo
    // Si falla, usar el nombre extraído como búsqueda (no el string completo)
    let nombreFallback = n;
    let expansionFallback = expansion;
    let intentoDirecto = false;

    if (juego === "pokemon") {
      // Acepta "Charmander MEW 4"  o  "MEW 4"  (nombre opcional)
      const m = n.match(/^(?:(.+?)\s+)?([A-Z][A-Z0-9]{1,7})\s+(\d+)$/);
      if (m) {
        intentoDirecto = true;
        nombreFallback    = m[1] ?? '';  // puede estar vacío
        expansionFallback = m[2];
      }
    } else if (juego === "magic") {
      const m = n.match(/^(.+?)\s+\(([A-Z0-9]{2,5})\)\s+(\d+[a-z]?)$/);
      if (m) { intentoDirecto = true; nombreFallback = m[1]; }
    } else if (juego === "yugioh") {
      if (/^\d{6,10}$/.test(n)) intentoDirecto = true;
    } else if (juego === "digimon") {
      if (/^[A-Z]{1,4}\d{0,3}-\d{3,4}$/.test(n)) intentoDirecto = true;
    }

    if (intentoDirecto) {
      busquedaRef.current = { nombre: n, juego, expansion };
      setCargando(true);
      const directa = await tryResolveDirectly(n, juego);
      setCargando(false);
      if (directa) {
        setResultados([directa]);
        setNombresVistos(new Set([directa.name.toLowerCase()]));
        return;
      }
      // Resolve falló → buscar con el nombre extraído + set como filtro
    }

    busquedaRef.current = { nombre: nombreFallback, juego, expansion: expansionFallback };
    const vistos = new Set<string>();
    setNombresVistos(vistos);
    await cargarPagina(nombreFallback, juego, expansionFallback, 1, true, vistos);
  };

  const seleccionarSugerencia = (sugerencia: string) => {
    setNombre(sugerencia);
    setMostrarSugerencias(false);
    setSugerencias([]);
    buscarCartas(sugerencia);
  };

  // IntersectionObserver para infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !cargandoMas) {
          const { nombre: n, juego: j, expansion: e } = busquedaRef.current;
          cargarPagina(n, j, e, page + 1, false, nombresVistos);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, cargandoMas, page, nombresVistos, cargarPagina]);

  // Abre el modal.
  // Pokemon: carga rarezas disponibles para (carta + set).
  // Otros juegos: la carta ya es única, solo busca precio de CoolStuffInc directamente.
  const abrirModal = async (carta: CartaResultado) => {
    setModalCarta(carta);
    setRarezas([]);
    setRarezaElegida(null);
    setPrecioCoolStuff(null);
    setPreciosPokemon(null);

    setCargandoRarezas(true);
    try {
      // Para Pokémon filtramos por set (cada entrada del grid es set-específica).
      // Para el resto queremos TODAS las variantes/ediciones — no pasamos setName.
      const variants = await getCardRarities(
        toSlug(juego),
        carta.name,
        juego === "pokemon" ? carta.setName : undefined
      );
      setRarezas(variants.map(v => ({
        cardId: v.cardId,
        rarity: v.rarity,
        number: v.number,
        image: v.imageUrl,
        finish: v.finish,
        setName: v.setName,
      })));
    } catch {
      setRarezas([]);
    } finally {
      setCargandoRarezas(false);
    }
  };

  // Solo para Pokemon: al elegir rareza busca precios en todas las tiendas
  const elegirRareza = async (r: Rareza) => {
    setRarezaElegida(r);
    setPreciosPokemon("cargando");
    try {
      const params = new URLSearchParams({ nombre: modalCarta!.name });
      if (modalCarta!.setName) params.set("set", modalCarta!.setName);
      if (r.rarity) params.set("rareza", r.rarity);
      const resp = await fetchApi(`/api/cartas/precios-pokemon?${params}`);
      const data = await resp.json();
      setPreciosPokemon(data);
      setPrecioCoolStuff(data.coolstuff ?? null);
    } catch {
      setPreciosPokemon(null);
      setPrecioCoolStuff(null);
    }
  };

  // Para juegos no-Pokémon: selecciona una variante/reimpresión sin buscar precios
  const seleccionarVariante = (r: Rareza) => {
    setRarezaElegida(r);
  };

  // Añade la carta seleccionada del modal a la cola (sin publicar todavía)
  const agregarACola = () => {
    if (!user || !modalCarta) return;
    if (juego === "pokemon" && !rarezaElegida) return;

    const juegoLabel = JUEGOS.find(j => j.value === juego)?.label ?? juego;
    const cartaClassMatch = cartaClasses.find(cc =>
      cc.name.toLowerCase().includes(juego) ||
      cc.name.toLowerCase().includes(juegoLabel.toLowerCase().split(":")[0].trim())
    );
    void cartaClassMatch; // usado en publishQueueItem por format

    const precioFinal = (() => {
      if (typeof preciosPokemon !== "string" && preciosPokemon?.coolstuff) return preciosPokemon.coolstuff;
      if (typeof precioCoolStuff === "string" && precioCoolStuff !== "cargando") return precioCoolStuff;
      return "";
    })();

    const carta: CartaResultado = {
      name: modalCarta.name,
      image: rarezaElegida?.image ?? modalCarta.image,
      rarity: rarezaElegida?.rarity ?? modalCarta.rarity,
      setName: rarezaElegida?.setName ?? modalCarta.setName,
      setId: modalCarta.setId,
      number: rarezaElegida?.number ?? modalCarta.number,
    };

    const newItem: QueueItem = {
      uid: `grid-${Date.now()}`,
      parsed: { quantity: 1, name: modalCarta.name, set: modalCarta.setId, number: modalCarta.number },
      format: juego as DetectedFormat,
      status: "found",
      carta,
      rarezaElegida: rarezaElegida,
      rarezas: rarezas.length > 0 ? rarezas : undefined,
      price: precioFinal,
      quantity: 1,
      checked: true,
    };

    setQueue(prev => [...prev, newItem]);
    setModalCarta(null);
    setRarezaElegida(null);
    setRarezas([]);
    setPrecioCoolStuff(null);
    setPreciosPokemon(null);
    setPanelOpen(true);
  };

  const crearCartaManual = () => {
    if (!user) { setMensaje("Debes iniciar sesión como vendedor."); return; }
    navigate("/editar-carta", { state: { carta: { name: "", uploader: { id: user.id } } } });
  };

  // Detecta si el texto ingresado es un código exacto (nombre+set+número, passcode, id)
  // y resuelve directamente la carta sin pasar por la búsqueda general.
  // Patrones:
  //   Pokemon:  "Pikachu ex PAR 239"      → set=PAR  number=239
  //   Magic:    "Lightning Bolt (LTR) 149" → set=ltr  number=149
  //   YuGiOh:  "89631139"                 → passcode numérico de 6-10 dígitos
  //   Digimon:  "BT1-009"                 → id con formato XX#-###
  const tryResolveDirectly = async (texto: string, juegoActual: Juego): Promise<CartaResultado | null> => {
    let rParams: { set?: string; number?: string; passcode?: string; id?: string; name?: string } | null = null;

    if (juegoActual === "pokemon") {
      const m = texto.match(/^(?:(.+?)\s+)?([A-Z][A-Z0-9]{1,7})\s+(\d+)$/);
      if (!m) return null;
      rParams = { set: m[2], number: m[3], name: m[1] ?? undefined };
    } else if (juegoActual === "magic") {
      const m = texto.match(/^(.+?)\s+\(([A-Z0-9]{2,5})\)\s+(\d+[a-z]?)$/);
      if (!m) return null;
      rParams = { set: m[2].toLowerCase(), number: m[3] };
    } else if (juegoActual === "yugioh") {
      if (!/^\d{6,10}$/.test(texto)) return null;
      rParams = { passcode: texto };
    } else if (juegoActual === "digimon") {
      if (!/^[A-Z]{1,4}\d{0,3}-\d{3,4}$/.test(texto)) return null;
      rParams = { id: texto };
    } else {
      return null;
    }

    try {
      const result = await resolveCard(toSlug(juegoActual), rParams);
      if (!result) return null;
      const card = Array.isArray(result) ? result[0] : result;
      return { name: card.name, image: card.imageUrl, rarity: card.rarity, setName: card.setName, setId: card.set, number: card.number };
    } catch {
      return null;
    }
  };

  const resolveItem = useCallback(async (item: QueueItem): Promise<QueueItem> => {
    try {
      const p = item.parsed;
      const fmt = item.format as Juego;
      const rParams: { set?: string; number?: string; passcode?: string; id?: string; name?: string } = {};
      if (fmt === "pokemon" && p.set && p.number) {
        rParams.set = p.set; rParams.number = p.number; if (p.name) rParams.name = p.name;
      } else if (fmt === "magic" && p.set && p.number) {
        rParams.set = p.set; rParams.number = p.number;
      } else if (fmt === "yugioh" && p.passcode !== undefined) {
        rParams.passcode = String(p.passcode);
      } else if (fmt === "digimon") {
        if (p.id) rParams.id = p.id;
        else if (p.name) rParams.name = p.name;
      }

      const result = await resolveCard(toSlug(fmt), rParams);
      if (!result) return { ...item, status: "not_found" };
      if (Array.isArray(result)) {
        return { ...item, status: "ambiguous", candidates: result.map(c => ({ name: c.name, image: c.imageUrl, rarity: c.rarity, setName: c.setName, setId: c.set, number: c.number })) };
      }
      return { ...item, status: "found", carta: { name: result.name, image: result.imageUrl, rarity: result.rarity, setName: result.setName, setId: result.set, number: result.number } };
    } catch {
      return { ...item, status: "not_found" };
    }
  }, []);

  // ─── Rareza helpers ────────────────────────────────────────────────────────

  function preselectRareza(rarezas: Rareza[]): Rareza | null {
    if (rarezas.length === 0) return null;
    const common = rarezas.find(r => r.rarity?.toLowerCase() === "common");
    if (common) return common;
    const reverse = rarezas.find(r => r.rarity?.toLowerCase().includes("reverse"));
    if (reverse) return reverse;
    return rarezas[0];
  }

  const loadRarezas = async (uid: string, carta: CartaResultado) => {
    setQueue(prev => prev.map(it => it.uid === uid ? { ...it, rarezasLoading: true } : it));
    try {
      const variants = await getCardRarities('pokemon', carta.name, carta.setName);
      const rarezas: Rareza[] = variants.map(v => ({
        cardId: v.cardId,
        rarity: v.rarity,
        number: v.number,
        image: v.imageUrl,
        finish: v.finish,
        setName: v.setName,
      }));
      const rarezaElegida = preselectRareza(rarezas);
      setQueue(prev => prev.map(it =>
        it.uid === uid ? { ...it, rarezas, rarezaElegida, rarezasLoading: false } : it
      ));
    } catch {
      setQueue(prev => prev.map(it => it.uid === uid ? { ...it, rarezasLoading: false } : it));
    }
  };

  const cycleRareza = (uid: string, rarezas: Rareza[], current: Rareza | null) => {
    if (rarezas.length <= 1) return;
    const idx = current ? rarezas.findIndex(r => r.cardId === current.cardId) : -1;
    const next = rarezas[(idx + 1) % rarezas.length];
    setQueue(prev => prev.map(it => it.uid === uid ? { ...it, rarezaElegida: next } : it));
  };

  // ─── Handlers del chip de rareza ───────────────────────────────────────────

  const handleRarezaMouseDown = (e: React.MouseEvent, uid: string, item: QueueItem) => {
    e.preventDefault();
    holdFiredRef.current = false;
    rarityHoveredRef.current = { idx: null, rareza: null };
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    holdTimerRef.current = setTimeout(() => {
      holdFiredRef.current = true;
      if (item.rarezas && item.rarezas.length > 0) {
        setRarityPopup({ uid, anchorRect: rect, hoveredIdx: null, rarezas: item.rarezas });
      }
      holdTimerRef.current = null;
    }, 280);
  };

  const handleRarezaMouseUp = (uid: string, item: QueueItem) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdFiredRef.current) return; // el popup cierra y selecciona vía mouseup global
    // Click corto: cargar rarezas si no hay, o ciclar
    if (!item.rarezas && !item.rarezasLoading && item.carta) {
      loadRarezas(uid, item.carta);
    } else if (item.rarezas) {
      cycleRareza(uid, item.rarezas, item.rarezaElegida ?? null);
    }
  };

  const handleRarezaHover = (idx: number, rareza: Rareza) => {
    rarityHoveredRef.current = { idx, rareza };
    setRarityPopup(prev => prev ? { ...prev, hoveredIdx: idx } : null);
  };

  // Parsea una línea suelta en el formato del juego activo
  const parseSingleLine = (line: string, j: Juego): ParsedCard | null => {
    if (j === "pokemon") {
      // "4 Pikachu ex PAR 239"  o  "Pikachu ex PAR 239"
      const m = line.match(/^(?:(\d+)\s+)?(.+?)\s+([A-Z][A-Z0-9]{1,7})\s+(\d+)$/);
      if (!m) return null;
      return { quantity: m[1] ? +m[1] : 1, name: m[2].trim(), set: m[3], number: m[4] };
    }
    if (j === "magic") {
      // "4 Lightning Bolt (LTR) 149"  o  "Lightning Bolt (LTR) 149"
      const m = line.match(/^(?:(\d+)\s+)?(.+?)\s+\(([A-Z0-9]{2,5})\)\s+(\d+[a-z]?)$/);
      if (!m) return null;
      return { quantity: m[1] ? +m[1] : 1, name: m[2].trim(), set: m[3].toLowerCase(), number: m[4] };
    }
    if (j === "yugioh") {
      // Solo el passcode numérico
      if (/^\d{6,10}$/.test(line)) return { quantity: 1, name: "", passcode: +line };
      return null;
    }
    if (j === "riftbound") return null; // sin formato estándar de importación
    if (j === "digimon") {
      // "BT1-009 4 Agumon"  o  "BT1-009"
      const m = line.match(/^([A-Z]{1,4}\d{0,3}-\d{3,4})\s+(\d+)\s+(.+)$/);
      if (m) return { quantity: +m[2], name: m[3].trim(), id: m[1] };
      const m2 = line.match(/^([A-Z]{1,4}\d{0,3}-\d{3,4})$/);
      if (m2) return { quantity: 1, name: "", id: m2[1] };
      return null;
    }
    return null;
  };

  const handleImportFromClipboard = async () => {
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      setMensaje("No se pudo leer el portapapeles. Habilitá el permiso de acceso al clipboard.");
      return;
    }

    if (!text.trim()) { setMensaje("El portapapeles está vacío."); return; }

    // Ignorar cabeceras de secciones, comentarios y líneas vacías
    const SKIP = new Set(["Pokémon:", "Pokemon:", "Trainer:", "Energy:", "Deck", "Sideboard", "#main", "#extra", "#side", "!side"]);
    const lines = text.split("\n").map((l) => l.trim()).filter(
      (l) => l && !SKIP.has(l) && !l.startsWith("//") && !l.startsWith("Total Cards:") && !l.startsWith("#")
    );

    const parsed: ParsedCard[] = [];
    for (const line of lines) {
      const card = parseSingleLine(line, juego);
      if (card) parsed.push(card);
    }

    if (parsed.length === 0) {
      setMensaje(`No se encontraron cartas del formato ${JUEGOS.find(j => j.value === juego)?.label} en el portapapeles.`);
      return;
    }

    const fmt = juego as DetectedFormat;
    const newItems: QueueItem[] = parsed.flatMap((p, pi) =>
      Array.from({ length: p.quantity }, (_, i) => ({
        uid: `${Date.now()}-${pi}-${i}`,
        parsed: p,
        format: fmt,
        status: "loading" as const,
        price: "",
        quantity: 1,
        checked: true,
      }))
    );

    setQueue((prev) => [...prev, ...newItems]);

    const BATCH = 5;
    for (let i = 0; i < newItems.length; i += BATCH) {
      const batch = newItems.slice(i, i + BATCH);
      const resolved = await Promise.all(batch.map(resolveItem));
      setQueue((prev) => {
        const map = new Map(resolved.map((r) => [r.uid, r]));
        return prev.map((it) => map.get(it.uid) ?? it);
      });
    }
  };

  const applyAllPrices = async () => {
    // Capturar snapshot actual para no depender de closure stale
    const snapshot = queue.filter(it => it.status === "found" && !it.published && !!it.carta);
    if (snapshot.length === 0) return;

    setApplyingPrices(true);
    setQueue((prev) => prev.map((it) =>
      it.status === "found" && !it.published ? { ...it, price: "…" } : it
    ));

    const site = selectedPriceSite; // fijar sitio al momento de iniciar

    for (const item of snapshot) {
      let precio = "";
      try {
        const params = new URLSearchParams({ nombre: item.carta!.name });
        if (item.carta!.setName) params.set("set", item.carta!.setName);
        const rarity = item.rarezaElegida?.rarity ?? item.carta!.rarity;
        if (rarity) params.set("rareza", rarity);

        const res = await fetchApi(`/api/cartas/precios-pokemon?${params}`);
        if (res.ok) {
          const data = await res.json();
          precio = (data[site] as string | null) ?? "";
        }

        // Fallback a precio-coolstuff si el sitio es coolstuff y precios-pokemon no devolvió nada
        if (!precio && site === "coolstuff") {
          const res2 = await fetchApi(`/api/cartas/precio-coolstuff?${params}`);
          if (res2.ok) {
            const d2 = await res2.json();
            precio = (d2.precio as string | null) ?? "";
          }
        }
      } catch { /* precio queda "" */ }

      setQueue((prev) =>
        prev.map((it) => (it.uid === item.uid ? { ...it, price: precio } : it))
      );
    }
    setApplyingPrices(false);
  };

  const publishQueueItem = async (item: QueueItem) => {
    if (!user || !item.carta) return;
    const juegoLabel = JUEGOS.find((j) => j.value === item.format)?.label ?? item.format;
    const cartaClassMatch = cartaClasses.find(
      (cc) =>
        cc.name.toLowerCase().includes(item.format) ||
        cc.name.toLowerCase().includes(juegoLabel.toLowerCase().split(":")[0].trim())
    );
    try {
      await api.post("/api/cartas", {
        name: item.carta.name,
        price: item.price || null,
        link: null,
        rarity: item.rarezaElegida?.rarity ?? item.carta.rarity ?? null,
        setName: item.rarezaElegida?.setName ?? item.carta.setName ?? null,
        setCode: item.carta.setId ?? null,
        cardNumber: item.rarezaElegida?.number ?? item.carta.number ?? null,
        cartaClass: cartaClassMatch?.id ?? null,
        userId: user.id,
      });
      setQueue((prev) =>
        prev.map((it) => (it.uid === item.uid ? { ...it, published: true, publishError: undefined } : it))
      );
    } catch {
      setQueue((prev) =>
        prev.map((it) => (it.uid === item.uid ? { ...it, publishError: "Error al publicar" } : it))
      );
    }
  };

  const publishAllChecked = async () => {
    setBulkPublishing(true);
    const pending = queue.filter((it) => it.checked && it.status === "found" && !it.published && it.carta);

    if (bundleAll && pending.length > 0) {
      // Publicación única: sumatoria de (precio × cantidad)
      const parsePrice = (p: string) => parseFloat(p.replace(/[^0-9.]/g, "")) || 0;
      const total = pending.reduce((acc, it) => acc + parsePrice(it.price) * it.quantity, 0);
      const juegoLabel = JUEGOS.find(j => j.value === pending[0].format)?.label ?? pending[0].format;
      const cartaClassMatch = cartaClasses.find(cc =>
        cc.name.toLowerCase().includes(pending[0].format) ||
        cc.name.toLowerCase().includes(juegoLabel.toLowerCase().split(":")[0].trim())
      );
      try {
        await api.post("/api/cartas", {
          name: pending.map(it => it.carta!.name).join(" + "),
          price: total > 0 ? `$${total.toFixed(2)}` : null,
          link: null,
          rarity: null,
          setName: null,
          cartaClass: cartaClassMatch?.id ?? null,
          userId: user!.id,
        });
        setQueue(prev => prev.map(it =>
          pending.find(p => p.uid === it.uid) ? { ...it, published: true, publishError: undefined } : it
        ));
      } catch {
        setQueue(prev => prev.map(it =>
          pending.find(p => p.uid === it.uid) ? { ...it, publishError: "Error al publicar" } : it
        ));
      }
    } else {
      for (const item of pending) {
        for (let q = 0; q < item.quantity; q++) {
          await publishQueueItem(item);
        }
      }
    }
    setBulkPublishing(false);
  };

  const handleScanConfirm = async (cards: ScannedCard[]) => {
    if (cards.length === 0) return;
    const first = cards[0];
    setIdentifyError(null);
    setIdentifyCardId(null);
    setResultados([]);
    setNombresVistos(new Set());
    setMensaje("");
    setHasMore(false);

    if (!first.name && !first.set && !first.number) return;

    const hasDirect = juego === "pokemon" && !!first.set && !!first.number;
    const queryDirect = hasDirect
      ? [first.name, first.set, first.number].filter(Boolean).join(' ')
      : '';
    const nombreBusqueda = first.name || [first.set, first.number].filter(Boolean).join(' ');

    // Si tenemos set+número, agregar directo a la cola, limpiar barra y sugerencias
    if (hasDirect) {
      setNombre("");
      setMostrarSugerencias(false);
      setSugerencias([]);
      const newItem: QueueItem = {
        uid: `scan-${Date.now()}`,
        parsed: { quantity: 1, name: first.name || "", set: first.set, number: first.number },
        format: "pokemon" as DetectedFormat,
        status: "loading",
        price: "",
        quantity: 1,
        checked: true,
      };
      setQueue(prev => [...prev, newItem]);
      resolveItem(newItem).then(resolved =>
        setQueue(q => q.map(it => it.uid === newItem.uid ? resolved : it))
      );
      return;
    }

    // Sin set+número: búsqueda por nombre en la grilla
    setNombre(nombreBusqueda);
    if (!nombreBusqueda) return;
    setExpansion("");
    const vistos = new Set<string>();
    setNombresVistos(vistos);
    await cargarPagina(nombreBusqueda, juego, "", 1, true, vistos);
  };

  const handleFileIdentify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setIdentifyError(null);
    setIdentifyCardId(null);
    setIdentifying(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const scanData = await res.json();
      if (!res.ok) {
        throw new Error(scanData?.mensaje ?? `Error del servidor (${res.status})`);
      }

      const nombreScan: string = scanData?.nombre    ?? "";
      const coleccion:  string = scanData?.coleccion ?? "";
      const numero:     string = scanData?.numero    ?? "";
      console.log(`[identify] Vision → "${nombreScan} ${coleccion} ${numero}"`);

      if (!nombreScan && !coleccion) {
        setIdentifyError("No se pudo identificar la carta. Intentá con mejor iluminación.");
        return;
      }

      setResultados([]);
      setNombresVistos(new Set());
      setMensaje("");
      setHasMore(false);

      const hasDirectFile = juego === "pokemon" && !!coleccion && !!numero;

      // Si tenemos colección+número, agregar directo a la cola, limpiar barra y sugerencias
      if (hasDirectFile) {
        setNombre("");
        setMostrarSugerencias(false);
        setSugerencias([]);
        const newItem: QueueItem = {
          uid: `scan-${Date.now()}`,
          parsed: { quantity: 1, name: nombreScan || "", set: coleccion, number: numero },
          format: "pokemon" as DetectedFormat,
          status: "loading",
          price: "",
          quantity: 1,
          checked: true,
        };
        setQueue(prev => [...prev, newItem]);
        resolveItem(newItem).then(resolved =>
          setQueue(q => q.map(it => it.uid === newItem.uid ? resolved : it))
        );
        return;
      }

      // Fallback: buscar solo por nombre en la grilla
      if (!nombreScan) {
        setIdentifyError("No se detectó ningún dato de la carta.");
        return;
      }
      setNombre(nombreScan);
      setExpansion("");
      const vistos = new Set<string>();
      setNombresVistos(vistos);
      await cargarPagina(nombreScan, juego, "", 1, true, vistos);

    } catch (err: any) {
      setIdentifyError(err.message ?? "No se pudo identificar la carta.");
    } finally {
      setIdentifying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">

      {/* Panel de búsqueda */}
      <div className="bg-gradient-to-b from-green-50 to-transparent rounded-2xl shadow-xl p-8 space-y-6">
        <h2 className="text-3xl font-bold text-center">Publicar nueva carta</h2>

        {/* Scanner + Import section */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 border-2 border-indigo-400 text-indigo-600 font-semibold px-5 py-2 rounded-xl hover:bg-indigo-50 transition"
          >
            <ScanLine size={18} />
            Escanear carta con cámara
          </button>

          {/* Identificar desde archivo — para probar sin cámara */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={identifying}
            className="flex items-center gap-2 border-2 border-emerald-400 text-emerald-700 font-semibold px-5 py-2 rounded-xl hover:bg-emerald-50 transition disabled:opacity-50"
          >
            {identifying
              ? <Loader2 size={18} className="animate-spin" />
              : <Upload size={18} />}
            {identifying ? "Identificando…" : "Identificar desde foto"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileIdentify}
          />
          {identifyCardId != null && !identifyError && (
            <div className="w-full flex justify-center">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full">
                <CheckCircle2 size={13} />
                Carta identificada
                <Link
                  to={`/card/${identifyCardId}`}
                  className="inline-flex items-center gap-0.5 text-blue-600 hover:underline ml-1"
                >
                  <ExternalLink size={11} />
                  Ver carta
                </Link>
              </span>
            </div>
          )}
          {identifyError && (
            <p className="w-full text-center text-sm text-amber-600">{identifyError}</p>
          )}
          <button
            onClick={handleImportFromClipboard}
            className="flex items-center gap-2 border-2 border-purple-400 text-purple-600 font-semibold px-5 py-2 rounded-xl hover:bg-purple-50 transition"
          >
            <ListPlus size={18} />
            Importar
          </button>
          {queue.length > 0 && (
            <button
              onClick={() => setPanelOpen(true)}
              className="flex items-center gap-2 border-2 border-green-500 text-green-600 font-semibold px-5 py-2 rounded-xl hover:bg-green-50 transition"
            >
              <ChevronRight size={18} />
              Cola ({queue.filter((i) => !i.published).length} pendientes)
            </button>
          )}
        </div>

        {scannerOpen && (
          <CardScanner
            onCardsScanned={handleScanConfirm}
            onClose={() => setScannerOpen(false)}
          />
        )}

        {/* Selector de juego */}
        <div className="flex flex-wrap justify-center gap-3">
          {JUEGOS.map(j => (
            <button
              key={j.value}
              onClick={() => {
                setJuego(j.value);
                setExpansion("");
                setResultados([]);
                setNombresVistos(new Set());
                setMensaje("");
                setHasMore(false);
                setSugerencias([]);
                setMostrarSugerencias(false);
              }}
              className={`px-5 py-2 rounded-xl font-semibold border-2 transition ${
                juego === j.value
                  ? "bg-green-500 border-green-500 text-white shadow-md"
                  : "border-green-400 text-green-700 hover:bg-green-50"
              }`}
            >
              {j.label}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="flex flex-col gap-3 items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center items-center">
            <div className="relative w-full max-w-md" ref={sugerenciasRef}>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                onFocus={() => { if (sugerencias.length > 0) setMostrarSugerencias(true); }}
                onKeyDown={e => {
                  if (e.key === "Enter") buscarCartas();
                  if (e.key === "Escape") setMostrarSugerencias(false);
                }}
                placeholder={PLACEHOLDERS[juego]}
                className="border rounded-xl px-4 py-2 w-full outline-none focus:ring-2 focus:ring-green-400"
                autoComplete="off"
              />
              {/* Spinner de carga de sugerencias */}
              {cargandoSugerencias && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {/* Dropdown de sugerencias */}
              {mostrarSugerencias && sugerencias.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                  {sugerencias.map((s, i) => (
                    <button
                      key={i}
                      onMouseDown={e => { e.preventDefault(); seleccionarSugerencia(s); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-green-50 text-sm font-medium border-b border-gray-100 last:border-0 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => buscarCartas()}
              disabled={cargando || !nombre.trim()}
              className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold px-6 py-2 rounded-xl transition shadow-md"
            >
              {cargando ? "Buscando…" : "Buscar"}
            </button>
          </div>

          {/* Filtro de expansión — solo Pokemon */}
          {juego === "pokemon" && (
            <input
              type="text"
              value={expansion}
              onChange={e => setExpansion(e.target.value)}
              onKeyDown={e => e.key === "Enter" && buscarCartas()}
              placeholder="Expansión o código (opcional, ej: Base Set, sv, xy3)"
              className="border rounded-xl px-4 py-2 w-full max-w-md outline-none focus:ring-2 focus:ring-green-300 text-sm text-gray-600"
            />
          )}
        </div>

        <div className="flex justify-center">
          <button
            onClick={crearCartaManual}
            className="border-2 border-green-500 text-green-600 font-semibold px-6 py-2 rounded-xl hover:bg-green-100 transition"
          >
            Crear Carta Manual
          </button>
        </div>

        {mensaje && <p className="text-center text-sm text-gray-600">{mensaje}</p>}
      </div>

      {/* Grid de resultados */}
      {resultados.length > 0 && (() => {
        // Para no-Pokémon: agrupar por nombre (una carta = una entrada, las variantes se ven en el modal)
        const items = juego === "pokemon"
          ? resultados
          : resultados.filter((c, idx, arr) => arr.findIndex(x => x.name.toLowerCase() === c.name.toLowerCase()) === idx);
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-10">
            {items.map((carta, i) => (
              <div
                key={i}
                className="bg-gradient-to-b from-green-50 to-transparent rounded-2xl shadow-md p-4 flex flex-col items-center transition hover:scale-[1.02]"
              >
                {carta.image && (
                  <img src={carta.image} alt={carta.name} className="w-[150px] h-[210px] object-contain mb-2" />
                )}
                <h3 className="text-base font-semibold text-center leading-tight">{carta.name}</h3>
                {juego === "pokemon" && carta.setName && (
                  <p className="text-xs text-green-700 font-medium text-center mt-1 bg-green-100 px-2 py-0.5 rounded-full">
                    {carta.setName}
                  </p>
                )}
                {juego !== "pokemon" && (
                  <p className="text-xs text-indigo-600 font-medium text-center mt-1">
                    Ver colecciones y rarezas →
                  </p>
                )}
                <button
                  onClick={() => abrirModal(carta)}
                  className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl font-semibold transition shadow-sm"
                >
                  Añadir a cola
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Sentinel infinite scroll */}
      <div ref={sentinelRef} className="flex justify-center py-8">
        {cargandoMas && (
          <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        )}
        {!hasMore && resultados.length > 0 && (
          <p className="text-sm text-gray-400">No hay más resultados.</p>
        )}
      </div>

      {/* Botón flotante de cola — pequeño tab en el borde derecho */}
      {queue.length > 0 && !panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          title="Abrir cola de publicación"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 bg-green-500 hover:bg-green-600 text-white py-2 px-1 rounded-l-lg shadow-lg transition-colors"
        >
          <ChevronRight size={13} />
          <span className="text-[10px] font-bold leading-none bg-white text-green-600 rounded-full w-4 h-4 flex items-center justify-center">
            {queue.filter(i => !i.published).length}
          </span>
        </button>
      )}

      {/* Panel lateral de cola */}
      {panelOpen && (
        <>
          {/* Backdrop sin bloquear interacción con la página */}
          <div className="fixed inset-0 z-40" onClick={() => setPanelOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50">
              <div>
                <h3 className="font-bold text-lg">Cola de publicación</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {queue.filter((i) => i.status === "loading").length > 0
                    ? `Resolviendo cartas…`
                    : `${queue.filter((i) => !i.published).length} pendientes · ${queue.filter((i) => i.published).length} publicadas`}
                </p>
              </div>
              <button onClick={() => setPanelOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            {/* Acciones */}
            <div className="px-5 py-3 border-b flex flex-wrap gap-2">
              <div className="flex flex-1 gap-1.5 min-w-0">
                <select
                  value={selectedPriceSite}
                  onChange={e => setSelectedPriceSite(e.target.value as PriceSiteKey)}
                  disabled={applyingPrices}
                  className="text-xs border border-amber-300 rounded-lg px-2 py-1.5 bg-amber-50 text-amber-800 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
                >
                  {PRICE_SITES.map(s => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
                <button
                  onClick={applyAllPrices}
                  disabled={applyingPrices || queue.every((i) => i.status !== "found" || !!i.published)}
                  className="flex-1 text-sm font-semibold bg-amber-50 border border-amber-300 text-amber-700 px-3 py-1.5 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition"
                >
                  {applyingPrices ? "Aplicando…" : "Aplicar precios"}
                </button>
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none px-1">
                  <input
                    type="checkbox"
                    checked={bundleAll}
                    onChange={e => setBundleAll(e.target.checked)}
                    className="accent-green-500"
                  />
                  Todo en una publicación
                  {bundleAll && (() => {
                    const parsePrice = (p: string) => parseFloat(p.replace(/[^0-9.]/g, "")) || 0;
                    const total = queue
                      .filter(it => it.checked && it.status === "found" && !it.published)
                      .reduce((acc, it) => acc + parsePrice(it.price) * it.quantity, 0);
                    return total > 0
                      ? <span className="ml-auto font-semibold text-green-600">${total.toFixed(2)}</span>
                      : null;
                  })()}
                </label>
                <button
                  onClick={publishAllChecked}
                  disabled={bulkPublishing || queue.every((i) => !i.checked || i.status !== "found" || !!i.published)}
                  className="text-sm font-semibold bg-green-500 text-white px-3 py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 transition"
                >
                  {bulkPublishing ? "Publicando…" : `Publicar seleccionadas (${queue.filter((i) => i.checked && i.status === "found" && !i.published).length})`}
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {queue.map((item) => (
                <div
                  key={item.uid}
                  className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 ${item.published ? "opacity-50" : ""}`}
                >
                  {/* Checkbox */}
                  {!item.published && item.status === "found" && (
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) =>
                        setQueue((prev) =>
                          prev.map((it) => (it.uid === item.uid ? { ...it, checked: e.target.checked } : it))
                        )
                      }
                      className="mt-1 accent-green-500"
                    />
                  )}
                  {/* Thumbnail — muestra la imagen de la rareza elegida si está disponible */}
                  <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                    {item.status === "loading" ? (
                      <Loader2 size={16} className="animate-spin text-gray-400" />
                    ) : item.status === "not_found" ? (
                      <AlertCircle size={16} className="text-red-400" />
                    ) : item.status === "ambiguous" ? (
                      <span className="text-[10px] text-amber-500 font-bold text-center leading-tight px-0.5">?</span>
                    ) : (item.rarezaElegida?.image ?? item.carta?.image) ? (
                      <img src={item.rarezaElegida?.image ?? item.carta!.image} alt={item.carta!.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs text-gray-400">?</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    {item.status === "loading" && (
                      <p className="text-sm text-gray-400">
                        {item.parsed.name || `#${item.parsed.passcode}`}
                        <span className="ml-1 text-xs">(buscando…)</span>
                      </p>
                    )}
                    {item.status === "not_found" && (
                      <p className="text-sm text-red-500 truncate">
                        No encontrada:{' '}
                        {item.parsed.name
                          || item.parsed.id
                          || (item.parsed.set && item.parsed.number ? `${item.parsed.set} #${item.parsed.number}` : undefined)
                          || (item.parsed.passcode != null ? `#${item.parsed.passcode}` : undefined)
                          || '(sin identificar)'}
                      </p>
                    )}
                    {item.status === "ambiguous" && item.candidates && (
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-amber-600 font-medium">
                          {item.candidates.length} versiones — elegí una:
                        </p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {item.candidates.map((c, i) => (
                            <button
                              key={i}
                              onClick={() => setQueue(prev => prev.map(it =>
                                it.uid === item.uid ? { ...it, status: "found", carta: c, candidates: undefined } : it
                              ))}
                              className="flex-shrink-0 flex flex-col items-center gap-0.5 rounded-lg border-2 border-transparent hover:border-indigo-400 p-1 transition-all bg-gray-50 hover:bg-indigo-50"
                              title={`${c.name} — ${c.setName} #${c.number}`}
                            >
                              {c.image
                                ? <img src={c.image} alt={c.name} className="w-9 h-[52px] object-cover rounded" />
                                : <div className="w-9 h-[52px] bg-gray-200 rounded flex items-center justify-center text-[9px] text-gray-400">?</div>
                              }
                              <span className="text-[9px] text-gray-500 max-w-[44px] truncate text-center leading-tight">
                                {c.setName?.replace(/^Scarlet & Violet[—–-]\s*/i, "SV ") ?? c.setId}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.status === "found" && item.carta && (
                      <>
                        <p className="text-sm font-semibold truncate flex items-center gap-1">
                          {item.published && <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />}
                          {item.carta.name}
                        </p>
                        {item.carta.setName && (
                          <p className="text-xs text-gray-500 truncate">{item.carta.setName}</p>
                        )}
                        {/* Chip de rareza */}
                        {!item.published && (
                          <button
                            onMouseDown={e => handleRarezaMouseDown(e, item.uid, item)}
                            onMouseUp={() => handleRarezaMouseUp(item.uid, item)}
                            onMouseLeave={() => {
                              if (holdTimerRef.current && !holdFiredRef.current) {
                                clearTimeout(holdTimerRef.current);
                                holdTimerRef.current = null;
                              }
                            }}
                            className={`mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border select-none transition-all
                              ${item.rarezasLoading ? "opacity-60 cursor-wait" : "cursor-pointer"}
                              ${!item.rarezas || item.rarezas.length <= 1
                                ? "border-gray-200 bg-gray-50 text-gray-400 opacity-50"
                                : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                              }`}
                            title={item.rarezas && item.rarezas.length > 1 ? "Click: cambiar · Mantener: elegir versión" : "Click para cargar versiones"}
                          >
                            {item.rarezasLoading
                              ? <span className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                              : null}
                            {item.rarezaElegida?.rarity ?? item.rarezas?.[0]?.rarity ?? "Versión"}
                            {item.rarezas && item.rarezas.length > 1 && (
                              <span className="text-indigo-400 text-[10px]">×{item.rarezas.length}</span>
                            )}
                          </button>
                        )}
                        {item.publishError && (
                          <p className="text-xs text-red-500">{item.publishError}</p>
                        )}
                        {!item.published && (
                          <div className="flex flex-col gap-1 mt-1.5">
                            <div className="flex items-center gap-1.5">
                              {/* Cantidad */}
                              <div className="flex items-center border rounded-lg overflow-hidden text-xs">
                                <button
                                  onClick={() => setQueue(prev => prev.map(it => it.uid === item.uid ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it))}
                                  className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 transition font-bold"
                                >−</button>
                                <span className="px-2 py-1 min-w-[24px] text-center font-semibold">{item.quantity}</span>
                                <button
                                  onClick={() => setQueue(prev => prev.map(it => it.uid === item.uid ? { ...it, quantity: it.quantity + 1 } : it))}
                                  className="px-1.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 transition font-bold"
                                >+</button>
                              </div>
                              <input
                                type="text"
                                value={item.price}
                                onChange={(e) =>
                                  setQueue((prev) =>
                                    prev.map((it) => (it.uid === item.uid ? { ...it, price: e.target.value } : it))
                                  )
                                }
                                placeholder="Precio (ej: $4.99)"
                                className="w-24 text-xs border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-green-400"
                              />
                              <button
                                onClick={() => publishQueueItem(item)}
                                className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600 transition"
                              >
                                Pub.
                              </button>
                              <button
                                onClick={() => setQueue((prev) => prev.filter((it) => it.uid !== item.uid))}
                                className="text-xs text-gray-400 hover:text-red-400 transition"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => setQueue([])}
                className="text-xs text-red-400 hover:text-red-600 transition"
              >
                Limpiar cola
              </button>
              <button
                onClick={handleImportFromClipboard}
                className="text-xs text-purple-500 hover:text-purple-700 transition flex items-center gap-1"
              >
                <ListPlus size={14} />
                Importar más
              </button>
            </div>
          </div>
        </>
      )}

      {/* Popup de rareza (hold-to-open) */}
      {rarityPopup && (() => {
        const popupW = Math.min(rarityPopup.rarezas.length * 88 + 16, window.innerWidth - 16);
        const anchorCx = rarityPopup.anchorRect.left + rarityPopup.anchorRect.width / 2;
        let left = Math.max(8, anchorCx - popupW / 2);
        left = Math.min(left, window.innerWidth - popupW - 8);
        const spaceAbove = rarityPopup.anchorRect.top - 8;
        const popupH = 148;
        const top = spaceAbove >= popupH
          ? rarityPopup.anchorRect.top - popupH - 6
          : rarityPopup.anchorRect.bottom + 6;
        return (
          <div
            className="fixed z-[9999] flex gap-2 p-2 bg-gray-900/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-700 select-none"
            style={{ left, top, width: popupW }}
            onMouseDown={e => e.preventDefault()}
          >
            {rarityPopup.rarezas.map((r, idx) => (
              <div
                key={r.cardId}
                onMouseEnter={() => handleRarezaHover(idx, r)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-xl cursor-pointer transition-all flex-shrink-0
                  ${rarityPopup.hoveredIdx === idx
                    ? "bg-indigo-500/30 ring-2 ring-indigo-400"
                    : "hover:bg-white/10"
                  }`}
                style={{ width: 80 }}
              >
                <div className="w-[60px] h-[84px] rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                  {r.image
                    ? <img src={r.image} alt={r.rarity ?? ""} className="w-full h-full object-cover" draggable={false} />
                    : <span className="text-gray-500 text-xs text-center px-1">{r.rarity ?? "?"}</span>
                  }
                </div>
                <span className={`text-[10px] text-center leading-tight max-w-[72px] truncate font-medium
                  ${rarityPopup.hoveredIdx === idx ? "text-indigo-200" : "text-gray-300"}`}>
                  {r.rarity ?? "Sin rareza"}
                </span>
                {r.finish && (
                  <span className="text-[9px] text-gray-500 text-center truncate max-w-[72px]">{r.finish}</span>
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Modal de versiones */}
      {modalCarta && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalCarta(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h3 className="text-xl font-bold">{modalCarta.name}</h3>
                {modalCarta.setName && (
                  <p className="text-sm text-green-700 font-medium mt-0.5">{modalCarta.setName}</p>
                )}
                {juego === "pokemon" && (
                  <p className="text-sm text-gray-500 mt-1">Elegí la rareza en la que viene esta carta</p>
                )}
              </div>
              <button onClick={() => setModalCarta(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>

            {/* Versiones / Rarezas — todos los juegos */}
            <div className="overflow-y-auto flex-1 p-6">
              {juego !== "pokemon" && (
                <p className="text-sm text-gray-500 mb-3 text-center">
                  Elegí la colección y rareza que querés publicar
                </p>
              )}
              {cargandoRarezas ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : rarezas.length === 0 ? (
                <p className="text-center text-gray-500">No se encontraron versiones.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rarezas.map(r => (
                    <button
                      key={r.cardId}
                      onClick={() => juego === "pokemon" ? elegirRareza(r) : seleccionarVariante(r)}
                      className={`rounded-xl border-2 p-3 flex flex-col items-center gap-2 transition ${
                        rarezaElegida?.cardId === r.cardId
                          ? "border-green-500 bg-green-50"
                          : "border-gray-200 hover:border-green-300"
                      }`}
                    >
                      {r.image && (
                        <img src={r.image} alt={r.rarity ?? ""} className="w-[80px] h-[112px] object-contain" />
                      )}
                      {r.setName && (
                        <span className="text-xs text-green-700 font-medium text-center bg-green-100 px-2 py-0.5 rounded-full leading-tight">
                          {r.setName}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-center leading-tight">
                        {r.rarity ?? "Sin rareza"}
                      </span>
                      {r.finish && <span className="text-xs text-gray-500 text-center">{r.finish}</span>}
                      {r.number && <span className="text-xs text-gray-400">#{r.number}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer del modal — precios de referencia (Pokémon) + Añadir a cola */}
            {(rarezaElegida || (juego !== "pokemon" && !cargandoRarezas && rarezas.length === 0)) && (
              <div className="border-t p-6 space-y-4">
                {/* Precios de referencia — solo Pokémon */}
                {juego === "pokemon" && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700 mb-1">Precios sugeridos de referencia:</p>
                    {preciosPokemon === "cargando" ? (
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                        Consultando tiendas…
                      </div>
                    ) : preciosPokemon ? (
                      [
                        { label: "CoolStuffInc", value: preciosPokemon.coolstuff },
                        { label: "TCGPlayer",    value: preciosPokemon.tcgplayer },
                        { label: "Cardmarket",   value: preciosPokemon.cardmarket },
                        { label: "eBay",         value: preciosPokemon.ebay },
                        { label: "PriceCharting",value: preciosPokemon.pricecharting },
                        { label: "Troll & Toad", value: preciosPokemon.trollandtoad },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 w-36">{label}:</span>
                          {value
                            ? <span className="text-green-600 font-bold">{value}</span>
                            : <span className="text-gray-400">No disponible</span>}
                        </div>
                      ))
                    ) : null}
                  </div>
                )}
                {/* Variante seleccionada — para juegos no-Pokémon */}
                {juego !== "pokemon" && rarezaElegida && (
                  <div className="text-sm text-gray-600 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                    <span className="font-semibold text-green-700">{rarezaElegida.setName ?? "Sin colección"}</span>
                    {rarezaElegida.rarity && <span className="ml-2 text-gray-500">· {rarezaElegida.rarity}</span>}
                    {rarezaElegida.number && <span className="ml-2 text-gray-400">#{rarezaElegida.number}</span>}
                    {rarezaElegida.finish && <span className="ml-2 text-gray-400">· {rarezaElegida.finish}</span>}
                  </div>
                )}
                <button
                  onClick={agregarACola}
                  disabled={juego === "pokemon" && preciosPokemon === "cargando"}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition shadow-md"
                >
                  Añadir a cola
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
