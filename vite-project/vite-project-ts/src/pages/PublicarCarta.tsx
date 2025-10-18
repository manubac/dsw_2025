import { useState } from "react";
import axios from "axios";

interface Carta {
  name: string;
  price?: string;
  image?: string;
  link?: string;
  rarity?: string;
  setName?: string;
}

export default function PublicarCartaPage() {
  const [nombre, setNombre] = useState("");
  const [resultados, setResultados] = useState<Carta[]>([]);
  const [mensaje, setMensaje] = useState("");

  // Buscar cartas por nombre usando tu backend (scraping)
  const buscarCartas = async () => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/cartas/scrape/${nombre}`
      );
      setResultados(response.data.data);
      setMensaje("");
    } catch (error) {
      console.error("Error buscando cartas:", error);
      setResultados([]);
      setMensaje("❌ No se encontraron cartas con ese nombre.");
    }
  };

  // Publicar carta seleccionada
  const publicarCarta = async (carta: Carta) => {
    try {
      await axios.post("http://localhost:3000/api/cartas", {
        name: carta.name,
        price: carta.price,
        image: carta.image,
        link: carta.link,
        rarity: carta.rarity,
        setName: carta.setName,
        cartaClass: null, // por ahora no vinculamos clase
        items: [], // vacío por ahora
      });
      setMensaje("✅ Carta publicada con éxito.");
    } catch (error) {
      console.error("Error al publicar carta:", error);
      setMensaje("❌ Error al publicar la carta.");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">Publicar nueva carta</h2>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Buscar carta (ej. Pikachu)"
          className="border p-2 flex-1 rounded"
        />
        <button
          onClick={buscarCartas}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Buscar
        </button>
      </div>

      {mensaje && (
        <p className="mb-4 text-sm text-gray-700 text-center">{mensaje}</p>
      )}

      {resultados.length > 0 && (
        <div className="grid gap-4">
          {resultados.map((carta, i) => (
            <div
              key={i}
              className="border rounded-lg p-4 shadow-md flex flex-col items-center"
            >
              {carta.image && (
                <img
                  src={carta.image}
                  alt={carta.name}
                  className="w-40 h-56 object-contain mb-2"
                />
              )}
              <h3 className="text-lg font-semibold text-center">{carta.name}</h3>
              <p className="text-sm text-gray-600 text-center">
                {carta.rarity || "Rareza desconocida"}
              </p>
              {carta.price && (
                <p className="text-green-600 font-bold mt-1">{carta.price}</p>
              )}
              <button
                onClick={() => publicarCarta(carta)}
                className="bg-green-500 text-white px-4 py-2 mt-3 rounded"
              >
                Publicar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
