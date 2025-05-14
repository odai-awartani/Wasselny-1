import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Image, SectionList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { useAuth } from '@clerk/clerk-expo';
import { formatTime, formatDate } from '@/lib/utils';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import Header from '@/components/Header';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from '@/constants';
import { useLanguage } from '@/context/LanguageContext';

interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
  origin_street?: string;
  destination_street?: string;
  ride_datetime: string;
  status: string;
  driver_id: string;
  available_seats: number;
  fare_price: number;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  created_at: Date;
  updated_at: Date;
  is_recurring: boolean;
  no_children: boolean;
  no_music: boolean;
  no_smoking: boolean;
  required_gender: string;
  ride_days: string[];
  ride_number: number;
  user_id: string;
  driver?: {
    name: string;
    profile_image_url: string;
  };
  waypoints?: Array<{
    address: string;
    street?: string;
    latitude: number;
    longitude: number;
  }>;
}

interface RideWithRequests extends Ride {
  requests?: {
    id: string;
    status: string;
    user_id: string;
    user_name?: string;
    user_image?: string;
  }[];
}

interface CachedData {
  upcomingRides: RideWithRequests[];
  pastDriverRides: RideWithRequests[];
  pastPassengerRides: RideWithRequests[];
  timestamp: number;
}

export default function Rides() {
  const router = useRouter();
  const { userId } = useAuth();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [isDriver, setIsDriver] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [upcomingRides, setUpcomingRides] = useState<RideWithRequests[]>([]);
  const [pastDriverRides, setPastDriverRides] = useState<RideWithRequests[]>([]);
  const [pastPassengerRides, setPastPassengerRides] = useState<RideWithRequests[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'pending' | 'completed' | 'cancelled'>('all');
  const [rideTypeFilter, setRideTypeFilter] = useState<'all' | 'created' | 'registered'>('all');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const { t, language } = useLanguage();

  // Cache helper functions
  const cacheRidesData = async (data: CachedData) => {
    try {
      await AsyncStorage.setItem(`rides_${userId}`, JSON.stringify({ ...data, timestamp: Date.now() }));
    } catch (err) {
      console.error('Error caching rides data:', err);
    }
  };

  const getCachedRidesData = async (): Promise<CachedData | null> => {
    try {
      const cached = await AsyncStorage.getItem(`rides_${userId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          return parsed;
        }
      }
      return null;
    } catch (err) {
      console.error('Error retrieving cached rides data:', err);
      return null;
    }
  };

  const clearCache = async () => {
    try {
      await AsyncStorage.removeItem(`rides_${userId}`);
    } catch (err) {
      console.error('Error clearing cache:', err);
    }
  };

  // Check if user is a driver
  const checkIfUserIsDriver = useCallback(async () => {
    if (!userId) {
      console.log('No user ID found');
      return;
    }
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const isActiveDriver = userData.driver?.is_active === true;
        setIsDriver(isActiveDriver);
        console.log('Driver status:', isActiveDriver);
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
    }
  }, [userId]);

  // Parse ride_datetime safely
  const parseRideDateTime = (ride_datetime: string): Date | null => {
    try {
      if (ride_datetime.includes('T')) {
        const date = new Date(ride_datetime);
        return isNaN(date.getTime()) ? null : date;
      }
      const [datePart, timePart] = ride_datetime.split(' ');
      if (datePart && timePart) {
        const [day, month, year] = datePart.split('/').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        const date = new Date(year, month - 1, day, hours, minutes);
        return isNaN(date.getTime()) ? null : date;
      }
      return null;
    } catch (error) {
      console.error(`Error parsing ride_datetime: ${ride_datetime}`, error);
      return null;
    }
  };

  // Format time with AM/PM
  const formatTimeWithPeriod = (dateTimeString: string): string => {
    const date = parseRideDateTime(dateTimeString);
    if (!date) return '';
    
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    // Standard format: 9:30
    let timeStr = `${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${formattedMinutes}`;
    
    // Add period indicator based on language
    if (language === 'ar') {
      timeStr += hours >= 12 ? ' م' : ' ص'; // Arabic: ص for AM, م for PM
    } else {
      timeStr += hours >= 12 ? ' PM' : ' AM'; // English: AM/PM
    }
    
    return timeStr;
  };
  
  // Format date with month name
  const formatDateWithMonth = (dateTimeString: string): string => {
    const date = parseRideDateTime(dateTimeString);
    if (!date) return '';
    
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    
    // Month names in Arabic and English
    const arabicMonths = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    const englishMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Format based on language
    if (language === 'ar') {
      return `${day} ${arabicMonths[month]} ${year}`;
    } else {
      return `${day} ${englishMonths[month]} ${year}`;
    }
  };

  // Fetch rides (driver and passenger)
  const fetchRides = useCallback(async () => {
    if (!userId) {
      console.log('No userId provided');
      return;
    }

    setLoading(true);
    try {
      await clearCache();

      const now = new Date();
      const ridesRef = collection(db, 'rides');
      const rideRequestsRef = collection(db, 'ride_requests');

      const driverRidesQuery = query(
        ridesRef,
        where('driver_id', '==', userId),
        orderBy('ride_datetime', 'desc'),
        limit(20)
      );

      const passengerRequestsQuery = query(
        rideRequestsRef,
        where('user_id', '==', userId),
        where('status', 'in', ['accepted', 'checked_in', 'checked_out']),
        limit(20)
      );

      const [driverRidesSnapshot, passengerRequestsSnapshot] = await Promise.all([
        getDocs(driverRidesQuery),
        getDocs(passengerRequestsQuery)
      ]);

      console.log('Driver rides fetched:', driverRidesSnapshot.size);
      console.log('Passenger requests fetched:', passengerRequestsSnapshot.size);

      const driverRides: RideWithRequests[] = await Promise.all(
        driverRidesSnapshot.docs.map(async (rideDoc) => {
          const rideData = rideDoc.data() as Ride;
          const rideId = rideDoc.id;

          const requestsQuery = query(
            rideRequestsRef,
            where('ride_id', '==', rideId),
            where('status', 'in', ['waiting', 'accepted', 'checked_in', 'checked_out'])
          );
          const requestsSnapshot = await getDocs(requestsQuery);

          const requests = await Promise.all(
            requestsSnapshot.docs.map(async (requestDoc) => {
              const requestData = requestDoc.data();
              const userDoc = await getDoc(doc(db, 'users', requestData.user_id));
              const userData = userDoc.data();
              return {
                id: requestDoc.id,
                status: requestData.status,
                user_id: requestData.user_id,
                user_name: userData?.name,
                user_image: userData?.profile_image_url,
              };
            })
          );

          return {
            ...rideData,
            id: rideId,
            requests,
            created_at: rideData.created_at instanceof Date ? rideData.created_at : new Date(rideData.created_at),
            updated_at: rideData.updated_at instanceof Date ? rideData.updated_at : new Date(rideData.updated_at),
            is_recurring: rideData.is_recurring || false,
          };
        })
      );

      console.log('Processed driver rides:', driverRides.length, 'Data:', JSON.stringify(driverRides, null, 2));

      const passengerRideIds = passengerRequestsSnapshot.docs.map((doc) => doc.data().ride_id);
      const uniqueRideIds = [...new Set(passengerRideIds)];

      // Fetch passenger rides and filter out null values
      const passengerRidesWithNulls = await Promise.all(
        uniqueRideIds.map(async (rideId) => {
          const rideDoc = await getDoc(doc(db, 'rides', rideId));
          if (!rideDoc.exists()) return null;

          const rideData = rideDoc.data() as Ride;
          const driverDoc = await getDoc(doc(db, 'users', rideData.driver_id));
          const driverData = driverDoc.data();

          return {
            ...rideData,
            id: rideId,
            driver: {
              name: driverData?.name || 'Unknown Driver',
              profile_image_url: driverData?.profile_image_url || 'https://via.placeholder.com/40',
            },
            requests: [],
            created_at: rideData.created_at instanceof Date ? rideData.created_at : new Date(rideData.created_at),
            updated_at: rideData.updated_at instanceof Date ? rideData.updated_at : new Date(rideData.updated_at),
            is_recurring: rideData.is_recurring || false,
            waypoints: rideData.waypoints || [],
          };
        })
      );

      // Filter out null values to satisfy TypeScript
      const passengerRides: RideWithRequests[] = passengerRidesWithNulls.filter((ride): ride is RideWithRequests => ride !== null);

      console.log('Processed passenger rides:', passengerRides.length, 'Data:', JSON.stringify(passengerRides, null, 2));

      const allRides = [...driverRides, ...passengerRides];

      const upcoming = allRides.filter((ride) => {
        if (ride.is_recurring) {
          console.log(`Recurring ride included: ${ride.id}, ride_datetime: ${ride.ride_datetime}`);
          return true;
        }
        const rideDate = parseRideDateTime(ride.ride_datetime);
        if (!rideDate) {
          console.log(`Invalid ride_datetime for ride ${ride.id}: ${ride.ride_datetime}`);
          return false;
        }
        return rideDate > now;
      });

      const past = allRides.filter((ride) => {
        if (ride.is_recurring) return false;
        const rideDate = parseRideDateTime(ride.ride_datetime);
        if (!rideDate) return false;
        return rideDate <= now;
      });

      const pastDriver = past.filter((ride) => ride.driver_id === userId);
      const pastPassenger = past.filter((ride) => ride.driver_id !== userId);

      console.log('Upcoming rides:', upcoming.length, 'Data:', JSON.stringify(upcoming, null, 2));
      console.log('Past driver rides:', pastDriver.length);
      console.log('Past passenger rides:', pastPassenger.length);

      setUpcomingRides(upcoming);
      setPastDriverRides(pastDriver);
      setPastPassengerRides(pastPassenger);

      await cacheRidesData({
        upcomingRides: upcoming,
        pastDriverRides: pastDriver,
        pastPassengerRides: pastPassenger,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await clearCache();
    await Promise.all([checkIfUserIsDriver(), fetchRides()]);
    setRefreshing(false);
  }, [checkIfUserIsDriver, fetchRides]);

  const renderRideCard = useCallback(
    ({ item }: { item: RideWithRequests }) => {
      // Translate English days to Arabic
      const dayTranslations: { [key: string]: string } = {
        Monday: 'الإثنين',
        Tuesday: 'الثلاثاء',
        Wednesday: 'الأربعاء',
        Thursday: 'الخميس',
        Friday: 'الجمعة',
        Saturday: 'السبت',
        Sunday: 'الأحد',
      };

      // English day names
      const englishDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      // Arabic day names
      const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

      // Format ride_days for display
      const formattedRideDays = item.ride_days?.length
        ? language === 'ar' 
          ? item.ride_days.map(day => dayTranslations[day] || day).join('، ')
          : item.ride_days.join(', ')
        : t.daysNotSpecified;

      // Get status text based on language
      const getStatusText = (status: string) => {
        if (language === 'ar') {
          switch(status) {
            case 'available': return 'متاح';
            case 'pending': return 'قيد الانتظار';
            case 'completed': return 'مكتمل';
            default: return 'منتهي';
          }
        } else {
          switch(status) {
            case 'available': return 'Available';
            case 'pending': return 'Pending';
            case 'completed': return 'Completed';
            default: return 'Ended';
          }
        }
      };

      return (
        <TouchableOpacity
          onPress={() => {
            if (Platform.OS === 'android') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            router.push({
              pathname: '/(root)/ride-details/[id]',
              params: { id: item.id },
            });
          }}
          className="mb-4 mx-4"
        >
          <LinearGradient
            colors={['#FFFFFF', '#F8F8F8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-2xl shadow-sm overflow-hidden"
          >
            <View
              className={`absolute top-4 right-4 px-3 py-1 rounded-full ${
                item.status === 'available' ? 'bg-[#E6F4EA]' :
                item.status === 'pending' ? 'bg-[#FFF3E0]' :
                item.status === 'completed' ? 'bg-[#E8F0FE]' :
                'bg-[#FCE8E6]'
              }`}
            >
              <Text
                className={`text-xs ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${
                  item.status === 'available' ? 'text-[#1E8E3E]' :
                  item.status === 'pending' ? 'text-[#E65100]' :
                  item.status === 'completed' ? 'text-[#1A73E8]' :
                  'text-[#D93025]'
                }`}
              >
                {getStatusText(item.status)}
              </Text>
            </View>

            <View className="p-4">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3">
                  <Image source={icons.pin} className="w-5 h-5" resizeMode="contain" />
                </View>
                <View className="flex-1">
                  <Text className={`text-base ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                    {item.origin_address}
                  </Text>
                  {item.origin_street && (
                    <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'} mt-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                      {item.origin_street}
                    </Text>
                  )}
                </View>
              </View>

              {/* Add waypoints display */}
              {item.waypoints && item.waypoints.length > 0 && (
                item.waypoints.map((waypoint, index) => (
                  <View key={index} className="flex-row items-center mb-4">
                    <View className="w-8 h-8 rounded-full items-center justify-center mr-3">
                      <Image source={icons.map} className="w-5 h-5" tintColor="#F79824" />
                    </View>
                    <View className="flex-1">
                      <Text className={`text-base ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                        {`${t.stop} ${index + 1}: ${waypoint.address}`}
                      </Text>
                      {waypoint.street && (
                        <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'} mt-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                          {waypoint.street}
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              )}

              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3">
                  <Image source={icons.target} className="w-5 h-5" />
                </View>
                <View className="flex-1">
                  <Text className={`text-base ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                    {item.destination_address}
                  </Text>
                  {item.destination_street && (
                    <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'} mt-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                      {item.destination_street}
                    </Text>
                  )}
                </View>
              </View>

              <View className="flex-row justify-between ml-2 items-center mb-3">
                <View className="flex-row items-center">
                  <Image source={icons.clock} className="w-4 h-4 mr-2" />
                  <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'}`}>
                    {formatTimeWithPeriod(item.ride_datetime)}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Image source={icons.calendar} className="w-4 mb-5 h-4 mr-2" />
                  <View className={`items-${language === 'ar' ? 'end' : 'start'}`}>
                    <Text className={`text-sm text-gray-700 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                      {formatDateWithMonth(item.ride_datetime)}
                    </Text>
                    <View className="flex-row items-center mt-0.5">
                      <Text className={`text-xs text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'}`}>
                        {item.is_recurring ? formattedRideDays : (() => {
                          const date = parseRideDateTime(item.ride_datetime);
                          if (!date) return '';
                          return language === 'ar' ? arabicDays[date.getDay()] : englishDays[date.getDay()];
                        })()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
               
              <View className="flex-row items-center ml-2 justify-between mb-3">
                <View className="flex-row items-center">
                  <Image source={icons.person} className="w-4 h-4 mr-2" />
                  <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'}`}>
                    {`${item.available_seats} ${t.availableSeats}`}
                  </Text>
                </View>
                {item.is_recurring && (
                  <View className="flex-row items-center mt-1">
                    <Text className={`text-xs text-orange-500 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                      {t.recurringTrip}
                    </Text>
                  </View>
                )}
              </View>

              {item.driver && (
                <View className="mt-4 flex-row items-center border-t border-gray-100 pt-4">
                  <Image source={{ uri: item.driver.profile_image_url }} className="w-10 h-10 rounded-full mr-3" />
                  <View>
                    <Text className={`text-sm ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>{item.driver.name}</Text>
                    <Text className={`text-xs text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'}`}>
                      {item.driver_id === userId ? t.youAreTheDriver : t.theDriver}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [router, userId, language]
  );

  const renderEmptyState = useCallback(
    () => (
      <View className="flex-1 justify-center items-center p-8">
        <MaterialIcons name="directions-car" size={64} color="#EA580C" />
        <Text className={`text-xl ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-900 mt-4 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {activeTab === 'upcoming' ? t.noUpcomingRides : t.noPastRides}
        </Text>
        <Text className={`text-gray-600 text-center mt-2 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'}`}>
          {activeTab === 'upcoming' ? t.upcomingRidesWillAppearHere : t.pastRidesWillAppearHere}
        </Text>
      </View>
    ),
    [activeTab, language, t]
  );

  const renderSectionHeader = useCallback(
    ({ section: { title } }: { section: { title: string } }) => (
      <View className="bg-gray-100 px-4 py-2">
        <Text className={`text-lg ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-gray-900 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
          {title === 'الرحلات التي قمت بقيادتها' ? t.ridesYouDrove : t.ridesYouJoined}
        </Text>
      </View>
    ),
    [language, t]
  );

  const pastRidesSections = useMemo(() => {
    const sections = [];
    if (pastDriverRides.length > 0) {
      sections.push({
        title: t.ridesYouDrove,
        data: pastDriverRides,
      });
    }
    if (pastPassengerRides.length > 0) {
      sections.push({
        title: t.ridesYouJoined,
        data: pastPassengerRides,
      });
    }
    return sections;
  }, [pastDriverRides, pastPassengerRides, t]);

  const currentData = useMemo(() => {
    let filteredRides = activeTab === 'upcoming' ? upcomingRides : [];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filteredRides = filteredRides.filter(ride => ride.status === statusFilter);
    }

    // Apply ride type filter
    if (rideTypeFilter !== 'all') {
      filteredRides = filteredRides.filter(ride => {
        if (rideTypeFilter === 'created') {
          return ride.driver_id === userId;
        } else {
          return ride.driver_id !== userId;
        }
      });
    }

    // Sort by date (most recent first)
    return filteredRides.sort((a, b) => {
      const dateA = parseRideDateTime(a.ride_datetime);
      const dateB = parseRideDateTime(b.ride_datetime);
      if (!dateA || !dateB) return 0;
      return dateB.getTime() - dateA.getTime();
    });
  }, [activeTab, upcomingRides, statusFilter, rideTypeFilter, userId]);

  const renderRideTypeFilter = () => (
    <View className="bg-white py-2 border-b border-gray-100">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <TouchableOpacity
          onPress={() => setRideTypeFilter('all')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            rideTypeFilter === 'all' ? 'bg-orange-500' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="directions-car" 
            size={16} 
            color={rideTypeFilter === 'all' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            rideTypeFilter === 'all' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.allRides}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setRideTypeFilter('created')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            rideTypeFilter === 'created' ? 'bg-orange-500' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="person" 
            size={16} 
            color={rideTypeFilter === 'created' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            rideTypeFilter === 'created' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.myRides}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setRideTypeFilter('registered')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            rideTypeFilter === 'registered' ? 'bg-orange-500' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="group" 
            size={16} 
            color={rideTypeFilter === 'registered' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            rideTypeFilter === 'registered' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.registeredRides}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderStatusFilter = () => (
    <View className="bg-white py-3 border-b border-gray-100">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        <TouchableOpacity
          onPress={() => setStatusFilter('all')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            statusFilter === 'all' ? 'bg-orange-500' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="filter-list" 
            size={16} 
            color={statusFilter === 'all' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            statusFilter === 'all' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.all}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStatusFilter('available')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            statusFilter === 'available' ? 'bg-green-500' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="check-circle" 
            size={16} 
            color={statusFilter === 'available' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            statusFilter === 'available' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.available}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStatusFilter('pending')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            statusFilter === 'pending' ? 'bg-orange-400' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="pending" 
            size={16} 
            color={statusFilter === 'pending' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            statusFilter === 'pending' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.pending}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStatusFilter('completed')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            statusFilter === 'completed' ? 'bg-blue-500' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="done-all" 
            size={16} 
            color={statusFilter === 'completed' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            statusFilter === 'completed' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.completed}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setStatusFilter('cancelled')}
          className={`flex-row items-center px-4 py-2 rounded-full mr-3 ${
            statusFilter === 'cancelled' ? 'bg-red-500' : 'bg-gray-100'
          }`}
        >
          <MaterialIcons 
            name="cancel" 
            size={16} 
            color={statusFilter === 'cancelled' ? 'white' : '#374151'} 
          />
          <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} mr-1 ${
            statusFilter === 'cancelled' ? 'text-white' : 'text-gray-700'
          }`}>
            {t.cancelled}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  useEffect(() => {
    checkIfUserIsDriver();
  }, [checkIfUserIsDriver]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (userId) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfileImageUrl(userData.profile_image_url || userData.driver?.profile_image_url || null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [userId]);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header profileImageUrl={profileImageUrl} title={t.Rides} />

      <View className="flex-row justify-around items-center px-4 py-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setActiveTab('upcoming')}
          className={`flex-1 items-center py-3 ${activeTab === 'upcoming' ? 'border-b-2 border-orange-500' : ''}`}
        >
          <Text className={`${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} ${activeTab === 'upcoming' ? 'text-orange-500' : 'text-gray-500'}`}>
            {t.upcoming}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('past')}
          className={`flex-1 items-center py-3 ${activeTab === 'past' ? 'border-b-2 border-orange-500' : ''}`}
        >
          <Text className={`${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} ${activeTab === 'past' ? 'text-orange-500' : 'text-gray-500'}`}>
            {t.past}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'upcoming' && (
        <>
          {renderRideTypeFilter()}
          {renderStatusFilter()}
        </>
      )}

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#F87000" />
        </View>
      ) : activeTab === 'upcoming' ? (
        <FlatList
          data={currentData}
          renderItem={renderRideCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 16, paddingBottom: 100 }}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F87000']} tintColor="#F87000" />
          }
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
        />
      ) : (
        <SectionList
          sections={pastRidesSections}
          renderItem={renderRideCard}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingVertical: 16, paddingBottom: 100 }}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F87000']} tintColor="#F87000" />
          }
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={50}
        />
      )}
    </SafeAreaView>
  );
}