import React, { useState } from 'react';
import { api } from '../services/api';
import { useUser } from '../context/user';

const MOTIVOS = [
  { value: 'sin_stock',        label: 'Sin stock' },
  { value: 'error_precio',     label: 'Error de precio' },
  { value: 'producto_daniado', label: 'Producto dañado o incorrecto' },
  { value: 'no_respondio',     label: 'La otra parte no respondió' },
  { value: 'cambio_decision',  label: 'Cambio de decisión' },
  { value: 'sospecha_fraude',  label: 'Sospecha de fraude' },
  { value: 'problema_tienda',  label: 'Problema con la tienda' },
  { value: 'otro',             label: 'Otro' },
] as const;

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  compraId: number;
  estadoActual: string;
  onSuccess: () => void;
}

export function CancelOrderModal({ isOpen, onClose, compraId, estadoActual, onSuccess }: CancelOrderModalProps) {
  const { user } = useUser();
  const [motivo, setMotivo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const advertencia =
    estadoActual === 'en_tienda'
      ? 'Las cartas ya están en la tienda. Coordiná con la tienda para la devolución o desistimiento.'
      : estadoActual === 'listo_para_retirar'
      ? 'Las cartas ya están listas para retirar. Informá a la tienda sobre la cancelación.'
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) { setError('Seleccioná un motivo para continuar'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/api/compras/${compraId}/cancelar`, { motivo }, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cancelar la orden');
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
        className="bg-white w-[460px] max-w-[94%] rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-xl shrink-0">
            🚫
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Cancelar orden #{compraId}</h3>
            <p className="text-xs text-gray-500">Esta acción no se puede deshacer</p>
          </div>
        </div>

        {/* Warning for advanced states */}
        {advertencia && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm font-medium flex gap-2 items-start">
            <span className="shrink-0 mt-0.5">⚠️</span>
            <span>{advertencia}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <p className="text-sm font-semibold text-gray-700 mb-3">
            Motivo de cancelación <span className="text-red-500">*</span>
          </p>

          <div className="space-y-2 mb-5 max-h-64 overflow-y-auto pr-1">
            {MOTIVOS.map(({ value, label }) => (
              <label
                key={value}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  motivo === value
                    ? 'border-red-400 bg-red-50 text-red-800 font-semibold shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="motivo"
                  value={value}
                  checked={motivo === value}
                  onChange={() => { setMotivo(value); setError(null); }}
                  className="accent-red-500"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-gray-300 text-gray-600 hover:bg-gray-100 transition text-sm font-medium"
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={submitting || !motivo}
              className="px-5 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Cancelando...
                </>
              ) : 'Confirmar cancelación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
