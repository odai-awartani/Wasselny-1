import React, { useEffect, useState, useCallback } from "react";
import GoogleTextInput from "@/components/GoogleTextInput";
import Map from "@/components/Map";
import RideCard from "@/components/RideCard";
import SuggestedRides from "@/components/SuggestedRides";
import { icons, images } from '@/constants';
import { useNotifications } from '@/context/NotificationContext';
import { useLocationStore } from "@/store";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Image, RefreshControl, TouchableOpacity, Alert, Platform } from "react-native";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useDriverStore } from '@/store';
import { Ride } from "@/types/type";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, View } from "react-native";
import { FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from '@expo/vector-icons';

export default function Home() {
  const { setUserLocation, setDestinationLocation } = useLocationStore();
  const { unreadCount } = useNotifications();
  const { user } = useUser();
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const { signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [isDriver, setIsDriver] = useState<boolean>(false);
  const [isCheckingDriver, setIsCheckingDriver] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const checkIfUserIsDriver = async () => {
    if (!user?.id) {
      setIsCheckingDriver(false);
      return;
    }
    
    try {
      console.log('Checking driver status for user:', user.id);
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const isUserDriver = userData.driver?.is_active === true;
        console.log('Is user a driver?', isUserDriver);
        setIsDriver(isUserDriver);
        // Fetch profile image URL from Firestore
        const imageUrl = userData.profile_image_url || userData.driver?.profile_image_url || null;
        console.log('Profile Image URL:', imageUrl); // Log to debug
        setProfileImageUrl(imageUrl);
      } else {
        setIsDriver(false);
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
      setIsDriver(false);
    } finally {
      setIsCheckingDriver(false);
    }
  };

  useEffect(() => {
    checkIfUserIsDriver();
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      checkIfUserIsDriver();
    }, [user?.id])
  );

  const handleSignOut = () => {
    signOut();
    router.replace("/(auth)/sign-in");
  };

  const handleDestinationPress = (location: {
    latitude: number;
    longitude: number;
    address: string;
  }) => {
    setDestinationLocation(location);
    router.push("/(root)/find-ride");
  };

  useEffect(() => {
    const requestLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setHasPermission(false);
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
          address: "Current Location",
        };
        
        setUserLocation(newLocation);
        await AsyncStorage.setItem('userLocation', JSON.stringify(newLocation));
      } catch (err) {
        console.error("Location request failed:", err);
        setHasPermission(false);
      }
    };
    requestLocation();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Platform.OS === 'android' ? Location.Accuracy.Balanced : Location.Accuracy.High,
      });
      
      const newLocation = {
        latitude: location.coords?.latitude,
        longitude: location.coords?.longitude,
        address: "Current Location",
      };
      
      setUserLocation(newLocation);
      await AsyncStorage.setItem('userLocation', JSON.stringify(newLocation));
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="bg-general-500">
      <FlatList 
        data={[]}
        renderItem={() => null}
        className="px-5"
        keyboardShouldPersistTaps="handled" 
        contentContainerStyle={{ paddingBottom: 100 }}  
        ListHeaderComponent={
          <>
            <View className="py-3 w-full my-2">
              <View className="flex-row-reverse items-center justify-between">
                <View className="flex-row-reverse items-center">
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      handleSignOut();
                    }}
                    className="justify-center items-center w-10 h-10"
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="logout" size={24} color="#333333" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      router.push('/(root)/notifications');
                    }}
                    className="justify-center items-center w-10 h-10"
                    activeOpacity={0.8}
                  >
                    <Image source={icons.ring1} className="w-6 h-6" tintColor="#333333" />
                    {unreadCount > 0 && (
                      <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                        <Text className="text-[12px] text-white font-JakartaBold">{unreadCount}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
                <View className="flex-row items-center">
                  <TouchableOpacity
                onPress={() => router.push('/(root)/(tabs)/profile')}
                >
                  {profileImageUrl ? (
                    <Image
                      source={{ uri: profileImageUrl }}
                      className="w-12 h-12 rounded-full border border-2 mr-2"
                      resizeMode="contain"
                      onError={(e) => {
                        console.log('Image load error:', e.nativeEvent.error);
                        setProfileImageUrl(null); // Reset on error
                      }}
                    />
                    
                  ) : (
                    <MaterialIcons name="person" size={24} color="#333333" className="mr-2" />
                  )}
                  </TouchableOpacity>
                  <Text className="text-xs mt-5 mr-1 font-CairoBold text-gray-700">
                    {user?.fullName || 'User'}
                  </Text>
                </View>
              </View>
            </View>

            
            <GoogleTextInput
              icon={icons.search}
              containerStyle="bg-white shadow-sm mt-5"
              handlePress={handleDestinationPress}
            />

          
            <>
              <Text className="text-xl font-JakartaBold mt-5 mb-3">
                Your current location
              </Text>
              <View className="flex flex-row items-center bg-transparent h-[300px]">
                <Map/> 
              </View>
            </>

            {!isCheckingDriver && !isDriver && (
              <TouchableOpacity 
                onPress={() => router.push('/(root)/driverInfo')}
                className="bg-white p-4 rounded-2xl my-5 flex-row items-center justify-between shadow-lg"
                style={{
                  elevation: 3,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                }}
              >
                <View className="flex-1">
                  <Text className="text-gray-900 text-lg font-bold mb-1">Become a Driver</Text>
                  <Text className="text-gray-600">Earn money by giving rides</Text>
                </View>
                <View className="bg-orange-500 px-4 py-2 rounded-full">
                  <Text className="text-white font-medium">Register</Text>
                </View>
              </TouchableOpacity>
            )}

          
            {/* Suggested Rides and Available Rides Side by Side */}
            <View className="flex-row-reverse items-center justify-between mt-5 mb-3">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    router.push('/create-ride');
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
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 20,
                    }}
                  >
                    <MaterialIcons name="add" size={20} color="#666666" />
                    <Text className="text-secondary-700 font-CairoBold text-sm ml-1 mt-1">
                      New Ride
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
               
              </View>
              <Text className="text-xl font-JakartaBold">
                Suggested Rides
              </Text>
            </View>
            <SuggestedRides key={refreshKey} refreshKey={refreshKey} />


            <TouchableOpacity 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/(root)/(tabs)/barriers');
              }}
              className="bg-white p-4 rounded-2xl my-5 flex-row items-center justify-between shadow-lg"
              style={{
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
              }}
            >
              <View className="flex-1">
                <Text className="text-gray-900 text-lg font-bold mb-1">حواجز الصمود</Text>
                <Text className="text-gray-600">تعرف على تأثير الحواجز في فلسطين</Text>
              </View>
              <View className="bg-orange-500 px-4 py-2 rounded-full">
                <Text className="text-white font-medium">استكشف</Text>
              </View>
            </TouchableOpacity>
          </>
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={["#000", "#000"]}
            tintColor="#000"
          />
        }
      />

      <StatusBar backgroundColor="#f97316" style="dark" />
    </SafeAreaView>
  );
}