import './Hero.css'
import { Link } from 'react-router-dom'

export function Hero () {
  return (
    <section className='hero'>
      <div className='hero-content'>
        <h1>Your Pokémon TCG Destination</h1>
        <p>Find the rarest cards and complete your collection.</p>
        <Link to="/register" className="cta-button">Create Account</Link>
      </div>
    </section>
  )
}
