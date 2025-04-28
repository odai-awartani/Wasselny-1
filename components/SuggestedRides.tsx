import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { icons, images } from '@/constants';

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

const SuggestedRides = ({ refreshKey }: { refreshKey: number }) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  const parseDateString = (dateStr: string) => {
    // Handle both formats: "DD/MM/YYYY HH:mm" and "DD/MM/YYYY HH:mm AM/PM"
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    
    let hours = 0;
    let minutes = 0;
    
    // Parse time part
    if (timePart) {
      if (timePart.includes('AM') || timePart.includes('PM')) {
        // Handle 12-hour format
        const isPM = timePart.includes('PM');
        const [time] = timePart.split(' ');
        const [h, m] = time.split(':').map(Number);
        hours = isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
        minutes = m;
      } else {
        // Handle 24-hour format
        const [h, m] = timePart.split(':').map(Number);
        hours = h;
        minutes = m;
      }
    }
    
    return new Date(year, month - 1, day, hours, minutes);
  };

  const isRideOutdated = (rideDateTime: string) => {
    try {
      const rideDate = parseDateString(rideDateTime);
      const currentDate = new Date();
      
      console.log('Checking ride date:', {
        rideDateTime,
        parsedRideDate: rideDate.toISOString(),
        currentDate: currentDate.toISOString(),
        isOutdated: rideDate < currentDate
      });
      
      return rideDate < currentDate;
    } catch (err) {
      console.error('Error parsing ride date:', rideDateTime, err);
      return false;
    }
  };

  const updateRideStatus = async (rideId: string) => {
    try {
      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, {
        status: 'ended'
      });
      console.log(`Updated ride ${rideId} status to ended`);
    } catch (err) {
      console.error(`Error updating ride ${rideId} status:`, err);
    }
  };

  const fetchRides = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching rides...');

      // Fetch pending and ended rides
      const ridesRef = collection(db, 'rides');
      const q = query(ridesRef, 
        where('status', 'in', ['pending', 'ended']),
        limit(50)
      );
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
          driverDataMap[driverId] = { name: DEFAULT_DRIVER_NAME, driver: undefined };
        }
      }

      // Check for outdated rides and update their status
      const updatePromises = [];
      for (const docSnap of querySnapshot.docs) {
        const rideData = docSnap.data();
        console.log('Checking ride:', {
          id: docSnap.id,
          status: rideData.status,
          ride_datetime: rideData.ride_datetime
        });
        if (rideData.status === 'pending' && isRideOutdated(rideData.ride_datetime)) {
          console.log('Updating outdated ride:', docSnap.id);
          updatePromises.push(updateRideStatus(docSnap.id));
        }
      }
      
      // Wait for all updates to complete
      await Promise.all(updatePromises);

      // Map rides with driver data
      const ridesData = querySnapshot.docs.map((docSnap) => {
        const rideData = docSnap.data();
        const driverId = rideData.driver_id;
        const driverInfo = driverId ? driverDataMap[driverId] : null;

        return {
          id: docSnap.id,
          origin_address: rideData.origin_address || 'Unknown Origin',
          destination_address: rideData.destination_address || 'Unknown Destination',
          created_at: rideData.created_at,
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
      
    } catch (err) {
      console.error('Error fetching rides:', err);
      setError('Failed to load rides. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Only fetch rides when refreshKey changes
  useEffect(() => {
    fetchRides();
  }, [fetchRides, refreshKey]);

  const renderRideCard = useCallback(
    ({ item }: { item: Ride }) => {
      return (
        <TouchableOpacity
          onPress={() => router.push(`/ride-details/${item.id}`)}
          className="bg-white p-4 rounded-2xl mb-3 mx-2"
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold">Ride #{item.id}</Text>
            <View className={`px-3 py-1 rounded-full ${item.status === 'ended' ? 'bg-red-50' : 'bg-green-50'}`}>
              <Text className={`text-sm ${item.status === 'ended' ? 'text-red-700' : 'text-green-700'}`}>{item.status}</Text>
            </View>
          </View>

          <View className="mb-3">
            <View className="flex-row items-center mb-2">
              <Image source={icons.location} className="w-5 h-5 mr-2" />
              <Text className="text-gray-500">From</Text>
            </View>
            <Text className="text-black text-base ml-7">{item.origin_address}</Text>
          </View>

          <View className="mb-4">
            <View className="flex-row items-center mb-2">
              <Image source={icons.point} className="w-5 h-5 mr-2" />
              <Text className="text-gray-500">To</Text>
            </View>
            <Text className="text-black text-base ml-7">{item.destination_address}</Text>
          </View>

          <View className="flex-row justify-between mb-5">
            <View>
              <Text className="text-gray-500 text-sm mb-1">Price</Text>
              <Text className="text-black font-bold">$18.75</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-sm mb-1">Distance</Text>
              <Text className="text-black">3.8 km</Text>
            </View>
            <View>
              <Text className="text-gray-500 text-sm mb-1">Duration</Text>
              <Text className="text-black">12 min</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <Image 
                source={{ uri: item.driver?.profile_image_url }} 
                className="w-12 h-12 rounded-full mr-3"
              />
              <View>
                <Text className="text-black text-base font-semibold">
                  {item.driver?.name}
                </Text>
                <View className="flex-row items-center">
                  <Image source={icons.star} className="w-4 h-4 mr-1"/>
                  <Text className="mr-2">4.6</Text>
                  <Text className="text-gray-500">• 98 rides</Text>
                </View>
              </View>
            </View>
            <Text className="text-gray-500">{item.driver?.car_type}</Text>
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