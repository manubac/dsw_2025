import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api, fetchApi } from "../services/api";
import { useUser } from "../context/user";


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

interface Direccion {
  id: number;
  provincia: string;
  ciudad: string;
  codigoPostal: string;
  calle: string;
  altura: string;
  departamento?: string;
}

interface Intermediario {
  id: number;
  nombre: string;
  email: string;
  telefono: string;
  descripcion?: string;
  activo: boolean;
  direccion?: Direccion;
}

export default function EditarCartaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartaInicial = location.state?.carta as Carta;
  const { user } = useUser();

  const [carta, setCarta] = useState<Carta>(cartaInicial || { name: "" });
  const [mensaje, setMensaje] = useState("");
  const [nuevaImagen, setNuevaImagen] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [intermediarios, setIntermediarios] = useState<Intermediario[]>([]);
  const [selectedIntermediarios, setSelectedIntermediarios] = useState<number[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [itemCartaId, setItemCartaId] = useState<number | null>(null);
  
  // Allow manual creation even with minimal cartaInicial

  // Fetch intermediarios
  useEffect(() => {
    const fetchIntermediarios = async () => {
      try {
        const res = await fetchApi('/api/intermediarios');
        const json = await res.json();
        const data = json.data || [];
        setIntermediarios(data);
        
        // Extract unique cities
        const uniqueCities = Array.from(new Set(data
            .map((i: Intermediario) => i.direccion?.ciudad)
            .filter((c: string | undefined) => c)
        )) as string[];
        setCities(uniqueCities.sort());
        
      } catch (error) {
        console.error('Error fetching intermediarios:', error);
      }
    };
    fetchIntermediarios();
  }, []);

  // Fetch latest carta data from backend (by id) so editor shows current DB values
  useEffect(() => {
    if (!cartaInicial?.id) return;

    let mounted = true;
    (async () => {
      try {
        const res = await fetchApi(`/api/cartas/${cartaInicial.id}`);
        const json = await res.json();
        const data = json?.data;
        if (!data) return;

        const mapped: Carta = {
          id: data.id,
          name: data.title ?? data.name ?? "",
          price: typeof data.price === 'number' ? `$${data.price}` : (data.price ?? ""),
          image: (data.images && data.images[0]) || data.thumbnail || data.image || undefined,
          link: data.link ?? undefined,
          rarity: data.rarity ?? undefined,
          setName: data.set ?? data.setName ?? undefined,
          uploader: data.uploader ? { id: data.uploader.id } : undefined,
        };

        if (mounted) {
          setCarta(mapped);
          
          // Check if there is an existing ItemCarta for this card
          if (data.items && data.items.length > 0) {
            // Use the first associated item (assuming 1:1 for this use case or picking the first valid one)
            const existingItem = data.items[0];
            setItemCartaId(existingItem.id);
            setDescription(existingItem.description || "");
            
            // To get intermediarios, we need to fetch the specific item details because 
            // the carta endpoint might not deeply populate them
            try {
              const itemRes = await fetchApi(`/api/itemsCarta/${existingItem.id}`);
              const itemJson = await itemRes.json();
              const itemData = itemJson?.data;
              if (itemData && itemData.intermediarios) {
                 const ids = itemData.intermediarios.map((i: Intermediario) => i.id);
                 setSelectedIntermediarios(ids);
              }
            } catch (e) {
              console.error("Error fetching ItemCarta details", e);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching carta for edit', err);
        setMensaje('Error al cargar la carta.');
      }
    })();

    return () => { mounted = false };
  }, [cartaInicial?.id]);

  // Only the uploader vendedor can edit — check after fetching the real carta
  if (carta && user && carta.uploader && carta.uploader.id !== user.id) {
    return (
      <p className="p-6 text-center">No estás autorizado para editar esta carta.</p>
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
      let cartaId = carta.id;

      // If no carta.id (manual creation), create the carta first
      if (!cartaId) {
        const cartaResponse = await api.post("/api/cartas", {
          name: carta.name,
          price: carta.price,
          image: nuevaImagen || carta.image,
          link: carta.link,
          rarity: carta.rarity,
          setName: carta.setName,
          userId: user?.id,
        });
        cartaId = cartaResponse.data?.data?.id;
        if (!cartaId) {
          setMensaje("Error al crear la carta.");
          return;
        }
      }

      // Create or Update ItemCarta
      if (itemCartaId) {
        // Update existing ItemCarta
        await api.put(`/api/itemsCarta/${itemCartaId}`, {
          name: carta.name,
          description,
          cartasIds: cartaId ? [cartaId] : [],
          intermediariosIds: selectedIntermediarios,
          userId: user?.id, // required for permission check
        });
        setMensaje("Item actualizado con éxito.");
      } else {
        // Create new ItemCarta
        await api.post("/api/itemsCarta", {
            name: carta.name,
            description,
            cartasIds: cartaId ? [cartaId] : [],
            intermediariosIds: selectedIntermediarios,
            uploaderId: user?.id,
        });
        setMensaje("Item publicado con éxito.");
      }
      
      setTimeout(() => navigate("/cards"), 1500);
    } catch (error) {
      console.error("Error al publicar item:", error);
      setMensaje("Error al publicar el item.");
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
      await api.delete(`/api/cartas/${carta.id}`, { data: { userId: user.id } });
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
  <div className="max-w-6xl mx-auto px-4 py-10">

    <div className="grid md:grid-cols-2 gap-10 bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xl">

      {/* ================= LEFT - IMAGE ================= */}
      <div className="flex flex-col items-center gap-4">
        <img
          src={nuevaImagen || carta.image}
          alt={carta.name}
          className="
            w-full
            max-w-sm
            rounded-2xl
            shadow-lg
            object-contain
            bg-gradient-to-b
            from-green-100
            to-transparent
            p-4
          "
        />

        <label className="
          cursor-pointer
          px-4 py-2
          rounded-xl
          bg-green-500
          text-white
          font-medium
          hover:bg-green-600
          transition
        ">
          Cambiar imagen
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            hidden
          />
        </label>
      </div>

      {/* ================= RIGHT - FORM ================= */}
      <div className="space-y-5">

        <h2 className="text-2xl font-bold">
          Configurar Publicación
        </h2>

        {/* Nombre */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre</label>
          <input
            type="text"
            name="name"
            value={carta.name || ""}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
          />
        </div>

        {/* Precio */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Precio</label>
          <input
            type="text"
            name="price"
            value={carta.price || ""}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
          />
        </div>

        {/* Rareza */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Rareza</label>
          <input
            type="text"
            name="rarity"
            value={carta.rarity || ""}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
          />
        </div>

        {/* Set */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Set</label>
          <input
            type="text"
            name="setName"
            value={carta.setName || ""}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none"
          />
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe tu item..."
            className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none resize-none"
          />
        </div>

        {/* ================= INTERMEDIARIOS ================= */}
        <div className="space-y-3">
          <label className="text-sm font-medium">
            Intermediarios permitidos
          </label>

          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="">-- Seleccionar Ciudad --</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
            <option value="all">Ver todos</option>
          </select>

          <div className="
            grid
            grid-cols-1 sm:grid-cols-2
            gap-3
            max-h-[400px]
            overflow-y-auto
            border
            rounded-xl
            p-3
            bg-gray-50
          ">
            {intermediarios
              .filter(inter =>
                !selectedCity ||
                selectedCity === "all" ||
                inter.direccion?.ciudad === selectedCity
              )
              .map((inter) => {
                const isSelected = selectedIntermediarios.includes(inter.id);

                return (
                  <div
                    key={inter.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedIntermediarios(
                          selectedIntermediarios.filter(id => id !== inter.id)
                        );
                      } else {
                        setSelectedIntermediarios([
                          ...selectedIntermediarios,
                          inter.id
                        ]);
                      }
                    }}
                    className={`
                      cursor-pointer
                      rounded-lg
                      p-3
                      transition
                      shadow-sm
                      ${isSelected
                        ? "border-2 border-green-500 bg-green-100"
                        : "border bg-white hover:bg-green-50"}
                    `}
                  >
                    <div className="font-semibold">
                      {inter.nombre}
                    </div>

                    <div className="text-xs text-gray-600">
                      {inter.direccion?.ciudad},{" "}
                      {inter.direccion?.provincia}
                    </div>

                    <div className="text-xs text-gray-400">
                      {inter.direccion?.calle}{" "}
                      {inter.direccion?.altura}
                    </div>
                  </div>
                );
              })}

            {intermediarios.filter(inter =>
              !selectedCity ||
              selectedCity === "all" ||
              inter.direccion?.ciudad === selectedCity
            ).length === 0 && (
              <div className="col-span-full text-center text-gray-500 py-4">
                {selectedCity
                  ? "No hay intermediarios en esta ciudad."
                  : "Selecciona una ciudad para ver intermediarios."}
              </div>
            )}
          </div>
        </div>

        {/* ================= ACTIONS ================= */}
        <div className="flex gap-3 pt-2">

          <button
            onClick={publicarCarta}
            className="
              flex-1
              bg-green-500
              text-white
              py-3
              rounded-xl
              font-semibold
              hover:bg-green-600
              transition
              shadow-md
            "
          >
            Confirmar publicación
          </button>

          {carta.id && (
            <button
              onClick={handleDelete}
              className="
                bg-red-500
                text-white
                px-4
                rounded-xl
                hover:bg-red-600
                transition
              "
            >
              Eliminar carta
            </button>
          )}
        </div>

        {mensaje && (
          <p className="text-center text-sm text-gray-600">
            {mensaje}
          </p>
        )}

      </div>
    </div>
  </div>
);
}
