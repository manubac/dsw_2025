import { Link, useNavigate, useLocation } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { CartContext } from "../context/cart";
import { FiltersContext } from "../context/filters";
import { useUser } from "../context/user";
import { X, MessageSquare } from "lucide-react";
import { OrdersDropdown } from "./OrdersDropdown";
import { fetchApi } from "../services/api";
import { MdSearch } from "react-icons/md";

const POKEMON_CODE_RE = /^(.+?)\s+([A-Z][A-Z0-9]{1,7})\s+(\d+)$/;

const JUEGOS = [
  { value: 'pokemon',   label: '🎮 Pokémon' },
  { value: 'magic',     label: '⚔️ Magic' },
  { value: 'yugioh',    label: '👁️ Yu-Gi-Oh!' },
  { value: 'digimon',   label: '🦕 Digimon' },
  { value: 'riftbound', label: '⚡ Riftbound' },
] as const

type GameSlug = typeof JUEGOS[number]['value']
const PLACEHOLDERS: Record<GameSlug, string> = {
  pokemon:   'Ej: Pikachu, Charizard PAR 4…',
  magic:     'Ej: Black Lotus, Lightning Bolt',
  yugioh:    'Ej: Dark Magician, Blue-Eyes…',
  digimon:   'Ej: Agumon, Omnimon',
  riftbound: 'Ej: Jinx, Jinx 001',
}

