import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator, Platform, Alert } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { collection, query, getDocs, doc, getDoc, startAfter, limit, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { icons, images } from '@/constants';
import { StyleSheet } from 'react-native';
import { useLanguage } from '@/context/LanguageContext';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  created_at: any;
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
  priority?: number;
  distance?: number;
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
const MAX_DISTANCE_KM = 10; // 10 km radius
const RIDES_PER_PAGE = 5;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Haversine formula to calculate distance
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

// Cache helper functions
const cacheSuggestedRides = async (userId: string, rides: Ride[]) => {
  try {
    await AsyncStorage.setItem(`suggested_rides_${userId}`, JSON.stringify({ rides, timestamp: Date.now() }));
  } catch (err) {
    console.error('Error caching suggested rides:', err);
  }
};

const getCachedSuggestedRides = async (userId: string): Promise<Ride[] | null> => {
  try {
    const cached = await AsyncStorage.getItem(`suggested_rides_${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_DURATION) {
        return parsed.rides;
      }
    }
    return null;
  } catch (err) {
    console.error('Error retrieving cached suggested rides:', err);
    return null;
  }
};

const SuggestedRides = ({ refreshKey }: { refreshKey: number }) => {
  const { language, t } = useLanguage();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [preferredLocations, setPreferredLocations] = useState<RecentRoute[]>([]);
  const { user } = useUser();

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

  // Fetch user location
  const fetchUserLocation = useCallback(async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'ar' ? 'إذن الموقع مطلوب' : 'Location Permission Required',
          language === 'ar' ? 'يرجى السماح بالوصول إلى الموقع لعرض الرحلات المقترحة.' : 'Please allow location access to show suggested rides.'
        );
        return null;
      }
      let location = await Location.getCurrentPositionAsync({});
      return { latitude: location.coords.latitude, longitude: location.coords.longitude };
    } catch (err) {
      console.error('Error fetching user location:', err);
      return null;
    }
  }, [language]);

  // Fetch past rides (as driver and passenger)
  const fetchPastRides = useCallback(async () => {
    if (!user?.id) return [];
    try {
      const now = new Date();
      const ridesRef = collection(db, 'rides');
      const rideRequestsRef = collection(db, 'ride_requests');

      // Fetch past driver rides
      const driverRidesQuery = query(
        ridesRef,
        where('driver_id', '==', user.id),
        where('ride_datetime', '<=', now.toISOString()),
        orderBy('ride_datetime', 'desc'),
        limit(20)
      );

      // Fetch past passenger rides
      const passengerRequestsQuery = query(
        rideRequestsRef,
        where('user_id', '==', user.id),
        where('status', 'in', ['accepted', 'checked_in', 'checked_out']),
        limit(20)
      );

      const [driverRidesSnapshot, passengerRequestsSnapshot] = await Promise.all([
        getDocs(driverRidesQuery),
        getDocs(passengerRequestsQuery)
      ]);

      const driverRides = driverRidesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));

      const passengerRideIds = passengerRequestsSnapshot.docs.map(doc => doc.data().ride_id);
      const uniqueRideIds = [...new Set(passengerRideIds)];
      const passengerRidesPromises = uniqueRideIds.map(async (rideId) => {
        const rideDoc = await getDoc(doc(db, 'rides', rideId));
        if (rideDoc.exists()) {
          return { id: rideId, ...rideDoc.data() } as RideData;
        }
        return null;
      });
      const passengerRides = (await Promise.all(passengerRidesPromises)).filter((ride): ride is RideData => ride !== null);

      return [...driverRides, ...passengerRides];
    } catch (err) {
      console.error('Error fetching past rides:', err);
      return [];
    }
  }, [user]);

  // Analyze preferred locations from past rides
  const getPreferredLocations = useCallback((pastRides: RideData[]): RecentRoute[] => {
    const locations: { [key: string]: RecentRoute } = {};
    pastRides.forEach(ride => {
      const originKey = ride.origin_address;
      const destinationKey = ride.destination_address;
      if (originKey) {
        const key = `${originKey}|${destinationKey}`;
        if (locations[key]) {
          locations[key].count += 1;
        } else {
          locations[key] = { origin: originKey, destination: destinationKey, count: 1 };
        }
      }
    });
    return Object.values(locations).sort((a, b) => b.count - a.count).slice(0, 3); // Top 3 routes
  }, []);

  // Fetch suggested rides
  const fetchRides = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
        setRides([]);
        setLastVisible(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      if (!user?.id) {
        setError('User not authenticated');
        return;
      }

      // Check cache first
      const cachedRides = await getCachedSuggestedRides(user.id);
      if (cachedRides && isInitial) {
        setRides(cachedRides);
        setLoading(false);
        return;
      }

      // Fetch user location
      if (!userLocation) {
        const loc = await fetchUserLocation();
        if (!loc) {
          setError(language === 'ar' ? 'تعذر الوصول إلى الموقع' : 'Unable to access location');
          setLoading(false);
          return;
        }
        setUserLocation(loc);
      }

      // Fetch past rides and preferred locations
      if (preferredLocations.length === 0) {
        const pastRides = await fetchPastRides();
        const prefs = getPreferredLocations(pastRides);
        setPreferredLocations(prefs);
      }

      // Fetch upcoming rides
      const ridesRef = collection(db, 'rides');
      let ridesQuery;
      if (isInitial) {
        ridesQuery = query(
          ridesRef,
          where('ride_datetime', '>', new Date().toISOString()),
          where('status', '==', 'available'),
          limit(RIDES_PER_PAGE)
        );
      } else {
        if (!lastVisible) return;
        ridesQuery = query(
          ridesRef,
          where('ride_datetime', '>', new Date().toISOString()),
          where('status', '==', 'available'),
          startAfter(lastVisible),
          limit(RIDES_PER_PAGE)
        );
      }

      const ridesSnapshot = await getDocs(ridesQuery);
      if (ridesSnapshot.empty) {
        setHasMore(false);

        // If no nearby rides, fetch random rides
        const randomRidesQuery = query(
          ridesRef,
          where('ride_datetime', '>', new Date().toISOString()),
          where('status', '==', 'available'),
          limit(MAX_RIDES)
        );
        const randomRidesSnapshot = await getDocs(randomRidesQuery);
        if (!randomRidesSnapshot.empty) {
          const randomRidesData = randomRidesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));
          const randomRidesWithDriver = await getRidesWithDriverData(randomRidesData);
          setRides(prevRides => isInitial ? randomRidesWithDriver : [...prevRides, ...randomRidesWithDriver]);
        }
        return;
      }

      setLastVisible(ridesSnapshot.docs[ridesSnapshot.docs.length - 1]);
      const ridesData = ridesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));
      const ridesWithDriverData = await getRidesWithDriverData(ridesData);

      // Filter and prioritize rides
      const suggestedRides = ridesWithDriverData
        .map(ride => {
          if (!userLocation) return null;
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            ride.origin_latitude,
            ride.origin_longitude
          );
          if (distance > MAX_DISTANCE_KM) return null;

          let priority = 0;
          const routeMatch = preferredLocations.find(
            loc => loc.origin === ride.origin_address && loc.destination === ride.destination_address
          );
          if (routeMatch) {
            priority = routeMatch.count * 10; // Higher priority for preferred routes
          }
          priority -= distance; // Closer rides get higher priority

          return { ...ride, distance, priority };
        })
        .filter((ride): ride is Ride => ride !== null)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Add random rides if less than MAX_RIDES
      if (suggestedRides.length < MAX_RIDES && isInitial) {
        const randomRidesQuery = query(
          ridesRef,
          where('ride_datetime', '>', new Date().toISOString()),
          where('status', '==', 'available'),
          limit(MAX_RIDES - suggestedRides.length)
        );
        const randomRidesSnapshot = await getDocs(randomRidesQuery);
        if (!randomRidesSnapshot.empty) {
          const randomRidesData = randomRidesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));
          const randomRidesWithDriver = await getRidesWithDriverData(randomRidesData);
          suggestedRides.push(...randomRidesWithDriver);
        }
      }

      setRides(prevRides => isInitial ? suggestedRides : [...prevRides, ...suggestedRides]);
      if (isInitial) {
        await cacheSuggestedRides(user.id, suggestedRides);
      }
    } catch (err) {
      console.error('Error fetching rides:', err);
      setError('Failed to load rides. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, lastVisible, userLocation, preferredLocations, language]);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchRides(false);
    }
  };

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
    fetchRides(true);
  }, [refreshKey, fetchRides]);

  const renderRideCard = useCallback(
    ({ item }: { item: Ride }) => {
      const [date, time] = item.ride_datetime.split(' ');
      const formattedTime = formatTimeTo12Hour(time);

      return (
        <TouchableOpacity
          onPress={() => router.push(`/ride-details/${item.id}`)}
          className="bg-white p-4 rounded-2xl mb-3 mx-2"
          style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
        >
          {/* Status Badge */}
          <View className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'}`}>
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
                {item.status === 'ended' ? (language === 'ar' ? 'منتهي' : t.ended) : 
                 item.status === 'pending' ? (language === 'ar' ? 'قيد الانتظار' : t.pending) : 
                 (language === 'ar' ? 'متاح' : t.available)}
              </Text>
            </View>
          </View>

          {/* Driver Info */}
          <View className={`flex-row items-center mb-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <Image 
              source={item.driver?.profile_image_url ? { uri: item.driver.profile_image_url } : icons.profile} 
              className={`w-10 h-10 rounded-full ${language === 'ar' ? 'ml-3' : 'mr-3'}`}
            />
            <View className={language === 'ar' ? 'items-end' : 'items-start'}>
              <Text className={`text-base font-CairoBold ${language === 'ar' ? 'text-right' : 'text-left'}`}>{item.driver?.name}</Text>
              <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{item.driver?.car_type}</Text>
            </View>
          </View>

          {/* Route Info */}
          <View className={`flex-row items-start mb-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <View className="flex-1">
              <View className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Image source={icons.point} className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'ml-2' : 'mr-2'}`}>
                  {language === 'ar' ? 'من' : 'From'}:
                </Text>
                <Text className={`text-base font-CairoMedium flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                  {item.origin_address}
                </Text>
              </View>
              <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Image source={icons.target} className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'ml-2' : 'mr-2'}`}>
                  {language === 'ar' ? 'إلى' : 'To'}:
                </Text>
                <Text className={`text-base font-CairoMedium flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                  {item.destination_address}
                </Text>
              </View>
            </View>
          </View>

          {/* Ride Details */}
          <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.calendar} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{date}</Text>
            </View>
            <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.clock} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{formattedTime}</Text>
            </View>
            <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.person} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {item.available_seats} {language === 'ar' ? 'مقاعد' : t.seats}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [language, t]
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color="#000" />
      </View>
    );
  };

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
        <Text className={`text-sm text-red-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{error}</Text>
        <TouchableOpacity onPress={() => fetchRides(true)} className="mt-4">
          <Text className="text-blue-500">{t.retry}</Text>
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
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      ) : (
        <View className="items-center justify-center py-8">
          <Image source={images.noResult} className="w-40 h-40" resizeMode="contain" />
          <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {t.noRidesAvailable}
          </Text>
        </View>
      )}
    </View>
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

export default SuggestedRides;