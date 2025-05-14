// Suppress Reanimated strict mode warning in this file only
if (__DEV__ && (global as any)._REANIMATED_VERSION_3) {
  // @ts-ignore
  global.__reanimatedWorkletInit = () => {};
}

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Alert, FlatList, Image, Dimensions, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MaterialIcons, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useLanguage } from '@/context/LanguageContext';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { icons } from '@/constants';

// Types
interface AppUser {
  id: string;
  full_name: string;
  email: string;
  profile_image?: string;
}

interface Share {
  recipient_id: string;
  sharer_id: string;
  latitude: number;
  longitude: number;
  last_updated: string;
  is_active: boolean;
  docId?: string;
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

export default function Track() {
  // Context and state
  const { user } = useUser();
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const mapRef = useRef<MapView>(null);
  const bottomSheetRef = useRef<BottomSheet>(null);
  
  // State
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [now, setNow] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState<{latitude: number, longitude: number, title: string} | null>(null);
  const [trackRequests, setTrackRequests] = useState<any[]>([]);
  const [myShares, setMyShares] = useState<any[]>([]);
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [isLocationSharing, setIsLocationSharing] = useState(false);
  const [trackingInterval, setTrackingInterval] = useState<NodeJS.Timeout | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMyShares, setShowMyShares] = useState(false);

