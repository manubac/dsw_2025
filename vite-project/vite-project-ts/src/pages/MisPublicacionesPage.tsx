import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../context/user";
import axios from "axios";
import "../components/Products.css";

interface ItemCarta {
  id: number;
  title: string;
  thumbnail: string;
  price: number;
  description: string;
  uploader: { id: number; nombre: string };
}

export default function MisPublicacionesPage() {
  const [publicaciones, setPublicaciones] = useState<ItemCarta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { user } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'vendedor') {
      navigate('/');
      return;
    }

    fetchMisPublicaciones();
  }, [user, navigate]);

  const fetchMisPublicaciones = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/cartas');
      const allPublicaciones = res.data.data || [];
      
      // Filter to show only publications by the current user
      const misPublicaciones = allPublicaciones.filter((pub: ItemCarta) =>
        pub.uploader?.id === user?.id
      );
      
      setPublicaciones(misPublicaciones);
    } catch (err: any) {
      console.error('Error fetching publicaciones:', err);
      setError('Error al cargar las publicaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (publicacion: ItemCarta) => {
    navigate('/editar-carta', { state: { carta: publicacion } });
  };

  if (!user || user.role !== 'vendedor') {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>No tienes permisos para acceder a esta página.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p>Cargando publicaciones...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Mis Publicaciones</h1>

      {error && (
        <div style={{ color: "red", textAlign: "center", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {publicaciones.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>No tienes publicaciones aún.</p>
          <button
            onClick={() => navigate('/publicar')}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Crear primera publicación
          </button>
        </div>
      ) : (
        <div className="products" style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "1rem" }}>
            {publicaciones.map(publicacion => (
              <li key={publicacion.id} style={{ border: "1px solid #ddd", borderRadius: "8px", padding: "1rem", backgroundColor: "#fff" }}>
                <img
                  src={publicacion.thumbnail || '/placeholder-image.png'}
                  alt={publicacion.title}
                  style={{ width: "100%", height: "200px", objectFit: "cover", borderRadius: "4px", marginBottom: "1rem" }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-image.png';
                  }}
                />
                <div>
                  <strong style={{ display: "block", marginBottom: "0.5rem" }}>{publicacion.title}</strong>
                  <p style={{ color: "#666", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{publicacion.description}</p>
                  <p style={{ fontWeight: "bold", color: "#007bff" }}>${publicacion.price}</p>
                  <button
                    onClick={() => handleEdit(publicacion)}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      width: '100%',
                      marginTop: '1rem'
                    }}
                  >
                    Editar Publicación
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}