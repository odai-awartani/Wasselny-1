import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { collection, query, where, getDocs, limit, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { icons, images } from '@/constants';
import { useLocationStore } from '@/store';

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
  origin_latitude: number;
  origin_longitude: number;
  driver?: {
    name: string;
    car_seats: number;
    profile_image_url?: string;
    car_type: string;
  };
}

interface RideRequest {
  origin_address: string;
  destination_address: string;
  status: string;
}

interface RecentRoute {
  origin: string;
  destination: string;
  count: number;
}

interface RideData {
  id: string;
  origin_address: string;
  destination_address: string;
  created_at: any;
  ride_datetime: string;
  driver_id?: string;
  status: string;
  available_seats: number;
  origin_latitude: number;
  origin_longitude: number;
}

// Constants
const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const MAX_RIDES = 6;
const MAX_DISTANCE_KM = 60; // 10 km radius

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const SuggestedRides = ({ refreshKey }: { refreshKey: number }) => {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();
  const { userLatitude, userLongitude } = useLocationStore();

  const formatTimeTo12Hour = (timeStr: string) => {
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      console.error('Error formatting time:', error);
      return timeStr;
    }
  };

  const parseDateString = (dateStr: string) => {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    
    let hours = 0;
    let minutes = 0;
    
    if (timePart) {
      if (timePart.includes('AM') || timePart.includes('PM')) {
        const isPM = timePart.includes('PM');
        const [time] = timePart.split(' ');
        const [h, m] = time.split(':').map(Number);
        hours = isPM ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
        minutes = m;
      } else {
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
      console.log('Fetching personalized rides...');

      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      if (!userLatitude || !userLongitude) {
        setError('User location not available');
        return;
      }

      // Get completed ride requests
      const rideRequestsRef = collection(db, 'ride_requests');
      const rideRequestsQuery = query(
        rideRequestsRef,
        where('user_id', '==', user.id),
        where('status', '==', 'completed')
      );
      const rideRequestsSnapshot = await getDocs(rideRequestsQuery);
      const rideRequests = rideRequestsSnapshot.docs.map(doc => doc.data() as RideRequest);

      // Find most frequent routes
      const routeCounts: { [key: string]: RecentRoute } = {};
      rideRequests.forEach(request => {
        const routeKey = `${request.origin_address}|${request.destination_address}`;
        if (routeCounts[routeKey]) {
          routeCounts[routeKey].count += 1;
        } else {
          routeCounts[routeKey] = {
            origin: request.origin_address,
            destination: request.destination_address,
            count: 1
          };
        }
      });

      // Sort routes by frequency
      const sortedRoutes = Object.values(routeCounts).sort((a, b) => b.count - a.count);

      // Get rides collection reference
      const ridesRef = collection(db, 'rides');
      let ridesData: RideData[] = [];

      // If there are frequent routes, prioritize them
      if (sortedRoutes.length > 0) {
        const matchingRides = await Promise.all(
          sortedRoutes.slice(0, 3).map(async (route) => { // Limit to top 3 routes
            const routeQuery = query(
              ridesRef,
              where('origin_address', '==', route.origin),
              where('destination_address', '==', route.destination),
              where('status', '==', 'pending'),
              limit(2)
            );
            const snapshot = await getDocs(routeQuery);
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));
          })
        );

        // Flatten and deduplicate rides
        ridesData = matchingRides.flat().filter((ride, index, self) =>
          index === self.findIndex((r) => r.id === ride.id)
        );

        // If we have enough rides, use them
        if (ridesData.length >= MAX_RIDES) {
          const ridesWithDriverData = await getRidesWithDriverData(ridesData.slice(0, MAX_RIDES));
          const filteredRides = ridesWithDriverData.filter(ride => {
            if (isRideOutdated(ride.ride_datetime)) {
              updateRideStatus(ride.id);
              return false;
            }
            return true;
          });
          setRides(filteredRides);
          setLoading(false);
          return;
        }
      }

      // If not enough rides or no frequent routes, get rides based on location
      const allRidesQuery = query(
        ridesRef,
        where('status', '==', 'pending'),
        limit(MAX_RIDES)
      );
      const allRidesSnapshot = await getDocs(allRidesQuery);
      const allRides = allRidesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));

      // Filter rides within 10 km of user's current location
      const nearbyRides = allRides.filter(ride => {
        if (!ride.origin_latitude || !ride.origin_longitude) return false;
        const distance = calculateDistance(
          userLatitude,
          userLongitude,
          ride.origin_latitude,
          ride.origin_longitude
        );
        return distance <= MAX_DISTANCE_KM;
      });

      // Combine frequent route rides with nearby rides
      const combinedRides = [...ridesData, ...nearbyRides].filter((ride, index, self) =>
        index === self.findIndex((r) => r.id === ride.id)
      );

      const ridesWithDriverData = await getRidesWithDriverData(combinedRides.slice(0, MAX_RIDES));
      const filteredRides = ridesWithDriverData.filter(ride => {
        if (isRideOutdated(ride.ride_datetime)) {
          updateRideStatus(ride.id);
          return false;
        }
        return true;
      });
      setRides(filteredRides);
    } catch (err) {
      console.error('Error fetching rides:', err);
      setError('Failed to load rides. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, userLatitude, userLongitude]);

  const getRidesWithDriverData = async (rides: RideData[]): Promise<Ride[]> => {
    const driverIds = new Set(rides
      .map(ride => ride.driver_id)
      .filter((id): id is string => id !== undefined && id !== null)
    );
    
    const driverDataMap: { [key: string]: UserData } = {};

    for (const driverId of driverIds) {
      const driverDoc = await getDoc(doc(db, 'users', driverId));
      if (driverDoc.exists()) {
        driverDataMap[driverId] = driverDoc.data() as UserData;
      }
    }

    return rides.map(ride => {
      const driverId = ride.driver_id;
      const driverData = driverId ? driverDataMap[driverId] : undefined;
      
      return {
        id: ride.id,
        origin_address: ride.origin_address || 'Unknown Origin',
        destination_address: ride.destination_address || 'Unknown Destination',
        created_at: ride.created_at,
        ride_datetime: ride.ride_datetime || 'Unknown Time',
        status: ride.status,
        available_seats: ride.available_seats || 0,
        origin_latitude: ride.origin_latitude || 0,
        origin_longitude: ride.origin_longitude || 0,
        driver_id: driverId,
        driver: {
          name: driverData?.name || DEFAULT_DRIVER_NAME,
          car_seats: driverData?.driver?.car_seats || DEFAULT_CAR_SEATS,
          profile_image_url: driverData?.driver?.profile_image_url || '',
          car_type: driverData?.driver?.car_type || DEFAULT_CAR_TYPE,
        }
      };
    });
  };

  useEffect(() => {
    fetchRides();
  }, [fetchRides, refreshKey]);

  const renderRideCard = useCallback(
    ({ item }: { item: Ride }) => {
      const [date, time] = item.ride_datetime.split(' ');
      const formattedTime = formatTimeTo12Hour(time);

      return (
        <TouchableOpacity
          onPress={() => router.push(`/ride-details/${item.id}`)}
          className="bg-white p-4 rounded-2xl mb-3 mx-2 shadow-sm"
        >
          {/* Status Badge */}
          <View className="absolute top-4 right-4">
            <View className={`px-2 py-1 rounded-full ${
              item.status === 'ended' ? 'bg-red-50' : 
              item.status === 'pending' ? 'bg-yellow-50' : 
              'bg-green-50'
            }`}>
              <Text className={`text-xs font-CairoMedium ${
                item.status === 'ended' ? 'text-red-600' : 
                item.status === 'pending' ? 'text-yellow-600' : 
                'text-green-600'
              }`}>
                {item.status === 'ended' ? 'Ended' : 
                 item.status === 'pending' ? 'Pending' : 
                 'Available'}
              </Text>
            </View>
          </View>

          {/* Driver Info */}
          <View className="flex-row items-center mb-3">
            <Image 
              source={item.driver?.profile_image_url ? { uri: item.driver.profile_image_url } : icons.profile} 
              className="w-10 h-10 rounded-full mr-3"
            />
            <View>
              <Text className="text-base font-CairoBold">{item.driver?.name}</Text>
              <Text className="text-sm text-gray-500">{item.driver?.car_type}</Text>
            </View>
          </View>

          {/* Route Info */}
          <View className="flex-row items-start mb-3">
            
            <View className="flex-1">
              <View className="flex-row items-center mb-1">
                <Image source={icons.point} className="w-5 h-5 mr-1" />
                <Text className="text-sm text-gray-500 mr-2">From:</Text>
                <Text className="text-base font-CairoMedium flex-1" numberOfLines={1}>
                  {item.origin_address}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Image source={icons.target} className="w-5 h-5 mr-1" />
                <Text className="text-sm text-gray-500 mr-2">To:</Text>
                <Text className="text-base font-CairoMedium flex-1" numberOfLines={1}>
                  {item.destination_address}
                </Text>
              </View>
            </View>
          </View>

          {/* Ride Details */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              <Image source={icons.calendar} className="w-4 h-4 mr-1" />
              <Text className="text-sm text-gray-600">{date}</Text>
            </View>
            <View className="flex-row items-center">
              <Image source={icons.clock} className="w-4 h-4 mr-1" />
              <Text className="text-sm text-gray-600">{formattedTime}</Text>
            </View>
            <View className="flex-row items-center">
              <Image source={icons.person} className="w-4 h-4 mr-1" />
              <Text className="text-sm text-gray-600">{item.available_seats} مقاعد</Text>
            </View>
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