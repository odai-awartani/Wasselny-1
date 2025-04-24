import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@clerk/clerk-expo';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: 'ride_request' | 'ride_complete' | 'payment' | 'ride_status';
  read: boolean;
  createdAt: Date;
  userId: string;
  data?: {
    rideId?: string;
    notificationId?: string;
    status?: string;
  };
};

type NotificationContextType = {
  notifications: Notification[];
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  unreadCount: number;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  unreadCount: 0,
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('userId', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
      })) as Notification[];
      
      // Sort notifications by createdAt in descending order
      const sortedNotifications = notificationsList.sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      setNotifications(sortedNotifications);
      setUnreadCount(sortedNotifications.filter(n => !n.read).length);
    });

    return () => unsubscribe();
  }, [userId]);

  const markAsRead = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(notification => {
        if (!notification.read) {
          const notificationRef = doc(db, 'notifications', notification.id);
          
          // For ride requests, update the status to 'rejected' if not already handled
          if (notification.type === 'ride_request' && !notification.data?.status) {
            batch.update(notificationRef, {
              read: true,
              data: {
                ...notification.data,
                status: 'rejected'
              }
            });

            // Also update the ride request status
            if (notification.data?.rideId) {
              const rideRequestRef = doc(db, 'ride_requests', notification.data.rideId);
              batch.update(rideRequestRef, {
                status: 'rejected',
                updated_at: new Date(),
              });
            }
          } else {
            // For other notifications, just mark as read
            batch.update(notificationRef, { read: true });
          }
        }
      });
      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, markAsRead, markAllAsRead, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
};
