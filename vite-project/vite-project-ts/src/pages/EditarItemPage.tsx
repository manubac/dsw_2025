import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from '../services/api';
import { useUser } from "../context/user";


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
        const res = await api.get('/api/intermediarios');
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
      await api.put(`/api/itemsCarta/${itemInicial.id}`, {
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

      {/* Intermediarios */}
      <div className="space-y-3 w-full">
        <label className="text-sm font-medium">
          Intermediarios de envío
        </label>

        <div
          className="
            w-full
            grid
            grid-cols-1 sm:grid-cols-2
            gap-3
            max-h-[350px]
            overflow-y-auto
            border
            rounded-xl
            p-3
            bg-gray-50 dark:bg-gray-800
          "
        >
          {intermediarios.map((intermediario) => {
            const selected = selectedIntermediarios.includes(
              intermediario.id
            );

            return (
              <label
                key={intermediario.id}
                className={`
                  cursor-pointer
                  rounded-lg
                  p-3
                  transition
                  shadow-sm
                  flex gap-3 items-start
                  ${
                    selected
                      ? "border-2 border-green-500 bg-green-100 dark:bg-green-900/30"
                      : "border bg-white dark:bg-gray-900 hover:bg-green-50 dark:hover:bg-gray-800"
                  }
                `}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) =>
                    handleIntermediarioChange(
                      intermediario.id,
                      e.target.checked
                    )
                  }
                  className="mt-1 accent-green-500"
                />

                <div>
                  <div className="font-semibold">
                    {intermediario.nombre}
                  </div>

                  <div className="text-xs text-gray-500">
                    {intermediario.email}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <p className="text-center text-sm text-gray-600">
          {mensaje}
        </p>
      )}

      {/* Acciones */}
      <div className="flex flex-col gap-3 pt-4 w-full">

        {/* Guardar */}
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

        {/* Cancelar */}
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