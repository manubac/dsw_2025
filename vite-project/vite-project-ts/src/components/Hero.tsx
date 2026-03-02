
import { Link } from 'react-router-dom'
import { useUser } from '../context/user'
import { useState } from 'react'


import hero3 from '../assets/img/hero3.png'

export function Hero() {
  const { user } = useUser()

  return (
    <section className="relative overflow-hidden min-h-screen flex items-center">
      <img
          src={hero3}
          className="absolute inset-0 w-full h-full object-cover"
          alt="Hero background"
            />
            <div className="absolute inset-0 bg-black/40"></div>
              {/* wrapper full width */}
  <div className="relative w-full">
      <div className="relative container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 items-center gap-10">

        {/* TEXTO (esto es tu hero original) */}
        <div className="hero-content text-white">
          <h1 className="text-5xl sm:text-6xl 
          lg:text-7xl font-bold text-white">
            PokemonCard Market 
          </h1>

          <p className="text-sm">
            Encuentra las mejores cartas y completa tu colección.
          </p>

          <div className="buttons mt-6 flex gap-4">
            <Link to="/cards" className="bg-gradient-to-r from-primary to-secondary
            hover:scale-105 duration-200 text-white py-2 px-4 rounded-full">
              Ver stock
            </Link>

            {user?.role === 'vendedor' && (
              <Link to="/publicar" className="bg-gradient-to-r from-primary to-secondary
            hover:scale-105 duration-200 text-white py-2 px-4 rounded-full">
                Publicar carta
              </Link>
            )}
          </div>
        </div>



      
      </div>
    </div>
    </section>
  )
}