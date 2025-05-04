import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  Platform,
  Dimensions,
  ActivityIndicator,
  Animated,
} from "react-native";
import StepIndicator from "react-native-step-indicator";
import GoogleTextInput from "@/components/GoogleTextInput";
import { icons, images } from "@/constants";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ReactNativeModal from "react-native-modal";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useLocationStore } from "@/store";
import { doc, setDoc, getDocs, collection, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

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
  stepIndicatorSize: 35,
  currentStepIndicatorSize: 45,
  separatorStrokeWidth: 3,
  currentStepStrokeWidth: 5,
  stepStrokeCurrentColor: "#f97316",
  separatorFinishedColor: "#f97316",
  separatorUnFinishedColor: "#d1d5db",
  stepIndicatorFinishedColor: "#f97316",
  stepIndicatorUnFinishedColor: "#d1d5db",
  stepIndicatorCurrentColor: "#ffffff",
  stepIndicatorLabelFontSize: 16,
  currentStepIndicatorLabelFontSize: 16,
  stepIndicatorLabelCurrentColor: "#000000",
  stepIndicatorLabelFinishedColor: "#ffffff",
  stepIndicatorLabelUnFinishedColor: "#6b7280",
  labelColor: "#6b7280",
  labelSize: 14,
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

  // Screen dimensions and insets
  const { width } = Dimensions.get("window");
  const insets = useSafeAreaInsets();

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

  // Animation states
  const [nextButtonScale] = useState(new Animated.Value(1));
  const [backButtonScale] = useState(new Animated.Value(1));

  const days = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
  const genders = ["ذكر", "أنثى", "كلاهما"];
  const steps = ["المواقع", "تفاصيل الرحلة", "قوانين السيارة"];

  // Animation handlers
  const animateButton = (scale: Animated.Value, callback: () => void) => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => callback());
  };

  // Handlers
  const handleFromLocation = useCallback(
    (location: Location) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setDestinationLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
      });
    },
    [setDestinationLocation]
  );

  const toggleDaySelection = useCallback((day: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const formattedDate = `${date.getDate().toString().padStart(2, "0")}/${(
        date.getMonth() + 1
      )
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const hours = time.getHours().toString().padStart(2, "0");
    const minutes = time.getMinutes().toString().padStart(2, "0");
    setTripTime(`${hours}:${minutes}`);
    setTimePickerVisible(false);
  }, []);

  const handleSeatsChange = useCallback((text: string) => {
    const numericValue = text.replace(/[^0-9]/g, "");
    setAvailableSeats(numericValue);
  }, []);

  const toggleRule = useCallback((rule: keyof typeof rules) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRules((prev) => ({
      ...prev,
      [rule]: !prev[rule],
    }));
  }, []);

  const validateForm = useCallback(() => {
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
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(tripDate)) {
        Alert.alert("خطأ", "تنسيق التاريخ غير صحيح، يجب أن يكون DD/MM/YYYY");
        return false;
      }
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(tripTime)) {
        Alert.alert("خطأ", "تنسيق الوقت غير صحيح، يجب أن يكون HH:MM");
        return false;
      }
      const [day, month, year] = tripDate.split("/").map(Number);
      const [hours, minutes] = tripTime.split(":").map(Number);
      const selectedDateTime = new Date(year, month - 1, day, hours, minutes);
      if (isNaN(selectedDateTime.getTime())) {
        Alert.alert("خطأ", "تاريخ أو وقت غير صالح");
        return false;
      }
      const now = new Date();
      const oneHourFromNow = new Date(now.getTime() + 1 * 60 * 1000);
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
      if (
        !availableSeats ||
        isNaN(parseInt(availableSeats)) ||
        parseInt(availableSeats) < 1 ||
        parseInt(availableSeats) > 4
      ) {
        Alert.alert("خطأ", "يرجى إدخال عدد صحيح للمقاعد بين 1 و4");
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
      if (!validateForm()) {
        throw new Error("بيانات الرحلة غير مكتملة");
      }
      if (!userAddress || !destinationAddress || !user?.id) {
        throw new Error("بيانات الرحلة غير مكتملة");
      }
      if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
        throw new Error("إحداثيات الموقع غير صالحة");
      }
      if (!tripDate || !tripTime) {
        throw new Error("تاريخ أو وقت الرحلة غير محدد");
      }
      const rideDateTimeStr = `${tripDate} ${tripTime}`;
      console.log("Creating ride with:", { tripDate, tripTime, rideDateTimeStr });

      const ridesRef = collection(db, "rides");
      const conflictQuery = query(
        ridesRef,
        where("driver_id", "==", user.id),
        where("status", "in", ["available", "active"])
      );
      const conflictSnapshot = await getDocs(conflictQuery);
      let hasConflict = false;
      const fifteenMinutes = 15 * 60 * 1000;
      const [datePart, timePart] = rideDateTimeStr.split(" ");
      if (!datePart || !timePart) {
        throw new Error("تنسيق التاريخ أو الوقت غير صالح");
      }
      const [day, month, year] = datePart.split("/").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);
      if (!day || !month || !year || !hours || !minutes) {
        throw new Error("بيانات التاريخ أو الوقت غير كاملة");
      }
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
        status: "available",
        created_at: new Date(),
        ride_number: nextRideNumber,
      };
      const rideRef = doc(db, "rides", nextRideNumber.toString());
      await setDoc(rideRef, rideData);
      setSuccess(true);
    } catch (error: any) {
      console.error("خطأ في الحجز:", {
        error: error.message,
        tripDate,
        tripTime,
        rideDateTimeStr,
      });
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
    if (validateForm()) {
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
                <View
                  className="shadow-sm"
                  style={{
                    elevation: Platform.OS === "android" ? 3 : 0,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.22,
                    shadowRadius: 2.22,
                    overflow: "visible",
                  }}
                >
                  <GoogleTextInput
                    icon={icons.target}
                    initialLocation={userAddress || ""}
                    containerStyle="bg-neutral-100 rounded-xl"
                    textInputBackgroundColor="#f5f5f5"
                    handlePress={handleFromLocation}
                    placeholder="أدخل موقع البداية"
                  />
                </View>
              </View>
              <View className="my-3">
                <Text className="text-lg font-JakartaSemiBold mb-3 text-right">إلى</Text>
                <View
                  className="shadow-sm"
                  style={{
                    elevation: Platform.OS === "android" ? 3 : 0,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.22,
                    shadowRadius: 2.22,
                    overflow: "visible",
                  }}
                >
                  <GoogleTextInput
                    icon={icons.map}
                    initialLocation={destinationAddress || ""}
                    containerStyle="bg-neutral-100 rounded-xl"
                    textInputBackgroundColor="transparent"
                    handlePress={handleToLocation}
                    placeholder="أدخل الوجهة"
                  />
                </View>
              </View>
              <View className="my-3">
                <Text className="text-lg font-JakartaSemiBold mb-3 text-right">الشارع</Text>
                <View
                  className="flex-row items-center rounded-xl p-3 bg-neutral-100 shadow-sm"
                  style={{
                    elevation: Platform.OS === "android" ? 3 : 0,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.22,
                    shadowRadius: 2.22,
                    overflow: "visible",
                  }}
                >
                  <Image source={icons.street} className="w-7 h-7 ml-2" />
                  <TextInput
                    value={street}
                    onChangeText={setStreet}
                    placeholder="أدخل اسم الشارع"
                    className="flex-1 text-right ml-2.5 mr-5 bg-transparent pt-1 pb-2 font-JakartaBold placeholder:font-CairoBold"
                    placeholderTextColor="gray"
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </View>
              {/* Floating Action Buttons */}
              <View className="flex-row justify-end px-4 mt-4">
                <Animated.View style={{ transform: [{ scale: nextButtonScale }] }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => animateButton(nextButtonScale, handleNext)}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={["#f97316", "#f97316"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 35,
                        justifyContent: "center",
                        alignItems: "center",
                        elevation: Platform.OS === "android" ? 8 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4.65,
                      }}
                    >
                      <Image source={icons.goArrow} style={{ width: 24, height: 24, tintColor: "#fff" }} />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
        );
      case 1:
        return (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 100,
            }}
            keyboardShouldPersistTaps="handled"
            className="h-[72%]"
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View className="px-4 w-full">
                <View className="mb-4">
                  <Text className="text-lg font-JakartaMedium text-right mb-2">تاريخ الرحلة</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setDatePickerVisible(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={["#f8f8f8", "#f0f0f0"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      className="rounded-lg"
                     
                    >
                      <View className="flex-row items-center p-3">
                        <Text className="flex-1 text-right">{tripDate || "اختر التاريخ"}</Text>
                        <Image source={icons.calendar} className="w-5 h-5" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                <View className="mb-4">
                  <Text className="text-lg font-JakartaMedium text-right mb-2">وقت الرحلة</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTimePickerVisible(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={["#f8f8f8", "#f0f0f0"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      className="rounded-lg"
                     
                    >
                      <View className="flex-row items-center p-3">
                        <Text className="flex-1 text-right">{tripTime || "اختر الوقت"}</Text>
                        <Image source={icons.clock} className="w-5 h-5" />
                      </View>
                    </LinearGradient>
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
                        style={{
                          width: "30%",
                         
                        }}
                        onPress={() => toggleDaySelection(day)}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-center ${
                            selectedDays.includes(day) ? "text-white font-JakartaBold" : "text-gray-800"
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
                  <View
                    className="shadow-sm"
                    
                  >
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-right bg-gray-50"
                      value={availableSeats}
                      onChangeText={handleSeatsChange}
                      placeholder="حدد عدد المقاعد (1-4)"
                      keyboardType="numeric"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  </View>
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
                        style={{
                          width: "30%",
                         
                        }}
                        onPress={() => {
                          setSelectedGender(gender);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-center ${
                            selectedGender === gender ? "text-white font-JakartaBold" : "text-gray-800"
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
                      style={{
                        width: "49%",
                        
                      }}
                      onPress={() => {
                        setIsRecurring(true);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-center text-base ${
                          isRecurring ? "text-white font-JakartaBold" : "text-gray-800"
                        }`}
                      >
                        نعم
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`p-3 mb-2 ml-2 rounded-lg border ${
                        !isRecurring ? "bg-orange-500 border-orange-500" : "border-gray-300"
                      }`}
                      style={{
                        width: "49%",
                        
                      }}
                      onPress={() => {
                        setIsRecurring(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-center text-base ${
                          !isRecurring ? "text-white font-JakartaBold" : "text-gray-800"
                        }`}
                      >
                        لا
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Floating Action Buttons */}
                <View className="flex-row justify-between px-4 mt-4">
                  <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => animateButton(backButtonScale, handleBack)}
                      disabled={isLoading}
                    >
                      <LinearGradient
                        colors={["#333333", "#333333" ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 50,
                          justifyContent: "center",
                          alignItems: "center",
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.2,
                          shadowRadius: 3,
                        }}
                      >
                        <Image source={icons.backArrow} style={{ width: 30, height: 30, tintColor: "#fff" }} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                  <Animated.View style={{ transform: [{ scale: nextButtonScale }] }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => animateButton(nextButtonScale, handleNext)}
                      disabled={isLoading}
                    >
                      <LinearGradient
                        colors={["#f97316", "#f97316"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{
                          width: 70,
                          height: 70,
                          borderRadius: 35,
                          justifyContent: "center",
                          alignItems: "center",
                          elevation: Platform.OS === "android" ? 8 : 0,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4.65,
                        }}
                      >
                        <Image source={icons.goArrow} style={{ width: 24, height: 24, tintColor: "#fff" }} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </ScrollView>
        );
      case 2:
        return (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 100,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="px-4">
              <Text className="text-xl font-JakartaBold text-right mb-4">قوانين السيارة</Text>
              <TouchableOpacity
                className={`flex-row justify-between items-center p-4 mb-3 rounded-lg ${
                  rules.noSmoking ? "bg-primary-100 border-orange-500" : "bg-gray-50"
                } border`}
                style={{
                  elevation: Platform.OS === "android" ? (rules.noSmoking ? 5 : 2) : 0,
                  shadowColor: rules.noSmoking ? "#f97316" : "#000",
                  shadowOffset: { width: 0, height: rules.noSmoking ? 3 : 1 },
                  shadowOpacity: rules.noSmoking ? 0.3 : 0.1,
                  shadowRadius: rules.noSmoking ? 4.65 : 1.0,
                  overflow: "visible",
                }}
                onPress={() => toggleRule("noSmoking")}
                activeOpacity={0.7}
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
                style={{
                  elevation: Platform.OS === "android" ? (rules.noChildren ? 5 : 2) : 0,
                  shadowColor: rules.noChildren ? "#f97316" : "#000",
                  shadowOffset: { width: 0, height: rules.noChildren ? 3 : 1 },
                  shadowOpacity: rules.noChildren ? 0.3 : 0.1,
                  shadowRadius: rules.noChildren ? 4.65 : 1.0,
                  overflow: "visible",
                }}
                onPress={() => toggleRule("noChildren")}
                activeOpacity={0.7}
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
                style={{
                  elevation: Platform.OS === "android" ? (rules.noMusic ? 5 : 2) : 0,
                  shadowColor: rules.noMusic ? "#f97316" : "#000",
                  shadowOffset: { width: 0, height: rules.noMusic ? 3 : 1 },
                  shadowOpacity: rules.noMusic ? 0.3 : 0.1,
                  shadowRadius: rules.noMusic ? 4.65 : 1.0,
                  overflow: "visible",
                }}
                onPress={() => toggleRule("noMusic")}
                activeOpacity={0.7}
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
              {/* Floating Action Buttons */}
              <View className="flex-row justify-between px-4 mt-4">
                <Animated.View style={{ transform: [{ scale: backButtonScale }] }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => animateButton(backButtonScale, handleBack)}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={["#333333", "#333333"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 50,
                        justifyContent: "center",
                        alignItems: "center",
                        elevation: Platform.OS === "android" ? 6 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.2,
                        shadowRadius: 3,
                      }}
                    >
                      <Image source={icons.backArrow} style={{ width: 30, height: 30, tintColor: "#fff" }} />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
                <Animated.View style={{ transform: [{ scale: nextButtonScale }] }}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => animateButton(nextButtonScale, handleConfirmRide)}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={["#38A169", "#38A169"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: 70,
                        height: 70,
                        borderRadius: 35,
                        justifyContent: "center",
                        alignItems: "center",
                        elevation: Platform.OS === "android" ? 8 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4.65,
                      }}
                    >
                      <Image source={icons.checkmark} style={{ width: 30, height: 30, tintColor: "#fff" }} />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          </ScrollView>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ flex: 1 }}>
        {/* Header with step indicator */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, marginBottom: 10 }}>
          <StepIndicator
            customStyles={stepIndicatorStyles}
            currentPosition={currentStep}
            labels={steps}
            stepCount={steps.length}
          />
        </View>

        {/* Content area */}
        <View style={{ flex: 1 }}>
          {renderStepContent()}
          {isLoading && (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                zIndex: 1000,
              }}
            >
              <ActivityIndicator size="large" color="#f97316" />
            </View>
          )}
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
        <View
          className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl"
          style={{
            elevation: Platform.OS === "android" ? 10 : 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.34,
            shadowRadius: 6.27,
          }}
        >
          <Image source={images.check} className="w-28 h-28 mt-5" resizeMode="contain" />
          <Text className="text-2xl text-center font-CairoBold mt-5">
            تم إنشاء الرحلة بنجاح
          </Text>
          <Text className="text-md text-general-200 font-CairoRegular text-center mt-3">
            شكرًا لإنشاء الرحلة. يرجى المتابعة مع رحلتك.
          </Text>
          <LinearGradient
            colors={["#f97316", "#ea580c"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="rounded-xl mt-5 w-full"
          >
            <TouchableOpacity
              className="py-3 px-5 items-center"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setSuccess(false);
                router.push("/(root)/(tabs)/home");
              }}
              activeOpacity={0.8}
            >
              <Text className="text-white font-CairoBold text-lg">العودة للرئيسية</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ReactNativeModal>
    </SafeAreaView>
  );
};

export default RideCreationScreen;