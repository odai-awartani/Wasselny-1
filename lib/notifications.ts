import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';
import { format, parse, differenceInMinutes, addMinutes } from 'date-fns';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
interface FirebaseDriverData {
  car_type: string;
  car_image_url: string;
  profile_image_url: string;
  car_seats: number;
  created_at: string;
  is_active: boolean;
  name?: string;
}

interface BaseRideData {
  id: string;
  ride_datetime: string;
  origin: string;
  destination: string;
  notification_sent?: boolean;
  driver_id?: string;
}

interface DriverRideData extends BaseRideData {
  type: 'driver';
}

interface PassengerRideData extends BaseRideData {
  type: 'passenger';
  driver?: FirebaseDriverData;
  driver_name?: string;
}

type RideData = DriverRideData | PassengerRideData;

interface NotificationData {
  user_id: string;
  type: 'ride_reminder' | 'chat' | 'ride_request' | 'ride_status';
  title: string;
  message: string;
  ride_id?: string;
  scheduled_time?: Date;
  notification_id?: string;
  created_at: Date;
  read: boolean;
  data?: {
    rideId?: string;
    notificationId?: string;
    chatId?: string;
    type?: string;
  };
}

// Constants
const DATE_FORMAT = 'dd/MM/yyyy HH:mm';
const REMINDER_MINUTES = 15;
const CHECK_INTERVAL_SECONDS = 30;
const NOTIFICATION_CHANNEL = 'ride-requests';
const EXPO_PROJECT_ID = '20c6abe0-3a09-4d59-8ae3-13afa64ee315';

// Store sent notifications to avoid duplicates
const notificationsSentByRide: Record<string, boolean> = {};

// Configure notification handling
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Handle notification press
export const handleNotification = (notification: Notifications.NotificationResponse) => {
  const data = notification.notification.request.content.data;
  const rideId = data.rideId;

  if (rideId) {
    router.push(`/ride-details/${rideId}`);
  }
};

// Set up notification response listener
export const setupNotificationHandler = () => {
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotification(response);
  });

  return () => {
    Notifications.removeNotificationSubscription(responseListener);
  };
};

// Save user push token to Firestore
export const saveUserPushToken = async (userId: string, pushToken: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { pushToken }, { merge: true });
    console.log(`Push token saved for user: ${userId}`);
  } catch (error) {
    console.error('Error saving push token:', error);
  }
};

// Helper Functions
export const parseRideDateTime = (datetime: string): Date => {
  try {
    return parse(datetime, DATE_FORMAT, new Date());
  } catch (error) {
    console.error(`Invalid date format. Expected ${DATE_FORMAT}, got ${datetime}`);
    return new Date();
  }
};

export const calculateReminderTime = (rideDate: Date): Date => {
  return addMinutes(rideDate, -REMINDER_MINUTES);
};

export const getUserPushToken = async (userId: string): Promise<string | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists()) {
      return userDoc.data()?.pushToken || null;
    } else {
      console.error(`User with ID ${userId} does not exist`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting push token for user ${userId}:`, error);
    return null;
  }
};

export const saveNotificationToDB = async (data: Omit<NotificationData, 'created_at'>): Promise<string | null> => {
  try {
    const notificationRef = await addDoc(collection(db, 'notifications'), {
      ...data,
      created_at: serverTimestamp(),
    });
    return notificationRef.id;
  } catch (error) {
    console.error('Error saving notification to database:', error);
    return null;
  }
};

// Cancel a scheduled notification
export const cancelNotification = async (notificationId: string): Promise<void> => {
  if (!notificationId) {
    console.error('Notification ID is required');
    return;
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log(`Cancelled notification with ID: ${notificationId}`);
  } catch (error) {
    console.error('Error cancelling notification:', error);
  }
};

// Schedule the notification
export const scheduleNotification = async (
  title: string,
  body: string,
  triggerTime: Date,
  rideId: string,
  targetUserId?: string
): Promise<string | null> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') {
        console.warn('Notification permissions not granted');
        return null;
      }
    }

    // If targetUserId is provided, get their push token and send a push notification
    if (targetUserId) {
      const pushToken = await getUserPushToken(targetUserId);
      if (!pushToken) {
        console.log(`No push token found for user ${targetUserId}`);
        return null;
      }

      // Send push notification using Expo's push service
      const message = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: body,
        data: { rideId },
        priority: 'high',
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      // Generate a unique identifier for this notification
      const identifier = `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return identifier;
    }

    // Schedule local notification
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: title,
        body: body,
        data: { rideId },
        sound: 'default',
        priority: 'high',
      },
      trigger: {
        date: triggerTime,
        repeats: false,
      },
    });

    console.log(`Scheduled notification with ID: ${identifier}`);
    return identifier;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

