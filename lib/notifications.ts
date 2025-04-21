import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getMessaging, getToken } from 'firebase/messaging';
import firebase from 'firebase/app';
import { parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// إعداد الإشعارات وطلب الأذونات
export const setupNotifications = async (userId: string | null) => {
  try {
    // طلب الأذونات
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      alert('الرجاء منح إذن الإشعارات لتتمكن من تلقي التذكيرات');
      return false;
    }

    // إعداد قناة الإشعارات لنظام Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ride-reminders', {
        name: 'Ride Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
      });
    }

    // الحصول على pushToken وتخزينه في Firestore
    if (userId) {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'YOUR_EXPO_PROJECT_ID', // استبدل بمعرف مشروعك
      });
      await setDoc(doc(db, 'users', userId), { pushToken: token.data }, { merge: true });
      console.log('Push token saved for user:', userId);
    }

    return true;
  } catch (error) {
    console.error('Error setting up notifications:', error);
    return false;
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
// جدولة إشعار محلي
export const scheduleNotification = async (
  title: string,
  body: string,
  triggerDate: Date | string,
  rideId?: string,
  recipientId?: string // لتحديد المستلم (مثل السائق)
): Promise<string | null> => {
  try {
    // Convert the trigger date to the user's timezone
    const localTriggerDate = typeof triggerDate === 'string' 
      ? toZonedTime(parseISO(triggerDate), Intl.DateTimeFormat().resolvedOptions().timeZone)
      : triggerDate;
      
    const now = Date.now();
    const triggerSeconds = Math.floor((localTriggerDate.getTime() - now) / 1000);

    // التأكد من أن الإشعار ليس في الماضي
    if (triggerSeconds <= 0) {
      console.warn('Cannot schedule notification in the past:', triggerDate);
      return null;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { rideId },
      },
      trigger: {
        seconds: triggerSeconds,
        repeats: false,
      },
    });

    console.log(`Notification scheduled with ID: ${identifier} for ${triggerDate}`);
    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

// إرسال إشعار إلى مستخدم معين باستخدام FCM
export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  rideId?: string
) => {
  try {
    // جلب pushToken من Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists() || !userDoc.data().pushToken) {
      console.warn(`No push token found for user: ${userId}`);
      return;
    }

    const pushToken = userDoc.data().pushToken;

    // إرسال الإشعار عبر Expo server
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
        console.warn('Failed to send push notification:', await response.text());
        return;
      }
  
      console.log(`Push notification sent to user: ${userId}`);
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

// إلغاء إشعار مجدول
export const cancelNotification = async (identifier: string) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    console.log(`Notification ${identifier} cancelled`);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
};

// إلغاء كل الإشعارات
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling all notifications:', error);
  }
};

// التعامل مع النقر على الإشعار
export const handleNotificationResponse = (
  response: Notifications.NotificationResponse
) => {
  const { notification } = response;
  const rideId = notification.request.content.data?.rideId;

  console.log('Notification clicked:', { rideId });

  // يمكنك هنا توجيه المستخدم إلى شاشة تفاصيل الرحلة
  if (rideId) {
    import('expo-router').then(({ router }) => {
      router.push(`/ride-details/${rideId}`);
    });
  }
};

// إعداد مستمع للإشعارات
export const setupNotificationHandler = () => {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
};