import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import axios from "axios";
import { useUser } from "../context/user";
import "../components/CardForm.css"; // 👈 estilos compartidos

interface Carta {
  id?: number;
  name: string;
  price?: string;
  image?: string;
  link?: string;
  rarity?: string;
  setName?: string;
  uploader?: { id: number };
}

export default function EditarCartaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartaInicial = location.state?.carta as Carta;
  const { user } = useUser();

  const [carta, setCarta] = useState<Carta>(cartaInicial || { name: "" });
  const [mensaje, setMensaje] = useState("");
  const [nuevaImagen, setNuevaImagen] = useState<string | null>(null);

  if (!cartaInicial) {
    return (
      <p className="p-6 text-center">No hay carta seleccionada para editar.</p>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCarta({ ...carta, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNuevaImagen(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const publicarCarta = async () => {
    try {
      const cartaConImagen = { ...carta, image: nuevaImagen || carta.image };
      // include userId so backend links uploader when creating from editor
      await axios.post("http://localhost:3000/api/cartas", { ...cartaConImagen, userId: user?.id });
      setMensaje("✅ Carta publicada con éxito.");
      setTimeout(() => navigate("/cards"), 1500);
    } catch (error) {
      console.error("Error al publicar carta:", error);
      setMensaje("❌ Error al publicar la carta.");
    }
  };

  const handleDelete = async () => {
    if (!carta.id) return;
    if (!user) {
      setMensaje('Debes iniciar sesión como vendedor para eliminar la carta.');
      return;
    }
    const ok = window.confirm('¿Seguro que querés eliminar esta carta? Esta acción no se puede deshacer.');
    if (!ok) return;

    try {
      await axios.delete(`http://localhost:3000/api/cartas/${carta.id}`, { data: { userId: user.id } });
      setMensaje('Carta eliminada');
      setTimeout(() => navigate('/cards'), 1000);
    } catch (err: any) {
      console.error('Error deleting carta', err);
      if (err.response && err.response.status === 403) {
        setMensaje('No estás autorizado para eliminar esta carta');
      } else {
        setMensaje('Error al eliminar la carta');
      }
    }
  }

  return (
    <div className="card-form">
      {/* 📸 Imagen a la izquierda */}
      <div className="card-form-left">
        <img
          src={nuevaImagen || carta.image}
          alt={carta.name}
          className="preview-img"
        />
        <label className="change-image-btn">
          Cambiar imagen
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            hidden
          />
        </label>
      </div>

      {/* 🧾 Formulario a la derecha */}
      <div className="card-form-right">
        <h2 className="text-2xl font-bold mb-2">Editar publicación</h2>

        <div>
          <label>Nombre:</label>
          <input
            type="text"
            name="name"
            value={carta.name}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Precio:</label>
          <input
            type="text"
            name="price"
            value={carta.price || ""}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Rareza:</label>
          <input
            type="text"
            name="rarity"
            value={carta.rarity || ""}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Set:</label>
          <input
            type="text"
            name="setName"
            value={carta.setName || ""}
            onChange={handleChange}
          />
        </div>

        <div className="card-form-actions">
          <button onClick={publicarCarta} className="save-btn">
            Confirmar publicación
          </button>
          <button onClick={handleDelete} className="delete-btn" style={{ marginLeft: '0.5rem', background: '#e53e3e' }}>
            Eliminar carta
          </button>
        </div>

        {mensaje && (
          <p className="text-center mt-2 text-sm text-gray-700">{mensaje}</p>
        )}
      </div>
    </div>
  );
}
