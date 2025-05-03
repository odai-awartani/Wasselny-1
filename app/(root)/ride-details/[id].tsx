import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, query, where, getDocs, Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parse } from 'date-fns';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import { icons } from '@/constants';
import RideMap from '@/components/RideMap';
import CustomButton from '@/components/CustomButton';
import { useAuth } from '@clerk/clerk-expo';
import { scheduleNotification, setupNotifications, cancelNotification, sendRideStatusNotification, sendRideRequestNotification, startRideNotificationService, schedulePassengerRideReminder, sendCheckOutNotificationForDriver, scheduleDriverRideReminder } from '@/lib/notifications';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BottomSheet from '@gorhom/bottom-sheet';

interface DriverData {
  car_seats?: number;
  car_type?: string;
  profile_image_url?: string;
  car_image_url?: string;
}

interface UserData {
  name?: string;
  driver?: DriverData;
  gender?: string;
}

interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  created_at: any;
  ride_datetime: string;
  driver_id?: string;
  status: string;
  available_seats: number;
  is_recurring: boolean;
  no_children: boolean;
  no_music: boolean;
  no_smoking: boolean;
  required_gender: string;
  ride_days?: string[];
  ride_number: number;
  driver?: {
    name: string;
    car_seats: number;
    profile_image_url?: string;
    car_type: string;
    car_image_url?: string;
  };
}

interface RideRequest {
  id: string;
  ride_id: string;
  user_id: string;
  status: 'waiting' | 'accepted' | 'rejected' | 'checked_in' | 'checked_out' | 'cancelled';
  created_at: any;
  rating?: number;
  notification_id?: string;
  passenger_name?: string;
}

const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/40';
const DEFAULT_CAR_IMAGE = 'https://via.placeholder.com/120x80';
const DATE_FORMAT = 'dd/MM/yyyy HH:mm';

