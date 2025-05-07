import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

interface Ride {
  id: string;
  status: string;
  price?: number;
  rating?: number;
  origin?: {
    address?: string;
  };
  destination?: {
    address?: string;
  };
  createdAt: string;
}

interface UserDetails {
  id: string;
  name: string;
  email: string;
  role: string;
  profile_image_url?: string;
  phoneNumber?: string;
  driver?: {
    status: string;
    is_active: boolean;
    license_number?: string;
    vehicle_details?: {
      model?: string;
      color?: string;
      plate_number?: string;
    };
  };
  createdAt: string;
  totalRides?: number;
  averageRating?: number;
  totalEarnings?: number;
}

const UserDetails = () => {
  const { userId } = useLocalSearchParams();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [recentRides, setRecentRides] = useState<Ride[]>([]);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const userRef = doc(db, 'users', userId as string);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          Alert.alert('Error', 'User not found');
          router.back();
          return;
        }

        const userData = userSnap.data();
        setUserDetails({
          id: userSnap.id,
          name: userData.name || '',
          email: userData.email || '',
          profile_image_url: userData.profile_image_url || '',
          role: userData.role || 'passenger',
          phoneNumber: userData.phoneNumber || '',
          driver: userData.driver ? {
            status: userData.driver.status || 'pending',
            is_active: userData.driver.is_active || false,
            license_number: userData.driver.license_number || '',
            vehicle_details: userData.driver.vehicle_details || {}
          } : undefined,
          createdAt: userData.createdAt || new Date().toISOString()
        });

        // Fetch user's rides
        const ridesQuery = query(
          collection(db, 'rides'),
          where(userData.driver ? 'driverId' : 'passengerId', '==', userId)
        );

        const unsubscribe = onSnapshot(ridesQuery, (snapshot) => {
          const rides = snapshot.docs.map(doc => ({
            id: doc.id,
            status: doc.data().status || 'pending',
            price: doc.data().price || 0,
            rating: doc.data().rating || 0,
            origin: doc.data().origin || {},
            destination: doc.data().destination || {},
            createdAt: doc.data().createdAt || new Date().toISOString()
          })) as Ride[];

          // Calculate statistics
          const completedRides = rides.filter(ride => ride.status === 'completed');
          const totalEarnings = completedRides.reduce((sum, ride) => sum + (ride.price || 0), 0);
          const totalRatings = completedRides.reduce((sum, ride) => sum + (ride.rating || 0), 0);
          const averageRating = completedRides.length > 0 ? totalRatings / completedRides.length : 0;

          setUserDetails(prev => prev ? {
            ...prev,
            totalRides: rides.length,
            totalEarnings,
            averageRating
          } : null);

          setRecentRides(rides.slice(0, 5)); // Get 5 most recent rides
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error fetching user details:', error);
        Alert.alert('Error', 'Failed to fetch user details');
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [userId]);

  const handleStatusChange = async (newStatus: boolean) => {
    if (!userDetails?.driver) return;

    try {
      const userRef = doc(db, 'users', userId as string);
      await updateDoc(userRef, {
        'driver.is_active': newStatus
      });
      Alert.alert('Success', `Driver status updated to ${newStatus ? 'active' : 'inactive'}`);
    } catch (error) {
      console.error('Error updating driver status:', error);
      Alert.alert('Error', 'Failed to update driver status');
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-gray-600 mt-4">Loading user details...</Text>
      </SafeAreaView>
    );
  }

  if (!userDetails) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-600">User not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="bg-white p-4">
          <View className="flex-row items-center justify-between mb-4">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="bg-gray-100 p-2 rounded-full"
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-xl font-bold">User Details</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Profile Section */}
          <View className="items-center mb-6">
            {userDetails.profile_image_url ? (
              <Image 
                source={{ uri: userDetails.profile_image_url }}
                className="w-24 h-24 rounded-full mb-4"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-gray-200 items-center justify-center mb-4">
                <MaterialCommunityIcons name="account" size={48} color="#6B7280" />
              </View>
            )}
            <Text className="text-2xl font-bold mb-1">{userDetails.name}</Text>
            <Text className="text-gray-600 mb-2">{userDetails.email}</Text>
            <View className="flex-row">
              <View className={`px-3 py-1 rounded-full mr-2 ${userDetails.role === 'admin' ? 'bg-purple-100' : userDetails.driver ? 'bg-green-100' : 'bg-blue-100'}`}>
                <Text className={`${userDetails.role === 'admin' ? 'text-purple-700' : userDetails.driver ? 'text-green-700' : 'text-blue-700'}`}>
                  {userDetails.role === 'admin' ? 'Admin' : userDetails.driver ? 'Driver' : 'Passenger'}
                </Text>
              </View>
              {userDetails.driver && (
                <View className={`px-3 py-1 rounded-full ${userDetails.driver.is_active ? 'bg-green-100' : 'bg-yellow-100'}`}>
                  <Text className={userDetails.driver.is_active ? 'text-green-700' : 'text-yellow-700'}>
                    {userDetails.driver.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Statistics */}
          <View className="flex-row justify-between mb-6">
            <View className="flex-1 bg-white rounded-xl p-4 mr-2 shadow-sm">
              <Text className="text-gray-600 mb-1">Total Rides</Text>
              <Text className="text-2xl font-bold">{userDetails.totalRides || 0}</Text>
            </View>
            <View className="flex-1 bg-white rounded-xl p-4 mx-2 shadow-sm">
              <Text className="text-gray-600 mb-1">Rating</Text>
              <Text className="text-2xl font-bold">{userDetails.averageRating?.toFixed(1) || '0.0'}</Text>
            </View>
            {userDetails.driver && (
              <View className="flex-1 bg-white rounded-xl p-4 ml-2 shadow-sm">
                <Text className="text-gray-600 mb-1">Earnings</Text>
                <Text className="text-2xl font-bold">${userDetails.totalEarnings?.toFixed(2) || '0.00'}</Text>
              </View>
            )}
          </View>

          {/* Driver Details */}
          {userDetails.driver && (
            <View className="bg-white rounded-xl p-4 mb-6 shadow-sm">
              <Text className="text-lg font-bold mb-4">Driver Information</Text>
              <View className="space-y-3">
                <View>
                  <Text className="text-gray-600">License Number</Text>
                  <Text className="text-lg">{userDetails.driver.license_number || 'Not provided'}</Text>
                </View>
                {userDetails.driver.vehicle_details && (
                  <>
                    <View>
                      <Text className="text-gray-600">Vehicle Model</Text>
                      <Text className="text-lg">{userDetails.driver.vehicle_details.model || 'Not provided'}</Text>
                    </View>
                    <View>
                      <Text className="text-gray-600">Vehicle Color</Text>
                      <Text className="text-lg">{userDetails.driver.vehicle_details.color || 'Not provided'}</Text>
                    </View>
                    <View>
                      <Text className="text-gray-600">Plate Number</Text>
                      <Text className="text-lg">{userDetails.driver.vehicle_details.plate_number || 'Not provided'}</Text>
                    </View>
                  </>
                )}
                <TouchableOpacity
                  onPress={() => handleStatusChange(!userDetails.driver?.is_active)}
                  className={`mt-4 py-2 px-4 rounded-full ${userDetails.driver.is_active ? 'bg-red-100' : 'bg-green-100'}`}
                >
                  <Text className={`text-center ${userDetails.driver.is_active ? 'text-red-700' : 'text-green-700'}`}>
                    {userDetails.driver.is_active ? 'Deactivate Driver' : 'Activate Driver'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Recent Rides */}
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-lg font-bold mb-4">Recent Rides</Text>
            {recentRides.length > 0 ? (
              recentRides.map(ride => (
                <TouchableOpacity
                  key={ride.id}
                  onPress={() => router.push({
                    pathname: '/(root)/admin/rideDetails',
                    params: { rideId: ride.id }
                  } as any)}
                  className="flex-row justify-between items-center py-3 border-b border-gray-100"
                >
                  <View className="flex-1">
                    <Text className="font-medium">
                      {ride.origin?.address || 'Unknown origin'} → {ride.destination?.address || 'Unknown destination'}
                    </Text>
                    <Text className="text-gray-600">
                      {new Date(ride.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View className={`px-2 py-1 rounded-full ${
                    ride.status === 'completed' ? 'bg-green-100' :
                    ride.status === 'cancelled' ? 'bg-red-100' :
                    'bg-yellow-100'
                  }`}>
                    <Text className={`text-sm ${
                      ride.status === 'completed' ? 'text-green-700' :
                      ride.status === 'cancelled' ? 'text-red-700' :
                      'text-yellow-700'
                    }`}>
                      {ride.status.charAt(0).toUpperCase() + ride.status.slice(1)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text className="text-gray-600 text-center py-4">No rides found</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default UserDetails; 