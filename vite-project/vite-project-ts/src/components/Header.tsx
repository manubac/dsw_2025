import { Link, useNavigate } from "react-router-dom";
import { useContext, useState } from "react";
import { CartContext } from "../context/cart";
import { FiltersContext } from "../context/filters";
import { useUser } from "../context/user"; //  usamos el contexto global
import cartasData from "../mocks/cartas.json";
import "./Header.css";

export function Header() {
  const { cart } = useContext(CartContext);
  const { setFilters } = useContext(FiltersContext);
  const { user, logout } = useUser(); //  traemos user y logout del contexto

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const navigate = useNavigate();

  const cartas = cartasData.products;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setFilters((prev: any) => ({ ...prev, query: value }));

    if (value.trim() === "") {
      setResults([]);
    } else {
      const filtered = cartas.filter((carta) =>
        carta.title.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered.slice(0, 5));
    }
  };

  const handleResultClick = (title: string) => {
    setQuery(title);
    setResults([]);
    setFilters((prev: any) => ({ ...prev, query: title }));
    navigate("/cards");
  };

  const handleUserClick = () => {
    if (user) navigate("/profile");
    else navigate("/login");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

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
          <input
            type="text"
            className="search-input"
            placeholder="Buscar cartas..."
            value={query}
            onChange={handleSearch}
          />
          {results.length > 0 && (
            <ul className="search-dropdown">
              {results.map((card) => (
                <li
                  key={card.id}
                  onClick={() => handleResultClick(card.title)}
                  className="search-item"
                >
                  <img
                    src={card.thumbnail}
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
        <button onClick={handleUserClick} className="nav-button">
          👤 {user ? user.name : "Usuario"}
        </button>

        {user && (
          <button onClick={handleLogout} className="logout-button">
            Cerrar sesión
          </button>
        )}

        {cartCount > 0 && (
          <Link to="/cart" className="nav-button">
            🛒 {cartCount}
          </Link>
        )}
      </div>
    </header>
  );
}
