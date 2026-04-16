// CardsPage.tsx
import { useEffect, useState, useRef } from "react";
import { useFilters } from "../hooks/useFilters";
import { Products } from "../components/Products";
import { ProductFilters } from "../components/ProductFilters";
import { fetchApi } from "../services/api";

// Regex para detectar "nombre SETID número" (ej: "Pikachu ex PAR 239", "Charizard SV3 4")
const POKEMON_CODE_RE = /^(.+?)\s+([A-Z][A-Z0-9]{1,7})\s+(\d+)$/;

export function CardsPage() {
  const [products, setProducts] = useState([]);
  const { filters, setFilters, filterProducts } = useFilters();

  const [searchText, setSearchText] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchCartas() {
      try {
        const res = await fetchApi('/api/cartas');
        const json = await res.json();
        const transformedData = json.data.map((carta: any) => ({
          id: carta.id,
          title: carta.title,
          thumbnail: carta.thumbnail,
          price: typeof carta.price === 'string' ? parseFloat(carta.price.replace('$', '')) : carta.price,
          description: carta.description,
          intermediarios: carta.intermediarios,
          uploader: carta.uploader,
          stock: carta.stock,
        }));
        setProducts(transformedData);
      } catch (err) {
        console.error("Error al traer cartas:", err);
      }
    }

    fetchCartas();
  }, []);

  const handleSearch = async (raw: string) => {
    const text = raw.trim();
    setResolveError(null);

    if (!text) {
      setFilters((prev: any) => ({ ...prev, query: "" }));
      return;
    }

    const m = text.match(POKEMON_CODE_RE);
    if (m) {
      setResolving(true);
      try {
        const res = await fetchApi(
          `/api/cartas/resolve/pokemon?set=${encodeURIComponent(m[2])}&number=${encodeURIComponent(m[3])}`
        );
        const data = await res.json();
        if (res.ok && data.data?.name) {
          setFilters((prev: any) => ({ ...prev, query: data.data.name }));
          setResolving(false);
          return;
        }
        setResolveError(`No se encontró la carta ${m[2]} #${m[3]}`);
      } catch {
        setResolveError("No se pudo conectar con el servidor.");
      }
      setResolving(false);
    }

    setFilters((prev: any) => ({ ...prev, query: text }));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSearch(searchText);
  };

  const handleClear = () => {
    setSearchText("");
    setResolveError(null);
    setFilters((prev: any) => ({ ...prev, query: "" }));
    inputRef.current?.focus();
  };

  const filteredProducts = filterProducts(products || []);

  const cities: string[] = Array.from(
    new Set(
      (products as any[]).flatMap((p: any) =>
        (p.intermediarios || []).map((i: any) => i.direccion?.ciudad).filter(Boolean)
      )
    )
  ).sort() as string[];

  return (
    <main className="min-h-screen bg-green-50 p-5">
      <h1>Cartas disponibles</h1>

      {/* Buscador */}
      <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 mb-4 flex flex-col gap-2">
        <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
          Buscar carta
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: Pikachu, Charizard PAR 4, Pikachu ex SV3 123"
              className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition pr-8"
            />
            {searchText && (
              <button
                onClick={handleClear}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>
          <button
            onClick={() => handleSearch(searchText)}
            disabled={resolving}
            className="px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
          >
            {resolving ? "Buscando…" : "Buscar"}
          </button>
        </div>
        {filters.query && !resolveError && (
          <p className="text-xs text-gray-500">
            Mostrando resultados para: <span className="font-semibold">{filters.query}</span>
          </p>
        )}
        {resolveError && (
          <p className="text-xs text-red-500">{resolveError}</p>
        )}
        <p className="text-xs text-gray-400">
          Pokémon: podés buscar por nombre, o con el formato <span className="font-mono">Nombre SETID Número</span> (ej: <span className="font-mono">Pikachu ex PAR 239</span>)
        </p>
      </div>

      <ProductFilters cities={cities} />
      <Products products={filteredProducts} />
    </main>
  );
}