const RideDetails = () => {
  const [pendingRequests, setPendingRequests] = useState<RideRequest[]>([]);
  const [allPassengers, setAllPassengers] = useState<RideRequest[]>([]);
  const [passengerNames, setPassengerNames] = useState<Record<string, string>>({});
  const [passengerGenders, setPassengerGenders] = useState<Record<string, string>>({});
  const router = useRouter();
  const { id, notificationId, scrollToRequests } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const [ride, setRide] = useState<Ride | null>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [rating, setRating] = useState(0);
  const { userId } = useAuth();
  const isDriver = ride?.driver_id === userId;
  const isPassenger = rideRequest && rideRequest.status === 'accepted';

  // Cache helper functions
  const cacheRideDetails = async (rideId: string, rideData: Ride) => {
    try {
      await AsyncStorage.setItem(`ride_${rideId}`, JSON.stringify(rideData));
    } catch (err) {
      console.error('Error caching ride details:', err);
    }
  };

  const getCachedRideDetails = async (rideId: string): Promise<Ride | null> => {
    try {
      const cached = await AsyncStorage.getItem(`ride_${rideId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error('Error retrieving cached ride details:', err);
      return null;
    }
  };

  // Setup notifications
  useEffect(() => {
    if (userId) {
      setupNotifications(userId).catch((err) => console.error('Error setting up notifications:', err));
      startRideNotificationService(userId, true).catch((err) => console.error('Error starting notification service:', err));
    }
  }, [userId]);

  // Handle notification when page loads
  useEffect(() => {
    if (notificationId && typeof notificationId === 'string') {
      const markNotificationAsRead = async () => {
        try {
          const notificationRef = doc(db, 'notifications', notificationId);
          await updateDoc(notificationRef, { read: true });
          if (scrollViewRef.current && pendingRequests.length > 0) {
            scrollViewRef.current.scrollTo({ y: 600, animated: true });
          }
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      };
      markNotificationAsRead();
    }
  }, [notificationId, pendingRequests]);

  // Fetch ride details
  const fetchRideDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check cache first
      const cachedRide = await getCachedRideDetails(id as string);
      if (cachedRide) {
        setRide(cachedRide);
        setLoading(false);
        return;
      }

      const rideDocRef = doc(db, 'rides', id as string);
      const rideDocSnap = await getDoc(rideDocRef);

      if (!rideDocSnap.exists()) {
        setError('لم يتم العثور على الرحلة.');
        setLoading(false);
        return;
      }

      const rideData = rideDocSnap.data();

      let driverInfo: UserData = { name: DEFAULT_DRIVER_NAME };
      if (rideData.driver_id) {
        const userDocRef = doc(db, 'users', rideData.driver_id);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          driverInfo = userDocSnap.data() as UserData;
        } else {
          console.warn(`User not found for driver_id: ${rideData.driver_id}`);
        }
      }

      let formattedDateTime = rideData.ride_datetime;
      if (rideData.ride_datetime instanceof Timestamp) {
        formattedDateTime = format(rideData.ride_datetime.toDate(), DATE_FORMAT);
      } else {
        try {
          const parsedDate = parse(rideData.ride_datetime, DATE_FORMAT, new Date());
          if (!isNaN(parsedDate.getTime())) {
            formattedDateTime = format(parsedDate, DATE_FORMAT);
          } else {
            console.warn('Invalid ride_datetime format');
          }
        } catch {
          console.warn('Invalid ride_datetime format');
        }
      }

      const rideDetails: Ride = {
        id: rideDocSnap.id,
        origin_address: rideData.origin_address || 'غير معروف',
        destination_address: rideData.destination_address || 'غير معروف',
        origin_latitude: rideData.origin_latitude || 0,
        origin_longitude: rideData.origin_longitude || 0,
        destination_latitude: rideData.destination_latitude || 0,
        destination_longitude: rideData.destination_longitude || 0,
        created_at: rideData.created_at,
        ride_datetime: formattedDateTime,
        status: rideData.status || 'غير معروف',
        available_seats: rideData.available_seats || 0,
        is_recurring: rideData.is_recurring || false,
        no_children: rideData.no_children || false,
        no_music: rideData.no_music || false,
        no_smoking: rideData.no_smoking || false,
        required_gender: rideData.required_gender || 'كلاهما',
        ride_days: rideData.ride_days || [],
        ride_number: rideData.ride_number || 0,
        driver_id: rideData.driver_id,
        driver: {
          name: driverInfo.name || DEFAULT_DRIVER_NAME,
          car_seats: driverInfo.driver?.car_seats || DEFAULT_CAR_SEATS,
          profile_image_url: driverInfo.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE,
          car_type: driverInfo.driver?.car_type || DEFAULT_CAR_TYPE,
          car_image_url: driverInfo.driver?.car_image_url || DEFAULT_CAR_IMAGE,
        },
      };

      setRide(rideDetails);
      await cacheRideDetails(id as string, rideDetails);
    } catch (err) {
      console.error('Error fetching ride details:', err);
      setError('فشل تحميل تفاصيل الرحلة. تحقق من اتصالك بالإنترنت وحاول مجددًا.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Monitor ride request status
  useEffect(() => {
    if (!userId || !id) {
      setLoading(false);
      return;
    }

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, where('ride_id', '==', id), where('user_id', '==', userId));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const doc = snapshot.docs[0];
          setRideRequest({ id: doc.id, ...doc.data() } as RideRequest);
        } else {
          setRideRequest(null);
        }
      },
      (error) => {
        console.error('Error fetching ride request:', error);
        setError('فشل تحميل طلب الحجز. تحقق من اتصالك بالإنترنت.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id, userId]);

  // Fetch pending ride requests for driver
  useEffect(() => {
    if (!ride?.id || !isDriver) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, where('ride_id', '==', ride.id), where('status', '==', 'waiting'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests: RideRequest[] = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setPendingRequests(requests);
      },
      (error) => {
        console.error('Error fetching pending requests:', error);
        setError('فشل تحميل طلبات الحجز المعلقة.');
      }
    );

    return () => unsubscribe();
  }, [ride?.id, isDriver]);

  // Fetch all passengers for the ride
  useEffect(() => {
    if (!ride?.id) return;

    const fetchPassengers = async () => {
      try {
        const rideRequestsRef = collection(db, 'ride_requests');
        const q = query(rideRequestsRef, where('ride_id', '==', ride.id), where('status', 'in', ['accepted', 'checked_in', 'checked_out']));
        const snapshot = await getDocs(q);
        const passengers: RideRequest[] = [];
        snapshot.forEach((doc) => {
          passengers.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setAllPassengers(passengers);
      } catch (error) {
        console.error('Error fetching passengers:', error);
        setError('فشل تحميل قائمة الركاب.');
      }
    };

    fetchPassengers();
  }, [ride?.id]);

  // Fetch passenger names and genders
  useEffect(() => {
    const fetchPassengerDetails = async () => {
      try {
        const passengerIds = allPassengers.map((p) => p.user_id);
        if (!passengerIds.length) return;

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('__name__', 'in', passengerIds));
        const querySnapshot = await getDocs(q);

        const names: Record<string, string> = {};
        const genders: Record<string, string> = {};
        querySnapshot.forEach((doc) => {
          const userData = doc.data();
          names[doc.id] = userData?.name || 'الراكب';
          genders[doc.id] = userData?.gender || 'غير محدد';
        });

        setPassengerNames(names);
        setPassengerGenders(genders);
      } catch (error) {
        console.error('Error fetching passenger details:', error);
        setError('فشل تحميل بيانات الركاب.');
      }
    };

    if (allPassengers.length > 0) {
      fetchPassengerDetails();
    }
  }, [allPassengers]);

  // Handle scrolling to requests
  useEffect(() => {
    if (scrollToRequests === 'true' && scrollViewRef.current && pendingRequests.length > 0) {
      scrollViewRef.current.scrollTo({ y: 600, animated: true });
    }
  }, [scrollToRequests, pendingRequests]);

  // Handle driver accepting ride request
  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      if (!ride || !ride.driver_id) {
        throw new Error('بيانات الرحلة أو السائق غير متوفرة');
      }

      const passengerNotificationId = await schedulePassengerRideReminder(
        ride.id,
        ride.ride_datetime,
        ride.origin_address,
        ride.destination_address,
        ride.driver?.name || DEFAULT_DRIVER_NAME
      );

      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'accepted',
        updated_at: serverTimestamp(),
        passenger_name: passengerName,
        passenger_id: userId,
        notification_id: passengerNotificationId || null,
      });

      await sendRideStatusNotification(
        userId,
        'تم قبول طلب الحجز!',
        `تم قبول طلب حجزك للرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
        ride.id
      );

      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', userId),
        where('data.rideId', '==', ride.id),
        where('type', '==', 'ride_request')
      );

      const querySnapshot = await getDocs(q);
      for (const doc of querySnapshot.docs) {
        await updateDoc(doc.ref, {
          read: true,
          data: {
            status: 'accepted',
            rideId: ride.id,
            type: 'ride_status',
            passenger_name: passengerName,
          },
        });
      }

      Alert.alert('✅ تم قبول طلب الحجز بنجاح', `تم قبول طلب ${passengerName}`);
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('حدث خطأ أثناء قبول الطلب.');
    }
  };

  // Handle driver rejecting ride request
  const handleRejectRequest = async (requestId: string, userId: string) => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'rejected',
        updated_at: serverTimestamp(),
      });

      await sendRideStatusNotification(
        userId,
        'تم رفض طلب الحجز',
        `عذراً، تم رفض طلب حجزك للرحلة من ${ride?.origin_address} إلى ${ride?.destination_address}`,
        ride?.id || ''
      );

      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', userId),
        where('data.rideId', '==', ride?.id),
        where('type', '==', 'ride_request')
      );

      const querySnapshot = await getDocs(q);
      for (const doc of querySnapshot.docs) {
        await updateDoc(doc.ref, {
          read: true,
          data: {
            status: 'rejected',
            rideId: ride?.id,
            type: 'ride_status',
            passenger_name: passengerName,
          },
        });
      }

      Alert.alert('✅ تم رفض طلب الحجز', `تم رفض طلب ${passengerName}`);
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('حدث خطأ أثناء رفض الطلب.');
    }
  };

  // Handle booking a ride
  const handleBookRide = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!ride || !ride.id || !ride.driver_id || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      const userName = userData?.name || 'الراكب';
      const userGender = userData?.gender || 'غير محدد';

      if (ride.required_gender !== 'كلاهما') {
        if (ride.required_gender === 'ذكر' && userGender !== 'Male') {
          Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الذكور فقط.');
          return;
        }
        if (ride.required_gender === 'أنثى' && userGender !== 'Female') {
          Alert.alert('غير مسموح', 'هذه الرحلة مخصصة للركاب الإناث فقط.');
          return;
        }
      }

      const rideRequestRef = await addDoc(collection(db, 'ride_requests'), {
        ride_id: ride.id,
        user_id: userId,
        driver_id: ride.driver_id,
        status: 'waiting',
        created_at: serverTimestamp(),
        passenger_name: userName,
      });

      const driverNotificationId = await scheduleDriverRideReminder(
        ride.id,
        ride.driver_id,
        ride.ride_datetime,
        ride.origin_address,
        ride.destination_address
      );

      await sendRideRequestNotification(
        ride.driver_id,
        userName,
        ride.origin_address,
        ride.destination_address,
        ride.id
      );

      Alert.alert('✅ تم إرسال طلب الحجز بنجاح');
    } catch (error) {
      console.error('Booking error:', error);
      Alert.alert('حدث خطأ أثناء إرسال طلب الحجز.');
    }
  };

  // Handle check-in
  const handleCheckIn = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_in',
        updated_at: serverTimestamp(),
      });

      // Removed updating available_seats to keep it unchanged in Firestore
      await sendRideStatusNotification(
        ride.driver_id || '',
        'الراكب وصل',
        `الراكب قد وصل وبدأ الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
        ride.id
      );

      Alert.alert('✅ تم تسجيل الدخول بنجاح');
    } catch (error) {
      console.error('Error during check-in:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الدخول.');
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_out',
        updated_at: serverTimestamp(),
      });

      await sendCheckOutNotificationForDriver(
        ride.driver_id || '',
        passengerNames[userId] || 'الراكب',
        ride.id
      );

      setShowRatingModal(true);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };

  // Handle ride cancellation
  const handleCancelRide = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });

      // Removed updating available_seats to keep it unchanged in Firestore
      if (ride.driver_id) {
        const passengerName = passengerNames[userId] || 'الراكب';
        await sendRideStatusNotification(
          ride.driver_id,
          'تم إلغاء الحجز',
          `قام ${passengerName} بإلغاء حجز الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
          ride.id
        );
      }

      Alert.alert('✅ تم إلغاء الحجز بنجاح');
    } catch (error) {
      console.error('Cancellation error:', error);
      Alert.alert('حدث خطأ أثناء إلغاء الحجز.');
    }
  };

  // Handle rating submission
  const handleRateDriver = async () => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      if (!rideRequest || !ride) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        rating: rating,
        updated_at: serverTimestamp(),
      });

      if (ride.driver_id) {
        await sendRideStatusNotification(
          ride.driver_id,
          'تقييم جديد!',
          `قام الراكب بتقييم رحلتك بـ ${rating} نجوم`,
          ride.id
        );
      }

      setShowRatingModal(false);
      Alert.alert('✅ شكراً على تقييمك!');
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('حدث خطأ أثناء إرسال التقييم.');
    }
  };

  // Handle target press for bottom sheet
  const handleTargetPress = () => {
    if (Platform.OS === 'android') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    bottomSheetRef.current?.snapToIndex(2);
  };

  // Format time to 12-hour format
  const formatTimeTo12Hour = (timeStr: string) => {
    try {
      const [date, time] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'مساءً' : 'صباحاً';
      const formattedHours = hours % 12 || 12;
      return {
        date,
        time: `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`,
      };
    } catch (error) {
      console.error('Error formatting time:', error);
      return {
        date: timeStr,
        time: timeStr,
      };
    }
  };

  // Memoized formatted ride data
  const formattedRide = useMemo(() => {
    if (!ride) return null;
    return {
      ...ride,
      formattedDateTime: ride.ride_datetime ? formatTimeTo12Hour(ride.ride_datetime) : { date: 'غير محدد', time: 'غير محدد' },
    };
  }, [ride]);

  // Render driver info
  const renderDriverInfo = useCallback(
    () => (
      <View
        className="bg-white w-[98%] mx-1 p-4 rounded-xl"
        style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
      >
        <TouchableOpacity
          onPress={() => router.push(`/profile/${formattedRide?.driver_id}`)}
          className="flex-row-reverse items-center "
        >
          <Image
            source={{ uri: formattedRide?.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE }}
            className="w-16 h-16 rounded-full mr-4"
          />
          <View className="flex-1 ">
            <Text className="text-xl mr-2 text-right font-CairoBold mb-1 text-black">{formattedRide?.driver?.name}</Text>
            <View className="flex-row-reverse justify-between  items-center">
            <Text className="text-black mr-2 font-CairoMedium">{formattedRide?.driver?.car_type}</Text>
            <View className='flex-row-reverse'>
              <FontAwesome5 name="users" size={16} color="#000" />
            <Text className="text-black mr-1 font-CairoMedium">
                {`${formattedRide?.driver?.car_seats || DEFAULT_CAR_SEATS} مقاعد السيارة`}
              </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
        <View className="items-center">
          <View className="flex-row-reverse justify-between w-full">
            
              
           
          </View>
        </View>
      </View>
    ),
    [formattedRide, allPassengers]
  );

  // Render ride details
  const renderRideDetails = useCallback(
    () => (
      <View
        className="bg-white w-[98%] mx-1 mt-3 p-4 rounded-xl"
        style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
      >
        <View className="flex-row-reverse mb-4">
  <View className="flex-1">
    <View className="flex-row-reverse items-center mb-3">
      <Image source={icons.point} className="w-6 h-6 ml-3" />
      <Text className="text-lg font-CairoBold text-black text-right">
        من: {formattedRide?.origin_address}
      </Text>
    </View>
    <View className="flex-row-reverse items-center">
      <Image source={icons.target} className="w-6 h-6 ml-3" />
      <Text className="text-lg font-CairoBold text-black text-right">
        إلى: {formattedRide?.destination_address}
      </Text>
    </View>
  </View>
</View>


        <View className="flex-row-reverse justify-between mb-4">
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="event" size={20} color="#000" className="mr-3" />
            <Text className="text-black ml-1 font-CairoMedium">{formattedRide?.formattedDateTime?.date}</Text>
          </View>
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="access-time" size={20} color="#ff0000" className="mr-3" />
            <Text className="text-red-600 ml-1 font-CairoMedium">{formattedRide?.formattedDateTime?.time}</Text>
          </View>
        </View>

        <View className="flex-row-reverse justify-between mb-4">
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="repeat" size={20} color="#000" className="mr-3" />
            <Text className="text-black ml-1 font-CairoMedium">
              {formattedRide?.is_recurring ? `رحلة متكررة (${formattedRide.ride_days?.join(', ')})` : 'رحلة لمرة واحدة'}
            </Text>
          </View>
          <View className="flex-row-reverse items-center">
            <MaterialIcons name="event-seat" size={20} color="#000" className="mr-3" />
            <Text className="text-black ml-1 font-CairoMedium">
              {`${formattedRide?.available_seats}/${allPassengers.length} مقاعد`}
            </Text>
          </View>
        </View>

        <View className="mt-4">
          <Text className="text-lg font-CairoBold text-right mb-4 text-black">تفضيلات الرحلة</Text>
          <View className="flex-row-reverse flex-wrap">
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons
                name={formattedRide?.no_smoking ? 'smoke-free' : 'smoking-rooms'}
                size={24}
                color="#000"
                className="mr-3"
              />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.no_smoking ? 'ممنوع التدخين' : 'مسموح التدخين'}
              </Text>
            </View>
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons
                name={formattedRide?.no_music ? 'music-off' : 'music-note'}
                size={24}
                color="#000"
                className="mr-3"
              />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.no_music ? 'ممنوع الموسيقى' : 'مسموح الموسيقى'}
              </Text>
            </View>
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons
                name={formattedRide?.no_children ? 'child-care' : 'child-friendly'}
                size={24}
                color="#000"
                className="mr-3"
              />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.no_children ? 'ممنوع الأطفال' : 'مسموح الأطفال'}
              </Text>
            </View>
            <View className="w-1/2 flex-row-reverse items-center mb-4">
              <MaterialIcons name="wc" size={24} color="#000" className="mr-3" />
              <Text className="text-black ml-1 font-CairoMedium">
                {formattedRide?.required_gender === 'ذكر' ? 'ذكور فقط' : formattedRide?.required_gender === 'أنثى' ? 'إناث فقط' : 'جميع الجنسيات'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    ),
    [formattedRide, allPassengers]
  );

  // Render current passengers
  const renderCurrentPassengers = useCallback(
    () => (
      <View
        className="bg-white w-[98%]  mx-1 mt-3 p-4 rounded-xl"
        style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
      >
        <Text className="text-lg font-CairoBold text-right mb-3 text-black">الركاب الحاليين</Text>
        {allPassengers.length > 0 ? (
          <View className="border border-gray-200 rounded-lg overflow-hidden">
            <View className="flex-row-reverse bg-gray-50 p-3 border-b border-gray-200">
              <View className="flex-1">
                <Text className="text-sm font-CairoBold text-gray-700 text-right">الاسم</Text>
              </View>
              <View className="w-24">
                <Text className="text-sm font-CairoBold text-gray-700 text-right">الجنس</Text>
              </View>
            </View>
            {allPassengers.map((passenger) => (
              <View key={passenger.id} className="flex-row-reverse p-3 border-b border-gray-100">
                <View className="flex-1 flex-row-reverse items-center">
                  <Image
                    source={passengerGenders[passenger.user_id] === 'Female' ? icons.person : icons.person}
                    className="w-5 h-5 ml-2"
                    tintColor={passengerGenders[passenger.user_id] === 'Female' ? '#FF69B4' : '#10B981'}
                  />
                  <Text className="text-sm pt-1.5 text-gray-700 text-right font-CairoRegular">
                    {passengerNames[passenger.user_id] || 'الراكب'}
                  </Text>
                </View>
                <View className="w-24 justify-center">
                  <Text className="text-sm pt-1.5 text-gray-700 text-right font-CairoRegular">
                    {passengerGenders[passenger.user_id] || 'غير محدد'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="bg-gray-50 p-4 rounded-xl">
            <Text className="text-base text-gray-700 text-center font-CairoBold">لا يوجد ركاب حالياً</Text>
          </View>
        )}
      </View>
    ),
    [allPassengers, passengerNames, passengerGenders]
  );

  // Render pending requests for driver
  const renderPendingRequests = useCallback(
    () => {
      if (!isDriver || pendingRequests.length === 0) return null;
      return (
        <View
          className="bg-white w-[98%] mx-1 mt-3 p-4 rounded-xl"
          style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
        >
          <Text className="text-lg font-CairoBold mb-3 text-black">
            طلبات الحجز المعلقة ({pendingRequests.length})
          </Text>
          {pendingRequests.map((request) => (
            <View key={request.id} className="bg-gray-50 p-4 rounded-xl mb-3 border border-gray-200">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="font-CairoBold text-gray-700">
                  {passengerNames[request.user_id] || 'الراكب'}
                </Text>
                <Text className="text-sm text-gray-500 font-CairoRegular">
                  {request.created_at ? format(new Date(request.created_at.toDate()), 'HH:mm') : 'غير محدد'}
                </Text>
              </View>
              <View className="flex-row justify-between items-center">
                <View className="flex-row space-x-2">
                  <CustomButton
                    title="قبول"
                    onPress={() => handleAcceptRequest(request.id, request.user_id)}
                    className="bg-green-500 w-24 px-6"
                  />
                  <CustomButton
                    title="رفض"
                    onPress={() => handleRejectRequest(request.id, request.user_id)}
                    className="bg-red-500 w-24 px-6"
                  />
                </View>
                <View className="items-end">
                  <Text className="text-sm text-gray-500 font-CairoRegular">طلب حجز جديد</Text>
                  <Text className="text-xs text-gray-400 font-CairoRegular">
                    {request.created_at ? format(new Date(request.created_at.toDate()), 'dd/MM/yyyy') : 'غير محدد'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    },
    [isDriver, pendingRequests, passengerNames]
  );

  // Render action buttons
  const renderActionButtons = useCallback(
    () => {
      if (isDriver) {
        return (
          <View className="p-4 m-3">
            {allPassengers.length > 0 ? (
              <View className="mb-4">
                <CustomButton
                  title={`عرض الركاب الحاليين (${allPassengers.length})`}
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    router.push({
                      pathname: '/ride-requests',
                      params: { rideId: ride?.id, view: 'current' },
                    });
                  }}
                  className="bg-blue-500 py-3 rounded-xl"
                />
              </View>
            ) : (
              <View className="mb-4">
                <CustomButton
                  title="لا يوجد ركاب حالياً"
                  onPress={() => {
                    if (Platform.OS === 'android') {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }
                    Alert.alert('معلومات', 'لا يوجد ركاب مسجلين في هذه الرحلة حالياً.');
                  }}
                  className="bg-gray-500 py-3 rounded-xl"
                />
              </View>
            )}
            {pendingRequests.length > 0 ? (
              <CustomButton
                title="إدارة طلبات الحجز الجديدة"
                onPress={() => {
                  if (Platform.OS === 'android') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  router.push({
                    pathname: '/ride-requests',
                    params: { rideId: ride?.id, view: 'pending' },
                  });
                }}
                className="bg-orange-500 py-3 rounded-xl"
              />
            ) : (
              <Text className="text-gray-500 text-center font-CairoBold">لا توجد طلبات حجز معلقة</Text>
            )}
          </View>
        );
      }

      if (!rideRequest) {
        return (
          <View className="p-4 m-3">
            <CustomButton
              title="حجز الرحلة"
              onPress={handleBookRide}
              className="bg-orange-500 py-3 rounded-xl"
            />
          </View>
        );
      }

      if (rideRequest.status === 'waiting') {
        return (
          <View className="p-4 m-3">
            <View className="flex-row justify-between items-center bg-gray-50 p-4 rounded-xl">
              <CustomButton
                title="إلغاء الطلب"
                onPress={handleCancelRide}
                className="bg-red-500"
              />
              <Text className="text-gray-600 font-CairoRegular">في انتظار موافقة السائق...</Text>
            </View>
          </View>
        );
      }

      if (rideRequest.status === 'accepted') {
        return (
          <View className="p-4 m-3">
            <View className="flex-row justify-between space-x-2">
              <CustomButton
                title="ركوب السيارة"
                onPress={handleCheckIn}
                className="flex-1 bg-green-500 py-3 rounded-xl"
              />
              <CustomButton
                title="إلغاء الحجز"
                onPress={handleCancelRide}
                className="flex-1 bg-red-500 py-3 rounded-xl"
              />
            </View>
          </View>
        );
      }

      if (rideRequest.status === 'checked_in') {
        return (
          <View className="p-4 m-3">
            <View className="flex-row justify-between space-x-2">
              <CustomButton
                title="مغادرة السيارة"
                onPress={handleCheckOut}
                className="flex-1 bg-blue-500 py-3 rounded-xl"
              />
              <CustomButton
                title="إلغاء الحجز"
                onPress={handleCancelRide}
                className="flex-1 bg-red-500 py-3 rounded-xl"
              />
            </View>
          </View>
        );
      }

      if (rideRequest.status === 'rejected') {
        return (
          <View className="p-4 m-3">
            <View className="bg-red-50 p-4 rounded-xl">
              <Text className="text-red-500 text-center font-CairoBold">تم رفض طلب الحجز.</Text>
            </View>
          </View>
        );
      }

      if (rideRequest.status === 'checked_out') {
        return (
          <View className="p-4 m-3">
            <View className="bg-green-50 p-4 rounded-xl">
              <Text className="text-green-500 text-center font-CairoBold">تم تسجيل خروجك من الرحلة!</Text>
            </View>
          </View>
        );
      }

      if (rideRequest.status === 'cancelled') {
        return (
          <View className="p-4 m-3">
            <View className="bg-red-50 p-4 rounded-xl">
              <Text className="text-red-500 text-center font-CairoBold">تم إلغاء الحجز.</Text>
            </View>
          </View>
        );
      }

      return null;
    },
    [isDriver, rideRequest, pendingRequests, ride]
  );

  useEffect(() => {
    fetchRideDetails();
  }, [fetchRideDetails]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-4 text-black font-CairoMedium">جاري تحميل تفاصيل الرحلة...</Text>
      </View>
    );
  }

  if (error || !formattedRide) {
    return (
      <View className="flex-1 justify-center items-center p-4 bg-white">
        <MaterialIcons name="error-outline" size={48} color="#f97316" />
        <Text className="mt-4 text-black text-center font-CairoMedium">{error || 'الرحلة غير موجودة.'}</Text>
        <CustomButton
          title="إعادة المحاولة"
          onPress={() => {
            if (Platform.OS === 'android') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            fetchRideDetails();
          }}
          className="mt-4 bg-orange-500 py-3 px-6 rounded-xl"
        />
        <TouchableOpacity onPress={() => router.back()} className="mt-2">
          <Text className="text-blue-500 font-CairoMedium">العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RideLayout
      title=" "
      bottomSheetRef={bottomSheetRef}
      origin={{
        latitude: formattedRide.origin_latitude || 0,
        longitude: formattedRide.origin_longitude || 0,
      }}
      destination={{
        latitude: formattedRide.destination_latitude || 0,
        longitude: formattedRide.destination_longitude || 0,
      }}
      MapComponent={RideMap}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 0 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        className="flex-1 w-full"
      >
        {renderDriverInfo()}
        {renderRideDetails()}
        {renderCurrentPassengers()}
        {renderPendingRequests()}
        {renderActionButtons()}
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRatingModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
          <View className="bg-white p-6 rounded-xl w-[90%]">
            <Text className="text-xl font-CairoBold mb-4 text-center">قيّم رحلتك</Text>
            <View className="flex-row justify-center space-x-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Text style={{ fontSize: 40 }}>{star <= rating ? '⭐' : '☆'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row justify-between">
              <CustomButton
                title="إرسال"
                onPress={handleRateDriver}
                className="flex-1 mr-2 bg-green-500"
              />
              <CustomButton
                title="إلغاء"
                onPress={() => setShowRatingModal(false)}
                className="flex-1 ml-2 bg-gray-500"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Modal */}
      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowImageModal(false)}
        >
          <Image
            source={{ uri: selectedImage ?? DEFAULT_CAR_IMAGE }}
            style={{ width: '90%', height: 200, resizeMode: 'contain', borderRadius: 10 }}
          />
          <Text className="text-white mt-4 font-CairoBold">اضغط في أي مكان للإغلاق</Text>
        </Pressable>
      </Modal>
    </RideLayout>
  );
};

const styles = StyleSheet.create({
  androidShadow: {
    elevation: 5,
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default RideDetails;