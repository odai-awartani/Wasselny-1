import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, Image } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import RideLayout from '@/components/RideLayout';
import CustomButton from '@/components/CustomButton';
import { MaterialIcons } from '@expo/vector-icons';

interface RideRequest {
  id: string;
  ride_id: string;
  user_id: string;
  status: string;
  created_at: any;
  rating?: number;
  notification_id?: string;
}

interface Passenger {
  id: string;
  name: string;
  gender: string;
  profile_image_url?: string;
}

const RideRequests = () => {
  const { rideId } = useLocalSearchParams();
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [passengers, setPassengers] = useState<Record<string, Passenger>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, [rideId]);

  const fetchRequests = async () => {
    try {
      if (!rideId) return;

      const rideRequestsRef = collection(db, 'ride_requests');
      const q = query(
        rideRequestsRef,
        where('ride_id', '==', rideId),
        where('status', '==', 'waiting')
      );

      const querySnapshot = await getDocs(q);
      const requestsData: RideRequest[] = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RideRequest[];

      setRequests(requestsData);

      // Fetch passenger details
      const passengerDetails: Record<string, Passenger> = {};
      for (const request of requestsData) {
        const userDoc = await getDoc(doc(db, 'users', request.user_id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          passengerDetails[request.user_id] = {
            id: request.user_id,
            name: userData.name || 'الراكب',
            gender: userData.gender || 'غير محدد',
            profile_image_url: userData.profile_image_url
          };
        }
      }
      setPassengers(passengerDetails);
    } catch (error) {
      console.error('Error fetching requests:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء جلب طلبات الحجز');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string, userId: string) => {
    try {
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'accepted',
        updated_at: new Date()
      });

      Alert.alert('تم القبول', 'تم قبول طلب الحجز بنجاح');
      fetchRequests();
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء قبول الطلب');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'ride_requests', requestId), {
        status: 'rejected',
        updated_at: new Date()
      });

      Alert.alert('تم الرفض', 'تم رفض طلب الحجز');
      fetchRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء رفض الطلب');
    }
  };

  const renderRequest = (request: RideRequest) => {
    const passenger = passengers[request.user_id];
    if (!passenger) return null;

    return (
      <View key={request.id} className="bg-white m-2.5 p-4 rounded-lg shadow-sm">
        <View className="flex-row items-center mb-4">
          <View className="w-12 h-12 rounded-full bg-gray-100 items-center justify-center mr-4">
            {passenger.profile_image_url ? (
              <Image
                source={{ uri: passenger.profile_image_url }}
                className="w-full h-full rounded-full"
              />
            ) : (
              <MaterialIcons name="person" size={40} color="#666" />
            )}
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold mb-1">{passenger.name}</Text>
            <Text className="text-gray-600">الجنس: {passenger.gender}</Text>
          </View>
        </View>
        <View className="flex-row justify-between">
          <CustomButton
            title="قبول"
            onPress={() => handleAcceptRequest(request.id, passenger.id)}
            className="flex-1 mr-1 bg-green-500"
          />
          <CustomButton
            title="رفض"
            onPress={() => handleRejectRequest(request.id)}
            className="flex-1 ml-1 bg-red-500"
          />
        </View>
      </View>
    );
  };

  return (
    <RideLayout title="طلبات الحجز">
      <ScrollView className="flex-1 bg-gray-50">
        {loading ? (
          <View className="flex-1 justify-center items-center p-5">
            <Text>جاري تحميل الطلبات...</Text>
          </View>
        ) : requests.length > 0 ? (
          requests.map(renderRequest)
        ) : (
          <View className="flex-1 justify-center items-center p-5">
            <MaterialIcons name="inbox" size={48} color="#666" />
            <Text className="mt-2 text-gray-600 text-lg">لا توجد طلبات حجز جديدة</Text>
          </View>
        )}
      </ScrollView>
    </RideLayout>
  );
};

export default RideRequests; 