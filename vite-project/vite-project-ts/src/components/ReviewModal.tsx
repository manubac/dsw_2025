import React, { useState } from 'react';
import { api } from '../services/api';
import { useUser } from '../context/user';


interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: number;
  targetType: 'vendedor' | 'intermediario' | 'carta' | 'tiendaRetiro' | 'user';
  targetName: string;
  compraId?: number;
  onSuccess?: (puntuacion: number) => void;
}

export function ReviewModal({ isOpen, onClose, targetId, targetType, targetName, compraId, onSuccess }: ReviewModalProps) {
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
      
      await api.post('/api/valoraciones', {
        puntuacion: rating,
        comentario: comment,
        tipoObjeto: targetType,
        objetoId: targetId,
        ...(compraId ? { compraId } : {}),
      }, {
        headers: {
             Authorization: `Bearer ${user.token}`
        }
      });
      alert('¡Gracias por tu valoración!');
      if (onSuccess) onSuccess(rating);
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al enviar valoración');
    } finally {
      setIsSubmitting(false);
    }
  };

 return (
  <div
    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    onClick={onClose}
  >
    <div
      className="bg-white w-[400px] max-w-[90%] rounded-2xl shadow-xl p-6"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold mb-4">
        Valorar a {targetName}
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="flex gap-2 text-2xl text-gray-300 mb-4 cursor-pointer">
          {[1, 2, 3, 4, 5].map((star) => (
            <span
              key={star}
              className={
                (hoverRating || rating) >= star
                  ? "text-orange-500"
                  : "hover:text-orange-400"
              }
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
            >
              ★
            </span>
          ))}
        </div>

        <textarea
          className="w-full h-[100px] border rounded-lg p-2 mb-4 resize-y focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Escribe un comentario (opcional)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-lg border border-gray-400 text-gray-700 hover:bg-gray-200 transition"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={isSubmitting || rating === 0}
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition disabled:bg-orange-300 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Enviando..." : "Enviar Valoración"}
          </button>
        </div>
      </form>
    </div>
  </div>
);
}
