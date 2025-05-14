import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Alert, Share, Modal, TextInput, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { MaterialIcons, Ionicons, Feather, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import Map from '@/components/Map';
import { useLocationStore } from '@/store';
import * as Location from 'expo-location';
import { doc, getDoc, onSnapshot, updateDoc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MapView from 'react-native-maps';

// Type definition for app users
interface AppUser {
  id: string;
  full_name: string;
  email: string;
  profile_image?: string;
}

export default function Track() {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';
  const { user } = useUser();
  const { userLatitude, userLongitude, setUserLocation } = useLocationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState<string>('');
  const [safetyStatus, setSafetyStatus] = useState<'safe' | 'warning' | 'alert'>('safe');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userCurrentLocation, setUserCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  
  // User search and location sharing state
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    fetchUserLocation();
    const fetchActiveRide = async () => {
      if (!user?.id) return;

      try {
        // Get user's active ride
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.active_ride_id) {
            // Listen to ride updates
            const rideRef = doc(db, 'rides', userData.active_ride_id);
            const unsubscribe = onSnapshot(rideRef, (rideDoc) => {
              if (rideDoc.exists()) {
                const rideData = rideDoc.data();
                setActiveRide(rideData);
                
                // Calculate estimated arrival time
                if (rideData.estimated_arrival_time) {
                  const arrivalTime = new Date(rideData.estimated_arrival_time);
                  setEstimatedArrivalTime(arrivalTime.toLocaleTimeString());
                }

                // Update safety status based on ride progress
                if (rideData.status === 'in_progress') {
                  const lastUpdate = new Date(rideData.last_location_update);
                  const now = new Date();
                  const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
                  
                  if (minutesSinceUpdate > 10) {
                    setSafetyStatus('alert');
                  } else if (minutesSinceUpdate > 5) {
                    setSafetyStatus('warning');
                  } else {
                    setSafetyStatus('safe');
                  }
                }
                
                // If there's a driver assigned, listen to their location
                if (rideData.driver_id) {
                  const driverRef = doc(db, 'users', rideData.driver_id);
                  const driverUnsubscribe = onSnapshot(driverRef, (driverDoc) => {
                    if (driverDoc.exists()) {
                      const driverData = driverDoc.data();
                      if (driverData.current_location) {
                        setDriverLocation(driverData.current_location);
                      }
                    }
                  });
                  return () => driverUnsubscribe();
                }
              }
            });
            return () => unsubscribe();
          }
        }
      } catch (error) {
        console.error('Error fetching active ride:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveRide();
    fetchAppUsers();

    // Clean up any tracking intervals when component unmounts
    return () => {
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
    };
  }, [user?.id]);

  // Fetch all app users for sharing
  const fetchAppUsers = async () => {
    if (!user?.id) return;
    
    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      const usersList: AppUser[] = [];
      
      usersSnapshot.forEach(doc => {
        if (doc.id !== user.id) { // Exclude current user
          const userData = doc.data();
          usersList.push({
            id: doc.id,
            full_name: userData.full_name || userData.email,
            email: userData.email,
            profile_image: userData.profile_image
          });
        }
      });
      
      setAppUsers(usersList);
      setFilteredUsers(usersList);
    } catch (error) {
      console.error('Error fetching app users:', error);
    }
  };

  // Filter users based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(appUsers);
    } else {
      const filtered = appUsers.filter(user => 
        user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, appUsers]);

  const fetchUserLocation = async () => {
    try {
      setIsRefreshing(true);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          isRTL ? 'تنبيه الموقع' : 'Location Alert',
          isRTL ? 'لم يتم منح إذن الوصول إلى الموقع' : 'Location permission was not granted'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });
      
      setUserCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      // Update the global location store
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: ''
      });
      
      // Center map on user's location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,  // More zoomed in for better visibility
          longitudeDelta: 0.01
        }, 1000);
      }

      // Update shared location if actively sharing
      if (isLocationSharing && selectedUser && user?.id) {
        updateSharedLocation(location.coords.latitude, location.coords.longitude);
      }
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        isRTL ? 'خطأ في الموقع' : 'Location Error',
        isRTL ? 'حدث خطأ أثناء محاولة الحصول على موقعك' : 'An error occurred while trying to get your location'
      );
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  // Update shared location in Firestore
  const updateSharedLocation = async (latitude: number, longitude: number) => {
    if (!user?.id || !selectedUser) return;
    
    try {
      const locationSharingRef = doc(db, 'location_sharing', `${user.id}_${selectedUser.id}`);
      await setDoc(locationSharingRef, {
        sharer_id: user.id,
        recipient_id: selectedUser.id,
        latitude,
        longitude,
        last_updated: new Date().toISOString(),
        is_active: true
      }, { merge: true });
    } catch (error) {
      console.error('Error updating shared location:', error);
    }
  };

  // Start location sharing with selected user
  const startLocationSharing = async () => {
    if (!selectedUser || !userCurrentLocation || !user?.id) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'لا يمكن مشاركة الموقع، يرجى تحديث موقعك واختيار مستخدم' : 'Cannot share location, please refresh your location and select a user'
      );
      return;
    }

    try {
      // Create initial location sharing record
      await updateSharedLocation(userCurrentLocation.latitude, userCurrentLocation.longitude);
      
      // Set up interval to update location every 30 seconds
      const interval = setInterval(fetchUserLocation, 30000);
      setTrackingInterval(interval);
      setIsLocationSharing(true);
      
      // Notify user
      Alert.alert(
        isRTL ? 'مشاركة الموقع نشطة' : 'Location Sharing Active',
        isRTL ? `أنت الآن تشارك موقعك مع ${selectedUser.full_name}` : `You are now sharing your location with ${selectedUser.full_name}`
      );
      
      // Close modal
      setIsSearchModalVisible(false);
    } catch (error) {
      console.error('Error starting location sharing:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل في بدء مشاركة الموقع' : 'Failed to start location sharing'
      );
    }
  };

  // Stop location sharing
  const stopLocationSharing = async () => {
    if (trackingInterval) {
      clearInterval(trackingInterval);
      setTrackingInterval(null);
    }
    
    setIsLocationSharing(false);
    
    if (user?.id && selectedUser) {
      try {
        const locationSharingRef = doc(db, 'location_sharing', `${user.id}_${selectedUser.id}`);
        await updateDoc(locationSharingRef, {
          is_active: false
        });
        
        setSelectedUser(null);
        
        Alert.alert(
          isRTL ? 'تم إيقاف المشاركة' : 'Sharing Stopped',
          isRTL ? 'تم إيقاف مشاركة الموقع بنجاح' : 'Location sharing has been stopped successfully'
        );
      } catch (error) {
        console.error('Error stopping location sharing:', error);
      }
    }
  };

  const handleShareLocation = () => {
    setIsSearchModalVisible(true);
  };

  const handleEmergencyContact = () => {
    Alert.alert(
      isRTL ? 'اتصال الطوارئ' : 'Emergency Contact',
      isRTL ? 'هل تريد الاتصال بخدمات الطوارئ؟' : 'Do you want to contact emergency services?',
      [
        {
          text: isRTL ? 'اتصل بالطوارئ' : 'Call Emergency',
          onPress: () => {
            // Implement emergency call functionality
            console.log('Emergency call initiated');
          },
          style: 'destructive'
        },
        {
          text: isRTL ? 'إلغاء' : 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  // Render user item in the search list
  const renderUserItem = ({ item }: { item: AppUser }) => (
    <TouchableOpacity 
      className={`flex-row items-center p-3 border-b border-gray-100 ${selectedUser?.id === item.id ? 'bg-orange-50' : ''}`}
      onPress={() => setSelectedUser(item)}
    >
      <View className="w-10 h-10 rounded-full bg-gray-200 justify-center items-center mr-3">
        {item.profile_image ? (
          <Image source={{ uri: item.profile_image }} className="w-10 h-10 rounded-full" />
        ) : (
          <Text className="text-gray-500 font-bold">
            {(item.full_name?.charAt(0) || item.email?.charAt(0) || '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-800">{item.full_name || item.email || 'User'}</Text>
        <Text className="text-gray-500 text-sm">{item.email}</Text>
      </View>
      {selectedUser?.id === item.id && (
        <MaterialIcons name="check-circle" size={24} color="#f97316" />
      )}
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center"
        >
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className={`text-xl ${isRTL ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900`}>
          {isRTL ? 'تتبع الرحلة' : 'Track Ride'}
        </Text>
        <TouchableOpacity
          onPress={handleEmergencyContact}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="alert-circle" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Safety Status Indicator */}
      <View className={`px-4 py-2 ${safetyStatus === 'safe' ? 'bg-green-50' : safetyStatus === 'warning' ? 'bg-yellow-50' : 'bg-red-50'}`}>
        <Text className={`text-center ${isRTL ? 'font-Cairobold' : 'font-Jakartab'} ${safetyStatus === 'safe' ? 'text-green-600' : safetyStatus === 'warning' ? 'text-yellow-600' : 'text-red-600'}`}>
          {safetyStatus === 'safe' ? (isRTL ? 'الرحلة قيد التقدم' : 'Ride in Progress') : 
           safetyStatus === 'warning' ? (isRTL ? 'الرحلة متأخرة' : 'Ride Delayed') : 
           (isRTL ? 'تنبيه الرحلة' : 'Ride Alert')}
        </Text>
      </View>

      {/* Map Container */}
      <View style={{ flex: 1 }}>
        {/* Action Buttons Row */}
        <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-100">
          <Text className={`text-base ${isRTL ? 'font-Cairobold' : 'font-Jakartab'} text-gray-700`}>
            {isLocationSharing 
              ? (isRTL ? `مشاركة مع: ${selectedUser?.full_name}` : `Sharing with: ${selectedUser?.full_name}`)
              : (isRTL ? 'خيارات الموقع' : 'Location Options')}
          </Text>
          <View className="flex-row">
            {/* Refresh Location Button */}
            <TouchableOpacity 
              onPress={fetchUserLocation}
              disabled={isRefreshing}
              className="flex-row items-center bg-orange-50 rounded-full py-2 px-4 mr-2 border border-orange-100"
              style={styles.buttonShadow}
            >
              {isRefreshing ? (
                <ActivityIndicator size="small" color="#f97316" />
              ) : (
                <>
                  <MaterialIcons name="my-location" size={20} color="#f97316" />
                  <Text className={`ml-2 text-orange-500 ${isRTL ? 'font-CairoRegular' : 'font-JakartaRegular'}`}>
                    {isRTL ? 'تحديث' : 'Refresh'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            
            {isLocationSharing ? (
              /* Stop Sharing Button */
              <TouchableOpacity 
                onPress={stopLocationSharing}
                className="flex-row items-center bg-red-50 rounded-full py-2 px-4 border border-red-100"
                style={styles.buttonShadow}
              >
                <MaterialIcons name="location-off" size={20} color="#ef4444" />
                <Text className={`ml-2 text-red-500 ${isRTL ? 'font-CairoRegular' : 'font-JakartaRegular'}`}>
                  {isRTL ? 'إيقاف المشاركة' : 'Stop Sharing'}
                </Text>
              </TouchableOpacity>
            ) : (
              /* Share Location Button */
              <TouchableOpacity 
                onPress={handleShareLocation}
                className="flex-row items-center bg-blue-50 rounded-full py-2 px-4 border border-blue-100"
                style={styles.buttonShadow}
              >
                <MaterialCommunityIcons name="share-variant" size={20} color="#3b82f6" />
                <Text className={`ml-2 text-blue-500 ${isRTL ? 'font-CairoRegular' : 'font-JakartaRegular'}`}>
                  {isRTL ? 'مشاركة' : 'Share'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Map View with proper styling */}
        <View style={styles.mapWrapper}>
          <Map 
            showUserLocation={true}
            showDriverLocation={!!driverLocation}
            driverLocation={driverLocation}
            origin={activeRide?.origin}
            destination={activeRide?.destination}
          />
        </View>
      </View>

      {/* User Search Modal */}
      <Modal
        visible={isSearchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <View className="flex-1 bg-black bg-opacity-50 justify-end">
          <View className="bg-white rounded-t-3xl h-3/4 p-4">
            <View className="flex-row justify-between items-center mb-4">
              <Text className={`text-xl font-bold ${isRTL ? 'text-right' : 'text-left'}`}>
                {isRTL ? 'مشاركة الموقع مع' : 'Share Location With'}
              </Text>
              <TouchableOpacity onPress={() => setIsSearchModalVisible(false)}>
                <AntDesign name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>
            
            {/* Search input */}
            <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2 mb-4">
              <AntDesign name="search1" size={20} color="#9ca3af" />
              <TextInput
                className="flex-1 ml-2 text-gray-800"
                placeholder={isRTL ? "بحث عن مستخدم..." : "Search user..."}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <AntDesign name="close" size={16} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
            
            {/* Users list */}
            <FlatList
              data={filteredUsers}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-8">
                  <Text className="text-gray-500">
                    {isRTL ? 'لم يتم العثور على مستخدمين' : 'No users found'}
                  </Text>
                </View>
              }
              className="mb-4"
            />
            
            {/* Action buttons */}
            <View className="flex-row">
              <TouchableOpacity 
                className={`flex-1 py-3 rounded-xl mr-2 ${selectedUser ? 'bg-gray-200' : 'bg-gray-100'}`}
                onPress={() => setIsSearchModalVisible(false)}
              >
                <Text className="text-center text-gray-800 font-medium">
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 py-3 rounded-xl ${selectedUser ? 'bg-orange-500' : 'bg-gray-300'}`}
                onPress={startLocationSharing}
                disabled={!selectedUser}
              >
                <Text className={`text-center font-medium ${selectedUser ? 'text-white' : 'text-gray-500'}`}>
                  {isRTL ? 'بدء المشاركة' : 'Start Sharing'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  buttonShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  mapWrapper: {
    flex: 1,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 16,
    borderWidth: Platform.OS === 'android' ? 1 : 0,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardShadow: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 5,
      },
    }),
  },
}); 