import React, { useState } from 'react';
import { api } from '../services/api';
import { useUser } from '../context/user';

interface CancelReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetId: number;
  targetActorTipo: 'user' | 'vendedor' | 'tiendaRetiro';
  targetName: string;
  compraId: number;
  onSuccess: (puntuacion: number) => void;
}

const TIPO_LABEL: Record<string, string> = {
  user: 'comprador',
  vendedor: 'vendedor',
  tiendaRetiro: 'tienda',
};

const RATING_LABELS = ['', 'Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente'];

export function CancelReviewModal({
  isOpen,
  onClose,
  targetId,
  targetActorTipo,
  targetName,
  compraId,
  onSuccess,
}: CancelReviewModalProps) {
  const { user } = useUser();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const tipoObjeto = `cancelacion_${targetActorTipo}`;
  const active = hover || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return alert('Seleccioná una puntuación');
    setSubmitting(true);
    try {
      await api.post(
        '/api/valoraciones',
        {
          puntuacion: rating,
          comentario: comentario || undefined,
          tipoObjeto,
          objetoId: targetId,
          compraId,
        },
        { headers: { Authorization: `Bearer ${user?.token}` } }
      );
      onSuccess(rating);
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al enviar valoración');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-[430px] max-w-[94%] rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-xl shrink-0">
            📋
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Valorar gestión de cancelación</h3>
            <p className="text-xs text-gray-500">
              ¿Cómo manejó{' '}
              <span className="font-semibold text-gray-700">{targetName}</span>{' '}
              ({TIPO_LABEL[targetActorTipo]}) esta cancelación?
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Stars */}
          <div className="flex justify-center gap-2 text-4xl mb-2 cursor-pointer select-none">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`transition-all ${
                  active >= star
                    ? 'text-orange-400 scale-110'
                    : 'text-gray-200 hover:text-orange-300 hover:scale-105'
                }`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
              >
                ★
              </span>
            ))}
          </div>

          <div className="text-center h-6 mb-3">
            {active > 0 && (
              <span className="text-sm font-semibold text-orange-600">{RATING_LABELS[active]}</span>
            )}
          </div>

          <textarea
            className="w-full h-24 border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-300 transition"
            placeholder="Comentario opcional sobre cómo se manejó la cancelación..."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />

          <div className="flex gap-3 justify-end mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-xl border border-gray-300 text-gray-500 hover:bg-gray-50 transition font-medium"
            >
              Omitir
            </button>
            <button
              type="submit"
              disabled={submitting || rating === 0}
              className="px-5 py-2 text-sm rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Enviando...' : 'Enviar valoración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
