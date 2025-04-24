import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Alert, Modal, Pressable, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, onSnapshot, query, where, Query, setDoc, getDocs } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import { icons } from '@/constants';
import RideMap from '@/components/RideMap';
import CustomButton from '@/components/CustomButton';
import { useAuth } from '@clerk/clerk-expo';
import { scheduleNotification, setupNotifications, cancelNotification, sendRideStatusNotification, sendRideRequestNotification } from '@/lib/notifications';

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
}

const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/40';
const DEFAULT_CAR_IMAGE = 'https://via.placeholder.com/120x80';

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
  const isPassenger = ride?.driver_id === userId || (ride?.available_seats ?? 0) <= 0;

  // إعداد أذونات الإشعارات
  useEffect(() => {
    if (userId) {
      setupNotifications(userId);
    }
  }, [userId]);

  // جدولة الإشعار للراكب
  useEffect(() => {
    if (ride && ride.ride_datetime) {
      try {
        // Parse ride_datetime from DD/MM/YYYY HH:mm format (local time)
        const [datePart, timePart] = ride.ride_datetime.split(' ');
        const [day, month, year] = datePart.split('/').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
  
        // Create a Date object in local time
        const rideDate = new Date(year, month - 1, day, hours, minutes);
  
        // Validate the date
        if (isNaN(rideDate.getTime())) {
          console.warn('Invalid ride_datetime after parsing:', ride.ride_datetime);
          return;
        }
  
        // Calculate reminder time (15 minutes before)
        const reminderTime = new Date(rideDate.getTime() - 15 * 60 * 1000);
        const now = new Date();
  
        // Log times for debugging
        console.log('Current time:', now.toISOString());
        console.log('Ride time:', rideDate.toISOString());
        console.log('Reminder time:', reminderTime.toISOString());
  
        // Check if reminder time is in the future
        if (reminderTime > now) {
          scheduleNotification(
            'تذكير: رحلتك على وشك البدء!',
            `تستعد للانطلاق من ${ride.origin_address} إلى ${ride.destination_address}`,
            reminderTime,
            ride.id
          ).then((id) => {
            if (id) {
              console.log('Notification scheduled with ID:', id);
            } else {
              console.warn('Failed to schedule notification');
            }
          });
        } else {
          console.warn('Reminder time is in the past:', reminderTime.toISOString());
        }
      } catch (error) {
        console.error('Error scheduling notification:', error);
      }
    }
  
    return () => {
      if (notificationId && typeof notificationId === 'string') {
        cancelNotification(notificationId);
      }
    };
  }, [ride]);

  // Handle notification when page loads
  useEffect(() => {
    if (notificationId && typeof notificationId === 'string') {
      // Mark notification as read
      const markNotificationAsRead = async () => {
        try {
          const notificationRef = doc(db, 'notifications', notificationId);
          await updateDoc(notificationRef, { read: true });
        } catch (error) {
          console.error('Error marking notification as read:', error);
        }
      };
      markNotificationAsRead();
    }
  }, [notificationId]);

  // جلب تفاصيل الرحلة
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

      let formattedDateTime = rideData.ride_datetime || 'وقت غير معروف';
      try {
        const date = new Date(rideData.ride_datetime);
        if (!isNaN(date.getTime())) {
          formattedDateTime = date.toLocaleString('ar-EG', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
          });
        }
      } catch {
        console.warn('Invalid ride_datetime format');
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
      },
      (error) => {
        console.error('Error fetching ride requests:', error);
      }
    );

    return () => unsubscribe();
  }, [ride?.id, isDriver]);

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

      // Update ride request status and save passenger name
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'accepted',
        updated_at: serverTimestamp(),
        passenger_name: passengerName,
        passenger_id: userId
      });

      // Send notification to user
      await sendRideStatusNotification(
        userId,
        'تم قبول طلب الحجز!',
        `تم قبول طلب حجزك للرحلة من ${ride?.origin_address} إلى ${ride?.destination_address}`,
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
            status: 'accepted',
            rideId: ride?.id,
            type: 'ride_status',
            passenger_name: passengerName
          }
        });
      });

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
        passenger_name: passengerName
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

  // User booking the ride
  const handleBookRide = async () => {
    try {
      if (!ride || !ride.id || !ride.driver_id || !userId) {
        Alert.alert('معلومات الرحلة غير مكتملة');
        return;
      }

      // Get user's name for the notification
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userName = userDoc.data()?.name || 'A passenger';

      // Create the ride request document
      const rideRequestRef = await addDoc(collection(db, 'ride_requests'), {
        ride_id: ride.id,
        user_id: userId,
        driver_id: ride.driver_id,
        status: 'waiting',
        created_at: serverTimestamp(),
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
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_in',
        updated_at: serverTimestamp(),
      });

      // Update available seats
      await updateDoc(doc(db, 'rides', ride.id), {
        available_seats: ride.available_seats - 1,
      });

      // Send notification to driver
      await sendRideStatusNotification(
        ride.driver_id!,
        'تم تسجيل الدخول!',
        'قام الراكب بتسجيل الدخول للرحلة',
        ride.id
      );

      Alert.alert('✅ تم تسجيل دخولك للرحلة');
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الدخول.');
    }
  };

  // Handle check-out
  const handleCheckOut = async () => {
    try {
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'checked_out',
        updated_at: serverTimestamp(),
      });

      // Send notification to driver
      await sendRideStatusNotification(
        ride.driver_id!,
        'تم تسجيل الخروج!',
        'قام الراكب بتسجيل الخروج من الرحلة',
        ride.id
      );

      // Show rating modal
      setShowRatingModal(true);
    } catch (error) {
      console.error('Check-out error:', error);
      Alert.alert('حدث خطأ أثناء تسجيل الخروج.');
    }
  };

  // Handle rating submission
  const handleRateDriver = async () => {
    try {
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        rating: rating,
        updated_at: serverTimestamp(),
      });

      // Send notification to driver
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

  // Handle ride cancellation
  const handleCancelRide = async () => {
    try {
      if (!rideRequest || !ride) return;

      await updateDoc(doc(db, 'ride_requests', rideRequest.id), {
        status: 'cancelled',
        updated_at: serverTimestamp(),
      });

      // Send notification to driver
      if (ride.driver_id) {
        await sendRideStatusNotification(
          ride.driver_id,
          'تم إلغاء الحجز',
          'قام الراكب بإلغاء حجز الرحلة',
          ride.id
        );
      }

      Alert.alert('✅ تم إلغاء الحجز بنجاح');
    } catch (error) {
      console.error('Cancellation error:', error);
      Alert.alert('حدث خطأ أثناء إلغاء الحجز.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (error || !ride) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <Text className="text-red-500 mb-4">{error || 'Ride not found.'}</Text>
        <TouchableOpacity onPress={fetchRideDetails} className="mb-2">
          <Text className="text-blue-500">Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} className="mt-2">
          <Text className="text-blue-500">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <RideLayout
      title={ride.driver?.name || DEFAULT_DRIVER_NAME}
      snapPoints={["15%", "50%", "75%", "95%"]}
      origin={{ latitude: ride.origin_latitude, longitude: ride.origin_longitude }}
      destination={{ latitude: ride.destination_latitude, longitude: ride.destination_longitude }}
      MapComponent={RideMap}
    >
      <ScrollView 
        ref={scrollViewRef}
        className="flex-1 w-full" 
        showsVerticalScrollIndicator={false}
      >
       
          {/* Driver Profile Link */}
          <TouchableOpacity
            onPress={() => router.push(`/driver-profile/${ride.driver_id}`)}
            className="flex flex-row items-center space-x-2 mb-6 bg-gray-50 p-3 rounded-xl"
          >
            <Image 
              source={{ uri: ride.driver?.profile_image_url || DEFAULT_PROFILE_IMAGE }}
              className="w-12 h-12 rounded-full"
            />
            <View className="flex-1">
              <Text className="text-xl text-black-600 font-CairoBold">
                {ride.driver?.name}
              </Text>
              <Text className="text-xs text-red-600 font-CairoBold underline">
                (الملف الشخصي)
              </Text>
            </View>
          </TouchableOpacity>

          {/* Location Section */}
          <View className="mb-6 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-base font-semibold text-black mb-3 text-right font-CairoBold">الموقع</Text>
            <View className="flex-row items-center bg-gray-50 rounded-xl p-3 mb-3">
              <Image source={icons.point} className="w-7 h-7 ml-1.5" resizeMode="contain" />
              <Text className="flex-1 text-base text-gray-700 ml-2 text-right font-CairoBold">
                {ride.origin_address}
              </Text>
            </View>

            <View className="flex-row items-center bg-gray-50 rounded-xl p-3">
              <Image source={icons.map} className="w-7 h-7 ml-1.5" resizeMode="contain" />
              <Text className="flex-1 text-base text-gray-700 ml-2 text-right font-CairoBold">
                {ride.destination_address}
              </Text>
            </View>
          </View>

          {/* Ride Details Section */}
          <View className="mb-6 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-base font-semibold text-black mb-3 text-right font-CairoBold">تفاصيل الرحلة</Text>
            
            <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <Text className="text-base text-gray-600 text-right font-CairoBold">الوقت والتاريخ</Text>
              <View className="flex-column">
                <Text className="text-base text-red-700 font-medium text-right pb-1 font-CairoRegular">
                  {ride.ride_days?.join(', ') || 'غير محدد'}
                </Text>
                <Text className="text-base text-gray-700 font-medium text-right font-CairoRegular">
                  {ride.ride_datetime}
                </Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <Text className="text-base text-gray-600 text-right font-CairoBold">عدد المقاعد المتاحة</Text>
              <Text className="text-base text-red-600 font-medium text-right font-CairoBold">
                {ride.available_seats}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-2 border-b border-gray-100">
              <Text className="text-base text-gray-600 text-right font-CairoBold">الجنس المطلوب</Text>
              <Text className="text-base text-gray-700 font-medium text-right font-CairoRegular">
                {ride.required_gender === 'كلاهما' ? 'ذكر وأنثى' : ride.required_gender}
              </Text>
            </View>

            <View className="flex-row justify-between items-center py-2">
              <Text className="text-base text-gray-600 text-right font-CairoBold">السيارة</Text>
              <TouchableOpacity
                onPress={() => {
                  if (ride.driver?.car_image_url) {
                    setSelectedImage(ride.driver.car_image_url);
                    setShowImageModal(true);
                  }
                }}
              >
                <Image
                  source={{ uri: ride.driver?.car_image_url || DEFAULT_CAR_IMAGE }}
                  className="w-32 h-20 rounded-xl"
                  resizeMode="cover"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Ride Rules Section */}
          <View className="mb-6 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-base font-semibold text-black mb-3 text-right font-CairoBold">قوانين الرحلة</Text>
            <View className="flex-col space-y-2">
              {[
                ride.no_children && 'بدون أطفال',
                ride.no_music && 'بدون موسيقى',
                ride.no_smoking && 'بدون تدخين',
              ]
                .filter(Boolean)
                .map((rule, index) => (
                  <View key={index} className="flex-row items-center bg-gray-50 p-3 rounded-xl">
                    <Image source={icons.checkmark} className="w-5 h-5 ml-2" tintColor="#10B981" />
                    <Text className="text-base text-gray-700 text-right font-CairoRegular">
                      {rule}
                    </Text>
                  </View>
                ))}
              {![ride.no_children, ride.no_music, ride.no_smoking].some(Boolean) && (
                <Text className="text-base text-gray-700 text-center font-CairoBold">
                  لا توجد قواعد خاصة
                </Text>
              )}
            </View>
          </View>

          {/* Current Passengers Section */}
          <View className="mb-6 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-base font-semibold text-black mb-3 text-right font-CairoBold">الركاب الحاليين</Text>
            <View className="flex-col space-y-2">
              {allPassengers.length > 0 ? (
                <View className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Table Header */}
                  <View className="flex-row bg-gray-50 p-3 border-b border-gray-200">
                    <View className="flex-1">
                      <Text className="text-sm font-CairoBold text-gray-700 text-right">الاسم</Text>
                    </View>
                    <View className="w-24">
                      <Text className="text-sm font-CairoBold text-gray-700 text-right">الجنس</Text>
                    </View>
                  </View>
                  
                  {/* Table Rows */}
                  {allPassengers.map((passenger) => (
                    <View key={passenger.id} className="flex-row p-3 border-b border-gray-100">
                      <View className="flex-1 flex-row items-center">
                        <Image 
                          source={passengerGenders[passenger.user_id] === 'Female' ? icons.person : icons.person} 
                          className="w-5 h-5 ml-2" 
                          tintColor={passengerGenders[passenger.user_id] === 'Female' ? "#FF69B4" : "#10B981"} 
                        />
                        <Text className="text-sm text-gray-700 text-right font-CairoRegular">
                          {passengerNames[passenger.user_id] || 'الراكب'}
                        </Text>
                      </View>
                      <View className="w-24 justify-center">
                        <Text className="text-sm text-gray-700 text-right font-CairoRegular">
                          {passengerGenders[passenger.user_id] || 'غير محدد'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="bg-gray-50 p-4 rounded-xl">
                  <Text className="text-base text-gray-700 text-center font-CairoBold">
                    لا يوجد ركاب حالياً
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Pending Requests Section for Driver */}
          {isDriver && pendingRequests.length > 0 && (
            <View className="mb-6 bg-white rounded-xl p-4 shadow-sm">
              <Text className="text-lg text-center font-CairoBold mb-3 text-gray-800">
                طلبات الحجز المعلقة ({pendingRequests.length})
              </Text>
              {pendingRequests.map((request) => (
                <View key={request.id} className="bg-gray-50 p-4 rounded-xl mb-3 border border-gray-200">
                  <View className="flex-row justify-between items-center mb-2">
                    <Text className="font-CairoBold text-gray-700">
                      {passengerNames[request.user_id] || 'الراكب'}
                    </Text>
                    <Text className="text-sm text-gray-500 font-CairoRegular">
                      {format(new Date(request.created_at?.toDate()), 'HH:mm')}
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
                        {format(new Date(request.created_at?.toDate()), 'dd/MM/yyyy')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action Buttons Section */}
          <View className="mb-6">
            {isDriver ? (
              pendingRequests.length === 0 ? (
                <Text className="text-gray-500 text-center mt-4 font-CairoBold">
                  لا توجد طلبات حجز معلقة
                </Text>
              ) : null
            ) : !rideRequest ? (
              <CustomButton 
                title="احجز الرحلة" 
                onPress={handleBookRide}
                className="bg-primary"
              />
            ) : rideRequest.status === 'waiting' ? (
              <View className="flex-row justify-between items-center bg-gray-50 p-4 rounded-xl">
                <CustomButton
                  title="إلغاء الطلب"
                  onPress={handleCancelRide}
                  className="bg-red-500"
                />
                <Text className="text-gray-600 font-CairoRegular">في انتظار موافقة السائق...</Text>
              </View>
            ) : rideRequest.status === 'accepted' ? (
              <View className="flex-row justify-between space-x-2">
                <CustomButton
                  title="تسجيل الدخول"
                  onPress={handleCheckIn}
                  className="flex-1 bg-green-500"
                />
                <CustomButton
                  title="إلغاء الحجز"
                  onPress={handleCancelRide}
                  className="flex-1 bg-red-500"
                />
              </View>
            ) : rideRequest.status === 'checked_in' ? (
              <View className="flex-row justify-between space-x-2">
                <CustomButton
                  title="تسجيل الخروج"
                  onPress={handleCheckOut}
                  className="flex-1 bg-blue-500"
                />
                <CustomButton
                  title="إلغاء الحجز"
                  onPress={handleCancelRide}
                  className="flex-1 bg-red-500"
                />
              </View>
            ) : rideRequest.status === 'rejected' ? (
              <View className="bg-red-50 p-4 rounded-xl">
                <Text className="text-red-500 text-center font-CairoBold">
                  تم رفض طلب الحجز.
                </Text>
              </View>
            ) : rideRequest.status === 'checked_out' ? (
              <View className="bg-green-50 p-4 rounded-xl">
                <Text className="text-green-500 text-center font-CairoBold">
                  تم تسجيل خروجك من الرحلة!
                </Text>
              </View>
            ) : rideRequest.status === 'cancelled' ? (
              <View className="bg-red-50 p-4 rounded-xl">
                <Text className="text-red-500 text-center font-CairoBold">
                  تم إلغاء الحجز.
                </Text>
              </View>
            ) : (
              <CustomButton 
                title="احجز الرحلة" 
                onPress={handleBookRide}
                className="bg-primary"
              />
            )}
          </View>
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
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                >
                  <Text style={{ fontSize: 40 }}>
                    {star <= rating ? '⭐' : '☆'}
                  </Text>
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

export default RideDetails;