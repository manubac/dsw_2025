
import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/user";
import "../components/CardForm.css";

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
      const response = await axios.get(
        `http://localhost:3000/api/cartas/scrape/${nombre}`
      );
      setResultados(response.data.data);
      setMensaje("");
    } catch (error) {
      console.error("Error buscando cartas:", error);
      setResultados([]);
      setMensaje("No se encontraron cartas con ese nombre.");
    }
  };

  const irAEditarCarta = async (carta: Carta) => {
    if (!user) {
      setMensaje("Debes iniciar sesión como vendedor para publicar una carta.");
      return;
    }

    try {
      // Create Carta on backend and include vendedor id so uploader is linked
      const res = await axios.post("http://localhost:3000/api/cartas", {
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
    <div className="card-form" style={{ flexDirection: "column" }}>
      <h2 className="text-2xl font-bold mb-4 text-center">
        Publicar nueva carta
      </h2>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Buscar carta (ej. Pikachu)"
          className="border p-2 flex-1 rounded max-w-md"
        />
        <button onClick={buscarCartas} className="publish-btn">
          Buscar
        </button>
      </div>

      {mensaje && (
        <p className="mt-3 text-sm text-gray-700 text-center">{mensaje}</p>
      )}

      {resultados.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1.5rem",
            marginTop: "2rem",
          }}
        >
          {resultados.map((carta, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "1rem",
                backgroundColor: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
              }}
            >
              {carta.image && (
                <img
                  src={carta.image}
                  alt={carta.name}
                  style={{
                    width: "150px",
                    height: "210px",
                    objectFit: "contain",
                    marginBottom: "0.5rem",
                  }}
                />
              )}
              <h3 className="text-lg font-semibold text-center">
                {carta.name}
              </h3>
              <p className="text-sm text-gray-600 text-center">
                {carta.rarity || "Rareza desconocida"}
              </p>
              {carta.price && (
                <p className="text-green-600 font-bold mt-1">{carta.price}</p>
              )}

              <div className="card-form-actions" style={{ marginTop: "1rem" }}>
                <button
                  onClick={() => irAEditarCarta(carta)}
                  className="publish-btn"
                >
                  Publicar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
