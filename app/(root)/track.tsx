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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

// Types
interface AppUser {
  id: string;
  name: string;
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
  const [activeModal, setActiveModal] = useState<'none' | 'search' | 'shares'>('none');
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
            name: 'Unknown User',
          email: '',
          profile_image: undefined
        };
        
        if (sharerDoc.exists()) {
          const sharerData = sharerDoc.data();
          sharer = {
            id: data.sharer_id,
            name: sharerData.name || sharerData.email || 'User',
            email: sharerData.email,
            profile_image: sharerData.profile_image_url 
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
          name: 'Unknown User',
          email: '',
          profile_image: undefined
        };
                  
        if (recipientDoc.exists()) {
          const recipientData = recipientDoc.data();
          recipient = {
            id: data.recipient_id,
            name: recipientData.name || recipientData.email || 'User',
            email: recipientData.email,
            profile_image: recipientData.profile_image_url
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
              name: userData.name || userData.email || 'User',
              email: userData.email,
              profile_image: userData.profile_image_url
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
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
      title: share.sharer.name
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
      
      // Request location permissions
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          isRTL ? 'تنبيه الموقع' : 'Location Alert',
          isRTL ? 'لم يتم منح إذن الوصول إلى الموقع' : 'Location permission was not granted'
        );
        setIsRefreshing(false);
        return;
      }

      // Get current location with timeout
      const locationPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest
      });
      
      // Set a timeout of 10 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Location request timed out')), 10000);
      });
      
      // Race between location request and timeout
      const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;
      
      // Update user location state
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
        await updateSharedLocation(location.coords.latitude, location.coords.longitude);
      }
      
      setIsRefreshing(false);
      setLoading(false);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        isRTL ? 'خطأ في الموقع' : 'Location Error',
        isRTL ? 'حدث خطأ أثناء محاولة الحصول على موقعك' : 'An error occurred while trying to get your location'
      );
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

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (trackingInterval) {
        clearInterval(trackingInterval);
      }
    };
  }, [trackingInterval]);

  // Start location sharing with selected user
  const startLocationSharing = async () => {
    try {
      // Validate required data
      if (!selectedUser || !userLocation || !user?.id) {
        Alert.alert(
          isRTL ? 'خطأ' : 'Error',
          isRTL ? 'لا يمكن مشاركة الموقع، يرجى تحديث موقعك واختيار مستخدم' : 'Cannot share location, please refresh your location and select a user'
        );
        return;
      }

      // Show loading indicator
      setIsRefreshing(true);

      // Clear any existing interval
      if (trackingInterval) {
        clearInterval(trackingInterval);
        setTrackingInterval(null);
      }
      
      // Get current location to ensure it's fresh
      try {
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });
        
        // Create initial location sharing record
        await updateSharedLocation(
          currentLocation.coords.latitude, 
          currentLocation.coords.longitude
        );
      } catch (error) {
        console.error('Error getting location:', error);
        // Use last known location if current fails
        if (userLocation) {
          await updateSharedLocation(userLocation.latitude, userLocation.longitude);
        }
      }
      
      // Set up interval to update location every 30 seconds
      const interval = setInterval(async () => {
        try {
          // Check if we still have valid data before updating
          if (!user?.id || !selectedUser?.id) {
            if (trackingInterval) {
              clearInterval(trackingInterval);
              setTrackingInterval(null);
            }
            return;
          }

          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          
          await updateSharedLocation(location.coords.latitude, location.coords.longitude);
        } catch (error) {
          console.error('Error updating location in interval:', error);
        }
      }, 30000);
      
      setTrackingInterval(interval);
      setIsLocationSharing(true);
      
      // Hide loading indicator
      setIsRefreshing(false);
      
      // Close modal and show success message
      setActiveModal('none');
      
      Alert.alert(
        isRTL ? 'مشاركة الموقع نشطة' : 'Location Sharing Active',
        isRTL ? `أنت الآن تشارك موقعك مع ${selectedUser.name}` : `You are now sharing your location with ${selectedUser.name}`
      );
    } catch (error) {
      console.error('Error starting location sharing:', error);
      
      // Hide loading indicator
      setIsRefreshing(false);
      
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
      title={request.sharer.name}
      description={`Last updated: ${formatTimeElapsed(request.last_updated)}`}
      pinColor="green"
    />
  )), [trackRequests, now]);

  // Memoize render functions
  const renderUserItem = useCallback(({ item }: { item: AppUser }) => (
    <TouchableOpacity 
      className={`flex-row items-center p-3 border-b border-gray-100 ${selectedUser?.id === item.id ? 'bg-orange-50' : ''}`}
      onPress={() => {
        // Set the selected user with a small delay to prevent UI glitches
        setSelectedUser(item);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      activeOpacity={0.7}
    >
      <View className="w-10 h-10 rounded-full bg-gray-200 justify-center items-center mr-3">
        {item.profile_image ? (
          <Image 
            source={{ uri: item.profile_image }} 
            className="w-10 h-10 rounded-full" 
          />
        ) : (
          <Text className="text-gray-500 font-bold">
            {(item.name?.charAt(0) || item.email?.charAt(0) || '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-gray-800">{item.name || item.email || 'User'}</Text>
        <Text className="text-gray-500 text-sm">{item.email}</Text>
      </View>
      {selectedUser?.id === item.id && (
        <MaterialIcons name="check-circle" size={24} color="#f97316" />
      )}
    </TouchableOpacity>
  ), [selectedUser]);

  const renderRequestItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.requestItem}
      onPress={() => viewSharerLocation(item)}
    >
      <View style={styles.userAvatar}>
        {item.sharer.profile_image ? (
          <Image 
            source={{ uri: item.sharer.profile_image }} 
            style={styles.avatarImage}
          />
        ) : (
          <Text style={styles.avatarText}>
            {(item.sharer.name?.charAt(0) || '?').toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.sharer.name}</Text>
        <Text style={styles.requestEmail}>{item.sharer.email}</Text>
        <Text style={styles.requestTime}>
          Last updated: {formatTimeElapsed(item.last_updated)}
        </Text>
      </View>
      <View style={styles.viewButton}>
        <Text style={styles.viewButtonText}>View</Text>
      </View>
    </TouchableOpacity>
  ), [viewSharerLocation, formatTimeElapsed]);

  // Render search user modal
  const renderSearchModal = () => {
    if (activeModal !== 'search') return null;
    
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isRTL ? 'مشاركة الموقع مع' : 'Share Location With'}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setActiveModal('none');
                setSearchQuery('');
              }}
              style={styles.closeButton}
            >
              <AntDesign name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <AntDesign name="search1" size={20} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
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
          
          <FlatList
            data={filteredUsers}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.userItem,
                  selectedUser?.id === item.id ? styles.selectedUserItem : null
                ]}
                onPress={() => {
                  setSelectedUser(item);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.userAvatar}>
                  {item.profile_image ? (
                    <Image 
                      source={{ uri: item.profile_image }} 
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {(item.name?.charAt(0) || item.email?.charAt(0) || '?').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.name || item.email || 'User'}</Text>
                  <Text style={styles.userEmail}>{item.email}</Text>
                </View>
                {selectedUser?.id === item.id && (
                  <MaterialIcons name="check-circle" size={24} color="#f97316" />
                )}
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>
                  {isRTL ? 'لم يتم العثور على مستخدمين' : 'No users found'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.usersList}
          />

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[
                styles.actionButton,
                styles.cancelButton
              ]}
              onPress={() => {
                setActiveModal('none');
                setSearchQuery('');
              }}
            >
              <Text style={styles.cancelButtonText}>
                {isRTL ? 'إلغاء' : 'Cancel'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.actionButton,
                selectedUser ? styles.confirmButton : styles.disabledButton
              ]}
              onPress={() => {
                if (selectedUser) {
                  startLocationSharing();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  
                }
              }}
              
              disabled={!selectedUser}
            >
              <Text style={[
                styles.confirmButtonText,
                !selectedUser && styles.disabledButtonText
              ]}>
                {isRTL ? 'بدء المشاركة' : 'Start Sharing'}
                
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // Render my shares modal
  const renderMySharesModal = () => {
    if (activeModal !== 'shares') return null;
    
    return (
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>My Shares</Text>
            <TouchableOpacity 
              onPress={() => setActiveModal('none')}
              style={styles.closeButton}
            >
              <AntDesign name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={myShares}
            keyExtractor={item => item.docId}
            renderItem={({ item }) => (
              <View style={styles.shareItem}>
                <View style={styles.userAvatar}>
                  {item.recipient.profile_image ? (
                    <Image 
                      source={{ uri: item.recipient.profile_image }} 
                      style={styles.avatarImage}
                    />
                  ) : (
                    <Text style={styles.avatarText}>
                      {(item.recipient.name?.charAt(0) || '?').toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{item.recipient.name}</Text>
                  <Text style={styles.userEmail}>{item.recipient.email}</Text>
                  <Text style={styles.lastUpdated}>
                    Last updated: {formatTimeElapsed(item.last_updated)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.stopButton}
                  onPress={() => {
                    stopSharing(item.docId);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                >
                  <Text style={styles.stopButtonText}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>
                  {isRTL ? 'لا توجد مشاركات نشطة' : 'No active shares'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.sharesList}
          />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row justify-between items-center p-4 border-b border-gray-200">
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-xl font-bold">Location Tracking</Text>
          <TouchableOpacity onPress={() => setActiveModal('shares')}>
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
          <TouchableOpacity
            style={styles.fab}
            onPress={() => {
              setSelectedUser(null);
              setSearchQuery('');
              setFilteredUsers(appUsers);
              setActiveModal('search');
            }}
          >
            <MaterialIcons name="person-add" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Location sharing status */}
          {isLocationSharing && (
            <View className="absolute bottom-32 left-4 right-4 bg-white p-3 rounded-lg shadow-md">
              <Text className="text-center font-bold text-green-600">
                Sharing location with {selectedUser?.name}
              </Text>
            </View>
          )}
        </View>

        {/* Bottom Sheet for Requests */}
        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={['25%', '50%', '85%']}
          index={1}
          enablePanDownToClose={false}
          handleIndicatorStyle={{ backgroundColor: '#9ca3af', width: 50 }}
        >
          <View style={styles.bottomSheetContainer}>
            <Text style={styles.bottomSheetTitle}>Location Requests</Text>
            {trackRequests.length === 0 ? (
              <View style={styles.emptyListContainer}>
                <Text style={styles.emptyListText}>No active location requests</Text>
              </View>
            ) : (
              <BottomSheetFlatList
                data={trackRequests}
                keyExtractor={item => item.docId}
                renderItem={renderRequestItem}
                contentContainerStyle={styles.bottomSheetContent}
                initialNumToRender={5}
                maxToRenderPerBatch={10}
                windowSize={5}
              />
            )}
          </View>
        </BottomSheet>

        {/* Render modals */}
        {renderSearchModal()}
        {renderMySharesModal()}
      </SafeAreaView>
    </GestureHandlerRootView>
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
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    backgroundColor: '#f97316',
    borderRadius: 32,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      }
    }),
    zIndex: 20
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    padding: 16,
    ...Platform.select({
      android: { elevation: 5 },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
      }
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  closeButton: {
    padding: 4
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#1f2937',
    fontSize: 16
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  selectedUserItem: {
    backgroundColor: '#fff7ed'
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6b7280'
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280'
  },
  emptyListContainer: {
    padding: 24,
    alignItems: 'center'
  },
  emptyListText: {
    color: '#6b7280',
    fontSize: 16
  },
  usersList: {
    flexGrow: 1
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    marginRight: 8
  },
  confirmButton: {
    backgroundColor: '#f97316'
  },
  disabledButton: {
    backgroundColor: '#e5e7eb'
  },
  cancelButtonText: {
    color: '#1f2937',
    fontWeight: '500',
    fontSize: 16
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '500',
    fontSize: 16
  },
  disabledButtonText: {
    color: '#9ca3af'
  },
  shareItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  lastUpdated: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4
  },
  stopButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  stopButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14
  },
  sharesList: {
    flexGrow: 1
  },
  viewButtonContainer: {
    padding: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#f3f4f6'
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f97316'
  },
  bottomSheetContainer: {
    flex: 1,
    backgroundColor: 'white'
  },
  bottomSheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingTop: 16
  },
  bottomSheetContent: {
    paddingBottom: 20
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6'
  },
  requestInfo: {
    flex: 1,
    marginLeft: 12
  },
  requestName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937'
  },
  requestEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2
  },
  requestTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4
  },
  viewButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 16
  }
}); 