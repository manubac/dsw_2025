import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { CartContext } from "../context/cart";
import { FiltersContext } from "../context/filters";
import { useUser } from "../context/user";
import { X } from "lucide-react";
import "./Header.css";

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
        const res = await fetch("http://localhost:3000/api/cartas"); //variable de ambiente 
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

      const response = await fetch(endpoint, {
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
    <header className="header">
      <div className="header-left">
        <Link to="/" className="brand-link">
          <img src="/logo.png" alt="Pokémon Logo" className="brand-logo" />
        </Link>
      </div>

      <div className="header-center">
        <div className="search-container">
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              placeholder="Buscar cartas..."
              value={query}
              onChange={handleSearch}
              onKeyDown={handleSearchSubmit}
            />
            {query && (
              <button
                className="clear-search-button"
                onClick={handleClearSearch}
                title="Limpiar búsqueda"
              >
                <X className="clear-icon" />
              </button>
            )}
          </div>

          {results.length > 0 && (
            <ul className="search-dropdown">
              {results.map((card, index) => (
                <li
                  key={card.id}
                  onClick={() => handleResultClick(card)}
                  className={`search-item ${
                    selectedIndex === index ? "selected" : ""
                  }`}
                >
                  <img
                    src={card.thumbnail || card.image || "/no-image.png"}
                    alt={card.title}
                    className="search-item-image"
                  />
                  <span className="search-item-title">{card.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="header-right">
        <div className="user-menu-container">
          <button onClick={handleUserClick} className="nav-button user-button">
            {user ? user.name : "Usuario"}
            {user && (
              <span
                className={`dropdown-arrow ${userMenuOpen ? "open" : ""}`}
              >
                ▼
              </span>
            )}
          </button>

          {user && userMenuOpen && (
            <div className="user-dropdown">
              <button onClick={handleProfileClick} className="dropdown-item">
                Mi Perfil
              </button>
              {user.role === 'vendedor' && (
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/mis-publicaciones') }}
                  className="dropdown-item"
                >
                  Mis Publicaciones
                </button>
              )}
              {user.role === 'vendedor' && (
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/mis-ventas') }}
                  className="dropdown-item"
                >
                  Mis Ventas
                </button>
              )}
              {user.role === 'usuario' && (
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/purchases') }}
                  className="dropdown-item"
                >
                  Mis Compras
                </button>
              )}
              {user.role === 'intermediario' && (
                <button
                  onClick={() => { setUserMenuOpen(false); navigate('/intermediario') }}
                  className="dropdown-item"
                >
                  Panel de Intermediario
                </button>
              )}
              <button
                onClick={handleDeleteAccount}
                className="dropdown-item delete-item"
              >
                Eliminar Cuenta
              </button>
              <button
                onClick={handleLogout}
                className="dropdown-item logout-item"
              >
                Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
 