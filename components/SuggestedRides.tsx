import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { collection, query, getDocs, doc, getDoc, where, orderBy, limit } from 'firebase/firestore';
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
  recurring: boolean;
  ride_days?: string[];
  waypoints?: {
    address: string;
    latitude: number;
    longitude: number;
  }[];
  driver?: {
    name: string;
    car_seats: number;
    profile_image_url?: string;
    car_type: string;
  };
  priority?: number;
  distance?: number;
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
  recurring: boolean;
  ride_days?: string[];
  waypoints?: {
    address: string;
    latitude: number;
    longitude: number;
  }[];
}

interface RecentRoute {
  origin: string;
  destination: string;
  count: number;
}

// Constants
const DEFAULT_DRIVER_NAME = 'Unknown Driver';
const DEFAULT_CAR_SEATS = 4;
const DEFAULT_CAR_TYPE = 'Unknown';
const MAX_RIDES = 5;
const MAX_DISTANCE_KM = 20;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const VALID_RECURRING_STATUSES = ['available', 'full', 'in-progress', 'completed', 'on-hold'];

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
    const cacheData = await AsyncStorage.getItem(`suggested_rides_${userId}`);
    if (!cacheData) return null;
    const parsed = JSON.parse(cacheData);
    if (parsed.rides && Date.now() - parsed.timestamp < CACHE_DURATION) {
      return parsed.rides;
    }
    return null;
  } catch (err) {
    console.error('Error retrieving cached suggested rides:', err);
    return null;
  }
};

const clearCache = async (userId: string) => {
  try {
    await AsyncStorage.removeItem(`suggested_rides_${userId}`);
  } catch (err) {
    console.error('Error clearing cache:', err);
  }
};

