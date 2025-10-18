import { useState } from "react";
import axios from "axios";
import './PublicarCarta.css';


interface Carta {
  nombre: string;
  tipo: string;
  hp: number;
  ataque: number;
  defensa: number;
  velocidad: number;
  imagen: string;
}

export default function PublicarCartaPage() {
  const [nombre, setNombre] = useState("");
  const [carta, setCarta] = useState<Carta | null>(null);
  const [mensaje, setMensaje] = useState("");

  // Buscar carta desde tu backend
  const buscarCarta = async () => {
    try {
      const response = await axios.get(`http://localhost:3000/api/cartas/search/${nombre}`);
      setCarta(response.data);
      setMensaje("");
    } catch (error) {
      setCarta(null);
      setMensaje("No se encontró ninguna carta con ese nombre.");
    }
  };

  // Publicar carta en tu base de datos
  const publicarCarta = async () => {
    if (!carta) return;

    try {
      await axios.post("http://localhost:3000/api/cartas", carta);
      setMensaje("✅ Carta publicada con éxito.");
      setCarta(null);
      setNombre("");
    } catch (error) {
      setMensaje( "Error al publicar la carta.");
    }
  };

  return (
    <div className="publicar-carta-container">
      <h2 className="publicar-carta-title">Publicar nueva carta</h2>

      <div className="search-section">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Buscar Pokémon (ej. Pikachu)"
          className="search-input"
        />
        <button onClick={buscarCarta} className="search-button">
          Buscar
        </button>
      </div>

      {mensaje && <p className="message-text">{mensaje}</p>}

      {carta && (
        <div className="card-preview">
          <img src={carta.imagen} alt={carta.nombre} className="card-image" />
          <h3 className="card-name">{carta.nombre}</h3>
          <p className="card-type">{carta.tipo}</p>
          <div className="card-stats">
            <p>HP: {carta.hp}</p>
            <p>Ataque: {carta.ataque}</p>
            <p>Defensa: {carta.defensa}</p>
            <p>Velocidad: {carta.velocidad}</p>
          </div>
          <button
            onClick={publicarCarta}
            className="publish-button"
          >
            Publicar carta
          </button>
        </div>
      )}
    </div>
  );
}
