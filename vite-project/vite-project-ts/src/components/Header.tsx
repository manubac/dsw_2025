import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { CartContext } from "../context/cart";
import { FiltersContext } from "../context/filters";
import { useUser } from "../context/user";
import { X } from "lucide-react";
import { fetchApi } from "../services/api";
import { MdSearch } from "react-icons/md";


export function Header() {
  const { cart } = useContext(CartContext);
  const { setFilters } = useContext(FiltersContext);
  const { user, logout } = useUser();


  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cartas, setCartas] = useState<any[]>([]);
  const navigate = useNavigate();

  //  Traer cartas publicadas desde el backend
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

  //  Buscar cartas por título
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setFilters((prev: any) => ({ ...prev, query: value }));
    setSelectedIndex(-1);

    if (value.trim() === "") {
      setResults([]);
    } else {
      const filtered = cartas.filter((carta) =>
        carta.title.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered.slice(0, 5)); // limitar a 5 resultados
    }
  };

  //  Click sobre una carta en el dropdown
  const handleResultClick = (card: any) => {
    setResults([]);
    setQuery(card.title);
    navigate(`/card/${card.id}`);
  };

  //  Limpiar buscador
  const handleClearSearch = () => {
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
    setFilters((prev: any) => ({ ...prev, query: "" }));
  };

  //  Enter, flechas, etc.
  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === "Enter") {
        setResults([]);
        navigate("/cards");
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        } else {
          setResults([]);
          navigate("/cards");
        }
        break;
      case "Escape":
        setResults([]);
        setSelectedIndex(-1);
        break;
    }
  };

  //  Usuario
  const handleUserClick = () => {
    if (user) {
      setUserMenuOpen(!userMenuOpen);
    } else {
      navigate("/login");
    }
  };

  const handleProfileClick = () => {
    setUserMenuOpen(false);
    navigate("/profile");
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
      // elegir endpoint según rol
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

  //  Cerrar menú o resultados al hacer click afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".user-menu-container")) {
        setUserMenuOpen(false);
      }
      if (!target.closest(".search-container")) {
        setResults([]);
        setSelectedIndex(-1);
      }
    };

    if (userMenuOpen || results.length > 0) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen, results.length]);

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
<div className="flex-1 flex justify-center">
  <div
    className="relative hidden sm:block z-10 search-container
    w-[280px] focus-within:w-[380px] transition-all duration-300"
  >
    <input
      type="text"
      className="w-full rounded-full border border-gray-300
      px-4 pr-16 py-1.5 focus:outline-none focus:border-primary
      transition-all duration-300 select-none"
      placeholder="Buscar cartas..."
      value={query}
      onChange={handleSearch}
      onKeyDown={handleSearchSubmit}
    />

    {/* Icono lupa */}
    <MdSearch className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />


    {/* Resultados */}
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
  </div>
</div>
        {/* Usuario */}
        <div className="flex items-center gap-4">
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
                <button onClick={handleProfileClick} className="block w-full text-left px-4 py-2 hover:bg-orange-100">
                  Mi Perfil
                </button>

                {user.role === 'user' && (
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/purchases') }}
                    className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                  >
                    Mis Compras
                  </button>
                )}

                {user.role === 'vendedor' && (
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/mis-publicaciones') }}
                    className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                  >
                    Mis Publicaciones
                  </button>
                )}

                {user.role === 'vendedor' && (
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/mis-ventas') }}
                    className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                  >
                    Mis Ventas
                  </button>
                )}

                {user.role === 'usuario' && (
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/purchases') }}
                    className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                  >
                    Mis Compras
                  </button>
                )}

                {user.role === 'intermediario' && (
                  <button
                    onClick={() => { setUserMenuOpen(false); navigate('/intermediario') }}
                    className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                  >
                    Panel de Intermediario
                  </button>
                )}

                <button
                  onClick={handleDeleteAccount}
                  className="block w-full text-left px-4 py-2 text-red-500 hover:bg-orange-100"
                >
                  Eliminar Cuenta
                </button>

                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 hover:bg-orange-100"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  </header>
);
}