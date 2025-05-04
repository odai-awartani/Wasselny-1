import { View, Text, FlatList, Alert, ActivityIndicator, Image } from 'react-native';
import React, { useEffect, useState } from 'react';
import RideLayout from '@/components/RideLayout';
import CustomButton from '@/components/CustomButton';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@clerk/clerk-expo';
import { sendRideStatusNotification, schedulePassengerRideReminder } from '@/lib/notifications';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface UserData {
  name?: string;
  profile_image_url?: string;
  [key: string]: any;
}

interface RideRequest {
  id: string;
  user_id: string;
  status: 'waiting' | 'accepted' | 'rejected' | 'checked_in' | 'checked_out' | 'cancelled';
  created_at: any;
  passenger_name?: string;
  profile_image_url?: string;
}

const DEFAULT_DRIVER_NAME = 'Unknown Driver';

const RideRequests = () => {
  const params = useLocalSearchParams();
  const { userId } = useAuth();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch pending requests for this ride
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const rideRequestsRef = collection(db, 'ride_requests');
        const q = query(
          rideRequestsRef,
          where('ride_id', '==', params.rideId),
          where('status', '==', 'waiting')
        );
        
        const querySnapshot = await getDocs(q);
        const requestsData: RideRequest[] = [];
        
        for (const requestDoc of querySnapshot.docs) {
          const requestData = requestDoc.data();
          // Get passenger details
          const userDoc = await getDoc(doc(db, 'users', requestData.user_id));
          const userData = userDoc.data() as UserData;
          const userName = userData?.name || 'الراكب';
          const userImage = userData?.profile_image_url;
          
          requestsData.push({
            id: requestDoc.id,
            user_id: requestData.user_id,
            status: requestData.status,
            created_at: requestData.created_at,
            passenger_name: userName,
            profile_image_url: userImage
          });
        }
        
        setRequests(requestsData);
      } catch (err) {
        console.error('Error fetching requests:', err);
        setError('فشل تحميل طلبات الحجز');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [params.rideId]);

  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      if (Platform.OS === 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      const userDoc = await getDoc(doc(db, 'users', userId));
      const passengerName = userDoc.data()?.name || 'الراكب';

      if (!params.rideId || !params.driverId) {
        throw new Error('بيانات الرحلة أو السائق غير متوفرة');
      }

      const passengerNotificationId = await schedulePassengerRideReminder(
        params.rideId as string,
        params.rideTime as string,
        params.origin as string,
        params.destination as string,
        params.driverId as string
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
        `تم قبول طلب حجزك للرحلة من ${params.origin} إلى ${params.destination}`,
        params.rideId as string
      );

      // Remove the request from the local state
      setRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));

      Alert.alert('✅ تم قبول طلب الحجز بنجاح', `تم قبول طلب ${passengerName}`);
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('حدث خطأ أثناء قبول الطلب.');
    }
  };

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
        `عذراً، تم رفض طلب حجزك للرحلة من ${params.origin} إلى ${params.destination}`,
        params.rideId as string
      );

      // Remove the request from the local state
      setRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));

      Alert.alert('✅ تم رفض طلب الحجز', `تم رفض طلب ${passengerName}`);
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('حدث خطأ أثناء رفض الطلب.');
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
        <Text className="mt-4 text-black font-CairoMedium">جاري تحميل طلبات الحجز...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-4 bg-white">
        <MaterialIcons name="error-outline" size={48} color="#f97316" />
        <Text className="mt-4 text-black text-center font-CairoMedium">{error}</Text>
        <CustomButton
          title="إعادة المحاولة"
          onPress={() => router.back()}
          className="mt-4 bg-orange-500 py-3 px-6 rounded-xl"
        />
      </View>
    );
  }

  return (
    <RideLayout title="طلبات الحجز">
      <View className="flex-1 bg-white">
        {requests.length === 0 ? (
          <View className="flex-1 justify-center items-center p-4">
            <MaterialIcons name="event-busy" size={48} color="#9CA3AF" />
            <Text className="mt-4 text-gray-500 text-center font-CairoMedium">
              لا توجد طلبات حجز معلقة
            </Text>
          </View>
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="bg-white p-4 m-3 rounded-xl border border-gray-200">
                <View className="flex-row-reverse items-center mb-3">
                  <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-3 overflow-hidden">
                    {item.profile_image_url ? (
                      <Image
                        source={{ uri: item.profile_image_url }}
                        className="w-full h-full"
                      />
                    ) : (
                      <MaterialIcons name="person" size={24} color="#666" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-CairoBold text-black">
                      {item.passenger_name}
                    </Text>
                    <Text className="text-sm text-gray-500 font-CairoRegular">
                      {item.created_at ? new Date(item.created_at.toDate()).toLocaleTimeString() : 'غير محدد'}
                    </Text>
                  </View>
                </View>
                <View className="flex-row justify-between">
                  <CustomButton
                    title="قبول"
                    onPress={() => handleAcceptRequest(item.id, item.user_id)}
                    className="bg-green-500 w-24 px-6"
                  />
                  <CustomButton
                    title="رفض"
                    onPress={() => handleRejectRequest(item.id, item.user_id)}
                    className="bg-red-500 w-24 px-6"
                  />
                </View>
              </View>
            )}
          />
        )}
      </View>
    </RideLayout>
  );
};

export default RideRequests; 