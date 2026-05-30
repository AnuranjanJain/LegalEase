import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';

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
  markAllRead: () => void;
  markRead: (id: number) => void;
  addNotification: (
    n: Omit<AppNotification, 'id' | 'read' | 'timestamp'>
  ) => void;
  removeNotification: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 1,
    title: 'Document Uploaded',
    description: 'Your legal document was uploaded successfully.',
    type: 'document',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: 2,
    title: 'Profile Updated',
    description: 'Your profile information has been updated.',
    type: 'system',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: 3,
    title: 'Welcome to LegalEase',
    description: 'Explore dashboard features and documentation.',
    type: 'system',
    read: false,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(
    INITIAL_NOTIFICATIONS
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markRead = useCallback((id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const addNotification = useCallback(
    (n: Omit<AppNotification, 'id' | 'read' | 'timestamp'>) => {
      setNotifications((prev) => [
        { ...n, id: Date.now(), read: false, timestamp: new Date() },
        ...prev,
      ]);
    },
    []
  );

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAllRead,
        markRead,
        addNotification,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      'useNotifications must be used within NotificationProvider'
    );
  return ctx;
}
