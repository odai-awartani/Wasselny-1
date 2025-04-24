import React, { createContext, useContext, useState, useCallback } from 'react';

type NotificationType = {
  id: string;
  title: string;
  message: string;
  type: 'ride_request' | 'ride_complete' | 'payment';
  read: boolean;
  createdAt: Date;
};

type NotificationContextType = {
  notifications: NotificationType[];
  addNotification: (notification: Omit<NotificationType, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

const FAKE_NOTIFICATIONS = [
  {
    id: '1',
    title: 'New Ride Request',
    message: 'Ahmed has requested a ride to Cairo University',
    type: 'ride_request',
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
  },
  {
    id: '2',
    title: 'Ride Completed',
    message: 'Your ride with Sarah has been completed successfully',
    type: 'ride_complete',
    read: false,
    createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
  },
  {
    id: '3',
    title: 'Payment Received',
    message: 'You received a payment of 50 EGP for your last ride',
    type: 'payment',
    read: true,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: '4',
    title: 'Special Offer',
    message: 'Complete 5 rides today and get a 20% bonus!',
    type: 'payment',
    read: true,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
  }
];

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationType[]>(FAKE_NOTIFICATIONS);

  const addNotification = useCallback((notification: Omit<NotificationType, 'id' | 'read' | 'createdAt'>) => {
    const newNotification: NotificationType = {
      ...notification,
      id: Math.random().toString(36).substr(2, 9),
      read: false,
      createdAt: new Date(),
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, read: true }))
    );
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
