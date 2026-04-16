
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useUser } from "../context/user";
import { api, fetchApi } from "../services/api";
import { CardScanner, type ScannedCard } from "../components/CardScanner/CardScanner";
import { ScanLine, ListPlus, X, ChevronRight, Loader2, CheckCircle2, AlertCircle, Upload, ExternalLink } from "lucide-react";
import { type ParsedCard, type DetectedFormat } from "../utils/deckParsers";

type Juego = "pokemon" | "magic" | "yugioh" | "digimon";

interface CartaResultado {
  name: string;
  image?: string;
  rarity?: string;
  setName?: string;
  setId?: string;
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
  status: "loading" | "found" | "not_found";
  carta?: CartaResultado & { rarity?: string };
  price: string;
  checked: boolean;
  published?: boolean;
  publishError?: string;
}

const JUEGOS: { value: Juego; label: string }[] = [
  { value: "pokemon",  label: "Pokémon TCG"         },
  { value: "magic",    label: "Magic: The Gathering" },
  { value: "yugioh",   label: "Yu-Gi-Oh!"            },
  { value: "digimon",  label: "Digimon TCG"          },
];

const PLACEHOLDERS: Record<Juego, string> = {
  pokemon: "Pikachu, Charizard...",
  magic:   "Lightning Bolt, Black Lotus...",
  yugioh:  "Blue-Eyes, Dark Magician...",
  digimon: "Agumon, Gabumon...",
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

  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [cargandoSugerencias, setCargandoSugerencias] = useState(false);

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
      const params = new URLSearchParams({ page: String(pagina) });
      if (juegoBusqueda === "pokemon" && expansionBusqueda.trim()) {
        params.set("set", expansionBusqueda.trim());
      }
      const response = await fetchApi(
        `/api/cartas/scrape/${juegoBusqueda}/${encodeURIComponent(nombreBusqueda)}?${params}`
      );
      const data = await response.json();

      if (!response.ok) {
        if (reemplazar) setMensaje(data.message || "No se encontraron resultados.");
        setHasMore(false);
        return;
      }

      // Filtrar duplicados que ya se mostraron (por nombre + setId)
      const cardKey = (c: CartaResultado) =>
        `${c.name.toLowerCase()}|${(c.setId ?? "").toLowerCase()}`;
      const nuevas: CartaResultado[] = (data.data as CartaResultado[]).filter(
        c => !vistos.has(cardKey(c))
      );
      const nuevosVistos = new Set(vistos);
      nuevas.forEach(c => nuevosVistos.add(cardKey(c)));

      setResultados(prev => reemplazar ? nuevas : [...prev, ...nuevas]);
      setNombresVistos(nuevosVistos);
      setHasMore(data.hasMore ?? false);
      setPage(pagina);
    } catch {
      if (reemplazar) setMensaje("No se pudo conectar con el servidor.");
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
        const response = await fetchApi(
          `/api/cartas/scrape/${juego}/${encodeURIComponent(trimmed)}?page=1`
        );
        const data = await response.json();
        if (response.ok && data.data) {
          const nombres = [...new Set<string>(
            (data.data as CartaResultado[]).map(c => c.name)
          )].slice(0, 8);
          setSugerencias(nombres);
          setMostrarSugerencias(nombres.length > 0);
        }
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

    if (juego === "pokemon") {
      setCargandoRarezas(true);
      try {
        const params = new URLSearchParams({ nombre: carta.name });
        if (carta.setName) params.set("set", carta.setName);
        const r = await fetchApi(`/api/cartas/scrape/${juego}/rarezas?${params}`);
        const data = await r.json();
        setRarezas(data.data ?? []);
      } catch {
        setRarezas([]);
      } finally {
        setCargandoRarezas(false);
      }
    } else if (juego === "magic" || juego === "yugioh") {
      // Para Magic y YuGiOh: cargar todas las reimpresiones en distintos sets
      setCargandoRarezas(true);
      try {
        const params = new URLSearchParams({ nombre: carta.name });
        const r = await fetchApi(`/api/cartas/scrape/${juego}/rarezas?${params}`);
        const data = await r.json();
        setRarezas(data.data ?? []);
      } catch {
        setRarezas([]);
      } finally {
        setCargandoRarezas(false);
      }
    } else {
      // Digimon: la carta ya está determinada, buscar precio directamente
      setPrecioCoolStuff("cargando");
      try {
        const params = new URLSearchParams({ nombre: carta.name });
        if (carta.setName) params.set("set", carta.setName);
        const resp = await fetchApi(`/api/cartas/precio-coolstuff?${params}`);
        const data = await resp.json();
        setPrecioCoolStuff(data.precio ?? null);
      } catch {
        setPrecioCoolStuff(null);
      }
    }
  };

  // Solo para Pokemon: al elegir rareza busca el precio en CoolStuffInc
  const elegirRareza = async (r: Rareza) => {
    setRarezaElegida(r);
    setPrecioCoolStuff("cargando");
    try {
      const params = new URLSearchParams({ nombre: modalCarta!.name });
      if (modalCarta!.setName) params.set("set", modalCarta!.setName);
      if (r.rarity) params.set("rareza", r.rarity);
      const resp = await fetchApi(`/api/cartas/precio-coolstuff?${params}`);
      const data = await resp.json();
      setPrecioCoolStuff(data.precio ?? null);
    } catch {
      setPrecioCoolStuff(null);
    }
  };

  const confirmarPublicacion = async () => {
    if (!user || !modalCarta) return;
    // Para Pokemon, debe haber elegido rareza
    if (juego === "pokemon" && !rarezaElegida) return;

    const juegoLabel = JUEGOS.find(j => j.value === juego)?.label ?? juego;
    const cartaClassMatch = cartaClasses.find(cc =>
      cc.name.toLowerCase().includes(juego) ||
      cc.name.toLowerCase().includes(juegoLabel.toLowerCase().split(":")[0].trim())
    );

    const precioFinal = typeof precioCoolStuff === "string" && precioCoolStuff !== "cargando"
      ? precioCoolStuff
      : null;

    try {
      const res = await api.post("/api/cartas", {
        name: modalCarta.name,
        price: precioFinal,
        image: rarezaElegida?.image ?? modalCarta.image ?? null,
        link: null,
        rarity: rarezaElegida?.rarity ?? modalCarta.rarity ?? null,
        setName: rarezaElegida?.setName ?? modalCarta.setName ?? null,
        cartaClass: cartaClassMatch?.id ?? null,
        userId: user.id,
      });

      const created = res.data?.data;
      if (!created) { setMensaje("No se pudo crear la carta."); return; }
      setModalCarta(null);
      navigate("/editar-carta", { state: { carta: created } });
    } catch {
      setMensaje("Error al crear la carta.");
    }
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
    const params = new URLSearchParams();

    if (juegoActual === "pokemon") {
      // Acepta "Charmander MEW 4"  o  "MEW 4"  (nombre opcional)
      const m = texto.match(/^(?:.+?\s+)?([A-Z][A-Z0-9]{1,7})\s+(\d+)$/);
      if (!m) return null;
      params.set("set", m[1]);
      params.set("number", m[2]);
    } else if (juegoActual === "magic") {
      const m = texto.match(/^(.+?)\s+\(([A-Z0-9]{2,5})\)\s+(\d+[a-z]?)$/);
      if (!m) return null;
      params.set("set", m[2].toLowerCase());
      params.set("number", m[3]);
    } else if (juegoActual === "yugioh") {
      if (!/^\d{6,10}$/.test(texto)) return null;
      params.set("passcode", texto);
    } else if (juegoActual === "digimon") {
      if (!/^[A-Z]{1,4}\d{0,3}-\d{3,4}$/.test(texto)) return null;
      params.set("id", texto);
    } else {
      return null;
    }

    try {
      const res = await fetchApi(`/api/cartas/resolve/${juegoActual}?${params}`);
      const data = await res.json();
      if (res.ok && data.data) return data.data as CartaResultado;
      return null;
    } catch {
      return null;
    }
  };

  // Construye los query params para el endpoint /resolve/:juego
  const buildResolveUrl = (parsed: ParsedCard, fmt: DetectedFormat): string => {
    const params = new URLSearchParams();
    if (fmt === "pokemon" && parsed.set && parsed.number) {
      params.set("set", parsed.set);
      params.set("number", parsed.number);
    } else if (fmt === "magic" && parsed.set && parsed.number) {
      params.set("set", parsed.set);
      params.set("number", parsed.number);
    } else if (fmt === "yugioh" && parsed.passcode !== undefined) {
      params.set("passcode", String(parsed.passcode));
    } else if (fmt === "digimon") {
      if (parsed.id) params.set("id", parsed.id);
      else if (parsed.name) params.set("name", parsed.name);
    }
    return `/api/cartas/resolve/${fmt}?${params}`;
  };

  const resolveItem = useCallback(async (item: QueueItem): Promise<QueueItem> => {
    try {
      const res = await fetchApi(buildResolveUrl(item.parsed, item.format));
      const data = await res.json();
      if (res.ok && data.data) {
        return { ...item, status: "found", carta: data.data };
      }
      return { ...item, status: "not_found" };
    } catch {
      return { ...item, status: "not_found" };
    }
  }, []);

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
        checked: true,
      }))
    );

    setQueue((prev) => [...prev, ...newItems]);
    setPanelOpen(true);

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

  const applyAllCoolStuffPrices = async () => {
    setApplyingPrices(true);
    setQueue((prev) => prev.map((it) =>
      it.status === "found" && !it.published ? { ...it, price: "…" } : it
    ));

    for (const item of queue) {
      if (item.status !== "found" || item.published || !item.carta) continue;
      try {
        const params = new URLSearchParams({ nombre: item.carta.name });
        if (item.carta.setName) params.set("set", item.carta.setName);
        if (item.carta.rarity) params.set("rareza", item.carta.rarity);
        const res = await fetchApi(`/api/cartas/precio-coolstuff?${params}`);
        const data = await res.json();
        const precio: string = data.precio ?? "";
        setQueue((prev) =>
          prev.map((it) => (it.uid === item.uid ? { ...it, price: precio } : it))
        );
      } catch {
        setQueue((prev) =>
          prev.map((it) => (it.uid === item.uid ? { ...it, price: "" } : it))
        );
      }
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
        image: item.carta.image ?? null,
        link: null,
        rarity: item.carta.rarity ?? null,
        setName: item.carta.setName ?? null,
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
    const pending = queue.filter((it) => it.checked && it.status === "found" && !it.published);
    for (const item of pending) {
      await publishQueueItem(item);
    }
    setBulkPublishing(false);
  };

  const handleScanConfirm = (cards: ScannedCard[]) => {
    if (cards.length === 0) return;
    const first = cards[0];
    setIdentifyError(null);
    setIdentifyCardId(null);
    setResultados([]);
    setNombresVistos(new Set());
    setMensaje("");
    setHasMore(false);

    // Construir query con los datos disponibles — nombre es opcional
    // "Charmander MEW 4" | "MEW 4" | "Charmander"
    const query = [first.name, first.set, first.number].filter(Boolean).join(' ');
    if (!query) return;

    setNombre(query);
    buscarCartas(query);
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

      const nombre:    string = scanData?.nombre    ?? "";
      const coleccion: string = scanData?.coleccion ?? "";
      const numero:    string = scanData?.numero    ?? "";
      console.log(`[identify] Vision → "${nombre} ${coleccion} ${numero}"`);

      if (!nombre) {
        setIdentifyError("No se pudo identificar la carta. Intentá con mejor iluminación.");
        return;
      }

      // Construir query con los datos disponibles — nombre es opcional
      // "Charmander MEW 4" | "MEW 4" | "Charmander"
      const query = [nombre, coleccion, numero].filter(Boolean).join(' ');
      if (!query) {
        setIdentifyError("No se detectó ningún dato de la carta.");
        return;
      }

      setResultados([]);
      setNombresVistos(new Set());
      setMensaje("");
      setHasMore(false);
      setNombre(query);
      buscarCartas(query);

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
      {resultados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-10">
          {resultados.map((carta, i) => (
            <div
              key={i}
              className="bg-gradient-to-b from-green-50 to-transparent rounded-2xl shadow-md p-4 flex flex-col items-center transition hover:scale-[1.02]"
            >
              {carta.image && (
                <img src={carta.image} alt={carta.name} className="w-[150px] h-[210px] object-contain mb-2" />
              )}
              <h3 className="text-base font-semibold text-center leading-tight">{carta.name}</h3>
              {carta.setName && (
                <p className="text-xs text-green-700 font-medium text-center mt-1 bg-green-100 px-2 py-0.5 rounded-full">
                  {carta.setName}
                </p>
              )}
              {/* Rareza visible solo en juegos no-Pokemon (en Pokemon se elige en el modal) */}
              {juego !== "pokemon" && carta.rarity && (
                <p className="text-xs text-gray-500 text-center mt-1">{carta.rarity}</p>
              )}
              <button
                onClick={() => abrirModal(carta)}
                className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl font-semibold transition shadow-sm"
              >
                Publicar esta carta
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sentinel infinite scroll */}
      <div ref={sentinelRef} className="flex justify-center py-8">
        {cargandoMas && (
          <div className="w-8 h-8 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
        )}
        {!hasMore && resultados.length > 0 && (
          <p className="text-sm text-gray-400">No hay más resultados.</p>
        )}
      </div>

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
              <button
                onClick={applyAllCoolStuffPrices}
                disabled={applyingPrices || queue.every((i) => i.status !== "found" || i.published)}
                className="flex-1 text-sm font-semibold bg-amber-50 border border-amber-300 text-amber-700 px-3 py-2 rounded-xl hover:bg-amber-100 disabled:opacity-50 transition"
              >
                {applyingPrices ? "Aplicando precios…" : "Aplicar precios CoolStuffInc"}
              </button>
              <button
                onClick={publishAllChecked}
                disabled={bulkPublishing || queue.every((i) => !i.checked || i.status !== "found" || !!i.published)}
                className="flex-1 text-sm font-semibold bg-green-500 text-white px-3 py-2 rounded-xl hover:bg-green-600 disabled:opacity-50 transition"
              >
                {bulkPublishing ? "Publicando…" : `Publicar seleccionadas (${queue.filter((i) => i.checked && i.status === "found" && !i.published).length})`}
              </button>
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
                  {/* Thumbnail */}
                  <div className="w-10 h-14 flex-shrink-0 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                    {item.status === "loading" ? (
                      <Loader2 size={16} className="animate-spin text-gray-400" />
                    ) : item.status === "not_found" ? (
                      <AlertCircle size={16} className="text-red-400" />
                    ) : item.carta?.image ? (
                      <img src={item.carta.image} alt={item.carta.name} className="w-full h-full object-cover" />
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
                        No encontrada: {item.parsed.name || item.parsed.id || `#${item.parsed.passcode}`}
                      </p>
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
                        {item.publishError && (
                          <p className="text-xs text-red-500">{item.publishError}</p>
                        )}
                        {!item.published && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <input
                              type="text"
                              value={item.price}
                              onChange={(e) =>
                                setQueue((prev) =>
                                  prev.map((it) => (it.uid === item.uid ? { ...it, price: e.target.value } : it))
                                )
                              }
                              placeholder="Precio (ej: $4.99)"
                              className="w-28 text-xs border rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-green-400"
                            />
                            <button
                              onClick={() => publishQueueItem(item)}
                              className="text-xs bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600 transition"
                            >
                              Publicar
                            </button>
                            <button
                              onClick={() => setQueue((prev) => prev.filter((it) => it.uid !== item.uid))}
                              className="text-xs text-gray-400 hover:text-red-400 transition"
                            >
                              <X size={14} />
                            </button>
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

            {/* Reimpresiones/Rarezas — Pokemon, Magic y YuGiOh */}
            {(juego === "pokemon" || juego === "magic" || juego === "yugioh") && (
              <div className="overflow-y-auto flex-1 p-6">
                {juego !== "pokemon" && (
                  <p className="text-sm text-gray-500 mb-3 text-center">Elegí la reimpresión que querés publicar</p>
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
                        onClick={() => elegirRareza(r)}
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
            )}

            {/* Para Digimon: imagen + info de la carta directamente */}
            {juego === "digimon" && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
                {modalCarta.image && (
                  <img src={modalCarta.image} alt={modalCarta.name} className="w-[150px] h-[210px] object-contain" />
                )}
                {modalCarta.rarity && (
                  <p className="text-sm text-gray-600">{modalCarta.rarity}</p>
                )}
              </div>
            )}

            {/* Precio + Confirmar — se muestra cuando corresponde */}
            {(juego === "digimon" || rarezaElegida) && (
              <div className="border-t p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Precio sugerido CoolStuffInc:</span>
                  {precioCoolStuff === "cargando" ? (
                    <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  ) : precioCoolStuff ? (
                    <span className="text-green-600 font-bold text-lg">{precioCoolStuff}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">No disponible en CoolStuffInc</span>
                  )}
                </div>
                <button
                  onClick={confirmarPublicacion}
                  disabled={precioCoolStuff === "cargando"}
                  className="w-full bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition shadow-md"
                >
                  Confirmar publicación
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
