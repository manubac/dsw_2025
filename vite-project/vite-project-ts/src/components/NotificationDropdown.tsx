import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, MessageSquare, X } from 'lucide-react';
import { useNotifications, Notificacion } from '../context/notifications';
import { useUser } from '../context/user';

interface Props {
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}

function contextoLabel(notif: Notificacion): string | null {
  if (notif.contexto === 'venta') return 'Venta';
  if (notif.contexto === 'compra') return 'Compra';
  if (notif.contexto === 'gestion') return 'Gestión';
  return null;
}

function destinoPath(notif: Notificacion): string {
  if (notif.tipo === 'nuevo_mensaje') return `/chats?compraId=${notif.compraId}`;
  if (notif.contexto === 'gestion') return '/tienda-retiro/ventas';
  if (notif.contexto === 'venta') return '/mis-ventas';
  return '/purchases';
}

export function NotificationDropdown({ onClose }: Props) {
  const { notifications, markAsRead } = useNotifications();
  const { user } = useUser();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const unread = notifications.filter((n) => !n.leida);

  async function handleItemClick(notif: Notificacion) {
    await markAsRead(notif.compraId);
    navigate(destinoPath(notif));
    onClose();
  }

  // suppress unused warning
  void user;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-[80] overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-700">Notificaciones</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>

      {unread.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          No tenés notificaciones nuevas
        </div>
      ) : (
        <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
          {unread.map((notif, i) => {
            const ctxLabel = contextoLabel(notif);
            return (
              <li key={notif.id ?? i}>
                <button
                  onClick={() => handleItemClick(notif)}
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 transition flex gap-3 items-start"
                >
                  <span className="mt-0.5 flex-shrink-0 text-orange-500">
                    {notif.tipo === 'nuevo_mensaje' ? (
                      <MessageSquare size={16} />
                    ) : (
                      <Package size={16} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {ctxLabel && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium">
                          {ctxLabel}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-snug">{notif.texto}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0 mt-1.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
