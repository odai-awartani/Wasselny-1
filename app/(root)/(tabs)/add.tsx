import { useState, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "@/lib/upload";
import { useRouter } from "expo-router";
import CustomButton from "@/components/CustomButton";
import { icons } from "@/constants";
import { useUser } from "@clerk/clerk-expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import InputField from "@/components/InputField";

const Add = () => {
  const { user } = useUser();
  const router = useRouter();
  const [driverData, setDriverData] = useState({
    carType: "",
    carSeats: "",
    carImage: null,
    profileImage: null,
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDriverChecked, setIsDriverChecked] = useState(false);

  // تحسين fetch مع إدارة أفضل للأخطاء
  const checkDriverStatus = useCallback(async () => {
    try {
      if (!user?.id) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch("/(api)/driver/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.isDriver && data.driverId) {
        await AsyncStorage.setItem('driverData', JSON.stringify(data));
        router.replace({
          pathname: "/(root)/locationInfo",
          params: { driverId: data.driverId },
        });
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("تحذير", "يجب منح صلاحيات الوصول إلى المعرض");
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error("Error checking driver status:", error);
      }
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

      setDriverData(prev => ({
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
      const { carType, carSeats, carImage, profileImage } = driverData;
      
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

      const payload = {
        user_id: user?.id,
        car_type: carType.trim(),
        car_image_url: carImageUrl,
        profile_image_url: profileImageUrl,
        car_seats: Number(carSeats),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch("/(api)/driver/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "فشل في إنشاء حساب السائق");
      }

      const responseData = await response.json();
      const driverId = responseData.data?.id;

      if (!driverId) {
        throw new Error("استجابة غير صالحة من الخادم");
      }

      // حفظ البيانات محليًا
      await AsyncStorage.setItem('driverData', JSON.stringify({
        ...payload,
        id: driverId,
      }));

      Alert.alert("نجاح", "تم تسجيلك كسائق بنجاح", [
        { text: "حسناً", onPress: () => router.push({
          pathname: "/(root)/locationInfo",
          params: { driverId },
        })}
      ]);
    } catch (error: any) {
      console.error("Registration error:", error);
      Alert.alert("خطأ", error.message || "حدث خطأ أثناء التسجيل");
    } finally {
      setIsLoading(false);
    }
  }, [driverData, user, router]);

  if (!isDriverChecked) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-xl text-gray-600">جارٍ التحقق من البيانات...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 p-6 bg-gray-50">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-bold text-center text-black mb-6">تسجيل كسائق</Text>
      
        <InputField 
          label="نوع السيارة"
          value={driverData.carType}
          onChangeText={(text) => setDriverData(prev => ({ ...prev, carType: text }))}
          placeholder="مثال: تويوتا كورولا"
          className="border border-orange-500  placeholder:font-CairoBold"
          labelStyle="text-lg text-right text-gray-700 mb-4 font-CairoBold"
          maxLength={30}
        />
        
        <InputField 
          label="عدد المقاعد"
          value={driverData.carSeats}
          onChangeText={(text) => setDriverData(prev => ({ ...prev, carSeats: text }))}
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
            {driverData.carImage ? (
              <Image 
                source={{ uri: driverData.carImage }} 
                className="w-full h-full rounded-lg" 
                resizeMode="cover" 
                onError={() => setDriverData(prev => ({ ...prev, carImage: null }))}
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
            {driverData.profileImage ? (
              <Image 
                source={{ uri: driverData.profileImage }} 
                className="w-full h-full rounded-lg" 
                resizeMode="cover" 
                onError={() => setDriverData(prev => ({ ...prev, profileImage: null }))}
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

export default Add;