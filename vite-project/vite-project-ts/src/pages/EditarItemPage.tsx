import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from '../services/api';
import { useUser } from "../context/user";


interface ItemCarta {
  id: number;
  name: string;
  description: string;
  cartas: any[];
  uploader: { id: number };
}


export default function EditarItemPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const itemInicial = location.state?.item as ItemCarta;
  const { user } = useUser();

  const [name, setName] = useState(itemInicial?.name || "");
  const [description, setDescription] = useState(itemInicial?.description || "");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!user || user.role !== 'vendedor' || itemInicial?.uploader?.id !== user.id) {
      setMensaje('No estás autorizado para editar este item.');
    }
  }, [user, itemInicial]);

  const guardarCambios = async () => {
    if (!user || !itemInicial) return;

    try {
      await api.put(`/api/itemsCarta/${itemInicial.id}`, {
        userId: user.id,
        name,
        description,
      });
      setMensaje("Item actualizado con éxito.");
      setTimeout(() => navigate("/cards"), 1500);
    } catch (error: any) {
      console.error("Error al actualizar item:", error);
      setMensaje(error.response?.data?.message || "Error al actualizar el item.");
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
  <div className="max-w-3xl mx-auto px-4 py-10">

    <div
      className="
        bg-white dark:bg-gray-900
        rounded-2xl
        shadow-xl
        p-8
        space-y-6
      "
    >
      <h2 className="text-2xl font-bold text-center">
        Editar Publicación
      </h2>

      {/* Nombre */}
      <div className="space-y-1 w-full">
        <label className="text-sm font-medium">
          Nombre
        </label>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="
            w-full
            border
            rounded-lg
            px-3 py-2
            outline-none
            focus:ring-2
            focus:ring-green-400
          "
        />
      </div>

      {/* Descripción */}
      <div className="space-y-1 w-full">
        <label className="text-sm font-medium">
          Descripción
        </label>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="
            w-full
            border
            rounded-lg
            px-3 py-2
            outline-none
            focus:ring-2
            focus:ring-green-400
            resize-none
          "
        />
      </div>

      {/* Mensaje */}
      {mensaje && (
        <p className="text-center text-sm text-gray-600">
          {mensaje}
        </p>
      )}

      {/* Acciones */}
      <div className="flex flex-col gap-3 pt-4 w-full">

        <button
          onClick={guardarCambios}
          className="
            w-full
            bg-green-500
            text-white
            py-2
            rounded-lg
            font-semibold
            hover:bg-green-600
            transition
            shadow-md
          "
        >
          Guardar Cambios
        </button>

        <button
          onClick={() => navigate("/cards")}
          className="
            w-full
            py-2
            rounded-lg
            border
            border-gray-300
            hover:bg-gray-100
            dark:hover:bg-gray-800
            transition
          "
        >
          Cancelar
        </button>

      </div>
    </div>
  </div>
);
}