export function Header() {
  const { cart } = useContext(CartContext);
  const { filters, setFilters } = useContext(FiltersContext);
  const { user, logout } = useUser();
  const location = useLocation();
  const isCardsPage = location.pathname === '/cards';

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartas, setCartas] = useState<any[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchCartas() {
      try {
        const res = await fetchApi('/api/cartas');
        const json = await res.json();
        setCartas(json.data || []);
      } catch (err) {
        console.error("Error al traer cartas:", err);
      }
    }
    fetchCartas();
  }, []);

  useEffect(() => {
    if (!isCardsPage) {
      setResolveError(null);
      setResolving(false);
    }
  }, [isCardsPage]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setResolveError(null);
    setSelectedIndex(-1);

    if (value.trim() === "") {
      setFilters((prev: any) => ({ ...prev, query: "", queryAliases: [] }));
      setResults([]);
    } else {
      setFilters((prev: any) => ({ ...prev, query: value }));
      if (!isCardsPage) {
        const filtered = cartas.filter((carta) =>
          carta.title.toLowerCase().includes(value.toLowerCase())
        );
        setResults(filtered.slice(0, 5));
      }
    }
  };

  const handleResultClick = (card: any) => {
    setResults([]);
    setQuery(card.title);
    navigate(`/card/${card.id}`);
  };

  const handleClearSearch = () => {
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
    setResolveError(null);
    setFilters((prev: any) => ({ ...prev, query: "", queryAliases: [] }));
  };

  const handleGameChange = (value: string) => {
    setResolveError(null);
    setResolving(false);
    setFilters((prev: any) => ({
      ...prev,
      game: value,
      queryAliases: [],
      collection: 'all',
      rarity: 'all',
      minPrice: 0,
      maxPrice: 999999,
    }));
  };

  const handleSearchSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => prev < results.length - 1 ? prev + 1 : 0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => prev > 0 ? prev - 1 : results.length - 1);
        break;
      case 'Enter': {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
          break;
        }
        if (isCardsPage && filters.game === 'pokemon') {
          const text = query.trim();
          if (text) {
            const m = text.match(POKEMON_CODE_RE);
            if (m) {
              setResolving(true);
              setResolveError(null);
              try {
                const params = new URLSearchParams({ set: m[2], number: m[3] });
                if (m[1]) params.set('name', m[1]);
                const res = await fetchApi(`/api/cartas/resolve/pokemon?${params}`);
                const data = await res.json();
                if (res.ok && data.data?.name) {
                  const resolved = data.data.name;
                  setQuery(resolved);
                  setFilters((prev: any) => ({ ...prev, query: resolved, queryAliases: [] }));
                  fetchApi(`/api/cartas/resolve-names?q=${encodeURIComponent(resolved)}`)
                    .then(r => r.json())
                    .then(aliasData => {
                      const aliases = (aliasData.names as string[] || []).filter(
                        (n: string) => n.toLowerCase() !== resolved.toLowerCase()
                      );
                      if (aliases.length > 0) {
                        setFilters((prev: any) => ({ ...prev, queryAliases: aliases }));
                      }
                    })
                    .catch(() => {});
                  setResolving(false);
                  break;
                }
                setResolveError(`No se encontró la carta ${m[2]} #${m[3]}`);
              } catch {
                setResolveError('No se pudo conectar con el servidor.');
              }
              setResolving(false);
              break;
            }
          }
        }
        if (!isCardsPage) {
          setResults([]);
          navigate('/cards');
        }
        break;
      }
      case 'Escape':
        setResults([]);
        setSelectedIndex(-1);
        setResolveError(null);
        break;
    }
  };

  const handleUserClick = () => {
    if (user) {
      setUserMenuOpen(!userMenuOpen);
    } else {
      navigate("/login");
    }
  };

  const handleProfileClick = () => {
    setUserMenuOpen(false);
    if (user?.role === 'vendedor') {
      navigate("/mi-perfil");
    } else if (user?.role === 'user' || user?.role === 'usuario') {
      navigate("/mi-perfil-usuario");
    } else if (user?.role === 'tiendaRetiro') {
      navigate("/tienda-retiro/perfil");
    } else {
      navigate("/profile");
    }
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;

    const confirmDelete = window.confirm(
      "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer."
    );

    if (!confirmDelete) return;

    try {
      let endpoint = "";
      if (user.role === "vendedor") {
        endpoint = `/api/vendedores/${user.id}`;
      } else if (user.role === "intermediario") {
        endpoint = `/api/intermediarios/${user.id}`;
      } else {
        endpoint = `/api/users/${user.id}`;
      }

      const response = await fetchApi(endpoint, {
        method: "DELETE",
      });

      if (response.ok) {
        logout();
        navigate("/");
        alert("Cuenta eliminada exitosamente.");
      } else {
        alert("Error al eliminar la cuenta.");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Error al eliminar la cuenta.");
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".user-menu-container")) {
        setUserMenuOpen(false);
      }
      if (!target.closest(".search-container")) {
        setResults([]);
        setSelectedIndex(-1);
        setResolveError(null);
      }
    };

    if (userMenuOpen || results.length > 0 || resolveError) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen, results.length, resolveError]);

  const cartCount = cart.reduce(
    (sum: number, item: any) => sum + (item.quantity || 0),
    0
  );

 return (
  <header className="sticky top-0 z-50">
    <div className="shadow-md bg-white dark:bg-gray-900 dark:text-white duration-200 relative z-40">
      <div className="container flex items-center justify-between h-16">

        {/* Logo */}
        <div className="flex items-center">
          <Link to="/" className="font-bold text-2xl sm:text-3xl flex gap-2 items-center">
            <img src="/logo.png" alt="Pokémon Logo" className="w-20" />
          </Link>
        </div>

        {/* Buscador */}
        <div className="flex-1 flex justify-center items-center gap-2">
          <select
            value={filters.game}
            onChange={e => handleGameChange(e.target.value)}
            className="hidden sm:block px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:border-primary transition text-sm shrink-0"
          >
            {JUEGOS.map(j => (
              <option key={j.value} value={j.value}>{j.label}</option>
            ))}
          </select>
          <div
            className="relative hidden sm:block z-10 search-container
            w-[280px] focus-within:w-[380px] transition-all duration-300"
          >
            <input
              type="text"
              className="w-full rounded-full border border-gray-300
              px-4 pr-16 py-1.5 focus:outline-none focus:border-primary
              transition-all duration-300 select-none disabled:opacity-60"
              placeholder={PLACEHOLDERS[filters.game as GameSlug] ?? 'Buscar cartas...'}
              value={query}
              onChange={handleSearch}
              onKeyDown={handleSearchSubmit}
              disabled={resolving}
            />

            <MdSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />

            {results.length > 0 && (
              <ul className="absolute top-full mt-2 w-full bg-white border rounded-lg shadow-lg z-50">
                {results.map((card, index) => (
                  <li
                    key={card.id}
                    onClick={() => handleResultClick(card)}
                    className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-orange-100 ${
                      selectedIndex === index ? "bg-gray-100" : ""
                    }`}
                  >
                    <img
                      src={card.thumbnail || card.image || "/no-image.png"}
                      alt={card.title}
                      className="w-8 h-8 object-cover rounded"
                    />
                    <span className="text-sm">{card.title}</span>
                  </li>
                ))}
              </ul>
            )}

            {resolveError && (
              <div className="absolute top-full mt-2 w-full bg-white border border-red-200 rounded-lg shadow-lg z-50 px-3 py-2">
                <p className="text-xs text-red-500">{resolveError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Usuario */}
        <div className="flex items-center gap-4">
          {user && (
            <>
              <OrdersDropdown />
              <button
                onClick={() => navigate('/chats')}
                className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
                title="Mis chats"
              >
                <MessageSquare size={20} />
              </button>
            </>
          )}
          <div className="relative z-[60] user-menu-container">
            <button
              onClick={handleUserClick}
              className="flex items-center gap-2 px-3 py-1 rounded hover:bg-orange-100"
            >
              {user ? user.name : "Usuario"}
              {user && (
                <span
                  className={`transition-transform ${
                    userMenuOpen ? "rotate-180" : ""
                  }`}
                >
                  ▼
                </span>
              )}
            </button>

            {user && userMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white border rounded-lg shadow-lg z-[70]">
                {user.role === 'tiendaRetiro' ? (
                  <>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/tienda-retiro/perfil'); }}
                      className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                    >
                      Mi Perfil
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/purchases'); }}
                      className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                    >
                      Mis Compras
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/mis-ventas'); }}
                      className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                    >
                      Mis Ventas
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/tienda-retiro/ventas'); }}
                      className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                    >
                      Gestión de pedidos
                    </button>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                    >
                      Cerrar Sesión
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={handleProfileClick} className="block w-full text-left px-4 py-2 hover:bg-orange-100">
                      Mi Perfil
                    </button>

                    {(user.role === 'user' || user.role === 'usuario') && (
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate('/wishlist'); }}
                        className="block w-full text-left px-4 py-2 hover:bg-orange-100 text-red-500 font-medium"
                      >
                        ♥ Mis Favoritos
                      </button>
                    )}

                    {(user.role === 'user' || user.role === 'usuario') && (
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate('/purchases'); }}
                        className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                      >
                        Mis Compras
                      </button>
                    )}

                    {user.role === 'vendedor' && (
                      <>
                        <button
                          onClick={() => { setUserMenuOpen(false); navigate('/purchases'); }}
                          className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                        >
                          Mis Compras
                        </button>
                        <button
                          onClick={() => { setUserMenuOpen(false); navigate('/wishlist'); }}
                          className="block w-full text-left px-4 py-2 hover:bg-orange-100 text-red-500 font-medium"
                        >
                          ♥ Mis Favoritos
                        </button>
                        <button
                          onClick={() => { setUserMenuOpen(false); navigate('/mis-ventas'); }}
                          className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                        >
                          Mis Ventas
                        </button>
                      </>
                    )}

                    {user.role === 'intermediario' && (
                      <button
                        onClick={() => { setUserMenuOpen(false); navigate('/intermediario'); }}
                        className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                      >
                        Panel de Intermediario
                      </button>
                    )}

                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                    >
                      Cerrar Sesión
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  </header>
);
}
