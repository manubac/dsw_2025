import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { useUser } from "../context/user";
import "../components/CardForm.css";

interface ItemCarta {
  id: number;
  name: string;
  description: string;
  cartas: any[];
  intermediarios: any[];
  uploader: { id: number };
}

interface Intermediario {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  descripcion?: string;
  activo: boolean;
}

export default function EditarItemPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const itemInicial = location.state?.item as ItemCarta;
  const { user } = useUser();

  const [name, setName] = useState(itemInicial?.name || "");
  const [description, setDescription] = useState(itemInicial?.description || "");
  const [mensaje, setMensaje] = useState("");
  const [intermediarios, setIntermediarios] = useState<Intermediario[]>([]);
  const [selectedIntermediarios, setSelectedIntermediarios] = useState<number[]>(itemInicial?.intermediarios?.map(i => i.id) || []);

  // Check if user can edit
  useEffect(() => {
    if (!user || user.role !== 'vendedor' || itemInicial?.uploader?.id !== user.id) {
      setMensaje('No estás autorizado para editar este item.');
    }
  }, [user, itemInicial]);

  // Fetch intermediarios
  useEffect(() => {
    const fetchIntermediarios = async () => {
      try {
        const res = await axios.get('http://localhost:3000/api/intermediarios');
        setIntermediarios(res.data.data || []);
      } catch (error) {
        console.error('Error fetching intermediarios:', error);
      }
    };
    fetchIntermediarios();
  }, []);

  const guardarCambios = async () => {
    if (!user || !itemInicial) return;

    try {
      await axios.put(`http://localhost:3000/api/itemsCarta/${itemInicial.id}`, {
        userId: user.id,
        name,
        description,
        intermediariosIds: selectedIntermediarios,
      });
      setMensaje("Item actualizado con éxito.");
      setTimeout(() => navigate("/cards"), 1500);
    } catch (error: any) {
      console.error("Error al actualizar item:", error);
      setMensaje(error.response?.data?.message || "Error al actualizar el item.");
    }
  };

  const handleIntermediarioChange = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIntermediarios(prev => [...prev, id]);
    } else {
      setSelectedIntermediarios(prev => prev.filter(i => i !== id));
    }
  };

  if (!user || user.role !== 'vendedor' || itemInicial?.uploader?.id !== user.id) {
    return (
      <div className="card-form" style={{ flexDirection: "column", padding: "2rem" }}>
        <p className="text-center">No estás autorizado para editar este item.</p>
      </div>
    );
  }

  return (
    <div className="card-form" style={{ flexDirection: "column" }}>
      <h2 className="text-2xl font-bold mb-4 text-center">
        Editar Publicación
      </h2>

      <div className="form-section">
        <label>Nombre:</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input"
        />
      </div>

      <div className="form-section">
        <label>Descripción:</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="form-input"
          rows={4}
        />
      </div>

      <div className="form-section">
        <label>Intermediarios de envío:</label>
        {intermediarios.map((intermediario) => (
          <div key={intermediario.id} className="checkbox-group">
            <input
              type="checkbox"
              id={`inter-${intermediario.id}`}
              checked={selectedIntermediarios.includes(intermediario.id)}
              onChange={(e) => handleIntermediarioChange(intermediario.id, e.target.checked)}
            />
            <label htmlFor={`inter-${intermediario.id}`}>
              {intermediario.nombre} - {intermediario.email}
            </label>
          </div>
        ))}
      </div>

      {mensaje && (
        <p className="mt-3 text-sm text-gray-700 text-center">{mensaje}</p>
      )}

      <div className="card-form-actions">
        <button onClick={guardarCambios} className="save-btn">
          Guardar Cambios
        </button>
        <button onClick={() => navigate("/cards")} className="cancel-btn">
          Cancelar
        </button>
      </div>
    </div>
  );
}