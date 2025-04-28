import React, { useEffect, useState, useCallback } from "react";
import GoogleTextInput from "@/components/GoogleTextInput";
import Map from "@/components/Map";
import RideCard from "@/components/RideCard";
import SuggestedRides from "@/components/SuggestedRides";
import { icons } from '@/constants';
import { useNotifications } from '@/context/NotificationContext';
import { useLocationStore } from "@/store";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Image, RefreshControl, TouchableOpacity, Alert } from "react-native";

import { Text, View } from "react-native";
import { FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import { useDriverStore } from '@/store';
import { Ride } from "@/types/type";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

  // Check driver status when component mounts
  useEffect(() => {
    checkIfUserIsDriver();
  }, [user?.id]);

  // Recheck driver status when screen comes into focus
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
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setHasPermission(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords?.latitude!,
        longitude: location.coords?.longitude!,
      });
      setUserLocation({
        latitude: location.coords?.latitude,
        longitude: location.coords?.longitude,
        address: `${address[0].name}, ${address[0].region}`,
      });
    };
    requestLocation();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh location data
      const location = await Location.getCurrentPositionAsync({});
      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords?.latitude!,
        longitude: location.coords?.longitude!,
      });
      setUserLocation({
        latitude: location.coords?.latitude,
        longitude: location.coords?.longitude,
        address: `${address[0].name}, ${address[0].region}`,
      });
      
      // Force SuggestedRides to refresh
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
            <View className="flex flex-row items-center justify-between my-5">
              <Text className="text-2xl font-JakartaExtraBold">
                Welcome{","} {user?.firstName}👋
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(root)/notifications')}
                className="justify-center items-center w-10 h-10 rounded-full bg-white shadow-sm"
              >
                <Image 
                  source={icons.ring1} 
                  className="w-5 h-5" 
                  tintColor="#374151"
                />
                {/* Red notification dot */}
                {unreadCount > 0 && (
                  <View className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full items-center justify-center">
                    <Text className="text-[10px] text-white font-JakartaBold">{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <GoogleTextInput
              icon={icons.search}
              containerStyle="bg-white shadow-md shadow-neutral-300"
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

            <Text className="text-xl font-JakartaBold mt-5 mb-3">
              Suggested Rides
            </Text>
            <SuggestedRides key={refreshKey} refreshKey={refreshKey} />
          </>
        }
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={["#F97316"]} // Orange color for Android
            tintColor="#F97316" // Orange color for iOS
          />
        }
      />
      <StatusBar backgroundColor="#fff" style="dark" />
    </SafeAreaView>
  );
}