import React from 'react';
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Image, Text, View, Alert } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import RideLayout from "@/components/RideLayout";
import { icons, images } from "@/constants";
import { formatTime } from "@/lib/utils";
import { useDriverStore, useLocationStore } from "@/store";
import CustomButton from "@/components/CustomButton";
import ReactNativeModal from "react-native-modal";
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, sendRideStatusNotification } from "@/lib/notifications";

interface RideRequestData {
  origin_address: string;
  destination_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  ride_time: number;
  fare_price: number;
  payment_status: string;
  driver_id: number;
  user_id: string;
}

const BookRide = () => {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { 
    userAddress, 
    destinationAddress, 
    userLongitude, 
    userLatitude,
    destinationLatitude,
    destinationLongitude 
  } = useLocationStore();
  
  const { drivers, selectedDriver } = useDriverStore();
  const [success, setSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const driverDetails = drivers?.filter(
    (driver) => +driver.id === selectedDriver,
  )[0];

  const handleConfirmRide = async () => {
    setIsLoading(true);
    
    try {
      // Validate required fields
      if (!userAddress || !destinationAddress || !driverDetails?.id || !user?.id) {
        throw new Error('Missing required ride information');
      }

      if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
        throw new Error('Invalid location coordinates');
      }

      // Get authentication token
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication failed');
      }

      // Prepare request data
      const rideData: RideRequestData = {
        origin_address: userAddress,
        destination_address: destinationAddress,
        origin_latitude: userLatitude,
        origin_longitude: userLongitude,
        destination_latitude: destinationLatitude,
        destination_longitude: destinationLongitude,
        ride_time: Math.floor(driverDetails.time || 0),
        fare_price: Math.floor(parseFloat(driverDetails.price || "0") * 100),
        payment_status: "paid",
        driver_id: driverDetails.id,
        user_id: user.id,
      };

      // Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch("/(api)/ride/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(rideData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create ride');
      }

      const result = await response.json();
      
      // Handle successful booking
      setSuccess(true);

    } catch (error: any) {
      console.error("Booking error:", error);
      Alert.alert(
        "Booking Failed",
        error.message || "Could not complete booking. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!driverDetails) {
    return (
      <RideLayout title="Book Ride">
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg font-JakartaRegular">Driver not found</Text>
          <CustomButton
            title="Go Back"
            onPress={() => router.back()}
            className="mt-4"
          />
        </View>
      </RideLayout>
    );
  }


  return (
    <RideLayout title="Book Ride">
      <>
        <Text className="text-xl font-JakartaSemiBold mb-3">
          Ride Information
        </Text>

        <View className="flex flex-col w-full items-center justify-center mt-10">
        <Image
              source={{ uri: driverDetails?.profile_image_url }}
              className="w-28 h-28 rounded-full"
            />
 <View className="flex flex-row items-center justify-center mt-5 space-x-2">
      
       <Text className="text-lg font-JakartaSemiBold">
           {user?.firstName} {user?.lastName}
       </Text>

              <View className="flex flex-row items-center space-x-0.5">
                <Image
                  source={icons.star}
                  className="w-5 h-5"
                  resizeMode="contain"
                />
                <Text className="text-lg font-JakartaRegular">
                  {driverDetails?.rating}
                </Text>
              </View>
            </View>
          </View>
          <View className="flex flex-col w-full items-start justify-center py-3 px-5 rounded-3xl bg-general-600 mt-5">
            <View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
              <Text className="text-lg font-JakartaRegular">Ride Price</Text>
              <Text className="text-lg font-JakartaRegular text-[#0CC25F]">
                ${driverDetails?.price}
              </Text>
            </View>

            <View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
              <Text className="text-lg font-JakartaRegular">Pickup Time</Text>
              <Text className="text-lg font-JakartaRegular">
                {formatTime(driverDetails?.time!)}
              </Text>
            </View>

            <View className="flex flex-row items-center justify-between w-full py-3">
              <Text className="text-lg font-JakartaRegular">Car Seats</Text>
              <Text className="text-lg font-JakartaRegular">
                {driverDetails?.car_seats}
              </Text>
            </View>
          </View>

          <View className="flex flex-col w-full items-start justify-center mt-5">
            <View className="flex flex-row items-center justify-start mt-3 border-t border-b border-general-700 w-full py-3">
              <Image source={icons.to} className="w-6 h-6" />
              <Text className="text-lg font-JakartaRegular ml-2">
                {userAddress}
              </Text>
            </View>

            <View className="flex flex-row items-center justify-start border-b border-general-700 w-full py-3">
              <Image source={icons.point} className="w-6 h-6" />
              <Text className="text-lg font-JakartaRegular ml-2">
                {destinationAddress}
              </Text>
            </View>
          </View>
          
        <CustomButton
          title={isLoading ? "Processing..." : "Confirm Ride"}
          className="my-10"
          onPress={handleConfirmRide}
          disabled={isLoading}
        />

        <ReactNativeModal
          isVisible={success}
          onBackdropPress={() => setSuccess(false)}
          backdropOpacity={0.7}
          animationIn="fadeIn"
          animationOut="fadeOut"
        >
          <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
            <Image 
              source={images.check} 
              className="w-28 h-28 mt-5" 
              resizeMode="contain"
            />

            <Text className="text-2xl text-center font-JakartaBold mt-5">
              Booking placed successfully
            </Text>

            <Text className="text-md text-general-200 font-JakartaRegular text-center mt-3">
              Thank you for your booking. Your reservation has been successfully
              placed. Please proceed with your trip.
            </Text>

            <CustomButton
              title="Back Home"
              onPress={() => {
                setSuccess(false);
                router.push("/(root)/(tabs)/home");
              }}
              className="mt-5"
            />
          </View>
        </ReactNativeModal>
      </>
    </RideLayout>
  );
};

export default BookRide;