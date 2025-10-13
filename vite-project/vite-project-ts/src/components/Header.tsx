import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { CartContext } from "../context/cart";
import { FiltersContext } from "../context/filters";
import cartasData from "../mocks/cartas.json"; // 👈 tu JSON con 'products'
import "./Header.css";

export function Header() {
  const { cart } = useContext(CartContext);
  const { setFilters } = useContext(FiltersContext);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const navigate = useNavigate();

  const cartas = cartasData.products; 

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser).nombre);
    }
  }, []);

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
      setResults(filtered.slice(0, 5)); // máximo 5 resultados
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
          👤 {user ? user : "Usuario"}
        </button>
      </div>
    </header>
  );
}
