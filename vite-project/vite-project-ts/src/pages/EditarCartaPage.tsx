import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api, fetchApi } from "../services/api";
import { useUser } from "../context/user";
import "../components/CardForm.css"; // estilos compartidos

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
    <div className="card-form">
  {/* Imagen a la izquierda */}
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

  {/* Formulario a la derecha */}
      <div className="card-form-right">
        <h2 className="text-2xl font-bold mb-2">Configurar Publicación</h2>

        <div>
          <label>Nombre:</label>
          <input
            type="text"
            name="name"
            value={carta.name || ""}
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

        <div>
          <label>Descripción:</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe tu item..."
          />
        </div>

        <div>
          <label>Intermediarios permitidos:</label>
          
          <div style={{ marginBottom: '1rem' }}>
            <select 
              value={selectedCity} 
              onChange={(e) => setSelectedCity(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="">-- Seleccionar Ciudad --</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
              <option value="all">Ver todos</option>
            </select>
          </div>

          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
              gap: '10px',
              maxHeight: '400px', 
              overflowY: 'auto',
              border: '1px solid #e0e0e0',
              padding: '10px',
              borderRadius: '8px',
              backgroundColor: '#f9f9f9'
            }}
          >
            {intermediarios
              .filter(inter => !selectedCity || selectedCity === "all" || inter.direccion?.ciudad === selectedCity)
              .map((inter) => {
                const isSelected = selectedIntermediarios.includes(inter.id);
                return (
                  <div 
                    key={inter.id}
                    onClick={() => {
                        if (isSelected) {
                          setSelectedIntermediarios(selectedIntermediarios.filter(id => id !== inter.id));
                        } else {
                          setSelectedIntermediarios([...selectedIntermediarios, inter.id]);
                        }
                    }}
                    style={{
                      border: isSelected ? '2px solid #28a745' : '1px solid #ddd',
                      borderRadius: '6px',
                      padding: '10px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#e6ffe6' : 'white',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{inter.nombre}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '4px' }}>
                        {inter.direccion?.ciudad}, {inter.direccion?.provincia}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        {inter.direccion?.calle} {inter.direccion?.altura}
                    </div>
                  </div>
                );
              })}
            
            {intermediarios.filter(inter => !selectedCity || selectedCity === "all" || inter.direccion?.ciudad === selectedCity).length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '1rem', color: '#666' }}>
                    {selectedCity ? 'No hay intermediarios en esta ciudad.' : 'Selecciona una ciudad para ver intermediarios.'}
                </div>
            )}
          </div>
        </div>

        <div className="card-form-actions">
          <button onClick={publicarCarta} className="save-btn">
            Confirmar publicación
          </button>
          {carta.id && (
            <button onClick={handleDelete} className="delete-btn" style={{ marginLeft: '0.5rem', background: '#e53e3e' }}>
              Eliminar carta
            </button>
          )}
        </div>

        {mensaje && (
          <p className="text-center mt-2 text-sm text-gray-700">{mensaje}</p>
        )}
      </div>
    </div>
  );
}
