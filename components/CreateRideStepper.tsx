import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert, Keyboard, TouchableWithoutFeedback } from "react-native";
import StepIndicator from "react-native-step-indicator";
import GoogleTextInput from "@/components/GoogleTextInput";
import CustomButton from "@/components/CustomButton";
import { icons, images } from "@/constants";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ReactNativeModal from "react-native-modal";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useLocationStore } from "@/store";
import { doc, setDoc, getDocs, collection, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

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

const stepIndicatorStyles = {
  stepIndicatorSize: 30,
  currentStepIndicatorSize: 40,
  separatorStrokeWidth: 3,
  currentStepStrokeWidth: 5,
  stepStrokeCurrentColor: "#f97316",
  separatorFinishedColor: "#f97316",
  separatorUnFinishedColor: "#d1d5db",
  stepIndicatorFinishedColor: "#f97316",
  stepIndicatorUnFinishedColor: "#d1d5db",
  stepIndicatorCurrentColor: "#ffffff",
  stepIndicatorLabelFontSize: 15,
  currentStepIndicatorLabelFontSize: 15,
  stepIndicatorLabelCurrentColor: "#000000",
  stepIndicatorLabelFinishedColor: "#ffffff",
  stepIndicatorLabelUnFinishedColor: "#6b7280",
  labelColor: "#6b7280",
  labelSize: 13,
  currentStepLabelColor: "#f97316",
};

const RideCreationScreen = () => {
  const router = useRouter();
  const { user } = useUser();
  const { userId } = useAuth();
  const {
    userAddress,
    destinationAddress,
    userLatitude,
    userLongitude,
    destinationLatitude,
    destinationLongitude,
    setUserLocation,
    setDestinationLocation,
  } = useLocationStore();

  // States
  const [currentStep, setCurrentStep] = useState(0);
  const [street, setStreet] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [tripDate, setTripDate] = useState("");
  const [tripTime, setTripTime] = useState("");
  const [availableSeats, setAvailableSeats] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isDatePickerVisible, setDatePickerVisible] = useState(false);
  const [isTimePickerVisible, setTimePickerVisible] = useState(false);
  const [rules, setRules] = useState({
    noSmoking: false,
    noChildren: false,
    noMusic: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const genders = ["ذكر", "أنثى", "كلاهما"];
  const steps = ["المواقع", "تفاصيل الرحلة", "قوانين السيارة"];
  const insets = useSafeAreaInsets(); // للحصول على الحواف الآمنة
  // Handlers
  const handleFromLocation = useCallback(
    (location: Location) => {
      setUserLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
      });
    },
    [setUserLocation]
  );

  const handleToLocation = useCallback(
    (location: Location) => {
      setDestinationLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
      });
    },
    [setDestinationLocation]
  );

  const toggleDaySelection = useCallback((day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }, []);

  const getDayOfWeek = (date: Date) => {
    const dayIndex = date.getDay();
    const arabicDaysMap = [1, 2, 3, 4, 5, 6, 0];
    return days[arabicDaysMap[dayIndex]];
  };

  const handleDateConfirm = useCallback(
    (date: Date) => {
      const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1)
        .toString()
        .padStart(2, "0")}/${date.getFullYear()}`;
      setTripDate(formattedDate);
      const dayOfWeek = getDayOfWeek(date);
      if (!selectedDays.includes(dayOfWeek)) {
        setSelectedDays((prev) => [...prev, dayOfWeek]);
      }
      setDatePickerVisible(false);
    },
    [selectedDays]
  );

  const handleTimeConfirm = useCallback((time: Date) => {
    setTripTime(time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setTimePickerVisible(false);
  }, []);

  const handleSeatsChange = useCallback((text: string) => {
    const numericValue = text.replace(/[^0-9]/g, "");
    setAvailableSeats(numericValue);
  }, []);

  const toggleRule = useCallback((rule: keyof typeof rules) => {
    setRules((prev) => ({
      ...prev,
      [rule]: !prev[rule],
    }));
  }, []);

  const validateStep = useCallback(() => {
    if (currentStep === 0) {
      if (!userAddress || !destinationAddress || !street.trim()) {
        Alert.alert("خطأ", "يرجى إدخال موقع البداية، الوجهة، واسم الشارع");
        return false;
      }
    } else if (currentStep === 1) {
      if (selectedDays.length === 0) {
        Alert.alert("خطأ", "يرجى اختيار أيام الرحلة");
        return false;
      }
      if (!isRecurring && !tripDate) {
        Alert.alert("خطأ", "يرجى اختيار تاريخ الرحلة");
        return false;
      }
      if (!tripTime) {
        Alert.alert("خطأ", "يرجى اختيار وقت الرحلة");
        return false;
      }
      const [day, month, year] = tripDate.split("/").map(Number);
      const [hours, minutes] = tripTime.split(":").map(Number);
      const selectedDateTime = new Date(year, month - 1, day, hours, minutes);
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const isSameDay =
        selectedDateTime.getDate() === now.getDate() &&
        selectedDateTime.getMonth() === now.getMonth() &&
        selectedDateTime.getFullYear() === now.getFullYear();
      if (isSameDay && selectedDateTime <= oneHourFromNow) {
        Alert.alert("خطأ", "يجب اختيار وقت بعد ساعة واحدة على الأقل من الآن");
        return false;
      }
      if (selectedDateTime < now) {
        Alert.alert("خطأ", "لا يمكن اختيار تاريخ في الماضي");
        return false;
      }
      if (!availableSeats || isNaN(parseInt(availableSeats)) || parseInt(availableSeats) < 1 || parseInt(availableSeats) > 7) {
        Alert.alert("خطأ", "يرجى إدخال عدد صحيح للمقاعد بين 1 و7");
        return false;
      }
      if (!selectedGender) {
        Alert.alert("خطأ", "يرجى اختيار الجنس المطلوب");
        return false;
      }
    }
    return true;
  }, [
    currentStep,
    userAddress,
    destinationAddress,
    street,
    selectedDays,
    tripDate,
    tripTime,
    availableSeats,
    selectedGender,
    isRecurring,
  ]);

  const handleConfirmRide = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!userAddress || !destinationAddress || !user?.id) {
        throw new Error("بيانات الرحلة غير مكتملة");
      }
      if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
        throw new Error("إحداثيات الموقع غير صالحة");
      }
      const rideDateTimeStr = `${tripDate} ${tripTime}`;
      // التحقق من التعارض الزمني
      const ridesRef = collection(db, "rides");
      const conflictQuery = query(
        ridesRef,
        where("driver_id", "==", user.id),
        where("status", "in", ["pending", "active"])
      );
      const conflictSnapshot = await getDocs(conflictQuery);
      let hasConflict = false;
      const fifteenMinutes = 15 * 60 * 1000;
      const [datePart, timePart] = rideDateTimeStr.split(" ");
      const [day, month, year] = datePart.split("/").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);
      const newRideDate = new Date(year, month - 1, day, hours, minutes);
      if (isNaN(newRideDate.getTime())) {
        throw new Error("تنسيق التاريخ غير صالح");
      }
      conflictSnapshot.forEach((doc) => {
        const existingRide = doc.data();
        const existingRideDateStr = existingRide.ride_datetime;
        if (!existingRideDateStr) return;
        const [exDatePart, exTimePart] = existingRideDateStr.split(" ");
        const [exDay, exMonth, exYear] = exDatePart.split("/").map(Number);
        const [exHours, exMinutes] = exTimePart.split(":").map(Number);
        const existingRideDate = new Date(exYear, exMonth - 1, exDay, exHours, exMinutes);
        if (isNaN(existingRideDate.getTime())) return;
        const timeDiff = newRideDate.getTime() - existingRideDate.getTime();
        if (Math.abs(timeDiff) < fifteenMinutes) {
          hasConflict = true;
        }
      });
      if (hasConflict) {
        Alert.alert("تعارض زمني", "لديك رحلة مجدولة في نفس الوقت تقريبًا");
        setIsLoading(false);
        return;
      }
      // الحصول على رقم الرحلة التالي
      const q = query(ridesRef, orderBy("ride_number", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      let nextRideNumber = 1;
      if (!querySnapshot.empty) {
        const latestRide = querySnapshot.docs[0].data();
        nextRideNumber = (latestRide.ride_number || 0) + 1;
      }
      // إنشاء بيانات الرحلة
      const rideData: RideRequestData = {
        origin_address: userAddress,
        destination_address: destinationAddress,
        origin_latitude: userLatitude,
        origin_longitude: userLongitude,
        destination_latitude: destinationLatitude,
        destination_longitude: destinationLongitude,
        destination_street: street,
        ride_datetime: rideDateTimeStr,
        ride_days: selectedDays,
        required_gender: selectedGender,
        available_seats: parseInt(availableSeats),
        no_smoking: rules.noSmoking,
        no_children: rules.noChildren,
        no_music: rules.noMusic,
        driver_id: user.id,
        user_id: user.id,
        is_recurring: isRecurring,
        status: "pending",
        created_at: new Date(),
        ride_number: nextRideNumber,
      };
      // حفظ الرحلة
      const rideRef = doc(db, "rides", nextRideNumber.toString());
      await setDoc(rideRef, rideData);
      setSuccess(true);
    } catch (error: any) {
      console.error("خطأ في الحجز:", error);
      Alert.alert("فشل الحجز", error.message || "تعذر إتمام الحجز. حاول مرة أخرى.");
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
    street,
    tripDate,
    tripTime,
    selectedDays,
    selectedGender,
    availableSeats,
    rules,
    isRecurring,
    user,
  ]);

  const handleNext = () => {
    if (validateStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <View className="px-4">
            <View className="my-3">
              <Text className="text-lg font-JakartaSemiBold mb-3 text-right">من</Text>
              <GoogleTextInput
                icon={icons.target}
                initialLocation={userAddress || ""}
                containerStyle="bg-neutral-100"
                textInputBackgroundColor="#f5f5f5"
                handlePress={handleFromLocation}
                placeholder="أدخل موقع البداية"
              />
            </View>
            <View className="my-3">
              <Text className="text-lg font-JakartaSemiBold mb-3 text-right">إلى</Text>
              <GoogleTextInput
                icon={icons.map}
                initialLocation={destinationAddress || ""}
                containerStyle="bg-neutral-100"
                textInputBackgroundColor="transparent"
                handlePress={handleToLocation}
                placeholder="أدخل الوجهة"
              />
            </View>
            <View className="my-3">
              <Text className="text-lg font-JakartaSemiBold mb-3 text-right">الشارع</Text>
              <View className="flex-row items-center rounded-xl p-3 bg-neutral-100">
                <Image source={icons.street} className="w-7 h-7 ml-2" />
                <TextInput
                  value={street}
                  onChangeText={setStreet}
                  placeholder="أدخل اسم الشارع"
                  className="flex-1 text-right ml-2.5 mr-5 bg-transparent pt-1 pb-2 font-JakartaBold placeholder:font-CairoBold"
                  placeholderTextColor="gray"
                />
              </View>
            </View>
          </View>
        );
      case 1:
        return (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 10,
            }}
            className="h-[72%] "
          >
            
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View className="px-4 w-full">
              <View className="mb-4">
                <Text className="text-lg font-JakartaMedium text-right mb-2">تاريخ الرحلة</Text>
                <TouchableOpacity onPress={() => setDatePickerVisible(true)}>
                  <View className="flex-row items-center border border-gray-300 rounded-lg p-3">
                    <Text className="flex-1 text-right">{tripDate || "اختر التاريخ"}</Text>
                    <Image source={icons.calendar} className="w-5 h-5" />
                  </View>
                </TouchableOpacity>
              </View>
              <View className="mb-4">
                <Text className="text-lg font-JakartaMedium text-right mb-2">وقت الرحلة</Text>
                <TouchableOpacity onPress={() => setTimePickerVisible(true)}>
                  <View className="flex-row items-center border border-gray-300 rounded-lg p-3">
                    <Text className="flex-1 text-right">{tripTime || "اختر الوقت"}</Text>
                    <Image source={icons.clock} className="w-5 h-5" />
                  </View>
                </TouchableOpacity>
              </View>
              <View className="mb-2">
                <Text className="text-lg font-JakartaMedium text-right mb-2">حدد أيام الرحلة</Text>
                <View className="flex-row flex-wrap justify-between">
                  {days.map((day) => (
                    <TouchableOpacity
                      key={day}
                      className={`p-3 mb-2 rounded-lg border ${
                        selectedDays.includes(day)
                          ? "bg-orange-500 border-orange-500"
                          : "border-gray-300"
                      }`}
                      style={{ width: "30%" }}
                      onPress={() => toggleDaySelection(day)}
                    >
                      <Text
                        className={`text-center ${
                          selectedDays.includes(day) ? "text-white" : "text-gray-800"
                        }`}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View className="mb-4">
                <Text className="text-lg font-JakartaMedium text-right mb-2">عدد المقاعد المتاحة</Text>
                <TextInput
                  className="border border-gray-300 rounded-lg p-3 text-right"
                  value={availableSeats}
                  onChangeText={handleSeatsChange}
                  placeholder="حدد عدد المقاعد"
                  keyboardType="numeric"
                />
              </View>
              <View>
                <Text className="text-lg font-JakartaMedium text-right mb-2">الجنس المطلوب</Text>
                <View className="flex-row flex-wrap justify-between">
                  {genders.map((gender) => (
                    <TouchableOpacity
                      key={gender}
                      className={`p-3 mb-5 rounded-lg border ${
                        selectedGender === gender
                          ? "bg-orange-500 border-orange-500"
                          : "border-gray-300"
                      }`}
                      style={{ width: "30%" }}
                      onPress={() => setSelectedGender(gender)}
                    >
                      <Text
                        className={`text-center ${
                          selectedGender === gender ? "text-white" : "text-gray-800"
                        }`}
                      >
                        {gender}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View className="mb-1">
                <Text className="text-lg font-JakartaMedium text-right mb-2">هل الرحلة متكررة؟</Text>
                <View className="flex-row">
                  <TouchableOpacity
                    className={`p-3 mb-2 mr-2 rounded-lg border ${
                      isRecurring ? "bg-orange-500 border-orange-500" : "border-gray-300"
                    }`}
                    style={{ width: "45%" }}
                    onPress={() => setIsRecurring(true)}
                  >
                    <Text
                      className={`text-center text-base ${
                        isRecurring ? "text-white" : "text-gray-800"
                      }`}
                    >
                      نعم
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`p-3 mb-2 ml-2 rounded-lg border ${
                      !isRecurring ? "bg-orange-500 border-orange-500" : "border-gray-300"
                    }`}
                    style={{ width: "45%" }}
                    onPress={() => setIsRecurring(false)}
                  >
                    <Text
                      className={`text-center text-base ${
                        !isRecurring ? "text-white" : "text-gray-800"
                      }`}
                    >
                      لا
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
            </ScrollView>
        );
      case 2:
        return (
          <View className="px-4">
            <Text className="text-xl font-JakartaBold text-right mb-4">قوانين السيارة</Text>
            <TouchableOpacity
              className={`flex-row justify-between items-center p-4 mb-3 rounded-lg ${
                rules.noSmoking ? "bg-primary-100 border-orange-500" : "bg-gray-50"
              } border`}
              onPress={() => toggleRule("noSmoking")}
            >
              <Text
                className={`font-JakartaMedium ${
                  rules.noSmoking ? "text-orange-500" : "text-gray-800"
                }`}
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
                className={`font-JakartaMedium ${
                  rules.noChildren ? "text-orange-500" : "text-gray-800"
                }`}
              >
                بدون أطفال
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
                بدون أغاني
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
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} >
      <View className="flex  justify-between h-full">
      <View className="px-4 py-6">
        <View className="mb-6">
          <StepIndicator
            customStyles={stepIndicatorStyles}
            currentPosition={currentStep}
            labels={steps}
            stepCount={steps.length}
          />
        </View>
        {renderStepContent()}
        </View>
        <View
        style={{
          position: "absolute",
          bottom: insets.bottom + 45,
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: currentStep === 0 ? "flex-end" : "space-between",
          paddingHorizontal: 8,
        }}
      >
        {currentStep !== 0 && (
          <CustomButton
            title="رجوع"
            onPress={handleBack}
            className="w-[45%]"
            disabled={isLoading}
            bgVariant={currentStep === 1 ? "secondary" : "primary"}            
          />
        )}
        <CustomButton
          title={currentStep === steps.length - 1 ? "تأكيد الرحلة" : "التالي"}
          onPress={currentStep === steps.length - 1 ? handleConfirmRide : handleNext}
          className={currentStep === 0 ? "w-[100%]" : "w-[45%]"}
          disabled={isLoading}
          bgVariant={currentStep === 1 ? "success" : "success"}
        />
      </View>
      </View>
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={new Date()}
        minimumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
      />
      <DateTimePickerModal
        isVisible={isTimePickerVisible}
        mode="time"
        date={new Date()}
        onConfirm={handleTimeConfirm}
        onCancel={() => setTimePickerVisible(false)}
      />
      <ReactNativeModal
        isVisible={success}
        onBackdropPress={() => setSuccess(false)}
        backdropOpacity={0.7}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <Image source={images.check} className="w-28 h-28 mt-5" resizeMode="contain" />
          <Text className="text-2xl text-center font-CairoBold mt-5">
            تم إنشاء الرحلة بنجاح
          </Text>
          <Text className="text-md text-general-200 font-CairoRegular text-center mt-3">
              شكرًا لإنشاء الرحلة. يرجى المتابعة مع رحلتك.
          </Text>
          <CustomButton
            title="العودة للرئيسية"
            onPress={() => {
              setSuccess(false);
              router.push("/(root)/(tabs)/home");
            }}
            className="mt-5"
          />
        </View>
      </ReactNativeModal>
    </SafeAreaView>
  );
};

export default RideCreationScreen;
