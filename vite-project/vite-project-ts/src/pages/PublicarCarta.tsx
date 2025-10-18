import { useState } from "react";
import axios from "axios";


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
    <div className="p-6 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-4">Publicar nueva carta</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Buscar Pokémon (ej. pikachu)"
          className="border p-2 flex-1 rounded"
        />
        <button onClick={buscarCarta} className="bg-blue-500 text-white px-4 py-2 rounded">
          Buscar
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm text-gray-700">{mensaje}</p>}

      {carta && (
        <div className="border rounded p-4 mb-4 shadow-md">
          <img src={carta.imagen} alt={carta.nombre} className="w-32 mx-auto" />
          <h3 className="text-xl font-semibold text-center mt-2 capitalize">{carta.nombre}</h3>
          <p className="text-center text-gray-600">{carta.tipo}</p>
          <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
            <p>HP: {carta.hp}</p>
            <p>Ataque: {carta.ataque}</p>
            <p>Defensa: {carta.defensa}</p>
            <p>Velocidad: {carta.velocidad}</p>
          </div>
          <button
            onClick={publicarCarta}
            className="bg-green-500 text-white px-4 py-2 mt-4 w-full rounded"
          >
            Publicar carta
          </button>
        </div>
      )}
    </div>
  );
}