// Schedule notification for driver
export const scheduleDriverRideReminder = async (
  rideId: string,
  driverId: string,
  rideDateTime: string,
  origin: string,
  destination: string
): Promise<string | null> => {
  try {
    console.log(`Scheduling driver notification for ride ${rideId}`);
    
    const rideDate = parseRideDateTime(rideDateTime);
    const reminderTime = calculateReminderTime(rideDate);

    return await scheduleNotification(
      'تذكير بموعد رحلة',
      `استعد للانطلاق بعد ${REMINDER_MINUTES} دقيقة من ${origin} إلى ${destination}`,
      reminderTime,
      rideId,
      driverId
    );
  } catch (error) {
    console.error('Error scheduling driver notification:', error);
    return null;
  }
};

// Schedule notification for passenger
export const schedulePassengerRideReminder = async (
  rideId: string,
  rideDateTime: string,
  origin: string,
  destination: string,
  driverName: string
): Promise<string | null> => {
  try {
    console.log(`Scheduling passenger notification for ride ${rideId}`);
    
    const rideDate = parseRideDateTime(rideDateTime);
    const reminderTime = calculateReminderTime(rideDate);

    return await scheduleNotification(
      'تذكير بموعد رحلة',
      `استعد للانطلاق بعد ${REMINDER_MINUTES} دقيقة مع السائق ${driverName} من ${origin} إلى ${destination}`,
      reminderTime,
      rideId
    );
  } catch (error) {
    console.error('Error scheduling passenger notification:', error);
    return null;
  }
};

// Schedule notification for a specific ride (New Function)
export const scheduleRideNotification = async (
  rideId: string,
  userId: string,
  isDriver: boolean
): Promise<string | null> => {
  try {
    const rideDocRef = doc(db, 'rides', rideId);
    const rideDoc = await getDoc(rideDocRef);

    if (!rideDoc.exists()) {
      console.warn(`Ride ${rideId} not found`);
      return null;
    }

    const rideData = rideDoc.data();
    const rideTime = parseRideDateTime(rideData.ride_datetime);
    const nowDate = new Date();
    const minutesUntilRide = differenceInMinutes(rideTime, nowDate);

    console.log(`Processing ${isDriver ? 'driver' : 'passenger'} ride ${rideId}: ${minutesUntilRide} minutes until start`);

    if (minutesUntilRide > 0 && minutesUntilRide <= REMINDER_MINUTES) {
      let notificationId: string | null = null;
      if (isDriver) {
        notificationId = await scheduleDriverRideReminder(
          rideId,
          userId,
          rideData.ride_datetime,
          rideData.origin_address,
          rideData.destination_address
        );
      } else {
        let driverName = 'Unknown Driver';
        if (rideData.driver_id) {
          const driverDoc = await getDoc(doc(db, 'users', rideData.driver_id));
          if (driverDoc.exists()) {
            driverName = driverDoc.data().name || driverName;
          }
        }
        notificationId = await schedulePassengerRideReminder(
          rideId,
          rideData.ride_datetime,
          rideData.origin_address,
          rideData.destination_address,
          driverName
        );
      }

      if (notificationId) {
        const key = isDriver ? rideId : `${rideId}_${userId}`;
        notificationsSentByRide[key] = true;
        const updateDocRef = isDriver
          ? doc(db, 'rides', rideId)
          : doc(db, 'ride_requests', `${rideId}_${userId}`);
        await setDoc(updateDocRef, { notification_sent: true }, { merge: true });
        console.log(`Scheduled ${isDriver ? 'driver' : 'passenger'} notification for ride ${rideId}`);
        return notificationId; // Return notificationId for use in handleAcceptRequest
      }
    }
    return null;
  } catch (error) {
    console.error('Error in scheduleRideNotification:', error);
    return null;
  }
};

