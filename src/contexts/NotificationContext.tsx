import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { api, NotificationResponse } from '../services/api';
import { useAuth } from './AuthContext';

export interface AppNotification {
  id: number;
  title: string;
  description: string;
  type: 'document' | 'security' | 'system';
  read: boolean;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAllRead: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => void;
  removeNotification: (id: number) => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Convert API notification response to AppNotification format
 */
function toAppNotification(apiNotification: NotificationResponse): AppNotification {
  return {
    id: apiNotification.id,
    title: apiNotification.title,
    description: apiNotification.description || '',
    type: apiNotification.type,
    read: apiNotification.read,
    timestamp: new Date(apiNotification.created_at),
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.notifications.getAll();
      setNotifications(response.notifications.map(toAppNotification));
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError('Failed to load notifications');
      // On error, show empty state rather than stale data
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch notifications on mount and when auth state changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll for new notifications every 30 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications]);

  const markRead = useCallback(async (id: number) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    try {
      await api.notifications.markRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      // Revert on error
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const markAllRead = useCallback(async () => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await api.notifications.markAllRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      // Revert on error
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const addNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => {
      // Optimistically add to the top of the list
      const newNotification: AppNotification = {
        ...n,
        id: Date.now(), // Temporary ID until we sync with server
        read: false,
        timestamp: new Date(),
      };
      setNotifications((prev) => [newNotification, ...prev]);
    },
    []
  );

  const removeNotification = useCallback(async (id: number) => {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    try {
      await api.notifications.delete(id);
    } catch (err) {
      console.error('Failed to delete notification:', err);
      // Revert on error
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ 
        notifications, 
        unreadCount, 
        isLoading, 
        error, 
        markAllRead, 
        markRead, 
        addNotification, 
        removeNotification,
        refreshNotifications: fetchNotifications,
      }}
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