import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/user';
import { api } from '../services/api';

interface OrderSummary {
  id: number;
  estado: string;
  itemName: string;
  itemCount: number;
  withName: string;
  hasTiendaRetiro: boolean;
  isDirect: boolean; // tiendaRetiro: true = venta directa, false = intermediaria
}

const ACTIVE_STATES = ['pendiente', 'ENVIADO_A_INTERMEDIARIO', 'en_tienda', 'pago_confirmado', 'listo_para_retirar'];

const ESTADO_LABEL: Record<string, string> = {
  pendiente:               'Pendiente',
  ENVIADO_A_INTERMEDIARIO: 'En camino',
  en_tienda:               'En tienda',
  pago_confirmado:         'Pago confirmado',
  listo_para_retirar:      'Listo para retirar',
};

const ESTADO_DOT: Record<string, string> = {
  pendiente:               'bg-amber-400',
  ENVIADO_A_INTERMEDIARIO: 'bg-blue-400',
  en_tienda:               'bg-indigo-400',
  pago_confirmado:         'bg-violet-400',
  listo_para_retirar:      'bg-emerald-400',
};

function needsMyAction(order: OrderSummary, role: string): boolean {
  const { estado, hasTiendaRetiro, isDirect } = order;
  if (role === 'vendedor') {
    if (estado === 'pendiente' && hasTiendaRetiro) return true;
    if (estado === 'en_tienda') return true;
  }
  if (role === 'tiendaRetiro') {
    if (!isDirect) {
      if (estado === 'pendiente' || estado === 'ENVIADO_A_INTERMEDIARIO') return true;
      if (estado === 'pago_confirmado') return true;
    } else {
      if (estado === 'pendiente') return true;
      if (estado === 'listo_para_retirar') return true;
    }
  }
  return false;
}

function getActionLabel(order: OrderSummary, role: string): string | null {
  const { estado, hasTiendaRetiro, isDirect } = order;
  if (role === 'vendedor') {
    if (estado === 'pendiente' && hasTiendaRetiro) return 'Enviar a tienda';
    if (estado === 'en_tienda') return 'Confirmar pago';
  }
  if (role === 'tiendaRetiro') {
    if (!isDirect) {
      if (estado === 'pendiente' || estado === 'ENVIADO_A_INTERMEDIARIO') return 'Llegaron los items';
      if (estado === 'pago_confirmado') return 'Confirmar retiro';
    } else {
      if (estado === 'pendiente') return 'Marcar listo';
      if (estado === 'listo_para_retirar') return 'Confirmar retiro';
    }
  }
  return null;
}

function extractFromOrder(order: any, role: string, isDirect = false): Omit<OrderSummary, 'id' | 'estado'> {
  const items: any[] = order.itemCartas || order.items || [];
  const itemName =
    items[0]?.carta?.title ||
    items[0]?.title ||
    items[0]?.cartaNombre ||
    items[0]?.cartaTitle ||
    `Orden #${order.id}`;
  const itemCount = items.length;

  let withName = '';
  if (role === 'user' || role === 'usuario') {
    withName =
      order.tiendaRetiro?.nombre ||
      items[0]?.uploaderVendedor?.name ||
      items[0]?.uploaderTienda?.nombre ||
      order.uploaderVendedor?.name ||
      'Vendedor';
  } else {
    withName =
      order.comprador?.name ||
      order.comprador?.nombre ||
      order.compradorTienda?.nombre ||
      'Comprador';
  }

  const hasTiendaRetiro = !!order.tiendaRetiro;
  return { itemName, itemCount, withName, hasTiendaRetiro, isDirect };
}

