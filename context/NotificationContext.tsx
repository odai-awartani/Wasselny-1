import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch, getDocs, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@clerk/clerk-expo';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { startRideNotificationService } from '@/lib/notifications';
import { AppState } from 'react-native';

interface NotificationData {
  rideId?: string;
  notificationId?: string;
  chatId?: string;
  type?: string;
  status?: string;
}

interface Notification {
  id: string;
  type: 'ride_reminder' | 'chat' | 'ride_request' | 'ride_status';
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  user_id: string;
  ride_id?: string;
  scheduled_time?: Date;
  notification_id?: string;
  data?: NotificationData;
}

type NotificationContextType = {
  notifications: Notification[];
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  checkUpcomingRides: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType>({
  notifications: [],
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  unreadCount: 0,
  refreshNotifications: async () => {},
  checkUpcomingRides: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { userId } = useAuth();

  // Handle notification click
  useEffect(() => {
    if (!userId) return;

    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.rideId) {
        router.push(`/ride-details/${data.rideId}`);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userId]);

  // Handle foreground notifications
  useEffect(() => {
    if (!userId) return;

    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const notificationData = notification.request.content.data;
      
      // Create a temporary notification object
      const tempNotification: Notification = {
        id: notificationData.notificationId || Date.now().toString(),
        title: notification.request.content.title || '',
        message: notification.request.content.body || '',
        type: notificationData.type || 'ride_request',
        read: false,
        createdAt: new Date(),
        user_id: userId,
        ride_id: notificationData.rideId,
        data: notificationData
      };

      // Update notifications state immediately
      setNotifications(prevNotifications => {
        // Check if notification already exists
        const exists = prevNotifications.some(n => n.id === tempNotification.id);
        if (exists) return prevNotifications;

        // Add new notification and sort
        const updatedNotifications = [tempNotification, ...prevNotifications].sort((a, b) => 
          b.createdAt.getTime() - a.createdAt.getTime()
        );
        
        // Update unread count
        setUnreadCount(prev => prev + 1);
        
        return updatedNotifications;
      });
    });

    return () => {
      subscription.remove();
    };
  }, [userId]);

  // Check upcoming rides and schedule notifications
  const checkUpcomingRides = async () => {
    if (!userId) return;
    await startRideNotificationService(userId, true);
  };

  // Check upcoming rides periodically
  useEffect(() => {
    if (!userId) return;

    // Initial check
    checkUpcomingRides();

    // Set up periodic check every 5 minutes
    const interval = setInterval(() => {
      // Only check if the app is in the foreground
      if (AppState.currentState === 'active') {
        checkUpcomingRides();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes instead of every minute

    return () => {
      clearInterval(interval);
    };
  }, [userId]);

  const refreshNotifications = async () => {
    if (!userId) return;

    try {
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', userId)
      );

      const snapshot = await getDocs(q);
      const notificationsList = snapshot.docs.map((doc: DocumentData) => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'ride_request',
          title: data.title || '',
          message: data.message || '',
          read: data.read || false,
          user_id: data.user_id || userId,
          ride_id: data.ride_id,
          scheduled_time: data.scheduled_time?.toDate?.() || undefined,
          notification_id: data.notification_id,
          createdAt: data.created_at?.toDate?.() || new Date(),
          data: data.data || {}
        } as Notification;
      });
      
      // Sort notifications by createdAt in descending order
      const sortedNotifications = notificationsList.sort((a: Notification, b: Notification) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      setNotifications(sortedNotifications);
      setUnreadCount(sortedNotifications.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Error refreshing notifications:', error);
    }
  };

  // Firestore listener
  useEffect(() => {
    if (!userId) return;

    const notificationsRef = collection(db, 'notifications');
    const q = query(
      notificationsRef,
      where('user_id', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notificationsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type || 'ride_request',
          title: data.title || '',
          message: data.message || '',
          read: data.read || false,
          user_id: data.user_id || userId,
          ride_id: data.ride_id,
          scheduled_time: data.scheduled_time?.toDate?.() || undefined,
          notification_id: data.notification_id,
          createdAt: data.created_at?.toDate?.() || new Date(),
          data: data.data || {}
        } as Notification;
      });
      
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
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification || notification.read) return;

      const notificationRef = doc(db, 'notifications', notificationId);
      
      await updateDoc(notificationRef, { 
        read: true,
        updated_at: new Date()
      });
      
      setNotifications(prevNotifications => 
        prevNotifications.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      const unreadNotifications = notifications.filter(n => !n.read);

      unreadNotifications.forEach(notification => {
        const notificationRef = doc(db, 'notifications', notification.id);
        batch.update(notificationRef, {
          read: true,
          updated_at: new Date()
        });
      });

      await batch.commit();

      setNotifications(prevNotifications =>
        prevNotifications.map(notification => ({ ...notification, read: true }))
      );
      
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  return (
    <NotificationContext.Provider value={{
      notifications,
      markAsRead,
      markAllAsRead,
      unreadCount,
      refreshNotifications,
      checkUpcomingRides
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
