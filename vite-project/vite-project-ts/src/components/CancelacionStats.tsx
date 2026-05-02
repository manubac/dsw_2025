import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface StatsData {
  totalCompras: number;
  totalVentas: number;
  totalOperaciones: number;
  comprasCanceladas: number;
  ventasCanceladas: number;
  totalCancelaciones: number;
  porcentajeCancelacion: number;
  comoComprador: number;
  comoVendedor: number;
  comoTienda: number;
  ratingCancelaciones: number | null;
  totalRatingsCancelacion: number;
  badge: 'none' | 'yellow' | 'red';
}

interface CancelacionStatsProps {
  actorTipo: 'vendedor' | 'user' | 'tiendaRetiro';
  actorId: number;
  compact?: boolean;
}

export function CancelacionStats({ actorTipo, actorId, compact = false }: CancelacionStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api
      .get(`/api/compras/stats-cancelaciones?actorTipo=${actorTipo}&actorId=${actorId}`)
      .then((r) => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actorTipo, actorId]);

  if (loading || !stats) return null;

  const badgeClasses =
    stats.badge === 'red'
      ? 'bg-red-100 text-red-700 border-red-300'
      : stats.badge === 'yellow'
      ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
      : 'bg-gray-100 text-gray-600 border-gray-200';

  const badgeIcon = stats.badge === 'red' ? '🔴' : stats.badge === 'yellow' ? '🟡' : '⚪';
  const badgeLabel =
    stats.badge === 'red'
      ? 'Alta tasa de cancelaciones'
      : stats.badge === 'yellow'
      ? 'Tasa moderada de cancelaciones'
      : '';

  if (compact) {
    if (stats.totalCancelaciones === 0) return null;
    return (
      <div
        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${badgeClasses}`}
      >
        <span>{badgeIcon}</span>
        <span>{stats.porcentajeCancelacion}% cancelaciones</span>
        {stats.ratingCancelaciones !== null && (
          <span className="text-orange-500 font-bold">★ {stats.ratingCancelaciones}</span>
        )}
      </div>
    );
  }

  const cancelColor =
    stats.badge === 'red'
      ? 'text-red-600'
      : stats.badge === 'yellow'
      ? 'text-yellow-600'
      : 'text-gray-800';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-green-700 hover:bg-green-50 transition-colors border-b border-gray-100"
      >
        {expanded ? 'MOSTRAR MENOS ▲' : 'MÁS INFORMACIÓN ▼'}
      </button>

      {expanded && (
        <>
          {/* Badge de cancelaciones (solo si aplica) */}
          {stats.badge !== 'none' && badgeLabel && (
            <div className="flex justify-end px-5 pt-3">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeClasses}`}>
                {badgeIcon} {badgeLabel}
              </span>
            </div>
          )}

          {/* Grid 2 columnas estilo Cardmarket */}
          <div className="grid grid-cols-2 divide-x divide-gray-100 px-0">
            {/* Columna izquierda */}
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm font-semibold text-gray-700">Compras</span>
                <span className="text-sm font-bold text-gray-800">{stats.totalCompras}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm font-semibold text-gray-700">Compras canceladas</span>
                <span className={`text-sm font-bold ${stats.comprasCanceladas > 0 ? cancelColor : 'text-gray-800'}`}>
                  {stats.comprasCanceladas}
                </span>
              </div>
              {stats.ratingCancelaciones !== null && (
                <div className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-sm font-semibold text-gray-700">Rating cancelaciones</span>
                  <div className="flex items-center gap-1">
                    <span className="text-orange-400 text-sm">
                      {'★'.repeat(Math.round(stats.ratingCancelaciones))}
                      {'☆'.repeat(5 - Math.round(stats.ratingCancelaciones))}
                    </span>
                    <span className="text-sm font-bold text-gray-800">{stats.ratingCancelaciones}</span>
                    <span className="text-xs text-gray-400">({stats.totalRatingsCancelacion})</span>
                  </div>
                </div>
              )}
            </div>

            {/* Columna derecha */}
            <div className="divide-y divide-gray-100">
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm font-semibold text-gray-700">Ventas</span>
                <span className="text-sm font-bold text-gray-800">{stats.totalVentas}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm font-semibold text-gray-700">Ventas canceladas</span>
                <span className={`text-sm font-bold ${stats.ventasCanceladas > 0 ? cancelColor : 'text-gray-800'}`}>
                  {stats.ventasCanceladas}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
