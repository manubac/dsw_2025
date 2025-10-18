import { Link, useNavigate } from "react-router-dom";
import { useContext, useState, useEffect } from "react";
import { CartContext } from "../context/cart";
import { FiltersContext } from "../context/filters";
import { useUser } from "../context/user";
import cartasData from "../mocks/cartas.json";
import "./Header.css";

export function Header() {
  const { cart } = useContext(CartContext);
  const { setFilters } = useContext(FiltersContext);
  const { user, logout } = useUser();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  const cartas = cartasData.products;

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setFilters((prev: any) => ({ ...prev, query: value }));
    setSelectedIndex(-1); // Reset selection when search changes

    if (value.trim() === "") {
      setResults([]);
    } else {
      const filtered = cartas.filter((carta) =>
        carta.title.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered.slice(0, 5));
    }
  };

  const handleResultClick = (card: any) => {
    setResults([]);
    setQuery(card.title);
    navigate(`/card/${card.id}`);
  };

  const handleSearchSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) {
      if (e.key === 'Enter') {
        setResults([]);
        navigate("/cards");
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        } else {
          setResults([]);
          navigate("/cards");
        }
        break;
      case 'Escape':
        setResults([]);
        setSelectedIndex(-1);
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
    navigate("/profile");
  };

  const handleLogout = () => {
    setUserMenuOpen(false);
    logout();
    navigate("/");
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
      if (!target.closest('.search-container')) {
        setResults([]);
        setSelectedIndex(-1);
      }
    };

    if (userMenuOpen || results.length > 0) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
          <input
            type="text"
            className="search-input"
            placeholder="Buscar cartas..."
            value={query}
            onChange={handleSearch}
            onKeyDown={handleSearchSubmit}
          />
          {results.length > 0 && (
            <ul className="search-dropdown">
              {results.map((card, index) => (
                <li
                  key={card.id}
                  onClick={() => handleResultClick(card)}
                  className={`search-item ${selectedIndex === index ? 'selected' : ''}`}
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
        <div className="user-menu-container">
          <button onClick={handleUserClick} className="nav-button user-button">
            👤 {user ? user.name : "Usuario"}
            {user && <span className={`dropdown-arrow ${userMenuOpen ? 'open' : ''}`}>▼</span>}
          </button>
          
          {user && userMenuOpen && (
            <div className="user-dropdown">
              <button onClick={handleProfileClick} className="dropdown-item">
                👤 Mi Perfil
              </button>
              <button onClick={handleLogout} className="dropdown-item logout-item">
                🚪 Cerrar Sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
