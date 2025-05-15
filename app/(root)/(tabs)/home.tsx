import React, { useEffect, useState, useCallback } from "react";
import Map from "@/components/Map";
import RideCard from "@/components/RideCard";
import SuggestedRides from "@/components/SuggestedRides";
import { icons, images } from '@/constants';
import { useNotifications } from '@/context/NotificationContext';
import { useLocationStore } from "@/store";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Image, RefreshControl, TouchableOpacity, Alert, Platform, StyleSheet } from "react-native";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useDriverStore } from '@/store';
import { Ride } from "@/types/type";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from "react-native";
import { FlatList } from "react-native";  
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from "@/context/LanguageContext";
import GoogleTextInput from "@/components/GoogleTextInput";
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import Header from "@/components/Header";

function CustomMenuIcon({ isRTL }: { isRTL: boolean }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center' }}>
      <View style={{ 
        width: 24, 
        height: 2.5, 
        backgroundColor: '#f97316', 
        borderRadius: 2, 
        marginBottom: 5,
        alignSelf: isRTL ? 'flex-end' : 'flex-start'
      }} />
      <View style={{ 
        width: 16, 
        height: 2.5, 
        backgroundColor: '#f97316', 
        borderRadius: 2, 
        marginBottom: 5,
        alignSelf: isRTL ? 'flex-end' : 'flex-start'
      }} />
      <View style={{ 
        width: 20, 
        height: 2.5, 
        backgroundColor: '#f97316', 
        borderRadius: 2,
        alignSelf: isRTL ? 'flex-end' : 'flex-start'
      }} />
    </View>
  );
}


interface Location {

  latitude: number;

  longitude: number;

