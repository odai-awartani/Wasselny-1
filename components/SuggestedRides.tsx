import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { icons, images } from '@/constants';
import { MapPin } from 'lucide-react-native';

// Interfaces
interface DriverData {
  car_seats?: number;
  car_type?: string;
  profile_image_url?: string;
}

interface UserData {
  name?: string;
  driver?: DriverData;
}

interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
  created_at: any; // Firestore Timestamp
  ride_datetime: string;
  driver_id?: string;
  status: string;
  available_seats: number;
  driver?: {
    name: string;
    car_seats: number;
    profile_image_url?: string;
    car_type: string;
  };
}

// Constants
const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';

const SuggestedRides = () => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const fetchRides = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching rides...');

      // Fetch pending rides
      const ridesRef = collection(db, 'rides');
      const q = query(ridesRef, where('status', '==', 'pending'), limit(10));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        console.log('No pending rides found.');
        setRides([]);
        return;
      }

      // Collect driver IDs
      const driverIds = new Set<string>();
      querySnapshot.forEach((docSnap) => {
        const rideData = docSnap.data();
        if (rideData.driver_id) driverIds.add(rideData.driver_id);
      });
      console.log('Driver IDs:', Array.from(driverIds));

      // Fetch user data (including driver field)
      const driverDataMap: { [key: string]: UserData } = {};
      for (const driverId of driverIds) {
        const userDocRef = doc(db, 'users', driverId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          driverDataMap[driverId] = userDocSnap.data() as UserData;
        } else {
          console.warn(`User not found for driver_id: ${driverId}`);
          driverDataMap[driverId] = { name: DEFAULT_DRIVER_NAME, driver: null };
        }
      }
      console.log('Driver data map:', driverDataMap);

      // Map rides with driver data
      const ridesData = querySnapshot.docs.map((docSnap) => {
        const rideData = docSnap.data();
        const driverId = rideData.driver_id;
        const driverInfo = driverId ? driverDataMap[driverId] : null;

        return {
          id: docSnap.id,
          origin_address: rideData.origin_address || 'Unknown Origin',
          destination_address: rideData.destination_address || 'Unknown Destination',
          created_at: rideData.created_at, // Firestore Timestamp
          ride_datetime: rideData.ride_datetime || 'Unknown Time',
          status: rideData.status,
          available_seats: rideData.available_seats || 0,
          driver_id: driverId,
          driver: {
            name: driverInfo?.name || DEFAULT_DRIVER_NAME,
            car_seats: driverInfo?.driver?.car_seats || DEFAULT_CAR_SEATS,
            profile_image_url: driverInfo?.driver?.profile_image_url || '',
            car_type: driverInfo?.driver?.car_type || DEFAULT_CAR_TYPE,
          },
        };
      });

      // Sort rides by created_at (newest first)
      const sortedRides = ridesData.sort((a, b) => {
        try {
          return b.created_at.toDate().getTime() - a.created_at.toDate().getTime();
        } catch (err) {
          console.warn('Error sorting rides:', err);
          return 0;
        }
      });

      setRides(sortedRides);
      console.log('Rides fetched:', sortedRides);
    } catch (err) {
      console.error('Error fetching rides:', err);
      setError('Failed to load rides. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  
  const renderRideCard = useCallback(
    ({ item }: { item: Ride }) => {
      let rideDate;
      try {
        rideDate = item.created_at.toDate();
      } catch (err) {
        console.warn(`Invalid date for ride ${item.id}:`, item.created_at);
        rideDate = new Date();
      }

      const driverName = item.driver?.name || DEFAULT_DRIVER_NAME;
      const driverImage = item.driver?.profile_image_url || 'https://via.placeholder.com/150';
      const rating = 4.3; // مؤقتًا
      const dateTime = `${item.ride_datetime}`;
      const from = item.origin_address;
      const to = item.destination_address;

      return (
        <TouchableOpacity
          onPress={() => router.push(`/ride-details/${item.id}`)}
          className="flex-row bg-slate-100 rounded-xl p-3 mb-3 items-start shadow-sm"
        >
          <View className='flex flex-row justify-center items-start h-full w-15'>

          <Image source={{ uri: driverImage }} className="w-12 h-12 rounded-full mr-3" />
          </View>
          <View className="flex-1">
            {/* الاسم والتاريخ */}
            <View className="flex-row justify-between mb-1">
              <Text className="font-CairoBold text-base text-gray-900">{driverName}</Text>
              <Text className="text-xs text-gray-500 pt-1.5">{dateTime}</Text>
            </View>

            {/* المواقع */}
            <View className='flex-row justify-between'>
            <View className="mt-1 w-50%">
              <View className="flex-row items-center mb-1.5">
                
                <Image source={icons.point} className="w-5 h-5 ml-1.5" resizeMode='contain' />
                <Text className='ml-1.5 text-sm text-gray-700 font-CairoRegular'>: من</Text>
                <Text className="ml-1.5 text-sm text-gray-700 font-CairoRegular">{from}</Text>
              </View>
              <View className="flex-row items-center">
              <Image source={icons.to} className="w-5 h-5 ml-1.5" resizeMode='contain' />
              <Text className='ml-1.5 text-sm text-gray-700 font-CairoRegular'>: الى</Text>
              <Text className="ml-1.5 text-sm text-gray-700 font-CairoRegular">{to}</Text>
              </View>
            </View>
            <View className="flex-column justify-between mt-2 w-50%">
              <Text className="text-amber-500 font-semibold text-right ">★ {rating}</Text>
              <Text className="text-xs text-gray-600 font-CairoRegular">المقاعد المتاحة: {item.available_seats}</Text>
            </View>
              </View>
            {/* التقييم والمقاعد */}
          </View>
        </TouchableOpacity>
      );
    },
    []
  );

  if (loading) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="small" color="#000" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center justify-center py-8">
        <Text className="text-sm text-red-500">{error}</Text>
        <TouchableOpacity onPress={fetchRides} className="mt-4">
          <Text className="text-blue-500">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {rides.length > 0 ? (
        <FlatList
          data={rides}
          renderItem={renderRideCard}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16 }}
        />
      ) : (
        <View className="items-center justify-center py-8">
          <Image source={images.noResult} className="w-40 h-40" resizeMode="contain" />
          <Text className="text-sm text-gray-500">No suggested rides available</Text>
        </View>
      )}
    </View>
  );
};

export default SuggestedRides;