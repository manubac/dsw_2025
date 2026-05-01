import { useEffect, useState } from 'react';
import { api } from '../services/api';

interface StatsData {
  totalOperaciones: number;
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

  useEffect(() => {
    api
      .get(`/api/compras/stats-cancelaciones?actorTipo=${actorTipo}&actorId=${actorId}`)
      .then((r) => setStats(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [actorTipo, actorId]);

  if (loading || !stats || stats.totalCancelaciones === 0) return null;

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

  const numColor =
    stats.badge === 'red'
      ? 'text-red-700'
      : stats.badge === 'yellow'
      ? 'text-yellow-700'
      : 'text-gray-800';

  const numBg =
    stats.badge === 'red'
      ? 'bg-red-50 border-red-200'
      : stats.badge === 'yellow'
      ? 'bg-yellow-50 border-yellow-200'
      : 'bg-gray-50 border-gray-200';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-bold text-gray-700">Historial de cancelaciones</h4>
        {stats.badge !== 'none' && badgeLabel && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badgeClasses}`}>
            {badgeIcon} {badgeLabel}
          </span>
        )}
      </div>

      {/* Main numbers */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-extrabold text-gray-800">{stats.totalOperaciones}</p>
          <p className="text-xs text-gray-500 mt-0.5">operaciones</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${numBg}`}>
          <p className={`text-2xl font-extrabold ${numColor}`}>{stats.totalCancelaciones}</p>
          <p className="text-xs text-gray-500 mt-0.5">cancelaciones</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${numBg}`}>
          <p className={`text-2xl font-extrabold ${numColor}`}>{stats.porcentajeCancelacion}%</p>
          <p className="text-xs text-gray-500 mt-0.5">tasa</p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-2 mb-4">
        {stats.comoComprador > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Canceló como comprador</span>
            <span className="font-semibold text-gray-800">{stats.comoComprador}</span>
          </div>
        )}
        {stats.comoVendedor > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Canceló como vendedor</span>
            <span className="font-semibold text-gray-800">{stats.comoVendedor}</span>
          </div>
        )}
        {stats.comoTienda > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Canceló como tienda</span>
            <span className="font-semibold text-gray-800">{stats.comoTienda}</span>
          </div>
        )}
      </div>

      {/* Cancellation rating */}
      {stats.ratingCancelaciones !== null && (
        <div className="border-t border-gray-100 pt-3 flex items-center justify-between">
          <span className="text-sm text-gray-600">Rating de gestión de cancelaciones</span>
          <div className="flex items-center gap-1.5">
            <span className="text-orange-400 text-base">
              {'★'.repeat(Math.round(stats.ratingCancelaciones))}
              {'☆'.repeat(5 - Math.round(stats.ratingCancelaciones))}
            </span>
            <span className="text-sm font-bold text-gray-800">{stats.ratingCancelaciones}</span>
            <span className="text-xs text-gray-400">({stats.totalRatingsCancelacion})</span>
          </div>
        </div>
      )}
    </div>
  );
}
