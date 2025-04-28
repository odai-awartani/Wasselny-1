import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { icons, images } from "@/constants";
import CustomButton from "@/components/CustomButton";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import RideLayout from "@/components/RideLayout";
import { uploadImageToCloudinary } from "@/lib/upload";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import ReactNativeModal from "react-native-modal";
import { useLocationStore } from "@/store";
import { doc, setDoc, getDocs, collection, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { scheduleDriverRideReminder } from '@/lib/notifications';

interface RideRequestData {
  origin_address: string;
  destination_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  destination_street: string;
  ride_datetime: string;
  ride_days: string[];
  required_gender: string;
  available_seats: number;
  no_smoking: boolean;
  no_children: boolean;
  no_music: boolean;
  driver_id: string;
  user_id: string;
  is_recurring: boolean;
  status: string;
  created_at: Date;
  ride_number: number;
}

const CarInfoScreen = () => {
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();
  const {
    userAddress,
    destinationAddress,
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  const params = useLocalSearchParams();
  const [success, setSuccess] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [rules, setRules] = useState({
    noSmoking: false,
    noChildren: false,
    noMusic: false,
  });

  const toggleRule = useCallback((rule: keyof typeof rules) => {
    setRules((prev) => ({
      ...prev,
      [rule]: !prev[rule],
    }));
  }, []);

  const handleConfirmRide = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!userAddress || !destinationAddress || !user?.id) {
        throw new Error("Missing required ride information");
      }

      if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
        throw new Error("Invalid location coordinates");
      }

      // Get and validate the ride datetime
      let rideDateTimeStr = params.ride_datetime as string;
      if (!rideDateTimeStr) {
        throw new Error("Ride date and time are required");
      }

      // Validate that the selected time is at least one hour from now
      const [datePart, timePart] = rideDateTimeStr.split(' ');
      const [day, month, year] = datePart.split('/').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);
      const selectedDateTime = new Date(year, month - 1, day, hours, minutes);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000); // Add one hour to current time

      // Check if it's the same day
      const isSameDay = selectedDateTime.getDate() === now.getDate() &&
                        selectedDateTime.getMonth() === now.getMonth() &&
                        selectedDateTime.getFullYear() === now.getFullYear();

      if (isSameDay && selectedDateTime <= oneHourFromNow) {
        Alert.alert(
          "خطأ في الوقت",
          "يجب اختيار وقت بعد ساعة واحدة على الأقل من الآن"
        );
        setIsLoading(false);
        return;
      }

      if (selectedDateTime < now) {
        Alert.alert(
          "خطأ في التاريخ",
          "لا يمكن اختيار تاريخ في الماضي"
        );
        setIsLoading(false);
        return;
      }

      // Check for time conflicts
      const ridesRef = collection(db, "rides");
      const conflictQuery = query(
        ridesRef,
        where("driver_id", "==", user.id),
        where("status", "in", ["pending", "active"])
      );
      
      const conflictSnapshot = await getDocs(conflictQuery);
      let hasConflict = false;

      try {
        // Parse the date string correctly
        let newRideDate: Date;
        if (typeof rideDateTimeStr === 'string') {
          // Handle DD/MM/YYYY HH:mm format
          const [datePart, timePart] = rideDateTimeStr.split(' ');
          const [day, month, year] = datePart.split('/');
          const [hours, minutes] = timePart.split(':');
          
          newRideDate = new Date(
            parseInt(year),
            parseInt(month) - 1, // months are 0-based
            parseInt(day),
            parseInt(hours),
            parseInt(minutes)
          );
        } else {
          newRideDate = new Date(rideDateTimeStr);
        }

        if (isNaN(newRideDate.getTime())) {
          console.error("Invalid date format:", rideDateTimeStr);
          throw new Error("Invalid date format for new ride");
        }

        // Define the 15-minute window in milliseconds
        const fifteenMinutes = 15 * 60 * 1000;

        conflictSnapshot.forEach((doc) => {
          const existingRide = doc.data();
          const existingRideDateStr = existingRide.ride_datetime;
          
          if (!existingRideDateStr) return;

          let existingRideDate: Date;
          if (typeof existingRideDateStr === 'string') {
            // Handle DD/MM/YYYY HH:mm format for existing rides
            const [datePart, timePart] = existingRideDateStr.split(' ');
            const [day, month, year] = datePart.split('/');
            const [hours, minutes] = timePart.split(':');
            
            existingRideDate = new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day),
              parseInt(hours),
              parseInt(minutes)
            );
          } else {
            existingRideDate = new Date(existingRideDateStr);
          }

          if (isNaN(existingRideDate.getTime())) {
            console.error("Invalid date format for existing ride:", existingRideDateStr);
            return;
          }

          // Calculate the time difference
          const timeDiff = newRideDate.getTime() - existingRideDate.getTime();
          
          // Check if the new ride is within 2 minutes before or after the existing ride
          if (Math.abs(timeDiff) < fifteenMinutes) {
            console.log("Time conflict found:", {
              newRideTime: newRideDate.toISOString(),
              existingRideTime: existingRideDate.toISOString(),
              timeDiffMinutes: Math.abs(timeDiff) / (60 * 1000)
            });
            hasConflict = true;
            return;
          }
        });

        if (hasConflict) {
          Alert.alert(
            "Schedule Conflict",
            "You already have a ride scheduled around this time. For scheduling and safety reasons, you can't create another ride within 2 minutes before or after your current ride."
          );
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error("Error in time conflict check:", error);
        Alert.alert(
          "Error",
          "There was an error checking the ride schedule. Please try again."
        );
        setIsLoading(false);
        return;
      }

      // Get the latest ride number
      const q = query(ridesRef, orderBy("ride_number", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      
      let nextRideNumber = 1;
      if (!querySnapshot.empty) {
        const latestRide = querySnapshot.docs[0].data();
        nextRideNumber = (latestRide.ride_number || 0) + 1;
      }

      const rideData: RideRequestData = {
        origin_address: userAddress,
        destination_address: destinationAddress,
        origin_latitude: userLatitude,
        origin_longitude: userLongitude,
        destination_latitude: destinationLatitude,
        destination_longitude: destinationLongitude,
        destination_street: params.destination_street as string || "",
        ride_datetime: rideDateTimeStr,
        ride_days: params.ride_days ? (Array.isArray(params.ride_days) ? params.ride_days : [params.ride_days]) : [],
        required_gender: params.required_gender as string || "any",
        available_seats: parseInt(params.available_seats as string) || 1,
        no_smoking: rules.noSmoking,
        no_children: rules.noChildren,
        no_music: rules.noMusic,
        driver_id: user.id,
        user_id: user.id,
        is_recurring: params.is_recurring === "true",
        status: "pending",
        created_at: new Date(),
        ride_number: nextRideNumber
      };

      // Create a new ride document with the serial number as ID
      const rideRef = doc(db, "rides", nextRideNumber.toString());
      await setDoc(rideRef, rideData);

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
  }, [
    userAddress,
    destinationAddress,
    userLatitude,
    userLongitude,
    destinationLatitude,
    destinationLongitude,
    params,
    rules,
    user,
  ]);

  return (
    <RideLayout title="معلومات السيارة" snapPoints={["65%", "85%", "100%"]}>
      <ScrollView className="px-4 py-6">
        <Text className="text-2xl font-JakartaBold text-right mb-6">معلومات السيارة</Text>

        <View className="border-b border-gray-200 my-4" />

        <View className="mb-6">
          <Text className="text-xl font-JakartaBold text-right mb-4">قوانين السيارة</Text>

          <TouchableOpacity
            className={`flex-row justify-between items-center p-4 mb-3 rounded-lg ${
              rules.noSmoking ? "bg-primary-100 border-orange-500" : "bg-gray-50"
            } border`}
            onPress={() => toggleRule("noSmoking")}
          >
            <Text
              className={`font-JakartaMedium ${rules.noSmoking ? "text-orange-500" : "text-gray-800"}`}
            >
              بدون تدخين
            </Text>
            <View
              className={`w-6 h-6 rounded-full border-2 ${
                rules.noSmoking ? "bg-orange-500 border-orange-500" : "border-gray-400"
              }`}
            >
              {rules.noSmoking && <Image source={icons.checkmark} className="w-5 h-5" />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row justify-between items-center p-4 mb-3 rounded-lg ${
              rules.noChildren ? "bg-primary-100 border-orange-500" : "bg-gray-50"
            } border`}
            onPress={() => toggleRule("noChildren")}
          >
            <Text
              className={`font-JakartaMedium ${rules.noChildren ? "text-orange-500" : "text-gray-800"}`}
            >
              بدون اطفال
            </Text>
            <View
              className={`w-6 h-6 rounded-full border-2 ${
                rules.noChildren ? "bg-orange-500 border-orange-500" : "border-gray-400"
              }`}
            >
              {rules.noChildren && <Image source={icons.checkmark} className="w-5 h-5" />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-row justify-between items-center p-4 rounded-lg ${
              rules.noMusic ? "bg-primary-100 border-orange-500" : "bg-gray-50"
            } border`}
            onPress={() => toggleRule("noMusic")}
          >
            <Text
              className={`font-JakartaMedium ${rules.noMusic ? "text-orange-500" : "text-gray-800"}`}
            >
              بدون اغاني
            </Text>
            <View
              className={`w-6 h-6 rounded-full border-2 ${
                rules.noMusic ? "bg-orange-500 border-orange-500" : "border-gray-400"
              }`}
            >
              {rules.noMusic && <Image source={icons.checkmark} className="w-5 h-5" />}
            </View>
          </TouchableOpacity>
        </View>

        <CustomButton
          title={isLoading ? "Processing..." : "Confirm Ride"}
          onPress={handleConfirmRide}
          disabled={isLoading}
        />
      </ScrollView>
      <ReactNativeModal
        isVisible={success}
        onBackdropPress={() => setSuccess(false)}
        backdropOpacity={0.7}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <Image source={images.check} className="w-28 h-28 mt-5" resizeMode="contain" />

          <Text className="text-2xl text-center font-JakartaBold mt-5">
            Booking placed successfully
          </Text>

          <Text className="text-md text-general-200 font-JakartaRegular text-center mt-3">
            Thank you for your booking. Your reservation has been successfully placed. Please
            proceed with your trip.
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
    </RideLayout>
  );
};

export default CarInfoScreen;