// Setup notifications
export const setupNotifications = async (userId: string): Promise<string | null> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ride-reminders', {
        name: 'Ride Reminders',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    const pushToken = tokenData.data;

    await saveUserPushToken(userId, pushToken);
    setupNotificationHandler();

    return pushToken;
  } catch (error) {
    console.error('Error in setupNotifications:', error);
    return null;
  }
};

// Send ride status notification
export const sendRideStatusNotification = async (
  userId: string,
  title: string,
  message: string,
  rideId: string
): Promise<boolean> => {
  try {
    const userPushToken = await getUserPushToken(userId);
    if (!userPushToken) {
      console.log('No push token found for user');
      return false;
    }

    const identifier = await scheduleNotification(
      title,
      message,
      new Date(),
      rideId,
      userId
    );

    if (identifier) {
      await saveNotificationToDB({
        user_id: userId,
        type: 'ride_status',
        title,
        message,
        ride_id: rideId,
        read: false,
        data: {
          rideId,
          type: 'ride_status'
        }
      });

      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending ride status notification:', error);
    return false;
  }
};

// Send check-in notification
export const sendCheckInNotification = async (
  driverId: string,
  passengerName: string,
  rideId: string
): Promise<boolean> => {
  return sendRideStatusNotification(
    driverId,
    'تم تسجيل الدخول!',
    `قام ${passengerName} بتسجيل الدخول للرحلة`,
    rideId
  );
};

// Send check-out notification for driver
export const sendCheckOutNotificationForDriver = async (
  driverId: string,
  passengerName: string,
  rideId: string
): Promise<boolean> => {
  return sendRideStatusNotification(
    driverId,
    'تم تسجيل الخروج!',
    `قام ${passengerName} بتسجيل الخروج من الرحلة`,
    rideId
  );
};

// Send check-out notification for passenger
export const sendCheckOutNotificationForPassenger = async (
  passengerId: string,
  driverName: string,
  rideId: string
): Promise<boolean> => {
  return sendRideStatusNotification(
    passengerId,
    'تم تسجيل الخروج!',
    `قام السائق ${driverName} بتسجيل الخروج من الرحلة`,
    rideId
  );
};

// Send check-out notification for both
export const sendCheckOutNotification = async (
  driverId: string,
  passengerId: string,
  passengerName: string,
  driverName: string,
  rideId: string
): Promise<boolean> => {
  const driverNotification = await sendCheckOutNotificationForDriver(driverId, passengerName, rideId);
  const passengerNotification = await sendCheckOutNotificationForPassenger(passengerId, driverName, rideId);
  return driverNotification && passengerNotification;
};

// Send rating notification to driver
export const sendRatingNotification = async (
  driverId: string,
  rating: number,
  rideId: string
): Promise<boolean> => {
  return sendRideStatusNotification(
    driverId,
    'تقييم جديد للرحلة!',
    `تم تقييم رحلتك بـ ${rating} نجوم`,
    rideId
  );
};

// Send ride cancellation notification
export const sendRideCancellationNotification = async (
  driverId: string,
  passengerName: string,
  rideId: string
): Promise<boolean> => {
  return sendRideStatusNotification(
    driverId,
    'تم إلغاء الحجز',
    `قام ${passengerName} بإلغاء حجز الرحلة`,
    rideId
  );
};

// Send ride request notification to driver
export const sendRideRequestNotification = async (
  driverId: string,
  passengerName: string,
  originAddress: string,
  destinationAddress: string,
  rideId: string
): Promise<boolean> => {
  try {
    const notificationId = await scheduleNotification(
      'طلب حجز جديد',
      `يوجد طلب حجز جديد من ${passengerName} للرحلة من ${originAddress} إلى ${destinationAddress}`,
      new Date(),
      rideId,
      driverId
    );

    if (notificationId) {
      await addDoc(collection(db, 'notifications'), {
        user_id: driverId,
        type: 'ride_request',
        title: 'طلب حجز جديد',
        message: `يوجد طلب حجز جديد من ${passengerName} للرحلة من ${originAddress} إلى ${destinationAddress}`,
        ride_id: rideId,
        notification_id: notificationId,
        created_at: serverTimestamp(),
        read: false,
        data: {
          rideId,
          type: 'ride_request',
          notificationId
        }
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending ride request notification:', error);
    return false;
  }
};

// Start the ride notification service
export const startRideNotificationService = async (
  userId: string,
  forceCheck: boolean = false
): Promise<void> => {
  try {
    console.log('Starting Ride Notification Service for user:', userId);

    const lastCheck = Number(await AsyncStorage.getItem(`lastCheck_${userId}`)) || 0;
    const now = Date.now();
    if (!forceCheck && now - lastCheck < CHECK_INTERVAL_SECONDS * 1000) {
      console.log('Skipping check: too soon since last check');
      return;
    }

    await AsyncStorage.setItem(`lastCheck_${userId}`, now.toString());

    const ridesRef = collection(db, 'rides');
    const nowDate = new Date();

    // 1. Check for driver rides
    const driverRidesQuery = query(
      ridesRef,
      where('driver_id', '==', userId),
      where('status', '==', 'scheduled')
    );

    const driverRidesSnapshot = await getDocs(driverRidesQuery);
    for (const rideDoc of driverRidesSnapshot.docs) {
      const data = rideDoc.data();
      const rideTime = parseRideDateTime(data.ride_datetime);
      const minutesUntilRide = differenceInMinutes(rideTime, nowDate);

      console.log(`Processing driver ride ${rideDoc.id}: ${minutesUntilRide} minutes until start`);

      if (
        minutesUntilRide > 0 &&
        minutesUntilRide === REMINDER_MINUTES &&
        !notificationsSentByRide[rideDoc.id]
      ) {
        const notificationId = await scheduleDriverRideReminder(
          rideDoc.id,
          userId,
          data.ride_datetime,
          data.origin_address,
          data.destination_address
        );

        if (notificationId) {
          notificationsSentByRide[rideDoc.id] = true;
          await setDoc(doc(db, 'rides', rideDoc.id), { notification_sent: true }, { merge: true });
          console.log(`Scheduled driver notification for ride ${rideDoc.id}`);
        }
      }
    }

    // 2. Check for passenger rides (accepted requests)
    const rideRequestsRef = collection(db, 'ride_requests');
    const passengerRequestsQuery = query(
      rideRequestsRef,
      where('user_id', '==', userId),
      where('status', '==', 'accepted')
    );

    const passengerRequestsSnapshot = await getDocs(passengerRequestsQuery);
    for (const requestDoc of passengerRequestsSnapshot.docs) {
      const requestData = requestDoc.data();
      const rideDocRef = doc(db, 'rides', requestData.ride_id);
      const rideDoc = await getDoc(rideDocRef);

      if (!rideDoc.exists()) {
        console.warn(`Ride ${requestData.ride_id} not found for request ${requestDoc.id}`);
        continue;
      }

      const rideData = rideDoc.data();
      const rideTime = parseRideDateTime(rideData.ride_datetime);
      const minutesUntilRide = differenceInMinutes(rideTime, nowDate);

      console.log(`Processing passenger ride ${rideDoc.id}: ${minutesUntilRide} minutes until start`);

      let driverName = 'Unknown Driver';
      if (rideData.driver_id) {
        const driverDoc = await getDoc(doc(db, 'users', rideData.driver_id));
        if (driverDoc.exists()) {
          driverName = driverDoc.data().name || driverName;
        }
      }

      if (
        minutesUntilRide > 0 &&
        minutesUntilRide === REMINDER_MINUTES &&
        !notificationsSentByRide[`${rideDoc.id}_${userId}`]
      ) {
        const notificationId = await schedulePassengerRideReminder(
          rideDoc.id,
          rideData.ride_datetime,
          rideData.origin_address,
          rideData.destination_address,
          driverName
        );

        if (notificationId) {
          notificationsSentByRide[`${rideDoc.id}_${userId}`] = true;
          await setDoc(doc(db, 'ride_requests', requestDoc.id), { notification_sent: true }, { merge: true });
          console.log(`Scheduled passenger notification for ride ${rideDoc.id}`);
        }
      }
    }

  } catch (error) {
    console.error('Error in startRideNotificationService:', error);
  }
};