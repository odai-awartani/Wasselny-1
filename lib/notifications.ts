import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getMessaging, getToken } from 'firebase/messaging';
import firebase from 'firebase/app';
import { parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Configure how notifications should be handled when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Save push token for the current user
const savePushTokenForUser = async (userId: string, token: string) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { 
      pushToken: token,
      updatedAt: new Date()
    }, { merge: true });
    console.log('Push token saved successfully for user:', userId);
  } catch (error) {
    console.error('Error saving push token:', error);
  }
};

// Setup notifications and request permissions
export const setupNotifications = async (userId: string) => {
  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    // Get push token with the correct project ID
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '20c6abe0-3a09-4d59-8ae3-13afa64ee315',
    })).data;

    // Save token to Firestore
    if (userId) {
      await savePushTokenForUser(userId, token);
    }

    return token;
  } catch (error) {
    console.error('Error setting up notifications:', error);
    return null;
  }
};

// Schedule a notification
export const scheduleNotification = async (
  title: string,
  body: string,
  triggerDate: Date,
  rideId?: string
): Promise<string | null> => {
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { rideId },
      },
      trigger: {
        date: triggerDate,
      } as Notifications.NotificationTriggerInput,
    });

    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

// Send immediate notification
export const sendRideStatusNotification = async (
  userId: string,
  title: string,
  body: string,
  rideId?: string
) => {
  try {
    // Get user's push token from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists() || !userDoc.data().pushToken) {
      console.warn('No push token found for user:', userId);
      return;
    }

    const pushToken = userDoc.data().pushToken;

    // Send notification via Expo's push notification service
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: { rideId },
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error('Failed to send push notification');
    }

    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
};

// Cancel a scheduled notification
export const cancelNotification = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
};

// Cancel all scheduled notifications
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
};

// Send chat notification to a specific user
// Send chat notification to a specific user
export const sendChatNotification = async (
    recipientId: string,
    senderName: string,
    message: string,
    chatId: string
  ) => {
    try {
      // Get recipient's push token from Firestore
      const userDoc = await getDoc(doc(db, 'users', recipientId));
      if (!userDoc.exists() || !userDoc.data().pushToken) {
        console.warn(`No push token found for user: ${recipientId}`);
        return;
      }
  
      const pushToken = userDoc.data().pushToken;
  
      // Send notification via Expo server
      const notificationMessage = {
        to: pushToken,
        sound: 'default',
        title: `New message from ${senderName}`,
        body: message,
        data: { chatId, type: 'chat' },
        priority: 'high',
        channelId: 'chat-messages',
      };
  
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationMessage),
      });
  
      if (!response.ok) {
        console.warn('Failed to send chat notification:', await response.text());
        return;
      }
  
      console.log(`Chat notification sent to user: ${recipientId}`);
    } catch (error) {
      console.error('Error sending chat notification:', error);
    }
  };

// التعامل مع النقر على الإشعار
export const handleNotificationResponse = (
  response: Notifications.NotificationResponse
) => {
  const { notification } = response;
  const data = notification.request.content.data;
  const rideId = data?.rideId;
  const type = data?.type;
  const notificationId = data?.notificationId;

  console.log('Notification clicked:', { rideId, type, notificationId });

  if (type === 'ride_request' && notificationId) {
    // Navigate to ride details with the notification ID
    const { router } = require('expo-router');
    router.push({
      pathname: `/ride-details/${rideId}`,
      params: { notificationId }
    });
  } else if (rideId) {
    // Navigate to ride details for other notifications
    const { router } = require('expo-router');
    router.push(`/ride-details/${rideId}`);
  }
};

// إعداد مستمع للإشعارات
export const setupNotificationHandler = () => {
  Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};

export const registerForPushNotificationsAsync = async () => {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return;
  }

  token = (await Notifications.getExpoPushTokenAsync({
    projectId: '20c6abe0-3a09-4d59-8ae3-13afa64ee315'
  })).data;
  
  return token;
};

export const scheduleRideNotification = async (title: string, body: string, timeInMinutes: number) => {
  const triggerDate = new Date(Date.now() + timeInMinutes * 60 * 1000);
  
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      date: triggerDate,
    } as Notifications.NotificationTriggerInput,
  });
};

export const sendTestNotification = async () => {
  try {
    console.log('Starting notification setup...');
    
    // Check notification permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Current notification permission status:', existingStatus);
    
    if (existingStatus !== 'granted') {
      console.log('Requesting notification permissions...');
      const { status } = await Notifications.requestPermissionsAsync();
      console.log('New permission status:', status);
      
      if (status !== 'granted') {
        console.warn('Notification permissions not granted');
        return false;
      }
    }
    
    // Get the current user's push token
    const token = await registerForPushNotificationsAsync();
    console.log('Push token received:', token);
    
    if (!token) {
      console.warn('No push token available for test notification');
      return false;
    }

    // Send test notification
    const message = {
      to: token,
      sound: 'default',
      title: 'Test Notification',
      body: 'This is a test notification from Wasselny!',
      data: { test: true },
      priority: 'high',
      channelId: 'default',
      badge: 1,
      vibrate: [0, 250, 250, 250],
    };

    console.log('Sending notification with message:', message);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const responseData = await response.json();
    console.log('Notification response:', responseData);

    if (!response.ok) {
      console.error('Failed to send test notification:', responseData);
      return false;
    }

    console.log('Test notification sent successfully!');
    return true;
  } catch (error) {
    console.error('Error sending test notification:', error);
    return false;
  }
};

// Send ride request notification
export const sendRideRequestNotification = async (
  driverId: string,
  passengerName: string,
  pickupLocation: string,
  dropoffLocation: string,
  rideId: string
) => {
  try {
    // Get driver's push token from Firestore
    const driverDoc = await getDoc(doc(db, 'users', driverId));
    if (!driverDoc.exists() || !driverDoc.data().pushToken) {
      console.warn('No push token found for driver:', driverId);
      return;
    }

    const pushToken = driverDoc.data().pushToken;

    // Create notification in Firestore
    const notificationRef = doc(collection(db, 'notifications'));
    const notificationData = {
      id: notificationRef.id,
      title: 'New Ride Request',
      message: `${passengerName} requested a ride from ${pickupLocation} to ${dropoffLocation}`,
      type: 'ride_request',
      read: false,
      userId: driverId,
      createdAt: new Date(),
      data: {
        rideId,
        notificationId: notificationRef.id
      }
    };

    // Save notification to Firestore
    await setDoc(notificationRef, notificationData);

    // Send push notification
    const message = {
      to: pushToken,
      sound: 'default',
      title: 'New Ride Request',
      body: `${passengerName} requested a ride from ${pickupLocation} to ${dropoffLocation}`,
      data: { 
        type: 'ride_request',
        notificationId: notificationRef.id,
        rideId
      },
      priority: 'high',
      channelId: 'ride-requests',
      badge: 1,
      vibrate: [0, 250, 250, 250],
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error('Failed to send push notification');
    }

    console.log('Ride request notification sent successfully');
    return true;
  } catch (error) {
    console.error('Error sending ride request notification:', error);
    return false;
  }
};