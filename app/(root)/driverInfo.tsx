import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "@/lib/upload";
import { useRouter } from "expo-router";
import CustomButton from "@/components/CustomButton";
import { icons, images } from "@/constants";
import { useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import InputField from "@/components/InputField";
import { db } from "@/lib/firebase";
import { doc, updateDoc, setDoc, getDoc, collection, addDoc } from "firebase/firestore";
import { ActivityIndicator } from "react-native";
interface DriverFormData {
  carType: string;
  carSeats: string;
  carImage: string | null;
  profileImage: string | null;
}

interface FirebaseDriverData {
  car_type: string;
  car_image_url: string;
  profile_image_url: string;
  car_seats: number;
  created_at: string;
  is_active: boolean;
}

const driverInfo = () => {
  const { user } = useUser();
  const router = useRouter();
  const [driverFormData, setDriverFormData] = useState<DriverFormData>({
    carType: "",
    carSeats: "",
    carImage: null,
    profileImage: null,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDriverChecked, setIsDriverChecked] = useState(false);

  const checkDriverStatus = useCallback(async () => {
    try {
      if (!user?.id) {
        console.log("No user ID available");
        return;
      }

      console.log("Checking driver status for user:", user.id);
      
      // Get user document from Firestore
      const userDoc = await getDoc(doc(db, "users", user.id));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Check if user has driver data
        if (userData.driver) {
          if (userData.driver.status === 'pending') {
            Alert.alert(
              "تنبيه",
              "لديك طلب قيد المراجعة. يرجى الانتظار حتى يتم مراجعة طلبك من قبل الإدارة."
            );
            router.replace("/(root)/(tabs)/home");
            return;
          } else if (userData.driver.status === 'rejected') {
            Alert.alert(
              "تنبيه",
              `تم رفض طلبك السابق للأسباب التالية:\n${userData.driver.rejection_reason || 'لم يتم تحديد السبب'}\n\nيمكنك تعديل بياناتك وإعادة التقديم.`
            );
            // Pre-fill the form with existing data
            setDriverFormData({
              carType: userData.driver.car_type || "",
              carSeats: userData.driver.car_seats?.toString() || "",
              carImage: userData.driver.car_image_url || null,
              profileImage: userData.driver.profile_image_url || null,
            });
          } else if (userData.driver.is_active) {
            console.log("User is a driver, redirecting to locationInfo");
            await AsyncStorage.setItem('driverData', JSON.stringify(userData.driver));
            router.replace({
              pathname: "/(root)/locationInfo",
              params: { driverId: user.id },
            });
            return;
          }
        }
      }
      
      console.log("User is not a driver, requesting media permissions");
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تحذير", "يجب منح صلاحيات الوصول إلى المعرض");
      }
    } catch (error: any) {
      console.error("Error checking driver status:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء التحقق من حالة السائق");
    } finally {
      setIsDriverChecked(true);
    }
  }, [user, router]);

  useEffect(() => {
    let isMounted = true;
    
    if (isMounted) {
      checkDriverStatus();
    }

    return () => {
      isMounted = false;
    };
  }, [checkDriverStatus]);

  // تحسين اختيار الصور مع تحقق إضافي
  const pickImage = useCallback(async (type: "car" | "profile") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) return;

      // تحقق إضافي من نوع الملف
      const fileExtension = asset.uri.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
        Alert.alert("خطأ", "يجب اختيار صورة بصيغة JPG أو PNG");
        return;
      }

      if ((asset.fileSize || 0) > 5 * 1024 * 1024) {
        Alert.alert("خطأ", "حجم الصورة يجب أن يكون أقل من 5MB");
        return;
      }

      setDriverFormData(prev => ({
        ...prev,
        [type === "car" ? "carImage" : "profileImage"]: asset.uri,
      }));
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("خطأ", "حدث خطأ أثناء اختيار الصورة");
    }
  }, []);

  // تحسين تسجيل السائق مع إدارة أفضل للطلبات
  const handleRegister = useCallback(async () => {
    setIsLoading(true);

    try {
      const { carType, carSeats, carImage, profileImage } = driverFormData;
      
      // تحقق شامل من البيانات
      if (!carType.trim() || !carSeats || !carImage || !profileImage) {
        throw new Error("يجب تعبئة جميع الحقول المطلوبة");
      }

      if (isNaN(Number(carSeats)) || Number(carSeats) < 1 || Number(carSeats) > 10) {
        throw new Error("عدد المقاعد يجب أن يكون بين 1 و 10");
      }

      const [carImageUrl, profileImageUrl] = await Promise.all([
        uploadImageToCloudinary(carImage),
        uploadImageToCloudinary(profileImage),
      ]);

      if (!carImageUrl || !profileImageUrl) {
        throw new Error("فشل في تحميل الصور، يرجى المحاولة لاحقًا");
      }

      // Create driver data object
      const driverData = {
        car_type: carType.trim(),
        car_image_url: carImageUrl,
        profile_image_url: profileImageUrl,
        car_seats: Number(carSeats),
        created_at: new Date().toISOString(),
        is_active: false,
        status: 'pending',
        user_id: user?.id,
        user_name: user?.fullName,
        user_email: user?.primaryEmailAddress?.emailAddress,
        rejection_reason: null // Clear any previous rejection reason
      };

      // Get user reference using Clerk ID
      const userRef = doc(db, "users", user?.id!);
      
      // Update the existing user document with driver data and profile image
      await updateDoc(userRef, {
        driver: driverData,
        profile_image_url: profileImageUrl
      });

      // Create notification for admin
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        type: 'driver_request',
        title: 'طلب جديد للتسجيل كسائق',
        message: `طلب جديد من ${user?.fullName} للتسجيل كسائق`,
        created_at: new Date(),
        read: false,
        user_id: 'admin', // This will be received by all admin users
        data: {
          driver_id: user?.id,
          driver_name: user?.fullName,
          car_type: carType.trim(),
          car_seats: Number(carSeats)
        }
      });

      // Save to AsyncStorage for local access
      await AsyncStorage.setItem('driverData', JSON.stringify(driverData));

      // Recheck driver status to update tabs

      Alert.alert("نجاح", "تم تقديم طلب التسجيل كسائق بنجاح. سيتم مراجعة طلبك من قبل الإدارة", [
        { text: "حسناً", onPress: () => router.push("/(root)/(tabs)/home")}
      ]);
    } catch (error: any) {
      console.error("Registration error:", error);
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء التسجيل");
    } finally {
      setIsLoading(false);
    }
  }, [driverFormData, user, router]);

  if (!isDriverChecked) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white px-4">
        <Image
          source={images.loadingCar} // تأكد إنك تضيف صورة gif مناسبة داخل مجلد الصور
          className="w-40 h-40 mb-6"
          resizeMode="contain"
        />
        <Text className="text-xl font-CairoBold text-orange-500 mb-2">
          جاري التحقق من بياناتك...
        </Text>
        <Text className="text-base text-gray-500 text-center">
          برجاء الانتظار قليلاً أثناء التحقق من حالة حسابك كسائق
        </Text>
        <ActivityIndicator size="large" color="#F97316" className="mt-6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 p-6 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-center text-black mb-6">تسجيل كسائق</Text>
      
        <InputField 
          label="نوع السيارة"
          value={driverFormData.carType}
          onChangeText={(text) => setDriverFormData(prev => ({ ...prev, carType: text }))}
          placeholder="مثال: تويوتا كورولا"
          className="border border-orange-500  placeholder:font-CairoBold"
          labelStyle="text-lg text-right text-gray-700 mb-4 font-CairoBold"
          maxLength={30}
        />
        
        <InputField 
          label="عدد المقاعد"
          value={driverFormData.carSeats}
          onChangeText={(text) => setDriverFormData(prev => ({ ...prev, carSeats: text }))}
          placeholder="مثال: 4"
          keyboardType="number-pad"
          className="border border-orange-500 placeholder:font-CairoBold"
          labelStyle="text-lg text-right text-gray-700 mb-4 font-CairoBold"
          maxLength={2}
        />  
        
        <Text className="text-lg text-right text-gray-700 mb-4 font-CairoBold">صورة السيارة</Text>
        <View className="mb-6 items-center">
          <TouchableOpacity
            onPress={() => pickImage("car")}
            className="w-full h-48 bg-gray-100 rounded-lg border-dashed border-2 border-gray-300 justify-center items-center"
            >
            {driverFormData.carImage ? (
              <Image 
                source={{ uri: driverFormData.carImage }} 
                className="w-full h-full rounded-lg" 
                resizeMode="cover" 
                onError={() => setDriverFormData(prev => ({ ...prev, carImage: null }))}
              />
            ) : (
              <>
                <Image source={icons.upload} className="w-12 h-12 mb-2" />
                <Text className="text-gray-500">اضغط لاختيار صورة للسيارة</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
        
        <Text className="text-lg text-right text-gray-700 mb-4 font-CairoBold">صورة البروفايل</Text>
        <View className="mb-6 items-center">
          <TouchableOpacity
            onPress={() => pickImage("profile")}
            className="w-full h-48 bg-gray-100 rounded-lg border-dashed border-2 border-gray-300 justify-center items-center"
            >
            {driverFormData.profileImage ? (
              <Image 
                source={{ uri: driverFormData.profileImage }} 
                className="w-full h-full rounded-lg" 
                resizeMode="cover" 
                onError={() => setDriverFormData(prev => ({ ...prev, profileImage: null }))}
              />
            ) : (
              <>
                <Image source={icons.upload} className="w-12 h-12 mb-2" />
                <Text className="text-gray-500">اضغط لاختيار صورة للبروفايل</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View className="pb-20 items-center">
          <CustomButton 
            title={isLoading ? "جاري التسجيل..." : "التسجيل كـ سائق"}
            onPress={handleRegister}
            disabled={isLoading}
            className="w-full"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default driverInfo;