export function OrdersDropdown() {
  const { user } = useUser();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const role = user?.role;
  const userId = user?.id;

  const fetchOrders = useCallback(async () => {
    if (!user || !userId || !role) return;
    setLoading(true);
    try {
      let raw: any[] = [];

      if (role === 'user' || role === 'usuario') {
        const res = await api.get(`/api/compras?compradorId=${userId}`);
        raw = res.data?.data || res.data || [];
      } else if (role === 'vendedor') {
        const res = await api.get(`/api/vendedores/${userId}/ventas`);
        raw = res.data?.data || res.data || [];
      } else if (role === 'tiendaRetiro') {
        const [resInter, resDirect] = await Promise.all([
          api.get(`/api/tiendas/${userId}/ventas`),
          api.get(`/api/tiendas/${userId}/ventas-directas`),
        ]);
        const inter = (resInter.data?.data || resInter.data || []).map((o: any) => ({ ...o, _isDirect: false }));
        const direct = (resDirect.data?.data || resDirect.data || []).map((o: any) => ({ ...o, _isDirect: true }));
        raw = [...inter, ...direct];
      }

      const active: OrderSummary[] = raw
        .filter((o: any) => ACTIVE_STATES.includes(o.estado))
        .map((o: any) => ({
          id: o.id,
          estado: o.estado,
          ...extractFromOrder(o, role, o._isDirect ?? false),
        }));

      // Sort: orders needing action first
      active.sort((a, b) => {
        const aNeedsAction = needsMyAction(a, role) ? 0 : 1;
        const bNeedsAction = needsMyAction(b, role) ? 0 : 1;
        return aNeedsAction - bNeedsAction;
      });

      setOrders(active);
    } catch {
      // fail silently — badge just won't show
    } finally {
      setLoading(false);
    }
  }, [user, userId, role]);

  // Poll every 30s
  useEffect(() => {
    if (!user) return;
    fetchOrders();
    const interval = setInterval(fetchOrders, 30_000);
    return () => clearInterval(interval);
  }, [fetchOrders, user]);

  // Re-fetch on open
  useEffect(() => {
    if (open) fetchOrders();
  }, [open, fetchOrders]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleAction = async (e: React.MouseEvent, order: OrderSummary) => {
    e.stopPropagation();
    if (actioning !== null) return;
    setActioning(order.id);
    try {
      if (role === 'vendedor') {
        if (order.estado === 'pendiente') {
          await api.post(`/api/vendedores/${userId}/ventas/${order.id}/enviar`);
        } else if (order.estado === 'en_tienda') {
          await api.patch(`/api/vendedores/${userId}/ventas/${order.id}/pago-confirmado`);
        }
      } else if (role === 'tiendaRetiro') {
        if (!order.isDirect) {
          if (order.estado === 'pendiente' || order.estado === 'ENVIADO_A_INTERMEDIARIO') {
            await api.patch(`/api/tiendas/${userId}/ventas/${order.id}/en-tienda`);
          } else if (order.estado === 'pago_confirmado') {
            await api.patch(`/api/tiendas/${userId}/ventas/${order.id}/finalizar`);
          }
        } else {
          if (order.estado === 'pendiente') {
            await api.patch(`/api/tiendas/${userId}/ventas-directas/${order.id}/listo`);
          } else if (order.estado === 'listo_para_retirar') {
            await api.patch(`/api/tiendas/${userId}/ventas-directas/${order.id}/finalizar`);
          }
        }
      }
      await fetchOrders();
    } catch {
      // keep order visible, let full page handle errors
    } finally {
      setActioning(null);
    }
  };

  const handleCardClick = (order: OrderSummary) => {
    setOpen(false);
    const state = { selectedOrderId: order.id };
    if (role === 'user' || role === 'usuario') navigate('/purchases', { state });
    else if (role === 'vendedor') navigate('/mis-ventas', { state });
    else if (role === 'tiendaRetiro') {
      // ventas directas se gestionan desde /mis-ventas, las intermediarias desde /tienda-retiro/ventas
      navigate(order.isDirect ? '/mis-ventas' : '/tienda-retiro/ventas', { state });
    }
  };

  if (!user || role === 'intermediario') return null;

  const badgeCount =
    role === 'user' || role === 'usuario'
      ? orders.length
      : orders.filter(o => needsMyAction(o, role!)).length;

  const viewAllPath =
    role === 'tiendaRetiro' ? '/tienda-retiro/ventas'
    : role === 'vendedor' ? '/mis-ventas'
    : '/purchases';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500 transition"
        title="Mis órdenes activas"
      >
        <Bell size={20} />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none pointer-events-none">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-[70] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Órdenes activas</span>
            {orders.length > 0 && (
              <span className="text-xs text-gray-400">
                {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
              </span>
            )}
          </div>

          {/* Lista */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
            {loading && orders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">Cargando...</p>
            ) : orders.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">
                No tenés órdenes activas
              </p>
            ) : (
              orders.slice(0, 7).map(order => {
                const actionLabel = getActionLabel(order, role!);
                const isActioning = actioning === order.id;
                const dot = ESTADO_DOT[order.estado] || 'bg-gray-300';
                const label = ESTADO_LABEL[order.estado] || order.estado;

                return (
                  <div
                    key={`${order.isDirect ? 'd' : 'i'}-${order.id}`}
                    onClick={() => handleCardClick(order)}
                    className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {order.itemName}
                            {order.itemCount > 1 && (
                              <span className="text-gray-400 font-normal"> +{order.itemCount - 1}</span>
                            )}
                          </p>
                          <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{order.withName}</p>
                        {actionLabel && (
                          <div className="mt-2">
                            <button
                              onClick={e => handleAction(e, order)}
                              disabled={isActioning}
                              className="text-xs px-3 py-1 rounded-full bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition font-medium"
                            >
                              {isActioning ? '···' : actionLabel}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 text-center">
            <button
              onClick={() => { setOpen(false); navigate(viewAllPath); }}
              className="text-xs text-gray-500 hover:text-gray-800 font-medium transition"
            >
              Ver todas las órdenes →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
