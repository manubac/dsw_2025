import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../services/api';
import './VendedorProfile.css';

export function VendedorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vendedor, setVendedor] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [average, setAverage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch vendedor details
        const sellerRes = await api.get(`/api/vendedores/${id}`);
        setVendedor(sellerRes.data.data);

        // 2. Fetch reviews
        const reviewsRes = await api.get(`/api/valoraciones/vendedor/${id}`);
        // Backend returns the array directly, so use reviewsRes.data
        // Fallback: check if it wraps in data property just in case it changes later, but prioritized array check
        const reviewsData = Array.isArray(reviewsRes.data) ? reviewsRes.data : (reviewsRes.data.data || []);
        setReviews(reviewsData);

        // 3. Fetch average
        const avgRes = await api.get(`/api/valoraciones/vendedor/${id}/average`);
        setAverage(Number(avgRes.data.average) || 0);
      } catch (error) {
        console.error('Error fetching seller profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  if (loading) return <div className="loading">Cargando perfil...</div>;
  if (!vendedor) return <div className="error-msg">Vendedor no encontrado</div>;

  return (
    <div className="vendedor-profile-container">
      <div className="profile-header">
        <div className="avatar-placeholder">
          {vendedor.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1>{vendedor.nombre}</h1>
          <p className="role-badge">Vendedor Verificado</p>
          
          <div className="rating-summary">
            <div className="stars">
              {'★'.repeat(Math.round(average))}
              {'☆'.repeat(5 - Math.round(average))}
            </div>
            <span className="rating-number">({average.toFixed(1)}) • {reviews.length} valoraciones</span>
          </div>
        </div>
      </div>

      <div className="reviews-section">
        <h2>Publicaciones del Vendedor</h2>
        {(!vendedor.itemCartas || vendedor.itemCartas.length === 0) ? (
            <p className="no-reviews">Este vendedor no tiene cartas publicadas.</p>
        ) : (
            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem'}}>
                {vendedor.itemCartas.map((item: any) => {
                    // Usually item has one Carta, but it's a collection
                    // Filter paused items if needed, or show all
                    if (item.estado === 'pausado' || item.stock <= 0) return null;
                    
                    const carta = item.cartas && item.cartas[0];
                    if (!carta) return null;

                    return (
                        <div key={item.id} className="card-item" style={{border: '1px solid #ddd', padding: '10px', borderRadius: '8px'}}>
                            {carta.image && <img src={carta.image} alt={carta.name} style={{width:'100%', height:'150px', objectFit:'contain'}} />}
                            <h4 style={{margin: '10px 0 5px'}}>{carta.name}</h4>
                            <p style={{margin: '0', color: '#2ecc71', fontWeight: 'bold'}}>${carta.price}</p>
                            <p style={{margin: '5px 0', fontSize: '0.9rem'}}>Stock: {item.stock}</p>
                            <button 
                                onClick={() => navigate(`/card/${carta.id}`)}
                                style={{
                                    marginTop: '5px', 
                                    width: '100%', 
                                    padding: '5px', 
                                    background: '#3498db', 
                                    color: 'white', border:'none', 
                                    cursor:'pointer', borderRadius:'4px'
                                }}
                            >
                                Ver Detalle
                            </button>
                        </div>
                    );
                })}
            </div>
        )}

        <h2>Valoraciones</h2>
        {reviews.length === 0 ? (
          <p className="no-reviews">Este vendedor aún no tiene valoraciones.</p>
        ) : (
          <div className="reviews-list">
            {reviews.map((review: any) => (
              <div key={review.id} className="review-card">
                <div className="review-header">
                  <span className="reviewer-name">
                    {review.usuario ? review.usuario.nombre : 'Usuario'}
                  </span>
                  <div className="review-stars">
                    {'★'.repeat(review.puntuacion)}
                    {'☆'.repeat(5 - review.puntuacion)}
                  </div>
                </div>
                {review.comentario && <p className="review-comment">"{review.comentario}"</p>}
                {review.createdAt && (
                  <small className="review-date">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </small>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <button className="back-btn" onClick={() => navigate(-1)}>
        Volver
      </button>
    </div>
  );
}