const SuggestedRides = ({ refreshKey }: { refreshKey?: number }) => {
  const { language, t } = useLanguage();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [preferredLocations, setPreferredLocations] = useState<RecentRoute[]>([]);
  const { user } = useUser();
  const hasFetchedRef = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
        console.log('Location permission denied');
        return null;
      }
      let location = await Location.getCurrentPositionAsync({});
      return { latitude: location.coords.latitude, longitude: location.coords.longitude };
    } catch (err) {
      console.error('Error fetching user location:', err);
      return null;
    }
  }, []);

  // Fetch past rides
  const fetchPastRides = useCallback(async () => {
    if (!user?.id) return [];
    try {
      const now = new Date();
      const ridesRef = collection(db, 'rides');
      const rideRequestsRef = collection(db, 'ride_requests');

      const driverRidesQuery = query(
        ridesRef,
        where('driver_id', '==', user.id),
        where('ride_datetime', '<=', now.toISOString()),
        orderBy('ride_datetime', 'desc'),
        limit(20)
      );

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

      const passengerRideIds = passengerRequestsSnapshot.docs.map(doc => doc.data().ride_id).filter(id => id);
      const uniqueRideIds = [...new Set(passengerRideIds)];
      const passengerRidesPromises = uniqueRideIds.map(async (rideId) => {
        const rideDoc = await getDoc(doc(db, 'rides', rideId));
        if (rideDoc.exists()) {
          return { id: rideId, ...rideDoc.data() } as RideData;
        }
        return null;
      });
      const passengerRides = (await Promise.all(passengerRidesPromises)).filter((ride): ride is RideData => ride !== null);

      console.log('Past rides fetched:', driverRides.length + passengerRides.length);
      return [...driverRides, ...passengerRides];
    } catch (err) {
      console.error('Error fetching past rides:', err);
      return [];
    }
  }, [user?.id]);

  // Analyze preferred locations
  const getPreferredLocations = useCallback((pastRides: RideData[]): RecentRoute[] => {
    const locations: { [key: string]: RecentRoute } = {};
    pastRides.forEach(ride => {
      const originKey = ride.origin_address?.trim();
      const destinationKey = ride.destination_address?.trim();
      if (originKey && destinationKey) {
        const key = `${originKey}|${destinationKey}`;
        if (locations[key]) {
          locations[key].count += 1;
        } else {
          locations[key] = { origin: originKey, destination: destinationKey, count: 1 };
        }
      }
    });
    const prefs = Object.values(locations).sort((a, b) => b.count - a.count).slice(0, 3);
    console.log('Preferred locations:', prefs);
    return prefs;
  }, []);

  // Fetch suggested rides
  const fetchRides = useMemo(() => async () => {
    if (!user?.id) {
      setError(language === 'ar' ? 'المستخدم غير مصادق' : 'User not authenticated');
      setLoading(false);
      return;
    }

    if (!isMountedRef.current) {
      console.log('Fetch aborted: component unmounted');
      return;
    }

    console.log('Fetching rides');
    try {
      setLoading(true);
      setError(null);

      // Check cache
      if (!hasFetchedRef.current) {
        const cachedRides = await getCachedSuggestedRides(user.id);
        if (cachedRides?.length && isMountedRef.current) {
          console.log('Using cached rides:', cachedRides.length);
          setRides(cachedRides.slice(0, MAX_RIDES));
          setLoading(false);
          hasFetchedRef.current = true;
          return;
        }
        await clearCache(user.id);
      }

      // Fetch user location
      if (!userLocation && isMountedRef.current) {
        const loc = await fetchUserLocation();
        if (isMountedRef.current) {
          setUserLocation(loc);
          console.log('User location:', loc);
        }
      }

      // Fetch preferred locations
      if (preferredLocations.length === 0 && isMountedRef.current) {
        const pastRides = await fetchPastRides();
        if (isMountedRef.current) {
          const prefs = getPreferredLocations(pastRides);
          setPreferredLocations(prefs);
        }
      }

      // Fetch rides (recurring or future)
      const ridesRef = collection(db, 'rides');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Future rides query (non-recurring, available, future)
      const futureRidesQuery = query(
        ridesRef,
        where('ride_datetime', '>=', today.toISOString()),
        where('status', '==', 'available'),
        orderBy('ride_datetime', 'asc'),
        limit(10)
      );

      const futureRidesSnapshot = await getDocs(futureRidesQuery);
      let ridesData = futureRidesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));
      console.log('Future rides fetched:', ridesData.length, 'Data:', JSON.stringify(ridesData, null, 2));

      // Recurring rides query (any valid status)
      const recurringQuery = query(
        ridesRef,
        where('recurring', '==', true),
        where('status', 'in', VALID_RECURRING_STATUSES),
        limit(10)
      );
      const recurringSnapshot = await getDocs(recurringQuery);
      const recurringRidesData = recurringSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));
      console.log('Recurring rides fetched:', recurringRidesData.length, 'Data:', JSON.stringify(recurringRidesData, null, 2));

      ridesData = [
        ...ridesData,
        ...recurringRidesData
      ].filter((ride, index, self) => 
        index === self.findIndex(r => r.id === ride.id)
      );

      // Fallback query for any available rides
      if (ridesData.length === 0 && isMountedRef.current) {
        console.log('No future or recurring rides found, trying fallback query');
        const fallbackQuery = query(
          ridesRef,
          where('status', '==', 'available'),
          limit(10)
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        ridesData = fallbackSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RideData));
        console.log('Fallback rides fetched:', ridesData.length, 'Data:', JSON.stringify(ridesData, null, 2));
      }

      if (ridesData.length === 0) {
        setError(language === 'ar' ? 'لا توجد رحلات متاحة أو متكررة. تحقق من بيانات Firestore (الحالة، التكرار، أو التاريخ).' : 'No available or recurring rides. Check Firestore data (status, recurring, or datetime).');
        setRides([]);
        return;
      }

      const ridesWithDriverData = await getRidesWithDriverData(ridesData);

      // Prioritize rides
      const suggestedRides = ridesWithDriverData
        .map(ride => {
          const distance = userLocation ? calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            ride.origin_latitude,
            ride.origin_longitude
          ) : undefined;

          let priority = 0;
          const routeMatch = preferredLocations.find(
            loc => loc.origin === ride.origin_address && loc.destination === ride.destination_address
          );
          if (routeMatch) {
            priority += routeMatch.count * 100;
          }
          if (ride.recurring) {
            priority += 50;
          }
          if (distance !== undefined) {
            if (distance <= MAX_DISTANCE_KM) {
              priority += (MAX_DISTANCE_KM - distance) * 10;
            } else {
              priority -= distance;
            }
          }

          return { ...ride, distance, priority };
        })
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Select top 5 rides
      let finalRides = suggestedRides.slice(0, MAX_RIDES);

      // If fewer than 5 rides, fetch random rides
      if (finalRides.length < MAX_RIDES && isMountedRef.current) {
        const remaining = MAX_RIDES - finalRides.length;
        const randomQuery = query(
          ridesRef,
          where('status', '==', 'available'),
          limit(remaining)
        );
        const randomSnapshot = await getDocs(randomQuery);
        const randomRidesData = randomSnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as RideData))
          .filter(ride => !finalRides.some(r => r.id === ride.id));
        console.log('Random rides fetched:', randomRidesData.length, 'Data:', JSON.stringify(randomRidesData, null, 2));
        const randomRidesWithDriver = await getRidesWithDriverData(randomRidesData);
        const randomRides = randomRidesWithDriver.map(ride => ({
          ...ride,
          distance: userLocation ? calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            ride.origin_latitude,
            ride.origin_longitude
          ) : undefined,
          priority: 0,
        }));
        finalRides = [...finalRides, ...randomRides].slice(0, MAX_RIDES);
      }

      if (isMountedRef.current) {
        console.log('Final rides:', finalRides.length, 'Data:', JSON.stringify(finalRides, null, 2));
        setRides(finalRides);
        if (finalRides.length) {
          await cacheSuggestedRides(user.id, finalRides);
        }
      }
    } catch (err) {
      console.error('Error fetching rides:', err);
      if (isMountedRef.current) {
        setError(language === 'ar' ? 'فشل في تحميل الرحلات. تحقق من الاتصال وFirestore.' : 'Failed to load rides. Check connection and Firestore.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        hasFetchedRef.current = true;
      }
    }
  }, [user?.id, userLocation, preferredLocations, language, t]);

  const getRidesWithDriverData = async (rides: RideData[]): Promise<Ride[]> => {
    const driverIds = new Set(rides
      .map(ride => ride.driver_id)
      .filter((id): id is string => id !== undefined && id !== null)
    );

    const driverDataMap: { [key: string]: UserData } = {};
    for (const driverId of driverIds) {
      try {
        const driverDoc = await getDoc(doc(db, 'users', driverId));
        if (driverDoc.exists()) {
          driverDataMap[driverId] = driverDoc.data() as UserData;
        }
      } catch (err) {
        console.error(`Error fetching driver ${driverId}:`, err);
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
        status: ride.status || 'unknown',
        available_seats: ride.available_seats ?? 0,
        origin_latitude: ride.origin_latitude || 0,
        origin_longitude: ride.origin_longitude || 0,
        recurring: ride.recurring || false,
        ride_days: ride.ride_days || [],
        waypoints: ride.waypoints || [],
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
    console.log('useEffect running, hasFetched:', hasFetchedRef.current);
    if ((!hasFetchedRef.current || refreshKey !== undefined) && isMountedRef.current) {
      hasFetchedRef.current = false;
      fetchRides();
    }
  }, [fetchRides, refreshKey]);

  const renderRideCard = useMemo(() => {
    return ({ item }: { item: Ride }) => {
      const [date, time] = item.ride_datetime.split(' ') || ['Unknown Date', 'Unknown Time'];
      const formattedTime = time.includes(':') ? formatTimeTo12Hour(time) : time;

      return (
        <TouchableOpacity
          onPress={() => router.push(`/ride-details/${item.id}`)}
          className="bg-white p-4 rounded-2xl mb-3 mx-2"
          style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
        >
          <View className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'}`}>
            <View className={`px-2 py-1 rounded-full ${item.recurring ? 'bg-blue-50' : 'bg-green-50'}`}>
              <Text className={`text-xs font-CairoMedium ${item.recurring ? 'text-blue-600' : 'text-green-600'}`}>
                {item.recurring ? (language === 'ar' ? 'متكرر' : 'Recurring') : (language === 'ar' ? 'متاح' : t.available)}
              </Text>
            </View>
          </View>

          <View className={`flex-row items-center mb-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <Image 
              source={item.driver?.profile_image_url ? { uri: item.driver.profile_image_url } : icons.profile} 
              className={`w-10 h-10 rounded-full ${language === 'ar' ? 'ml-3' : 'mr-3'}`}
            />
            <View className={language === 'ar' ? 'items-end' : 'items-start'}>
              <Text className={`text-base font-CairoBold ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {item.driver?.name || DEFAULT_DRIVER_NAME}
              </Text>
              <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {item.driver?.car_type || DEFAULT_CAR_TYPE}
              </Text>
            </View>
          </View>

          <View className={`flex-row items-start mb-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <View className="flex-1">
              <View className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Image source={icons.point} className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoBold ml-2' : 'mr-2'}`}>
                  {language === 'ar' ? 'من' : 'From'}:
                </Text>
                <Text className={`text-base font-CairoMedium flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                  {item.origin_address}
                </Text>
              </View>
              {item.waypoints && item.waypoints.length > 0 && item.waypoints.map((waypoint, index) => (
                <View key={index} className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Image source={icons.point} className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                  <Text className={`text-sm text-gray-500 ${language === 'ar' ? ' font-CairoBold ml-2' : 'mr-2'}`}>
                    {language === 'ar' ? 'محطة' : 'Stop'} {index + 1}:
                  </Text>
                  <Text className={`text-base font-CairoMedium flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                    {waypoint.address}
                  </Text>
                </View>
              ))}
              <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Image source={icons.target} className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoBold ml-2' : 'mr-2'}`}>
                  {language === 'ar' ? 'إلى' : 'To'}:
                </Text>
                <Text className={`text-base font-CairoMedium flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                  {item.destination_address}
                </Text>
              </View>
            </View>
          </View>

          <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.calendar} className={`w-4 h-4 mb-1 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <View >
                <Text className={`text-sm pt-5 text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {date}
                </Text>
                <Text className={`text-sm mt-1 font-CairoBold text-red-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {item.ride_days && item.ride_days.length > 0 ? 
                    item.ride_days.map(day => {
                      const dayTranslations: { [key: string]: string } = {
                        'Monday': 'الإثنين',
                        'Tuesday': 'الثلاثاء',
                        'Wednesday': 'الأربعاء',
                        'Thursday': 'الخميس',
                        'Friday': 'الجمعة',
                        'Saturday': 'السبت',
                        'Sunday': 'الأحد'
                      };
                      return dayTranslations[day] || day;
                    }).join('، ') :
                    (() => {
                      const rideDate = new Date(item.ride_datetime);
                      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                      return days[rideDate.getDay()];
                    })()
                  }
                </Text>
              </View>
            </View>
            <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.clock} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {formattedTime}
              </Text>
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
    };
  }, [language, t]);

  if (loading) {
    return (
      <View className="items-center justify-center py-8">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="items-center justify-center py-8">
        <Text className={`text-sm text-red-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{error}</Text>
        <TouchableOpacity onPress={() => { hasFetchedRef.current = false; fetchRides(); }} className="mt-4">
          <Text className="text-blue-500">{language === 'ar' ? 'إعادة المحاولة' : t.retry}</Text>
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
          extraData={language}
        />
      ) : (
        <View className="items-center justify-center py-8">
          <Image source={images.noResult} className="w-40 h-40" resizeMode="contain" />
          <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'لا توجد رحلات متاحة حاليًا' : t.noRidesAvailable}
          </Text>
          <TouchableOpacity onPress={() => { hasFetchedRef.current = false; fetchRides(); }} className="mt-4">
            <Text className="text-blue-500">{language === 'ar' ? 'إعادة المحاولة' : t.retry}</Text>
          </TouchableOpacity>
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