  address: string;
}
export default function Home() {
  const { setIsMenuVisible } = require('@/context/MenuContext').useMenu();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { setUserLocation, setDestinationLocation } = useLocationStore();
  const { unreadCount } = useNotifications();
  const { user } = useUser();
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isDriver, setIsDriver] = useState<boolean>(false);
  const [isCheckingDriver, setIsCheckingDriver] = useState<boolean>(true);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [inProgressRides, setInProgressRides] = useState<Ride[]>([]);

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const checkIfUserIsDriver = async () => {
    if (!user?.id) {
      console.log('No user ID found');
      setIsCheckingDriver(false);
      return;
    }
    
    try {
      console.log('Checking driver status for user:', user.id);
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        console.log('User data:', userData);
        // Check if user has driver data and is active
        const isUserDriver = userData.driver && userData.driver.is_active === true;
        console.log('Is user a driver?', isUserDriver);
        setIsDriver(isUserDriver);
        
        // Set profile image URL
        const imageUrl = userData.profile_image_url || userData.driver?.profile_image_url || null;
        setProfileImageUrl(imageUrl);
      } else {
        console.log('User document does not exist');
        setIsDriver(false);
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
      setIsDriver(false);
    } finally {
      setIsCheckingDriver(false);
    }
  };
       
  // Add this useEffect to check driver status when user changes
  useEffect(() => {
    console.log('User changed:', user?.id);
    if (user?.id) {
      checkIfUserIsDriver();
    }
  }, [user?.id]);

  // Add this useFocusEffect to check driver status when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, checking driver status');
      if (user?.id) {
        checkIfUserIsDriver();
      }
    }, [user?.id])
  );

  const handleDestinationPress = (location: Location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/(root)/(tabs)/search",
      params: { 
        searchQuery: location.address,
        origin: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address
        })
      }
    });
  };

  useEffect(() => {
    const requestLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setHasPermission(false);
          Alert.alert(
            "Location Permission Denied",
            "Location permission is required to use this feature. Please enable it in your device settings."
          );
          return;
        }

        const cachedLocation = await AsyncStorage.getItem('userLocation');
        if (cachedLocation) {
          const parsedLocation = JSON.parse(cachedLocation);
          setUserLocation(parsedLocation);
        }

        let location = await Location.getCurrentPositionAsync({
          accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
        });

        const newLocation = {
          latitude: location.coords?.latitude,
          longitude: location.coords?.longitude,
          address: t.currentLocation,
        };
        
        setUserLocation(newLocation);
        await AsyncStorage.setItem('userLocation', JSON.stringify(newLocation));
        setRefreshKey(prev => prev + 1);
      } catch (err) {
        console.error("Location request failed:", err);
        setHasPermission(false);
        let message = "Location request failed. Please ensure location services are enabled and permissions are granted in your device settings.";
        if (err && typeof err === 'object' && 'message' in err && typeof (err as any).message === 'string' && (err as any).message.includes('unsatisfied device settings')) {
          message = "Location request failed due to unsatisfied device settings. Please enable location services (GPS) and try again.";
        }
        Alert.alert(
          "Location Error",
          message
        );
      }
    };
    requestLocation();
  }, [t]);

  const fetchInProgressRides = async () => {
    if (!user?.id || !isDriver) return;
    
    try {
      const ridesRef = collection(db, 'rides');
      const q = query(
        ridesRef,
        where('driver_id', '==', user.id),
        where('status', '==', 'in-progress'),
        orderBy('created_at', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const rides: Ride[] = [];
      
      snapshot.forEach((doc) => {
        rides.push({ id: doc.id, ...doc.data() } as Ride);
      });
      
      setInProgressRides(rides);
    } catch (error) {
      console.error('Error fetching in-progress rides:', error);
    }
  };

  // Fetch in-progress rides when driver status changes
  useEffect(() => {
    if (isDriver && user?.id) {
      fetchInProgressRides();
    }
  }, [isDriver, user?.id]);

  // Refresh in-progress rides when screen focuses
  useFocusEffect(
    useCallback(() => {
      if (isDriver && user?.id) {
        fetchInProgressRides();
      }
    }, [isDriver, user?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
      });
      
      const newLocation = {
        latitude: location.coords?.latitude,
        longitude: location.coords?.longitude,
        address: t.currentLocation,
      };
      
      setUserLocation(newLocation);
      await AsyncStorage.setItem('userLocation', JSON.stringify(newLocation));
      
      // Also refresh in-progress rides for drivers
      if (isDriver && user?.id) {
        await fetchInProgressRides();
      }
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="bg-general-500 flex-1">
      <Header 
        title={t.Home}
        profileImageUrl={profileImageUrl}
        showProfileImage={true}
      />

      {/* Content with Barrier Section below Header */}
      <FlatList 
        data={[]}
        renderItem={() => null}
        keyboardShouldPersistTaps="handled" 
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(root)/(tabs)/barriers');
              }}
              className={`bg-orange-50 p-4 rounded-b-[20px] flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'} justify-between shadow-lg`}
              style={{
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
              }}
            >
              <View className="flex-1">
                <Text className={`text-gray-900 text-lg ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} mb-1`}>
                  {t.barriers}
                </Text>
                <Text className={`text-gray-600 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                  {t.barriersDescription}
                </Text>
              </View>
              <View className="bg-orange-500 px-4 py-2 rounded-full">
                <Text className={`text-white ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                  {t.explore}
                </Text>
              </View>
            </TouchableOpacity>

            <View 
              className="mx-2 mt-5"
              style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
            >
              <GoogleTextInput
                icon={icons.search}
                containerStyle="bg-white rounded-xl"
                handlePress={handleDestinationPress}
                placeholder={t.searchPlaceholder}
                textInputBackgroundColor="white"
              />
            </View>

            <>
             
              <Text className={`text-xl px-3 mt-5 mb-3 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                {t.currentLocation}
              </Text>
              <View className="flex flex-row items-center px-2 bg-transparent h-[300px]">
                <Map/> 
              </View>
            </>

            {!isCheckingDriver && !isDriver && (
              <TouchableOpacity 
                onPress={() => router.push('/(root)/driverInfo')}
                className={`bg-white p-4 rounded-2xl my-5 flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'} justify-between shadow-lg`}
                style={{
                  elevation: 3,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                }}
              >
               <View className="flex-1">
                  <Text className={`text-gray-900 text-lg ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} mb-1`}>
                    {t.becomeDriver}
                  </Text>
                  <Text className={`text-gray-600 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                    {t.earnMoney}
                  </Text>
                </View>
                <View className="bg-orange-500 px-4 py-2 rounded-full">
                  <Text className={`text-white ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                    {t.register}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* In-Progress Rides Section for Drivers */}
            {isDriver && inProgressRides.length > 0 && (
              <>
                <View className={`flex-row items-center mt-5 mb-3 w-full px-3 ${language === 'ar' ? 'flex-row-reverse justify-between' : 'flex-row justify-between'}`}>
                  <Text className={`text-xl ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                    {language === 'ar' ? 'الرحلات الحالية' : 'Current Rides'}
                  </Text>
                  <View className="bg-orange-500 w-7 h-7 items-center justify-center rounded-full">
                    <Text className={`text-white text-sm ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                      {inProgressRides.length}
                    </Text>
                  </View>
                </View>
                
                <FlatList
                  data={inProgressRides}
                  renderItem={({ item: ride }) => (
                    <TouchableOpacity
                      key={ride.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push(`/(root)/ride-details/${ride.id}`);
                      }}
                      className="bg-white mx-3 mb-3 p-4 rounded-2xl shadow-lg"
                      style={{
                        elevation: 3,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3.84,
                      }}
                    >
                      <View className={`flex-row items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <View className="flex-1">
                          <View className={`flex-row items-center mb-2 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <View className="bg-green-100 px-2 py-1 rounded-full">
                              <Text className={`text-green-600 text-xs ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                                {language === 'ar' ? 'قيد التقدم' : 'In Progress'}
                              </Text>
                            </View>
                            <Text className={`text-gray-500 text-sm ${language === 'ar' ? 'font-CairoBold mr-2' : 'font-JakartaBold ml-2'}`}>
                              {ride.ride_datetime}
                            </Text>
                          </View>
                          <Text className={`text-gray-900 text-lg mb-1 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-CairoBold text-left'}`}>
                            {ride.destination_address}
                          </Text>
                          <Text className={`text-gray-600 text-sm ${language === 'ar' ? 'font-CairoBold text-right' : 'font-CairoRegular text-left'}`}>
                            {ride.origin_address}
                          </Text>
                          <Text className={`text-orange-500 text-sm mt-1 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                            {language === 'ar' ? `المقاعد المتاحة: ${ride.available_seats}` : `Available seats: ${ride.available_seats}`}
                          </Text>
                        </View>
                        <View className={`items-center ${language === 'ar' ? 'ml-3' : 'mr-3'}`}>
                          <MaterialIcons name="navigation" size={24} color="#f97316" />
                          <Text className={`text-orange-500 text-xs mt-1 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                            {language === 'ar' ? 'انتقل' : 'Navigate'}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  horizontal={false}
                  contentContainerStyle={{ paddingHorizontal: 0 }}
                />
              </>
            )}

            {/* Suggested Rides and Available Rides Side by Side */}
            <View className={`flex-row items-center mt-5 mb-3 w-full px-3 ${language === 'ar' ? 'flex-row-reverse justify-between' : 'flex-row justify-between'}`}>
              <View className={`${language === 'ar' ? 'items-end' : 'items-start'}`}>
                <Text className={`text-xl ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                  {t.suggestedRides}
                </Text>
              </View>
              <View className={`${language === 'ar' ? 'items-start' : 'items-end'}`}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/(root)/create-ride');
                  }}
                  className="flex-row items-center bg-white border border-secondary-700 px-1 py-1 rounded-[15px]"
                  style={{
                    elevation: Platform.OS === "android" ? 3 : 0,
                    shadowColor: "#666666",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: Platform.OS === "ios" ? 0.22 : 0,
                    shadowRadius: Platform.OS === "ios" ? 2.22 : 0,
                  }}
                >
                 <LinearGradient
                    colors={["#fff", "#fff"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      flexDirection: language === 'ar' ? 'row-reverse' : 'row',
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                    }}
                >
                    <MaterialIcons name="add" size={20} color="#666666" />
                    <Text className={`text-secondary-700 text-sm ${language === 'ar' ? 'mr-1 font-CairoBold' : 'ml-1 font-JakartaBold'} mt-1`}>
                      {t.newRide}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
            <SuggestedRides key={refreshKey} refreshKey={refreshKey} />
             </>
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={["#F87000", "#F87000"]}
            tintColor="#000"
            className="z-10"
          />
        }
      />

      {/* Floating Action Button for Drivers */}
      {isDriver && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/(root)/add');
          }}
          className="absolute bottom-24 right-5 bg-orange-500 w-14 h-14 rounded-full items-center justify-center shadow-lg"
          style={{
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            zIndex: 1000,
          }}
        >
          <MaterialIcons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      <StatusBar backgroundColor="#F87000" style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  androidShadow: {
    elevation: 8,
    backgroundColor: 'white',
    borderRadius: 20,
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    backgroundColor: 'white',
    borderRadius: 20,
  },
});