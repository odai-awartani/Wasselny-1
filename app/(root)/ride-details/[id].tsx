import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, query, where, Query, setDoc, getDocs, Timestamp } from 'firebase/firestore';
import { format, parse } from 'date-fns';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import { icons } from '@/constants';
import RideMap from '@/components/RideMap';
import CustomButton from '@/components/CustomButton';
import { useAuth } from '@clerk/clerk-expo';
import { scheduleNotification, setupNotifications, cancelNotification, sendRideStatusNotification, sendRideRequestNotification, startRideNotificationService, schedulePassengerRideReminder, sendCheckOutNotificationForDriver, sendRideCancellationNotification, scheduleDriverRideReminder, scheduleRideNotification } from '@/lib/notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface DriverData {
  car_seats?: number;
  car_type?: string;
  profile_image_url?: string;
  car_image_url?: string;
}

interface UserData {
  name?: string;
  driver?: DriverData;
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
  const bottomSheetRef = useRef<any>(null);

  // Setup notifications
  useEffect(() => {
    if (userId) {
      setupNotifications(userId);
      startRideNotificationService(userId, true);
    }
  }, [userId]);

  // Handle notification when page loads
  useEffect(() => {
    if (notificationId && typeof notificationId === 'string') {
      const markNotificationAsRead = async () => {
        try {
          const notificationRef = doc(db, 'notifications', notificationId);
          await updateDoc(notificationRef, { read: true });
          if (scrollViewRef.current) {
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({ y: 1000, animated: true });
            }, 500);
          }
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      };
      markNotificationAsRead();
    }
  }, [notificationId]);

  // Fetch ride details
  const fetchRideDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const rideDocRef = doc(db, 'rides', id as string);
      const rideDocSnap = await getDoc(rideDocRef);

      if (!rideDocSnap.exists()) {
        setError('لم يتم العثور على الرحلة.');
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
        origin_latitude: rideData.origin_latitude,
        origin_longitude: rideData.origin_longitude,
        destination_latitude: rideData.destination_latitude,
        destination_longitude: rideData.destination_longitude,
        created_at: rideData.created_at,
        ride_datetime: formattedDateTime,
        status: rideData.status || 'غير معروف',
        available_seats: rideData.available_seats || 0,
        is_recurring: rideData.is_recurring || false,
        no_children: rideData.no_children || false,
        no_music: rideData.no_music || false,
        no_smoking: rideData.no_smoking || false,
        required_gender: rideData.required_gender || 'أي',
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
    } catch (err) {
      console.error('Error fetching ride details:', err);
      setError('فشل تحميل تفاصيل الرحلة. حاول مجددًا.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // مراقبة حالة طلب الحجز
  useEffect(() => {
    if (!userId || !id) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef,
      where('ride_id', '==', id),
      where('user_id', '==', userId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setRideRequest({ id: doc.id, ...doc.data() } as RideRequest);
      } else {
        setRideRequest(null);
      }
    }, (error) => {
      console.error('Error fetching ride request:', error);
    });

    return () => unsubscribe();
  }, [id, userId]);

  useEffect(() => {
    fetchRideDetails();
  }, [fetchRideDetails]);

  // Fetch pending ride requests for driver
  useEffect(() => {
    if (!ride?.id || !isDriver) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, 
      where('ride_id', '==', ride.id),
      where('status', '==', 'waiting')
    );
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const requests: RideRequest[] = [];
        snapshot.forEach((doc) => {
          requests.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setPendingRequests(requests);
        
        // If we have a notification and new requests, scroll to them
        if (notificationId && requests.length > 0 && scrollViewRef.current) {
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({
              y: 1000, // Adjust this value based on your layout
              animated: true
            });
          }, 500);
        }
      },
      (error) => {
        console.error('Error fetching ride requests:', error);
      }
    );

    return () => unsubscribe();
  }, [ride?.id, isDriver, notificationId]);

  // Fetch all passengers for the ride
  useEffect(() => {
    if (!ride?.id) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(rideRequestsRef, 
      where('ride_id', '==', ride.id),
      where('status', 'in', ['accepted', 'checked_in', 'checked_out'])
    );
    const unsubscribe = onSnapshot(q,
      (snapshot) => {
        const passengers: RideRequest[] = [];
        snapshot.forEach((doc) => {
          passengers.push({ id: doc.id, ...doc.data() } as RideRequest);
        });
        setAllPassengers(passengers);
      },
      (error) => {
        console.error('Error fetching passengers:', error);
      }
    );

    return () => unsubscribe();
  }, [ride?.id]);

  // Fetch passenger names and genders when passengers change
  useEffect(() => {
    const fetchPassengerDetails = async () => {
      const names: Record<string, string> = {};
      const genders: Record<string, string> = {};
      for (const passenger of allPassengers) {
        try {
          const userDoc = await getDoc(doc(db, 'users', passenger.user_id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            names[passenger.user_id] = userData?.name || 'الراكب';
            genders[passenger.user_id] = userData?.gender || 'غير محدد';
          }
        } catch (error) {
          console.error('Error fetching passenger details:', error);
          names[passenger.user_id] = 'الراكب';
          genders[passenger.user_id] = 'غير محدد';
        }
      }
      setPassengerNames(names);
      setPassengerGenders(genders);
    };

    if (allPassengers.length > 0) {
      fetchPassengerDetails();
    }
  }, [allPassengers]);

  // Add useEffect to handle scrolling
  useEffect(() => {
    if (scrollToRequests === 'true' && scrollViewRef.current) {
      // Wait for the content to be rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: 1000, // Adjust this value based on your layout
          animated: true
        });
      }, 500);
    }
  }, [scrollToRequests, pendingRequests]);

