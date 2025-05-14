import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import Map from '@/components/Map';
import { useLocationStore } from '@/store';
import * as Location from 'expo-location';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Track() {
  const { t, language } = useLanguage();
  const { user } = useUser();
  const { userLatitude, userLongitude } = useLocationStore();
  const [isLoading, setIsLoading] = useState(true);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<any>(null);
  const [estimatedArrivalTime, setEstimatedArrivalTime] = useState<string>('');
  const [safetyStatus, setSafetyStatus] = useState<'safe' | 'warning' | 'alert'>('safe');

  useEffect(() => {
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
  }, [user?.id]);

  const handleEmergencyContact = () => {
    Alert.alert(
      t.emergencyContact,
      t.emergencyContactDescription,
      [
        {
          text: t.callEmergency,
          onPress: () => {
            // Implement emergency call functionality
            console.log('Emergency call initiated');
          },
          style: 'destructive'
        },
        {
          text: t.cancel,
          style: 'cancel'
        }
      ]
    );
  };

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
        <Text className={`text-xl ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900`}>
          {t.trackRide}
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
        <Text className={`text-center ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} ${safetyStatus === 'safe' ? 'text-green-600' : safetyStatus === 'warning' ? 'text-yellow-600' : 'text-red-600'}`}>
          {safetyStatus === 'safe' ? t.rideInProgress : safetyStatus === 'warning' ? t.rideDelayed : t.rideAlert}
        </Text>
      </View>

      {/* Map */}
      <View className="flex-1">
        <Map 
          showUserLocation={true}
          showDriverLocation={!!driverLocation}
          driverLocation={driverLocation}
          origin={activeRide?.origin}
          destination={activeRide?.destination}
        />
      </View>

      {/* Ride Info Card */}
      {activeRide && (
        <View className="absolute bottom-0 left-0 right-0 bg-white p-4 rounded-t-3xl shadow-lg" style={styles.cardShadow}>
          <View className={`flex-row items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <View className="flex-1">
              <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900`}>
                {activeRide.driver_name || t.driver}
              </Text>
              <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'}`}>
                {activeRide.car_type} • {activeRide.car_plate}
              </Text>
            </View>
            <View className="bg-orange-100 px-3 py-1 rounded-full">
              <Text className={`text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-orange-600`}>
                {activeRide.status === 'in_progress' ? t.inProgress : t.completed}
              </Text>
            </View>
          </View>

          {/* Estimated Arrival Time */}
          {estimatedArrivalTime && (
            <View className="mt-2 bg-blue-50 p-2 rounded-lg">
              <Text className={`text-center ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-blue-600`}>
                {t.estimatedArrival}: {estimatedArrivalTime}
              </Text>
            </View>
          )}

          <View className="mt-4 space-y-2">
            <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <View className={`w-2 h-2 rounded-full bg-green-500 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              <Text className={`flex-1 text-sm ${language === 'ar' ? 'font-CairoRegular text-right' : 'font-JakartaRegular text-left'}`}>
                {activeRide.origin_address}
              </Text>
            </View>
            <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <View className={`w-2 h-2 rounded-full bg-red-500 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
              <Text className={`flex-1 text-sm ${language === 'ar' ? 'font-CairoRegular text-right' : 'font-JakartaRegular text-left'}`}>
                {activeRide.destination_address}
              </Text>
            </View>
          </View>

          <View className="flex-row mt-4 space-x-2">
            <TouchableOpacity 
              onPress={() => router.push({
                pathname: '/(root)/chat/[id]',
                params: { 
                  id: activeRide.chat_id,
                  name: activeRide.driver_name,
                  avatar: activeRide.driver_image
                }
              })}
              className="flex-1 bg-orange-500 py-3 rounded-xl"
            >
              <Text className={`text-center text-white ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {t.contactDriver}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={handleEmergencyContact}
              className="flex-1 bg-red-500 py-3 rounded-xl"
            >
              <Text className={`text-center text-white ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {t.emergencyContact}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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