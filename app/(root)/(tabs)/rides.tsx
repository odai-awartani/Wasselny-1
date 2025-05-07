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

interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
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

      const passengerRides: RideWithRequests[] = await Promise.all(
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
          };
        })
      );

      const validPassengerRides = passengerRides.filter((ride): ride is RideWithRequests => ride !== null);
      console.log('Processed passenger rides:', validPassengerRides.length, 'Data:', JSON.stringify(validPassengerRides, null, 2));

      const allRides = [...driverRides, ...validPassengerRides];

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

      // Format ride_days for display
      const formattedRideDays = item.ride_days?.length
        ? item.ride_days.map(day => dayTranslations[day] || day).join('، ')
        : 'الأيام غير محددة';

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
                className={`text-xs font-CairoMedium ${
                  item.status === 'available' ? 'text-[#1E8E3E]' :
                  item.status === 'pending' ? 'text-[#E65100]' :
                  item.status === 'completed' ? 'text-[#1A73E8]' :
                  'text-[#D93025]'
                }`}
              >
                {item.status === 'available' ? 'متاح' :
                 item.status === 'pending' ? 'قيد الانتظار' :
                 item.status === 'completed' ? 'مكتمل' :
                 'منتهي'}
              </Text>
            </View>

            <View className="p-4">
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3">
                  <Image source={icons.pin} className="w-5 h-5" resizeMode="contain" />
                </View>
                <Text className="flex-1 text-base font-CairoMedium" numberOfLines={1}>
                  {item.origin_address}
                </Text>
              </View>

              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-3">
                  <Image source={icons.map} className="w-5 h-5" />
                </View>
                <Text className="flex-1 text-base font-CairoMedium" numberOfLines={1}>
                  {item.destination_address}
                </Text>
              </View>

              <View className="flex-row justify-between items-center mb-3">
                <View className="flex-row items-center">
                  <Image source={icons.clock} className="w-4 h-4 mr-2" />
                  <Text className="text-sm text-gray-500 font-CairoMedium">{formatTime(item.ride_datetime)}</Text>
                </View>
                <View className="flex-row items-center">
                  <Image source={icons.calendar} className="w-4 h-4 mr-2" />
                  <Text className="text-sm text-gray-500 font-CairoMedium">{formatDate(item.ride_datetime)}</Text>
                </View>
              </View>

              <View className="flex-row items-center mb-3">
                <Image source={icons.person} className="w-4 h-4 mr-2" />
                <Text className="text-sm text-gray-500 font-CairoMedium">{item.available_seats} مقاعد متاحة</Text>
              </View>

              {item.is_recurring && (
                <View className="flex-row items-center mb-3">
                  <Image source={icons.repeat} tintColor="#333333" className="w-4 h-4 mr-2" />
                  <Text className="text-sm text-gray-500 font-CairoMedium">
                    متكرر: أسبوعي يوم {formattedRideDays}
                  </Text>
                </View>
              )}

              {item.driver && (
                <View className="mt-4 flex-row items-center border-t border-gray-100 pt-4">
                  <Image source={{ uri: item.driver.profile_image_url }} className="w-10 h-10 rounded-full mr-3" />
                  <View>
                    <Text className="text-sm font-CairoBold">{item.driver.name}</Text>
                    <Text className="text-xs text-gray-500 font-CairoMedium">
                      {item.driver_id === userId ? 'أنت السائق' : 'السائق'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [router, userId]
  );

  const renderEmptyState = useCallback(
    () => (
      <View className="flex-1 justify-center items-center p-8">
        <MaterialIcons name="directions-car" size={64} color="#EA580C" />
        <Text className="text-xl font-CairoBold text-gray-900 mt-4">
          {activeTab === 'upcoming' ? 'لا توجد رحلات قادمة' : 'لا توجد رحلات سابقة'}
        </Text>
        <Text className="text-gray-600 text-center mt-2">
          {activeTab === 'upcoming' ? 'ستظهر رحلاتك القادمة هنا' : 'ستظهر رحلاتك السابقة هنا'}
        </Text>
      </View>
    ),
    [activeTab]
  );

  const renderSectionHeader = useCallback(
    ({ section: { title } }: { section: { title: string } }) => (
      <View className="bg-gray-100 px-4 py-2">
        <Text className="text-lg font-CairoBold text-gray-900">{title}</Text>
      </View>
    ),
    []
  );

  const pastRidesSections = useMemo(() => {
    const sections = [];
    if (pastDriverRides.length > 0) {
      sections.push({
        title: 'الرحلات التي قمت بقيادتها',
        data: pastDriverRides,
      });
    }
    if (pastPassengerRides.length > 0) {
      sections.push({
        title: 'الرحلات التي انضممت إليها',
        data: pastPassengerRides,
      });
    }
    return sections;
  }, [pastDriverRides, pastPassengerRides]);

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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            statusFilter === 'all' ? 'text-white' : 'text-gray-700'
          }`}>
            الكل
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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            statusFilter === 'available' ? 'text-white' : 'text-gray-700'
          }`}>
            متاح
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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            statusFilter === 'pending' ? 'text-white' : 'text-gray-700'
          }`}>
            قيد الانتظار
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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            statusFilter === 'completed' ? 'text-white' : 'text-gray-700'
          }`}>
            مكتمل
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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            statusFilter === 'cancelled' ? 'text-white' : 'text-gray-700'
          }`}>
            ملغي
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            rideTypeFilter === 'all' ? 'text-white' : 'text-gray-700'
          }`}>
            كل الرحلات
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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            rideTypeFilter === 'created' ? 'text-white' : 'text-gray-700'
          }`}>
            رحلاتي
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
          <Text className={`text-sm font-CairoMedium mr-1 ${
            rideTypeFilter === 'registered' ? 'text-white' : 'text-gray-700'
          }`}>
            رحلات مسجلة
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

  return (
    <SafeAreaView className="bg-general-500 flex-1">
      <Header pageTitle="رحلاتي" />

      <View className="flex-row justify-around items-center px-4 py-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setActiveTab('upcoming')}
          className={`flex-1 items-center py-3 ${activeTab === 'upcoming' ? 'border-b-2 border-orange-500' : ''}`}
        >
          <Text className={`font-CairoBold ${activeTab === 'upcoming' ? 'text-orange-500' : 'text-gray-500'}`}>
            القادمة
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('past')}
          className={`flex-1 items-center py-3 ${activeTab === 'past' ? 'border-b-2 border-orange-500' : ''}`}
        >
          <Text className={`font-CairoBold ${activeTab === 'past' ? 'text-orange-500' : 'text-gray-500'}`}>
            السابقة
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