import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

interface UserData {
  name: string;
  phoneNumber: string;
  email: string;
}

interface Ride {
  id: string;
  driver_id?: string;
  status: 'available' | 'full' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled';
  origin_address: string;
  destination_address: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  ride_datetime: string;
  available_seats: number;
  fare_price?: number;
  created_at: any;
  driver?: {
    name: string;
    phoneNumber: string;
    email: string;
  };
}

const RidesManagement = () => {
  const { user } = useUser();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'full' | 'in-progress' | 'completed' | 'on-hold' | 'cancelled'>('all');

  useEffect(() => {
    const fetchRides = async () => {
      try {
        const ridesQuery = query(collection(db, 'rides'));

        const unsubscribe = onSnapshot(ridesQuery, async (snapshot) => {
          const ridesData = await Promise.all(
            snapshot.docs.map(async (docSnapshot) => {
              const rideData = docSnapshot.data();
              const ride = {
                id: docSnapshot.id,
                ...rideData,
                status: rideData.status || 'available',
                fare_price: rideData.fare_price || 0,
                created_at: rideData.created_at || new Date().toISOString()
              } as Ride;

              // Fetch driver details
              if (ride.driver_id) {
                const driverRef = doc(db, 'users', ride.driver_id);
                const driverSnap = await getDoc(driverRef);
                if (driverSnap.exists()) {
                  const driverData = driverSnap.data() as UserData;
                  ride.driver = {
                    name: driverData.name || '',
                    phoneNumber: driverData.phoneNumber || '',
                    email: driverData.email || ''
                  };
                }
              }

              return ride;
            })
          );

          setRides(ridesData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching rides:', error);
        setLoading(false);
      }
    };

    fetchRides();
  }, []);

  const filteredRides = rides.filter(ride => {
    const matchesSearch =
      (ride.driver?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (ride.origin_address?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      (ride.destination_address?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesFilter = filter === 'all' || ride.status === filter;

    return matchesSearch && matchesFilter;
  });

  const handleStatusChange = async (rideId: string, newStatus: Ride['status']) => {
    try {
      const rideRef = doc(db, 'rides', rideId);
      await updateDoc(rideRef, { status: newStatus });
      Alert.alert('Success', 'Ride status updated successfully');
    } catch (error) {
      console.error('Error updating ride status:', error);
      Alert.alert('Error', 'Failed to update ride status');
    }
  };

  const getStatusColor = (status: Ride['status']) => {
    switch (status) {
      case 'in-progress':
        return 'bg-green-100 text-green-700';
      case 'completed':
        return 'bg-blue-100 text-blue-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'full':
        return 'bg-purple-100 text-purple-700';
      case 'on-hold':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const RideCard = ({ ride }: { ride: Ride }) => (
    <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-lg font-bold mb-2">
            {ride.origin_address || 'Unknown origin'} → {ride.destination_address || 'Unknown destination'}
          </Text>
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="account" size={16} color="#6B7280" />
            <Text className="text-gray-600 ml-2">
              Driver: {ride.driver?.name || 'Not assigned'}
            </Text>
          </View>
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="car" size={16} color="#6B7280" />
            <Text className="text-gray-600 ml-2">
              Available Seats: {ride.available_seats}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <View className={`px-2 py-1 rounded-full ${getStatusColor(ride.status)}`}>
              <Text className="text-sm capitalize">{ride.status}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/(root)/admin/rideDetails',
            params: { rideId: ride.id }
          } as any)}
          className="bg-gray-100 p-2 rounded-full"
        >
          <MaterialCommunityIcons name="chevron-right" size={24} color="#6B7280" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-gray-600 mt-4">Loading rides...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4">
      <View className="py-4">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="bg-gray-100 p-2 rounded-full"
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold">Rides Management</Text>
            <View className="w-10" />
          </View>

          {/* Search and Filter */}
          <View className="mb-6">
            <TextInput
              className="bg-white rounded-xl p-4 mb-4 shadow-sm"
              placeholder="Search rides..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row space-x-2">
                <TouchableOpacity
                  onPress={() => setFilter('all')}
                  className={`py-2 px-4 rounded-full ${filter === 'all' ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <Text className={`text-center ${filter === 'all' ? 'text-white' : 'text-gray-600'}`}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilter('available')}
                  className={`py-2 px-4 rounded-full ${filter === 'available' ? 'bg-green-500' : 'bg-gray-200'}`}
                >
                  <Text className={`text-center ${filter === 'available' ? 'text-white' : 'text-gray-600'}`}>Available</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilter('full')}
                  className={`py-2 px-4 rounded-full ${filter === 'full' ? 'bg-purple-500' : 'bg-gray-200'}`}
                >
                  <Text className={`text-center ${filter === 'full' ? 'text-white' : 'text-gray-600'}`}>Full</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilter('in-progress')}
                  className={`py-2 px-4 rounded-full ${filter === 'in-progress' ? 'bg-yellow-500' : 'bg-gray-200'}`}
                >
                  <Text className={`text-center ${filter === 'in-progress' ? 'text-white' : 'text-gray-600'}`}>In Progress</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFilter('completed')}
                  className={`py-2 px-4 rounded-full ${filter === 'completed' ? 'bg-blue-500' : 'bg-gray-200'}`}
                >
                  <Text className={`text-center ${filter === 'completed' ? 'text-white' : 'text-gray-600'}`}>Completed</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Rides List */}
          <View>
            {filteredRides.length === 0 ? (
              <View className="items-center justify-center py-8">
                <Text className="text-gray-500 text-lg">No rides found</Text>
              </View>
            ) : (
              filteredRides.map(ride => (
                <RideCard key={ride.id} ride={ride} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default RidesManagement;