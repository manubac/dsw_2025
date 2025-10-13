import './Hero.css'
import { Link } from 'react-router-dom'

export function Hero () {
  return (
    <section className='hero'>
      <div className='hero-content'>
        <h1>PokemonCard Market</h1>
        <p>Encuentra las mejores cartas y completa tu colección.</p>
        <Link to="/cards" className="cta-button">Ver stock</Link>
      </div>
    </section>
  )
}