// Handle driver accepting ride request
const handleAcceptRequest = async (requestId: string, userId: string) => {
  try {
    // Get passenger's name
    const userDoc = await getDoc(doc(db, 'users', userId));
    const passengerName = userDoc.data()?.name || 'الراكب';

    // افترض أن ride هو كائن تم تعريفه مسبقًا (يحتوي على id, driver_id, origin_address, destination_address)
    if (!ride) {
      throw new Error('بيانات الرحلة غير متوفرة');
    }

    if (!ride.driver_id) {
      throw new Error('معرف السائق غير موجود');
    }

    // جدولة إشعار للراكب
    const passengerNotificationId = await scheduleRideNotification(ride.id, userId, false); // false لأنه راكب

    // جدولة إشعار للسائق
    const driverNotificationId = await scheduleRideNotification(ride.id, ride.driver_id, true); // true لأنه سائق

    // تحديث حالة طلب الرحلة إلى "مقبول"
    await updateDoc(doc(db, 'ride_requests', requestId), {
      status: 'accepted',
      updated_at: serverTimestamp(),
      passenger_name: passengerName,
      passenger_id: userId,
      notification_id: passengerNotificationId || null, // تخزين معرف الإشعار للراكب
    });

    // إرسال إشعار فوري للراكب
    await sendRideStatusNotification(
      userId,
      'تم قبول طلب الحجز!',
      `تم قبول طلب حجزك للرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
      ride.id
    );

    // تحديث الإشعارات السابقة المتعلقة بالطلب
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
      // Get passenger's name
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      // Update ride request status
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'rejected',
        updated_at: serverTimestamp(),
      });

      // Send notification to user
      await sendRideStatusNotification(
        userId,
        'تم رفض طلب الحجز',
        `عذراً، تم رفض طلب حجزك للرحلة من ${ride?.origin_address} إلى ${ride?.destination_address}`,
        ride?.id || ''
      );

      // Find and update all related notifications
      const notificationsRef = collection(db, 'notifications');
      const q = query(
        notificationsRef,
        where('user_id', '==', userId),
        where('data.rideId', '==', ride?.id),
        where('type', '==', 'ride_request')
      );

      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, {
          read: true,
          data: {
            status: 'rejected',
            rideId: ride?.id,
            type: 'ride_status',
            passenger_name: passengerName
          }
        });
      });

      Alert.alert('✅ تم رفض طلب الحجز', `تم رفض طلب ${passengerName}`);
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('حدث خطأ أثناء رفض الطلب.');
    }
  };

  const handleBookRide = async () => {
    try {
      if (!ride || !ride.id || !ride.driver_id || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }
      console.log('Booking ride for user:', ride.driver_id);
  
      // Get user's data (name and gender)
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      const userName = userData?.name || 'الراكب';
      const userGender = userData?.gender || 'غير محدد';
  
      // Check if the user's gender matches the ride's required gender
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
  
      // Create the ride request document
      const rideRequestRef = await addDoc(collection(db, 'ride_requests'), {
        ride_id: ride.id,
        user_id: userId,
        driver_id: ride.driver_id,
        status: 'waiting',
        created_at: serverTimestamp(),
        passenger_name: userName,
      });

      // Send push notification to driver
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
      if (!rideRequest || !ride || !userId) return;

      // Update the ride request status to checked_in
      const updatedRequest: RideRequest = {
        ...rideRequest,
        status: 'checked_in' as const,
      };

      // Update in Firestore
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_in',
        updated_at: serverTimestamp(),
      });

      // Update available seats
      await updateDoc(doc(db, 'rides', ride.id), {
        available_seats: ride.available_seats - 1,
      });

      // Update local state
      setRideRequest(updatedRequest);

      // Send notification to the driver
      await sendRideStatusNotification(
        ride?.driver_id || '',
        'الراكب وصل',
        `الراكب قد وصل وبدأ الرحلة من ${ride?.origin_address} إلى ${ride?.destination_address}`,
        ride?.id || ''
      );

      console.log('Check-in completed, new status:', updatedRequest.status);
    } catch (error) {
      console.error('Error during check-in:', error);
    }
  };

  const handleCheckOut = async () => {
    try {
      if (!rideRequest || !ride || !userId) {
        console.error('Missing required data: rideRequest, ride, or userId');
        return;
      }

      // إلغاء الإشعار المجدول إذا كان موجودًا
      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }

      // تحديث حالة طلب الحجز إلى checked_out
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_out',
        updated_at: serverTimestamp(),
      });

      // إرسال إشعار للسائق
      const notificationSent = await sendCheckOutNotificationForDriver(
        ride.driver_id || '',
        passengerNames[userId] || 'الراكب', // تمرير اسم الراكب
        ride.id
      );

      if (!notificationSent) {
        console.warn('Failed to send check-out notification to driver');
      }

      // فتح نافذة التقييم
      setShowRatingModal(true);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };


  // Handle ride cancellation
  const handleCancelRide = async () => {
    try {
      if (!rideRequest || !ride || !userId) {
        console.error('Missing required data: rideRequest, ride, or userId');
        return;
      }
  
      // إلغاء الإشعار المجدول إذا كان موجودًا
      if (rideRequest.notification_id) {
        await cancelNotification(rideRequest.notification_id);
        console.log(`Cancelled notification ${rideRequest.notification_id}`);
      }
  
      // تحديث حالة طلب الحجز إلى cancelled
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });
  
      // تحديث عدد المقاعد المتاحة إذا كان الطلب مقبولًا أو تم تسجيل الدخول
      if (rideRequest.status === 'accepted' || rideRequest.status === 'checked_in') {
        await updateDoc(doc(db, 'rides', ride.id), {
          available_seats: ride.available_seats + 1,
        });
        console.log(`Increased available_seats for ride ${ride.id}`);
      }
  
      // إرسال إشعار إلى السائق
      if (ride.driver_id) {
        const passengerName = passengerNames[userId] || 'الراكب';
        const notificationSent = await sendRideStatusNotification(
          ride.driver_id,
          'تم إلغاء الحجز',
          `قام ${passengerName} بإلغاء حجز الرحلة من ${ride.origin_address} إلى ${ride.destination_address}`,
          ride.id
        );
        if (!notificationSent) {
          console.warn('Failed to send cancellation notification to driver');
        }
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
      if (!rideRequest || !ride) return;
  
      // Update the ride request with the rating
      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        rating: rating,
        updated_at: serverTimestamp(),
      });
  
      // Send notification to the driver
      if (ride.driver_id) {
        await sendRideStatusNotification(
          ride.driver_id,
          'تقييم جديد!',
          `قام الراكب بتقييم رحلتك بـ ${rating} نجوم`,
          ride.id
        );
      }
  
      // Close the rating modal and show success alert
      setShowRatingModal(false);
      Alert.alert('✅ شكراً على تقييمك!');
    } catch (error) {
      console.error('Rating error:', error);
      Alert.alert('حدث خطأ أثناء إرسال التقييم.');
    }
  };

  // Function to handle target icon press
  const handleTargetPress = () => {
    // Collapse the bottom sheet to show only the map
    bottomSheetRef.current?.snapToIndex(0);
  };

  const formatTimeTo12Hour = (timeStr: string) => {
    try {
      const [date, time] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      const period = hours >= 12 ? 'مساءً' : 'صباحاً';
      const formattedHours = hours % 12 || 12;
      return {
        date,
        time: `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`
      };
    } catch (error) {
      console.error('Error formatting time:', error);
      return {
        date: timeStr,
        time: timeStr
      };
    }
  };

  const renderDriverInfo = () => (
    
    <View className="bg-white p-4 m-3 rounded-xl shadow-sm ">
      <View className="flex-row items-center mb-4">
        <Image 
          source={{ uri: ride?.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE }}
          className="w-16 h-16 rounded-full mr-4 "
        />
        <View className="flex-1">
          <Text className="text-xl font-CairoBold mb-1 text-black">{ride?.driver?.name}</Text>
          <Text className="text-black font-CairoMedium">{ride?.driver?.car_type}</Text>
        </View>
      </View>
      <View className="items-center">
        <Image 
          source={{ uri: ride?.driver?.car_image_url || DEFAULT_CAR_IMAGE }}
          className="w-full h-32 rounded-xl mb-3 "
        />
        <View className="flex-row justify-between items-center">
          <FontAwesome5 name="users"  size={16} color="#000" />
          <Text className="text-black ml-2 font-CairoMedium">{ride?.available_seats} مقاعد متاحة</Text>
        </View>
      </View>
    </View>
  );

  const renderRideDetails = () => (
    <View className="bg-white p-4 m-3 rounded-xl shadow-sm">
      <View className="flex-row mb-4">
       
        <View className="flex-1">
          <View className="flex-row items-center mb-3">
            <Image source={icons.point} className="w-5 h-5 mr-3" />
            <Text className="text-lg font-CairoBold text-black">{ride?.origin_address}</Text>
          </View>
          <View className="flex-row items-center">
            <Image source={icons.target} className="w-5 h-5 mr-3" />
            <Text className="text-lg font-CairoBold text-black">{ride?.destination_address}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row justify-between mb-4">
        <View className="flex-row items-center">
          <MaterialIcons name="event" size={20} color="#000" className="mr-3" />
          <Text className="text-black ml-1 font-CairoMedium">
            {ride?.ride_datetime ? formatTimeTo12Hour(ride.ride_datetime).date : 'غير محدد'}
          </Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="access-time" size={20} color="#000" className="mr-3" />
          <Text className="text-black ml-1 font-CairoMedium">
            {ride?.ride_datetime ? formatTimeTo12Hour(ride.ride_datetime).time : 'غير محدد'}
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between mb-4">
        <View className="flex-row items-center">
          <MaterialIcons name="repeat" size={20} color="#000" className="mr-3" />
          <Text className="text-black ml-1 font-CairoMedium">
            {ride?.is_recurring ? 'رحلة متكررة' : 'رحلة لمرة واحدة'}
          </Text>
        </View>
      </View>

      <View className="mt-4">
        <Text className="text-lg font-CairoBold mb-4 text-black">تفضيلات الرحلة</Text>
        <View className="flex-row flex-wrap">
          <View className="w-1/2 flex-row items-center mb-4">
            <MaterialIcons 
              name={ride?.no_smoking ? "smoke-free" : "smoking-rooms"} 
              size={24} 
              color="#000" 
              className="mr-3"
            />
            <Text className="text-black ml-1 font-CairoMedium">
              {ride?.no_smoking ? "ممنوع التدخين" : "مسموح التدخين"}
            </Text>
          </View>
          <View className="w-1/2 flex-row items-center mb-4">
            <MaterialIcons 
              name={ride?.no_music ? "music-off" : "music-note"} 
              size={24} 
              color="#000" 
              className="mr-3"
            />
            <Text className="text-black ml-1 font-CairoMedium">
              {ride?.no_music ? "ممنوع الموسيقى" : "مسموح الموسيقى"}
            </Text>
          </View>
          <View className="w-1/2 flex-row items-center mb-4">
            <MaterialIcons 
              name={ride?.no_children ? "child-care" : "child-friendly"} 
              size={24} 
              color="#000" 
              className="mr-3"
            />
            <Text className="text-black ml-1 font-CairoMedium">
              {ride?.no_children ? "ممنوع الأطفال" : "مسموح الأطفال"}
            </Text>
          </View>
          <View className="w-1/2 flex-row items-center mb-4">
            <MaterialIcons 
              name="wc" 
              size={24} 
              color="#000" 
              className="mr-3"
            />
            <Text className="text-black ml-1 font-CairoMedium">
              {ride?.required_gender === 'male' ? 'ذكور فقط' : 
               ride?.required_gender === 'female' ? 'إناث فقط' : 
               'جميع الجنسيات'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderActionButtons = () => {
    if (isDriver) {
      return (
        <View className="p-4 m-3">
          <CustomButton 
            title="إدارة الطلبات"
            onPress={handleRideRequests}
            className="bg-orange-500 py-3 rounded-xl"
          />
        </View>
      );
    }

    if (isPassenger) {
      console.log('Current Status:', rideRequest?.status); // Debug log
      
      // Show check-out button if status is checked_in
      if (rideRequest?.status === 'checked_in') {
        console.log('Showing check-out button'); // Debug log
        return (
          <View className="p-4 m-3">
            <CustomButton
              title="مغادرة السيارة"
              onPress={handleCheckOut}
              className="bg-orange-500 py-3 rounded-xl"
            />
          </View>
        );
      }
      
      // Show check-in button if status is accepted
      if (rideRequest?.status === 'accepted') {
        console.log('Showing check-in button'); // Debug log
        return (
          <View className="p-4 m-3">
            <CustomButton
              title="ركوب السيارة"
              onPress={handleCheckIn}
              className="bg-orange-500 py-3 rounded-xl"
            />
          </View>
        );
      }
    }

    // Show book ride button if no request exists
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

    return null;
  };

  // Add this function to handle ride requests
  const handleRideRequests = async () => {
    try {
      if (!ride?.id) return;

      const rideRequestsRef = collection(db, 'ride_requests');
      const q = query(
        rideRequestsRef,
        where('ride_id', '==', ride.id),
        where('status', '==', 'waiting')
      );

      const querySnapshot = await getDocs(q);
      const requests: RideRequest[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ride_id: ride.id,
        user_id: doc.data().user_id,
        status: doc.data().status,
        created_at: doc.data().created_at,
        rating: doc.data().rating,
        notification_id: doc.data().notification_id
      }));

      setPendingRequests(requests);

      if (requests.length > 0) {
        router.push({
          pathname: '/ride-requests',
          params: { rideId: ride.id }
        });
      } else {
        Alert.alert(
          'لا توجد طلبات',
          'لا توجد طلبات حجز جديدة للرحلة',
          [{ text: 'حسناً' }]
        );
      }
    } catch (error) {
      console.error('Error fetching ride requests:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء جلب طلبات الحجز');
    }
  };

  // Update the useEffect for fetching pending requests
  useEffect(() => {
    if (!ride?.id || !isDriver) return;

    const rideRequestsRef = collection(db, 'ride_requests');
    const q = query(
      rideRequestsRef,
      where('ride_id', '==', ride.id),
      where('status', '==', 'waiting')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests: RideRequest[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ride_id: ride.id,
        user_id: doc.data().user_id,
        status: doc.data().status,
        created_at: doc.data().created_at,
        rating: doc.data().rating,
        notification_id: doc.data().notification_id
      }));
      setPendingRequests(requests);
    });

    return () => unsubscribe();
  }, [ride?.id, isDriver]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#000" />
        <Text className="mt-4 text-black font-CairoMedium">جاري تحميل تفاصيل الرحلة...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4">
        <MaterialIcons name="error-outline" size={48} color="#000" />
        <Text className="mt-4 text-black text-center font-CairoMedium">{error}</Text>
        <CustomButton
          title="إعادة المحاولة"
          onPress={fetchRideDetails}
          className="mt-4 bg-orange-500 py-3 px-6 rounded-xl"
        />
      </View>
    );
  }

  return (
    <RideLayout title="تفاصيل الرحلة">
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 bg-white"
        showsVerticalScrollIndicator={false}
      >
        {renderDriverInfo()}
        {renderRideDetails()}
        {renderActionButtons()}
      </ScrollView>
    </RideLayout>
  );
};

export default RideDetails;