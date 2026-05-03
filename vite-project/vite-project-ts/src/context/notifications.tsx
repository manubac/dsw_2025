import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useUser } from './user';
import { api } from '../services/api';
import { io as socketIO } from 'socket.io-client';

export interface Notificacion {
  id?: number;
  userId: number;
  userRole: string;
  contexto: 'compra' | 'venta' | 'gestion' | null;
  tipo: 'compra_estado' | 'nuevo_mensaje';
  compraId: number;
  texto: string;
  leida: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: Notificacion[];
  unreadOrderCount: number;
  unreadChatCount: number;
  markAsRead: (compraId: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [notifications, setNotifications] = useState<Notificacion[]>([]);

  const fetchNotifications = useCallback(async () => {
    if (!user?.token) return;
    try {
      const res = await api.get('/api/notificaciones');
      setNotifications(res.data.data ?? []);
    } catch {
      // silencioso: no bloquear la app si falla
    }
  }, [user?.token]);

  useEffect(() => {
    if (!user?.token) {
      setNotifications([]);
      return;
    }
    fetchNotifications();
  }, [fetchNotifications, user?.token]);

  useEffect(() => {
    if (!user?.token) return;

    const socket = socketIO('http://localhost:3000', {
      auth: { token: user.token },
    });

    socket.on('nueva_notificacion', (notif: Notificacion) => {
      setNotifications((prev) => [notif, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.token]);

  const markAsRead = useCallback(async (compraId: number) => {
    if (!user?.token) return;
    try {
      await api.patch('/api/notificaciones/marcar-leidas', { compraId });
      setNotifications((prev) =>
        prev.map((n) => (n.compraId === compraId ? { ...n, leida: true } : n))
      );
    } catch {
      // silencioso
    }
  }, [user?.token]);

  const unreadOrderCount = notifications.filter((n) => !n.leida && n.tipo === 'compra_estado').length;
  const unreadChatCount = notifications.filter((n) => !n.leida && n.tipo === 'nuevo_mensaje').length;

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadOrderCount, unreadChatCount, markAsRead, refresh: fetchNotifications }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
