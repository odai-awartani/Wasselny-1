import { useState, useEffect, useCallback } from "react";
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

interface RideRequestData {
  origin_address: string;
  destination_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  destination_street: any;
  ride_datetime: any;
  ride_days: any;
  required_gender: any;
  available_seats: any;
  // car_image: string;
  no_smoking: boolean;
  no_children: boolean;
  no_music: boolean;
  driver_id: any;
  user_id: string;
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
  const [carImage, setCarImage] = useState<string | null>(null);
  const [rules, setRules] = useState({
    noSmoking: false,
    noChildren: false,
    noMusic: false,
  });

  useEffect(() => {
    const getPermission = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("لا توجد صلاحيات للوصول إلى المعرض");
      }
    };
    getPermission();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        console.log("تم اختيار الصورة بنجاح:", result.assets[0].uri);
        setCarImage(result.assets[0].uri);
      } else {
        Alert.alert("لم يتم اختيار صورة.");
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء اختيار الصورة.");
    }
  }, []);

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

      if (!carImage) {
        Alert.alert("خطأ", "يجب اختيار صورة للسيارة.");
        return;
      }

      const token = await getToken();
      if (!token) {
        throw new Error("Authentication failed");
      }

      const uploadedImageUrl = await uploadImageToCloudinary(carImage);
      console.log("رابط الصورة بعد الرفع:", uploadedImageUrl);

      if (!uploadedImageUrl) {
        Alert.alert("خطأ", "فشل في رفع صورة السيارة.");
        return;
      }

      const rideData: RideRequestData = {
        origin_address: userAddress,
        destination_address: destinationAddress,
        origin_latitude: userLatitude,
        origin_longitude: userLongitude,
        destination_latitude: destinationLatitude,
        destination_longitude: destinationLongitude,
        destination_street: params.destination_street,
        ride_datetime: params.ride_datetime,
        ride_days: params.ride_days,
        required_gender: params.required_gender,
        available_seats: params.available_seats,
        // car_image: uploadedImageUrl,
        no_smoking: rules.noSmoking || false,
        no_children: rules.noChildren || false,
        no_music: rules.noMusic || false,
        driver_id: params.driver_id || 1,
        user_id: user?.id,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("/(api)/rides/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(rideData),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create ride");
      }

      const result = await response.json();
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
    carImage,
    params,
    rules,
    user,
    getToken,
    
  ]);

  return (
    <RideLayout title="معلومات السيارة" snapPoints={["65%", "85%", "100%"]}>
      <>
        <ScrollView className="px-4 py-6">
          <Text className="text-2xl font-JakartaBold text-right mb-6">معلومات السيارة</Text>

          <View className="mb-6 items-center">
            <TouchableOpacity
              onPress={pickImage}
              className="w-full h-48 bg-gray-100 rounded-lg border-dashed border-2 border-gray-300 justify-center items-center"
            >
              {carImage ? (
                <>
                  <Image
                    source={{ uri: carImage }}
                    className="w-full h-full rounded-lg"
                    resizeMode="cover"
                  />
                  <Text className="absolute text-gray-500">اضغط لتغيير الصورة</Text>
                </>
              ) : (
                <>
                  <Image source={icons.upload} className="w-12 h-12 mb-2" />
                  <Text className="text-gray-500">اضغط لاختيار صورة للسيارة</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

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
              className={`flex-row justify-between items-center p-4 mb-6 rounded-lg ${
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
            className="my-10"
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
      </>
    </RideLayout>
  );
};

export default CarInfoScreen;