  // Timer for updating times
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Get user's location
  useEffect(() => {
    const getLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Permission',
            'Location permission is required to use the tracking features.'
          );
          return;
        }
        
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
      } catch (error) {
        console.error('Error getting location:', error);
      } finally {
        setLoading(false);
      }
    };
    
    getLocation();
  }, []);

  // Load track requests
  useEffect(() => {
    if (!user?.id) return;
    
    const q = query(
      collection(db, 'location_sharing'),
      where('recipient_id', '==', user.id),
      where('is_active', '==', true)
    );
    
    const unsub = onSnapshot(q, async (snapshot) => {
      const requests: any[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Share;
        const sharerDoc = await getDoc(doc(db, 'users', data.sharer_id));
        let sharer = {
          id: data.sharer_id,
          full_name: 'Unknown User',
          email: '',
          profile_image: undefined
        };
        
        if (sharerDoc.exists()) {
          const sharerData = sharerDoc.data();
          sharer = {
            id: data.sharer_id,
            full_name: sharerData.full_name || sharerData.email || 'User',
            email: sharerData.email,
            profile_image: sharerData.profile_image
          };
        }
        
        requests.push({ ...data, sharer, docId: docSnap.id });
      }
      
      setTrackRequests(requests);
      setLoading(false);
    });
    
    return () => unsub();
  }, [user?.id]);

  // Load my shares
  useEffect(() => {
    if (!user?.id) return;
    
    const q = query(
      collection(db, 'location_sharing'),
      where('sharer_id', '==', user.id),
      where('is_active', '==', true)
    );
    
    const unsub = onSnapshot(q, async (snapshot) => {
      const shares: any[] = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Share;
        const recipientDoc = await getDoc(doc(db, 'users', data.recipient_id));
        let recipient = {
          id: data.recipient_id,
          full_name: 'Unknown User',
          email: '',
          profile_image: undefined
        };
                  
        if (recipientDoc.exists()) {
          const recipientData = recipientDoc.data();
          recipient = {
            id: data.recipient_id,
            full_name: recipientData.full_name || recipientData.email || 'User',
            email: recipientData.email,
            profile_image: recipientData.profile_image
          };
        }
        
        shares.push({ ...data, recipient, docId: docSnap.id });
      }
      
      setMyShares(shares);
    });
    
    return () => unsub();
  }, [user?.id]);

  // Load users for sharing
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchAppUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const usersSnapshot = await getDocs(usersRef);
        const usersList: AppUser[] = [];
        
        usersSnapshot.forEach(doc => {
          if (doc.id !== user.id) {
            const userData = doc.data();
            usersList.push({
              id: doc.id,
              full_name: userData.full_name || userData.email || 'User',
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

    fetchAppUsers();
  }, [user?.id]);

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

  // Format elapsed time
  const formatTimeElapsed = (timestamp: string) => {
    if (!timestamp) return "Never";
    
    const lastUpdated = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      return lastUpdated.toLocaleTimeString();
    }
  };

  // Stop sharing location with a recipient
  const stopSharing = async (docId: string) => {
    try {
      await updateDoc(doc(db, 'location_sharing', docId), { is_active: false });
      Alert.alert('Success', 'Location sharing stopped');
    } catch (error) {
      console.error('Error stopping sharing:', error);
      Alert.alert('Error', 'Could not stop sharing location');
    }
  };

  // View a sharer's location
  const viewSharerLocation = (share: any) => {
    setSelectedLocation({
      latitude: share.latitude,
      longitude: share.longitude,
      title: share.sharer.full_name
    });
    
    // Center map on the selected location
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: share.latitude,
        longitude: share.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
      }, 1000);
    }

    // Close bottom sheet
    bottomSheetRef.current?.collapse();
  };

  // Update user location and shared location if sharing
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
      
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });
      
      // Center map on user's location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
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
      setLoading(false);
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
    if (!selectedUser || !userLocation || !user?.id) {
    Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'لا يمكن مشاركة الموقع، يرجى تحديث موقعك واختيار مستخدم' : 'Cannot share location, please refresh your location and select a user'
      );
      return;
    }

    try {
      // Create initial location sharing record
      await updateSharedLocation(userLocation.latitude, userLocation.longitude);
      
      // Set up interval to update location every 30 seconds
      const interval = setInterval(async () => {
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          
          if (user?.id && selectedUser?.id) {
            const locationSharingRef = doc(db, 'location_sharing', `${user.id}_${selectedUser.id}`);
            await setDoc(locationSharingRef, {
              sharer_id: user.id,
              recipient_id: selectedUser.id,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              last_updated: new Date().toISOString(),
              is_active: true
            }, { merge: true });
          }
        } catch (error) {
          console.error('Error updating location in interval:', error);
        }
      }, 30000);
      
      setTrackingInterval(interval);
      setIsLocationSharing(true);
      
      Alert.alert(
        isRTL ? 'مشاركة الموقع نشطة' : 'Location Sharing Active',
        isRTL ? `أنت الآن تشارك موقعك مع ${selectedUser.full_name}` : `You are now sharing your location with ${selectedUser.full_name}`
      );
      
      setIsSearchModalVisible(false);
    } catch (error) {
      console.error('Error starting location sharing:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل في بدء مشاركة الموقع' : 'Failed to start location sharing'
      );
    }
  };

  // Memoize request markers
  const requestMarkers = useMemo(() => trackRequests.map((request) => (
    <Marker
      key={request.docId}
      coordinate={{
        latitude: request.latitude,
        longitude: request.longitude
      }}
      title={request.sharer.full_name}
      description={`Last updated: ${formatTimeElapsed(request.last_updated)}`}
      pinColor="green"
    />
  )), [trackRequests, now]);

  // Memoize render functions
  const renderUserItem = useCallback(({ item }: { item: AppUser }) => (
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
  ), [selectedUser]);

  const renderRequestItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      className="flex-row items-center p-4 border-b border-gray-100"
      onPress={() => viewSharerLocation(item)}
    >
      <View className="w-12 h-12 rounded-full bg-gray-200 justify-center items-center mr-4">
        {item.sharer.profile_image ? (
          <Image source={{ uri: item.sharer.profile_image }} className="w-12 h-12 rounded-full" />
        ) : (
          <Text className="text-gray-500 font-bold text-lg">
            {(item.sharer.full_name?.charAt(0) || '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-800 text-lg">{item.sharer.full_name}</Text>
        <Text className="text-gray-500 text-sm">{item.sharer.email}</Text>
        <Text className="text-xs text-gray-400 mt-1">Last updated: {formatTimeElapsed(item.last_updated)}</Text>
      </View>
      <Text className="text-blue-500 font-bold">View</Text>
    </TouchableOpacity>
  ), [viewSharerLocation, formatTimeElapsed]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="text-xl font-bold">Location Tracking</Text>
        <TouchableOpacity onPress={() => setShowMyShares(true)}>
          <Text className="text-orange-500 font-bold">My Shares</Text>
        </TouchableOpacity>
      </View>

      {/* Map View */}
      <View className="flex-1">
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={
            userLocation ? {
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            } : undefined
          }
        >
          {userLocation && (
            <Marker
              coordinate={{
                latitude: userLocation.latitude,
                longitude: userLocation.longitude
              }}
              title="Your Location"
              pinColor="blue"
            />
          )}
          
          {selectedLocation && (
            <Marker
              coordinate={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude
              }}
              title={selectedLocation.title}
              pinColor="red"
            />
          )}
          
          {requestMarkers}
        </MapView>

        {/* Map Actions */}
        <View className="absolute top-4 right-4 space-y-2 z-10">
          <TouchableOpacity
            className="bg-white p-3 rounded-full shadow-md"
            onPress={fetchUserLocation}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color="#f97316" />
            ) : (
              <MaterialIcons name="my-location" size={24} color="#f97316" />
            )}
          </TouchableOpacity>
      </View>

        {/* Floating Action Button for sharing location */}
        <View style={{ position: 'absolute', bottom: 32, right: 24, zIndex: 20 }}>
          <TouchableOpacity
            onPress={() => setIsSearchModalVisible(true)}
            style={{ backgroundColor: '#f97316', borderRadius: 32, padding: 18, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3 }}
          >
            <MaterialIcons name="person-add" size={32} color="#fff" />
          </TouchableOpacity>
            </View>

        {/* Location sharing status */}
        {isLocationSharing && (
          <View className="absolute bottom-32 left-4 right-4 bg-white p-3 rounded-lg shadow-md">
            <Text className="text-center font-bold text-green-600">
              Sharing location with {selectedUser?.full_name}
              </Text>
          </View>
        )}
      </View>

      {/* Bottom Sheet for Requests */}
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={['25%', '50%', '90%']}
        index={1}
      >
        <View className="flex-1 bg-white">
          <Text className="text-lg font-bold px-4 py-2">Location Requests</Text>
          <BottomSheetFlatList
            data={trackRequests}
            keyExtractor={item => item.docId}
            renderItem={renderRequestItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            initialNumToRender={5}
            maxToRenderPerBatch={10}
            windowSize={5}
          />
        </View>
      </BottomSheet>

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
              initialNumToRender={5}
              maxToRenderPerBatch={10}
              windowSize={5}
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

      {/* My Shares Modal */}
      <Modal
        visible={showMyShares}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMyShares(false)}
      >
        <View className="flex-1 bg-white">
          <SafeAreaView className="flex-1">
            <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
              <TouchableOpacity onPress={() => setShowMyShares(false)}>
                <MaterialIcons name="close" size={24} color="#374151" />
              </TouchableOpacity>
              <Text className="text-xl font-bold">My Shares</Text>
              <View style={{ width: 24 }} />
            </View>
            
            <FlatList
              data={myShares}
              keyExtractor={item => item.docId}
              renderItem={({ item }) => (
                <View className="flex-row items-center p-4 border-b border-gray-100">
                  <View className="w-12 h-12 rounded-full bg-gray-200 justify-center items-center mr-4">
                    {item.recipient.profile_image ? (
                      <Image source={{ uri: item.recipient.profile_image }} className="w-12 h-12 rounded-full" />
                    ) : (
                      <Text className="text-gray-500 font-bold text-lg">
                        {(item.recipient.full_name?.charAt(0) || '?').toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-800 text-lg">{item.recipient.full_name}</Text>
                    <Text className="text-gray-500 text-sm">{item.recipient.email}</Text>
                    <Text className="text-xs text-gray-400 mt-1">Last updated: {formatTimeElapsed(item.last_updated)}</Text>
                  </View>
                  <TouchableOpacity
                    className="bg-red-500 px-4 py-2 rounded-xl"
                    onPress={() => stopSharing(item.docId)}
                  >
                    <Text className="text-white font-bold">Stop</Text>
                  </TouchableOpacity>
        </View>
      )}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-8">
                  <Text className="text-gray-500">
                    {isRTL ? 'لا توجد مشاركات نشطة' : 'No active shares'}
                  </Text>
                </View>
              }
            />
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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