
import { useState } from "react";
// import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/user";

import { api, fetchApi } from "../services/api";

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
  const navigate = useNavigate();
  const { user } = useUser();

  const buscarCartas = async () => {
    try {
      const response = await fetchApi(`/api/cartas/scrape/${nombre}`);
      const data = await response.json();
      setResultados(data.data);
      setMensaje("");
    } catch (error) {
      console.error("Error buscando cartas:", error);
      setResultados([]);
      setMensaje("No se encontraron cartas con ese nombre.");
    }
  };

  const crearCartaManual = () => {
    if (!user) {
      setMensaje("Debes iniciar sesión como vendedor para crear una carta.");
      return;
    }

    // Navigate to edit page with empty carta
    navigate("/editar-carta", { state: { carta: { name: "", uploader: { id: user.id } } } });
  };

  const irAEditarCarta = async (carta: Carta) => {
    if (!user) {
      setMensaje("Debes iniciar sesión como vendedor para publicar una carta.");
      return;
    }

    try {
      // Create Carta on backend and include vendedor id so uploader is linked
      const res = await api.post("/api/cartas", {
        name: carta.name,
        price: carta.price ?? null,
        image: carta.image ?? null,
        link: carta.link ?? null,
        rarity: carta.rarity ?? null,
        setName: carta.setName ?? null,
        userId: user.id,
      });

      const created = res.data?.data;
      if (!created) {
        setMensaje("No se pudo crear la carta en el servidor.");
        return;
      }

      navigate("/editar-carta", { state: { carta: created } });
    } catch (err) {
      console.error("Error creating carta:", err);
      setMensaje("Error al crear la carta. Revisa la consola del servidor.");
    }
  };

  return (
  <div className="max-w-6xl mx-auto px-4 py-10">

    {/* Card principal */}
    <div className="
      bg-gradient-to-b
      from-green-50
      to-transparent
      rounded-2xl
      shadow-xl
      p-8
      space-y-6
    ">
      <h2 className="text-3xl font-bold text-center">
        Publicar nueva carta
      </h2>

      {/* Buscador */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Buscar carta (ej. Pikachu)"
          className="
            border
            rounded-xl
            px-4
            py-2
            w-full
            max-w-md
            outline-none
            focus:ring-2
            focus:ring-green-400
          "
        />

        <button
          onClick={buscarCartas}
          className="
            bg-green-500
            hover:bg-green-600
            text-white
            font-semibold
            px-6
            py-2
            rounded-xl
            transition
            shadow-md
          "
        >
          Buscar
        </button>
      </div>

      {/* Crear manual */}
      <div className="flex justify-center">
        <button
          onClick={crearCartaManual}
          className="
            border-2 border-green-500
            text-green-600
            font-semibold
            px-6
            py-2
            rounded-xl
            hover:bg-green-100
            transition
          "
        >
          Crear Carta Manual
        </button>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <p className="text-center text-sm text-gray-600">
          {mensaje}
        </p>
      )}
    </div>

    {/* Resultados */}
    {resultados.length > 0 && (
      <div className="
        grid
        grid-cols-1
        sm:grid-cols-2
        md:grid-cols-3
        lg:grid-cols-4
        gap-6
        mt-10
      ">
        {resultados.map((carta, i) => (
          <div
            key={i}
            className="
              bg-gradient-to-b
              from-green-50
              to-transparent
              rounded-2xl
              shadow-md
              p-4
              flex flex-col
              items-center
              transition
              hover:scale-[1.02]
            "
          >
            {carta.image && (
              <img
                src={carta.image}
                alt={carta.name}
                className="
                  w-[150px]
                  h-[210px]
                  object-contain
                  mb-2
                "
              />
            )}

            <h3 className="text-lg font-semibold text-center">
              {carta.name}
            </h3>

            <p className="text-sm text-gray-600 text-center">
              {carta.rarity || "Rareza desconocida"}
            </p>

            {carta.price && (
              <p className="text-green-600 font-bold mt-1">
                {carta.price}
              </p>
            )}

            <button
              onClick={() => irAEditarCarta(carta)}
              className="
                mt-4
                w-full
                bg-green-500
                hover:bg-green-600
                text-white
                py-2
                rounded-xl
                font-semibold
                transition
                shadow-sm
              "
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
