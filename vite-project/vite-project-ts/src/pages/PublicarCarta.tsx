
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/user";
import { api, fetchApi } from "../services/api";

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

  const busquedaRef = useRef({ nombre: "", juego: "pokemon" as Juego, expansion: "" });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
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

      // Filtrar duplicados que ya se mostraron (por nombre)
      const nuevas: CartaResultado[] = (data.data as CartaResultado[]).filter(
        c => !vistos.has(c.name.toLowerCase())
      );
      const nuevosVistos = new Set(vistos);
      nuevas.forEach(c => nuevosVistos.add(c.name.toLowerCase()));

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

  const buscarCartas = async () => {
    const n = nombre.trim();
    if (!n) return;
    busquedaRef.current = { nombre: n, juego, expansion };
    const vistos = new Set<string>();
    setResultados([]);
    setNombresVistos(vistos);
    setMensaje("");
    setHasMore(false);
    await cargarPagina(n, juego, expansion, 1, true, vistos);
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">

      {/* Panel de búsqueda */}
      <div className="bg-gradient-to-b from-green-50 to-transparent rounded-2xl shadow-xl p-8 space-y-6">
        <h2 className="text-3xl font-bold text-center">Publicar nueva carta</h2>

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
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onKeyDown={e => e.key === "Enter" && buscarCartas()}
              placeholder={PLACEHOLDERS[juego]}
              className="border rounded-xl px-4 py-2 w-full max-w-md outline-none focus:ring-2 focus:ring-green-400"
            />
            <button
              onClick={buscarCartas}
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
