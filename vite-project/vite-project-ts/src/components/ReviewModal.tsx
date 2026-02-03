import React, { useState } from 'react';
import axios from 'axios';
import { useUser } from '../context/user';
import './ReviewModal.css';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: number;
  targetType: 'vendedor' | 'intermediario' | 'carta';
  targetName: string; 
  onSuccess?: () => void;
}

export function ReviewModal({ isOpen, onClose, targetId, targetType, targetName, onSuccess }: ReviewModalProps) {
  const { user } = useUser();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return alert("Por favor selecciona una puntuación");

    setIsSubmitting(true);
    try {
      if (!user?.token) {
         throw new Error("No estás autenticado");
      }
      
      await axios.post('http://localhost:3000/api/valoraciones', {
        puntuacion: rating,
        comentario: comment,
        tipoObjeto: targetType,
        objetoId: targetId
      }, {
        headers: {
             Authorization: `Bearer ${user.token}`
        }
      });
      alert('¡Gracias por tu valoración!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al enviar valoración');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="review-modal-overlay" onClick={onClose}>
      <div className="review-modal" onClick={e => e.stopPropagation()}>
        <h3>Valorar a {targetName}</h3>
        <form onSubmit={handleSubmit}>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={(hoverRating || rating) >= star ? 'active' : ''}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
              >
                ★
              </span>
            ))}
          </div>
          
          <textarea 
            placeholder="Escribe un comentario (opcional)..."
            value={comment}
            onChange={e => setComment(e.target.value)}
          />

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-submit" disabled={isSubmitting || rating === 0}>
              {isSubmitting ? 'Enviando...' : 'Enviar Valoración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
