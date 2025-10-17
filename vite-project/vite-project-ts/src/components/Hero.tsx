import './Hero.css'
import { Link } from 'react-router-dom'
import { useUser } from '../context/user'

export function Hero() {
  const { user } = useUser() //  traemos el usuario del contexto

  return (
    <section className='hero'>
      <div className='hero-content'>
        <h1>PokemonCard Market</h1>
        <p>Encuentra las mejores cartas y completa tu colección.</p>

        <div className="buttons">
          <Link to="/cards" className="cta-button">Ver stock</Link>

          {/*  solo se muestra si el usuario logueado es vendedor */}
          {user?.role === 'vendedor' && (
            <Link to="/publicar" className="cta-button-secondary">
              Publicar carta
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}

