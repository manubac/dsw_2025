import { useContext } from 'react'
import { FiltersContext } from '../context/filters'
import { CartContext } from '../context/cart'
import './footer.css';

export function Footer() {
  const { filters } = useContext(FiltersContext)
  const { cart } = useContext(CartContext)
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-section">
          <h4>PokemonCard Market</h4>
          <p>Encuentra las mejores cartas y completa tu colección.</p>
        </div>
        <div className="footer-section">
          <h5>Enlaces útiles</h5>
          <ul>
            <li><a href="/">Inicio</a></li>
            <li><a href="/cards">Cartas</a></li>
            <li><a href="/contact">Contacto</a></li>
          </ul>
        </div>
        <div className="footer-section">
          <h5>Contacto</h5>
          <p>Email: soporte@pokemoncard.com</p>
          <p>Teléfono: +54 11 1234-5678</p>
        </div>
      </div>
    </footer>
  );
}
