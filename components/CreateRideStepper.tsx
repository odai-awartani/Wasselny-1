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
  FlatList,
} from "react-native";
import StepIndicator from "react-native-step-indicator";
import GoogleTextInput from "@/components/GoogleTextInput";
import { icons, images } from "@/constants";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import ReactNativeModal from "react-native-modal";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useLocationStore } from "@/store";
import { doc, setDoc, getDocs, collection, query, orderBy, limit, where, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
dsadasdas
interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

interface Waypoint {
  address: string;
  street: string;
  latitude: number;
  longitude: number;
}

interface RideRequestData {
  origin_address: string;
  destination_address: string;
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  destination_street: string;
  origin_street: string;
  waypoints: {
    address: string;
    street: string;
    latitude: number;
    longitude: number;
  }[];
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

interface CarInfo {
  seats: number;
  model: string;
  color: string;
}

type Step0Item = {
  type: 'start' | 'waypoint' | 'addButton' | 'destination';
  index?: number;
  waypoint?: Waypoint;
};

const stepIndicatorStyles = {
  stepIndicatorSize: 40,
  currentStepIndicatorSize: 50,
  separatorStrokeWidth: 4,
  currentStepStrokeWidth: 6,
  stepStrokeCurrentColor: "#f97316",
  separatorFinishedColor: "#f97316",
  separatorUnFinishedColor: "#d1d5db",
  stepIndicatorFinishedColor: "#f97316",
  stepIndicatorUnFinishedColor: "#d1d5db",
  stepIndicatorCurrentColor: "#ffffff",
  stepIndicatorLabelFontSize: 14,
  currentStepIndicatorLabelFontSize: 14,
  stepIndicatorLabelCurrentColor: "#f97316",
  stepIndicatorLabelFinishedColor: "#ffffff",
  stepIndicatorLabelUnFinishedColor: "#6b7280",
  labelColor: "#6b7280",
  
  labelSize: 14,
  currentStepLabelColor: "#f97316",
  labelAlign: "center",
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
  const [selectedDay, setSelectedDay] = useState<string>("");
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
  const [upcomingDates, setUpcomingDates] = useState<{[key: string]: string}>({});
  const [selectedDateRange, setSelectedDateRange] = useState<{
    startDate: Date | null;
    endDate: Date | null;
  }>({
    startDate: null,
    endDate: null,
  });
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [carInfo, setCarInfo] = useState<CarInfo | null>(null);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [isAddingWaypoint, setIsAddingWaypoint] = useState(false);
  const [collapsedWaypoints, setCollapsedWaypoints] = useState<number[]>([]);
  const [startStreet, setStartStreet] = useState("");
  const [destinationStreet, setDestinationStreet] = useState("");

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

  const handleAddWaypoint = useCallback((location: Location) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaypoints(prev => [...prev, {
      address: location.address,
      street: "",
      latitude: location.latitude,
      longitude: location.longitude
    }]);
    setIsAddingWaypoint(false);
  }, []);

  const handleRemoveWaypoint = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleWaypointStreetChange = useCallback((index: number, street: string) => {
    setWaypoints(prev => prev.map((wp, i) => 
      i === index ? { ...wp, street } : wp
    ));
  }, []);

  const getDayOfWeek = (date: Date) => {
    const dayIndex = date.getDay();
    const arabicDaysMap = [1, 2, 3, 4, 5, 6, 0]; // Maps Sunday (0) to last position
    return days[arabicDaysMap[dayIndex]];
  };

  const formatDate = (date: Date): string => {
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    ).toString().padStart(2, "0")}/${date.getFullYear()}`;
  };

  const formatTime = (date: Date): string => {
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  };

  const getNextOccurrence = (day: string, startDate: Date): Date => {
    const dayIndex = days.indexOf(day);
    const currentDay = startDate.getDay();
    
    // Map the current day to match our Arabic days array
    const arabicDaysMap = [1, 2, 3, 4, 5, 6, 0]; // Maps Sunday (0) to last position
    const currentDayIndex = arabicDaysMap.indexOf(currentDay);
    
    // Calculate days until next occurrence
    let daysUntilNext = dayIndex - currentDayIndex;
    if (daysUntilNext <= 0) {
      daysUntilNext += 7; // If the day has passed this week, get next week's occurrence
    }
    
    const nextDate = new Date(startDate);
    nextDate.setDate(startDate.getDate() + daysUntilNext - 2); // Subtract 2 days from the calculated date
    return nextDate;
  };

  const calculateUpcomingDates = useCallback((startDate: Date, selectedDays: string[]) => {
    const dates: {[key: string]: string} = {};
    
    selectedDays.forEach(day => {
      const nextDate = getNextOccurrence(day, startDate);
      dates[day] = formatDate(nextDate);
    });
    
    return dates;
  }, [days]);

  const handleDateConfirm = useCallback(
    (date: Date) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Get the day of the selected date
      const selectedDayOfWeek = getDayOfWeek(date);
      
      // Set the selected day
      setSelectedDay(selectedDayOfWeek);
      
      if (isRecurring) {
        if (!selectedDateRange.startDate) {
          setSelectedDateRange(prev => ({ ...prev, startDate: date }));
          setTripDate(formatDate(date));
        } else {
          if (date < selectedDateRange.startDate) {
            Alert.alert("خطأ", "تاريخ النهاية يجب أن يكون بعد تاريخ البداية");
            return;
          }
          setSelectedDateRange(prev => ({ ...prev, endDate: date }));
          
          // Calculate all dates between start and end date for the selected day
          const dates: Date[] = [];
          let currentDate = new Date(selectedDateRange.startDate);
          while (currentDate <= date) {
            const dayOfWeek = getDayOfWeek(currentDate);
            if (dayOfWeek === selectedDayOfWeek) {
              dates.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          setSelectedDates(dates);
        }
      } else {
        setTripDate(formatDate(date));
        setSelectedDateRange({
          startDate: date,
          endDate: date
        });
        setSelectedDates([date]);
      }
      
      // Calculate upcoming dates for the selected day
      const dates = calculateUpcomingDates(date, [selectedDayOfWeek]);
      setUpcomingDates(dates);
      
      setDatePickerVisible(false);
    },
    [isRecurring, calculateUpcomingDates, selectedDateRange]
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
    const maxSeats = carInfo?.seats || 50;
    
    // If the input is empty, allow it (for backspace functionality)
    if (numericValue === "") {
      setAvailableSeats("");
      return;
    }
    
    const seatsNumber = parseInt(numericValue);
    
    // Strict validation
    if (seatsNumber > maxSeats) {
      Alert.alert(
        "تنبيه",
        `لا يمكن تجاوز عدد مقاعد سيارتك (${maxSeats} مقعد)`
      );
      setAvailableSeats(maxSeats.toString());
      return;
    }
    
    setAvailableSeats(numericValue);
  }, [carInfo]);

  const toggleRule = useCallback((rule: keyof typeof rules) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRules((prev) => ({
      ...prev,
      [rule]: !prev[rule],
    }));
  }, []);

  const toggleDaySelection = useCallback((day: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // If the day is already selected, do nothing
    if (selectedDay === day) return;
    
    // Set the new selected day
    setSelectedDay(day);
    
    // If we have a start date, update the date to the next occurrence of the selected day
    if (selectedDateRange.startDate) {
      const nextDate = getNextOccurrence(day, selectedDateRange.startDate);
      
      if (isRecurring) {
        // For recurring rides, update the dates array
        if (selectedDateRange.endDate) {
          const dates: Date[] = [];
          let currentDate = new Date(selectedDateRange.startDate);
          while (currentDate <= selectedDateRange.endDate) {
            const dayOfWeek = getDayOfWeek(currentDate);
            if (dayOfWeek === day) {
              dates.push(new Date(currentDate));
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          setSelectedDates(dates);
        }
      } else {
        // For non-recurring rides, update the single date
        setTripDate(formatDate(nextDate));
        setSelectedDateRange({
          startDate: nextDate,
          endDate: nextDate
        });
        setSelectedDates([nextDate]);
      }
      
      // Update upcoming dates
      const dates = calculateUpcomingDates(nextDate, [day]);
      setUpcomingDates(dates);
    }
  }, [selectedDateRange, calculateUpcomingDates, isRecurring, selectedDay]);

  const toggleRecurring = useCallback((value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRecurring(value);
    
    // If switching to non-recurring and we have a date selected,
    // only keep the day of that date
    if (!value && selectedDateRange.startDate) {
      const dayOfWeek = getDayOfWeek(selectedDateRange.startDate);
      setSelectedDay(dayOfWeek);
    }
  }, [selectedDateRange]);

  const validateForm = useCallback(() => {
    if (currentStep === 0) {
      if (!userAddress || !destinationAddress) {
        Alert.alert("خطأ", "يرجى إدخال موقع البداية والوجهة");
        return false;
      }
    } else if (currentStep === 1) {
      // Validate day selection
      if (!selectedDay) {
        Alert.alert("خطأ", "يرجى اختيار يوم الرحلة");
        return false;
      }

      // Validate date
      if (!isRecurring && !tripDate) {
        Alert.alert("خطأ", "يرجى اختيار تاريخ الرحلة");
        return false;
      }

      // Validate time
      if (!tripTime) {
        Alert.alert("خطأ", "يرجى اختيار وقت الرحلة");
        return false;
      }

      // Validate date format
      const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
      if (!dateRegex.test(tripDate)) {
        Alert.alert("خطأ", "تنسيق التاريخ غير صحيح، يجب أن يكون DD/MM/YYYY");
        return false;
      }

      // Validate time format
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(tripTime)) {
        Alert.alert("خطأ", "تنسيق الوقت غير صحيح، يجب أن يكون HH:MM");
        return false;
      }

      // Parse and validate date and time
      try {
        const [day, month, year] = tripDate.split("/").map(Number);
        const [hours, minutes] = tripTime.split(":").map(Number);
        
        // Validate date components
        if (isNaN(day) || isNaN(month) || isNaN(year) || 
            day < 1 || day > 31 || month < 1 || month > 12) {
          Alert.alert("خطأ", "تاريخ غير صالح");
          return false;
        }

        // Validate time components
        if (isNaN(hours) || isNaN(minutes) || 
            hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
          Alert.alert("خطأ", "وقت غير صالح");
          return false;
        }

        const selectedDateTime = new Date(year, month - 1, day, hours, minutes);
        
        // Check if date is valid
        if (isNaN(selectedDateTime.getTime())) {
          Alert.alert("خطأ", "تاريخ أو وقت غير صالح");
          return false;
        }

        // Check if date is in the future
        const now = new Date();
        if (selectedDateTime <= now) {
          Alert.alert("خطأ", "يجب اختيار تاريخ ووقت في المستقبل");
          return false;
        }

        // Check if time is at least 1 hour from now for same day
        const isSameDay = 
          selectedDateTime.getDate() === now.getDate() &&
          selectedDateTime.getMonth() === now.getMonth() &&
          selectedDateTime.getFullYear() === now.getFullYear();

        if (isSameDay) {
          const oneHourFromNow = new Date(now.getTime() + 29 * 60 * 1000);
          if (selectedDateTime <= oneHourFromNow) {
            Alert.alert("خطأ", "يجب اختيار وقت بعد 30 دقيقة على الأقل من الآن");
            return false;
          }
        }
      } catch (error) {
        console.error("Date validation error:", error);
        Alert.alert("خطأ", "تاريخ أو وقت غير صالح");
        return false;
      }

      // Validate seats
      if (!carInfo) {
        Alert.alert("خطأ", "لم يتم العثور على معلومات السيارة");
        return false;
      }

      if (!availableSeats || isNaN(parseInt(availableSeats))) {
        Alert.alert("خطأ", "يرجى إدخال عدد المقاعد");
        return false;
      }

      const seatsNumber = parseInt(availableSeats);
      if (seatsNumber < 1) {
        Alert.alert("خطأ", "يجب أن يكون عدد المقاعد 1 على الأقل");
        return false;
      }

      if (seatsNumber > carInfo.seats) {
        Alert.alert("خطأ", `لا يمكن تجاوز عدد مقاعد سيارتك (${carInfo.seats} مقعد)`);
        return false;
      }

      // Validate gender
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
    selectedDay,
    tripDate,
    tripTime,
    availableSeats,
    selectedGender,
    isRecurring,
    carInfo,
  ]);

  const resetForm = useCallback(() => {
    setCurrentStep(0);
    setStartStreet("");
    setDestinationStreet("");
    setSelectedDay("");
    setTripDate("");
    setTripTime("");
    setAvailableSeats("");
    setSelectedGender("");
    setIsRecurring(false);
    setRules({
      noSmoking: false,
      noChildren: false,
      noMusic: false,
    });
    setSelectedDateRange({
      startDate: null,
      endDate: null,
    });
    setSelectedDates([]);
    setUpcomingDates({});
    setWaypoints([]);
  }, []);

  useEffect(() => {
    return () => {
      resetForm();
    };
  }, [resetForm]);

  const handleSuccessModalClose = useCallback(() => {
    setSuccess(false);
    resetForm();
    router.push("/(root)/(tabs)/home");
  }, [resetForm, router]);

  const handleConfirmRide = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!validateForm()) {
        setIsLoading(false);
        return;
      }

      if (!userAddress || !destinationAddress || !user?.id) {
        throw new Error("بيانات الموقع غير مكتملة");
      }

      if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) {
        throw new Error("إحداثيات الموقع غير صالحة");
      }

      if (!tripDate || !tripTime) {
        throw new Error("تاريخ أو وقت الرحلة غير محدد");
      }

      // Additional seat validation
      if (!carInfo || parseInt(availableSeats) > carInfo.seats) {
        throw new Error(`لا يمكن تجاوز عدد مقاعد سيارتك (${carInfo?.seats || 0} مقعد)`);
      }

      // Parse date and time
      const [day, month, year] = tripDate.split("/").map(Number);
      const [hours, minutes] = tripTime.split(":").map(Number);

      // Validate date and time components
      if (isNaN(day) || isNaN(month) || isNaN(year) || isNaN(hours) || isNaN(minutes)) {
        throw new Error("تنسيق التاريخ أو الوقت غير صالح");
      }

      // Create date object
      const selectedDate = new Date(year, month - 1, day, hours, minutes);
      if (isNaN(selectedDate.getTime())) {
        throw new Error("تاريخ أو وقت غير صالح");
      }

      // Validate future date
      const now = new Date();
      if (selectedDate <= now) {
        throw new Error("يجب اختيار تاريخ ووقت في المستقبل");
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

      conflictSnapshot.forEach((doc) => {
        const existingRide = doc.data();
        const existingRideDateStr = existingRide.ride_datetime;
        if (!existingRideDateStr) return;

        const [exDatePart, exTimePart] = existingRideDateStr.split(" ");
        const [exDay, exMonth, exYear] = exDatePart.split("/").map(Number);
        const [exHours, exMinutes] = exTimePart.split(":").map(Number);
        const existingRideDate = new Date(exYear, exMonth - 1, exDay, exHours, exMinutes);
        
        if (isNaN(existingRideDate.getTime())) return;
        
        const timeDiff = selectedDate.getTime() - existingRideDate.getTime();
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

      // Validate waypoints
      const validatedWaypoints = waypoints.map((waypoint, index) => {
        if (!waypoint.address) {
          throw new Error(`نقطة المرور ${index + 1}: العنوان غير مكتمل`);
        }
        if (!waypoint.latitude || !waypoint.longitude) {
          throw new Error(`نقطة المرور ${index + 1}: إحداثيات الموقع غير صالحة`);
        }
        return {
          address: waypoint.address,
          street: waypoint.street || "", // Make street optional
          latitude: waypoint.latitude,
          longitude: waypoint.longitude
        };
      });

      const rideData: RideRequestData = {
        origin_address: userAddress,
        destination_address: destinationAddress,
        origin_latitude: userLatitude,
        origin_longitude: userLongitude,
        destination_latitude: destinationLatitude,
        destination_longitude: destinationLongitude,
        destination_street: destinationStreet || "", // Make street optional
        origin_street: startStreet || "", // Make street optional
        waypoints: validatedWaypoints,
        ride_datetime: rideDateTimeStr,
        ride_days: [selectedDay],
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
      resetForm();
    } catch (error: any) {
      console.error("خطأ في الحجز:", {
        error: error.message,
        tripDate,
        tripTime,
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
    destinationStreet,
    startStreet,
    tripDate,
    tripTime,
    selectedDay,
    selectedGender,
    availableSeats,
    rules,
    isRecurring,
    user,
    carInfo,
    resetForm,
    waypoints,
  ]);

  const handleNext = () => {
    if (validateForm()) {
      if (currentStep === steps.length - 1) {
        // If we're on the last step, confirm the ride
        handleConfirmRide();
      } else {
        // Otherwise, move to next step
        setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
      }
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleAddWaypointPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsAddingWaypoint(true);
  }, []);

  const handleToggleWaypointCollapse = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsedWaypoints(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  }, []);

  const renderStep0Item = ({ item }: { item: Step0Item }) => {
    switch (item.type) {
      case 'start':
        return (
          <View className="my-4">
            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 bg-green-100 rounded-full justify-center items-center mr-2">
                <Image source={icons.target} className="w-4 h-4 tint-green-500" />
              </View>
              <Text className="text-lg font-CairoBold text-right text-gray-800">نقطة البداية</Text>
            </View>
            <View
              className="shadow-sm mb-3"
              style={{
                elevation: Platform.OS === "android" ? 4 : 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                overflow: "visible",
              }}
            >
              <GoogleTextInput
                icon={icons.target}
                initialLocation={userAddress || ""}
                containerStyle="bg-white rounded-xl border border-gray-100"
                textInputBackgroundColor="#fff"
                handlePress={handleFromLocation}
                placeholder="أدخل موقع البداية"
              />
            </View>
            <View className="mt-2">
              <Text className="text-base font-CairoBold mb-2 text-right text-gray-800">الشارع</Text>
              <View
                className="flex-row items-center rounded-xl p-3 bg-white border border-gray-100 shadow-sm"
                style={{
                  elevation: Platform.OS === "android" ? 4 : 0,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  overflow: "visible",
                }}
              >
                <Image source={icons.street} className="w-7 h-7 ml-2" />
                <TextInput
                  value={startStreet}
                  onChangeText={setStartStreet}
                  placeholder="أدخل اسم الشارع"
                  className="flex-1 text-right ml-2.5 mr-5 bg-transparent pt-1 pb-2 font-CairoBold placeholder:font-CairoBold"
                  placeholderTextColor="#9CA3AF"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        );

      case 'waypoint':
        const isCollapsed = collapsedWaypoints.includes(item.index!);
        return (
          <View className="my-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => handleRemoveWaypoint(item.index!)}
                  className="p-2 bg-red-50 rounded-lg mr-2"
                  activeOpacity={0.7}
                >
                  <Image 
                    source={icons.close} 
                    className="w-5 h-5 tint-red-500"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleToggleWaypointCollapse(item.index!)}
                  className="p-2 bg-gray-50 rounded-lg"
                  activeOpacity={0.7}
                >
                  <Image 
                    source={icons.arrowDown} 
                    className={`w-5 h-5 tint-gray-500 ${isCollapsed ? 'rotate-180' : ''}`}
                    style={{ transform: [{ rotate: isCollapsed ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>
              </View>
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-orange-100 rounded-full justify-center items-center mr-2">
                  <Text className="text-orange-500 font-CairoBold">{item.index! + 1}</Text>
                </View>
                <Text className="text-lg font-CairoBold text-right text-gray-800">
                  نقطة مرور
                </Text>
              </View>
            </View>
            {!isCollapsed && (
              <Animated.View>
                <View
                  className="shadow-sm mb-3"
                  style={{
                    elevation: Platform.OS === "android" ? 4 : 0,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 3,
                    overflow: "visible",
                  }}
                >
                  <GoogleTextInput
                    icon={icons.map}
                    initialLocation={item.waypoint?.address || ""}
                    containerStyle="bg-white rounded-xl border border-gray-100"
                    textInputBackgroundColor="#fff"
                    handlePress={(location) => {
                      if (item.waypoint) {
                        const updatedWaypoint: Waypoint = {
                          ...item.waypoint,
                          address: location.address,
                          latitude: location.latitude,
                          longitude: location.longitude
                        };
                        setWaypoints(prev => prev.map((wp, i) => 
                          i === item.index ? updatedWaypoint : wp
                        ));
                      }
                    }}
                    placeholder="أدخل نقطة المرور"
                  />
                </View>
                <View className="mt-2">
                  <Text className="text-base font-CairoBold mb-2 text-right text-gray-800">الشارع</Text>
                  <View
                    className="flex-row items-center rounded-xl p-3 bg-white border border-gray-100 shadow-sm"
                    style={{
                      elevation: Platform.OS === "android" ? 4 : 0,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                      overflow: "visible",
                    }}
                  >
                    <Image source={icons.street} className="w-7 h-7 ml-2" />
                    <TextInput
                      value={item.waypoint?.street}
                      onChangeText={(text) => {
                        if (item.waypoint) {
                          const updatedWaypoint: Waypoint = {
                            ...item.waypoint,
                            street: text
                          };
                          setWaypoints(prev => prev.map((wp, i) => 
                            i === item.index ? updatedWaypoint : wp
                          ));
                        }
                      }}
                      placeholder="أدخل اسم الشارع"
                      className="flex-1 text-right ml-2.5 mr-5 bg-transparent pt-1 pb-2 font-CairoBold placeholder:font-CairoBold"
                      placeholderTextColor="#9CA3AF"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              </Animated.View>
            )}
          </View>
        );

      case 'addButton':
        return (
          <TouchableOpacity
            onPress={handleAddWaypointPress}
            className="flex-row items-center justify-center bg-orange-50 p-4 rounded-xl mt-4 mb-6 border-2 border-orange-100"
            activeOpacity={0.7}
            style={{
              elevation: Platform.OS === "android" ? 2 : 0,
              shadowColor: "#f97316",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 3,
            }}
          >
            <View className="w-8 h-8 bg-orange-100 rounded-full justify-center items-center mr-2">
              <Image source={icons.add} className="w-4 h-4 tint-orange-500" />
            </View>
            <Text className="text-orange-500 font-CairoBold text-base">إضافة نقطة مرور</Text>
          </TouchableOpacity>
        );

      case 'destination':
        return (
          <View className="my-4">
            <View className="flex-row items-center mb-3">
              <View className="w-8 h-8 bg-red-100 rounded-full justify-center items-center mr-2">
                <Image source={icons.map} className="w-4 h-4 tint-red-500" />
              </View>
              <Text className="text-lg font-CairoBold text-right text-gray-800">الوجهة</Text>
            </View>
            <View
              className="shadow-sm mb-3"
              style={{
                elevation: Platform.OS === "android" ? 4 : 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 3,
                overflow: "visible",
              }}
            >
              <GoogleTextInput
                icon={icons.map}
                initialLocation={destinationAddress || ""}
                containerStyle="bg-white rounded-xl border border-gray-100"
                textInputBackgroundColor="#fff"
                handlePress={handleToLocation}
                placeholder="أدخل الوجهة"
              />
            </View>
            <View className="mt-2">
              <Text className="text-base font-CairoBold mb-2 text-right text-gray-800">الشارع</Text>
              <View
                className="flex-row items-center rounded-xl p-3 bg-white border border-gray-100 shadow-sm"
                style={{
                  elevation: Platform.OS === "android" ? 4 : 0,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  overflow: "visible",
                }}
              >
                <Image source={icons.street} className="w-7 h-7 ml-2" />
                <TextInput
                  value={destinationStreet}
                  onChangeText={setDestinationStreet}
                  placeholder="أدخل اسم الشارع"
                  className="flex-1 text-right ml-2.5 mr-5 bg-transparent pt-1 pb-2 font-CairoBold placeholder:font-CairoBold"
                  placeholderTextColor="#9CA3AF"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        const step0Data: Step0Item[] = [
          { type: 'start' },
          ...waypoints.map((waypoint, index) => ({
            type: 'waypoint' as const,
            index,
            waypoint,
          })),
          { type: 'addButton' },
          { type: 'destination' },
        ];

        return (
          <View style={{ flex: 1 }}>
            <FlatList
              data={step0Data}
              renderItem={renderStep0Item}
              keyExtractor={(item, index) => `${item.type}-${index}`}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: insets.bottom + 100,
              }}
              keyboardShouldPersistTaps="handled"
            />
            {/* Floating Action Buttons */}
            <View className="flex-row justify-end px-4 mt-6">
              <Animated.View style={{ transform: [{ scale: nextButtonScale }] }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => animateButton(nextButtonScale, handleNext)}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={["#f97316", "#ea580c"]}
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

            {/* Waypoint Location Picker Modal */}
            <ReactNativeModal
              isVisible={isAddingWaypoint}
              onBackdropPress={() => setIsAddingWaypoint(false)}
              backdropOpacity={0.7}
              animationIn="slideInUp"
              animationOut="slideOutDown"
              style={{ margin: 0 }}
            >
              <View className="flex-1 bg-white rounded-t-3xl overflow-hidden">
                <WaypointLocationPicker 
                  onLocationSelect={(location) => {
                    handleAddWaypoint(location);
                    setIsAddingWaypoint(false);
                  }} 
                />
              </View>
            </ReactNativeModal>
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
                <View className="mb-3">
                  <Text className="text-lg font-CairoBold text-right pt-5 mb-2 text-gray-800">
                    {isRecurring ? "تاريخ بداية الرحلة" : "تاريخ الرحلة"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setDatePickerVisible(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="bg-white rounded-xl border border-gray-100 p-3 flex-row items-center justify-between shadow-sm"
                      style={{
                        elevation: Platform.OS === "android" ? 4 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                      }}
                    >
                      <Text className="flex-1 text-right text-gray-700 font-CairoRegular">
                        {selectedDateRange.startDate ? formatDate(selectedDateRange.startDate) : "اختر التاريخ"}
                      </Text>
                      <Image source={icons.calendar} className="w-5 h-5" />
                    </View>
                  </TouchableOpacity>
                  
                  {isRecurring && selectedDateRange.startDate && (
                    <>
                      <Text className="text-lg font-CairoBold text-right pt-5 mb-2 text-gray-800">
                        تاريخ نهاية الرحلة
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setDatePickerVisible(true);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        activeOpacity={0.7}
                      >
                        <View className="bg-white rounded-xl border border-gray-100 p-3 flex-row items-center justify-between shadow-sm"
                          style={{
                            elevation: Platform.OS === "android" ? 4 : 0,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.1,
                            shadowRadius: 3,
                          }}
                        >
                          <Text className="flex-1 text-right text-gray-700 font-CairoRegular">
                            {selectedDateRange.endDate ? formatDate(selectedDateRange.endDate) : "اختر تاريخ النهاية"}
                          </Text>
                          <Image source={icons.calendar} className="w-5 h-5" />
                        </View>
                      </TouchableOpacity>
                      
                      {selectedDates.length > 0 && (
                        <View className="mt-3">
                          <Text className="text-sm font-CairoRegular text-right text-gray-600 mb-2">
                            عدد الرحلات المحددة: {selectedDates.length}
                          </Text>
                          <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            className="flex-row"
                          >
                            {selectedDates.map((date, index) => (
                              <View 
                                key={index}
                                className="bg-orange-100 rounded-lg px-3 py-2 mr-2"
                              >
                                <Text className="text-orange-600 font-CairoRegular text-sm">
                                  {formatDate(date)}
                                </Text>
                              </View>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  )}
                </View>
                <View className="mb-3">
                  <Text className="text-lg font-CairoBold text-right mb-2 text-gray-800">وقت الرحلة</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTimePickerVisible(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.7}
                  >
                    <View className="bg-white rounded-xl border border-gray-100 p-3 flex-row items-center justify-between shadow-sm"
                      style={{
                        elevation: Platform.OS === "android" ? 4 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                      }}
                    >
                      <Text className="flex-1 text-right text-gray-700 font-CairoRegular">{tripTime || "اختر الوقت"}</Text>
                      <Image source={icons.clock} className="w-5 h-5" />
                    </View>
                  </TouchableOpacity>
                </View>
                <View className="mb-3">
                  <Text className="text-lg font-CairoBold text-right mb-2 text-gray-800">حدد أيام الرحلة</Text>
                  <View className="flex-row flex-wrap justify-between">
                    {days.map(renderDayButton)}
                  </View>
                </View>
                <View className="mb-3">
                  <Text className="text-lg font-CairoBold text-right mb-2 text-gray-800">عدد المقاعد المتاحة</Text>
                  <View className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm"
                    style={{
                      elevation: Platform.OS === "android" ? 4 : 0,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    }}
                  >
                    <TextInput
                      className="text-right font-CairoRegular text-gray-700"
                      value={availableSeats}
                      onChangeText={handleSeatsChange}
                      placeholder={`حدد عدد المقاعد (1-${carInfo?.seats || 50})`}
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      autoCorrect={false}
                      autoCapitalize="none"
                      maxLength={2}
                    />
                  </View>
                  {carInfo && (
                    <Text className="text-sm text-gray-500 text-right mt-1 font-CairoRegular">
                      عدد مقاعد سيارتك: {carInfo.seats} مقعد
                    </Text>
                  )}
                </View>
                <View className="mb-3">
                  <Text className="text-lg font-CairoBold text-right mb-2 text-gray-800">الجنس المطلوب</Text>
                  <View className="flex-row flex-wrap justify-between">
                    {genders.map((gender) => (
                      <TouchableOpacity
                        key={gender}
                        className={`p-3 mb-2 rounded-xl border ${
                          selectedGender === gender
                            ? "bg-orange-500 border-orange-500"
                            : "bg-white border-gray-100"
                        }`}
                        style={{
                          width: "30%",
                          elevation: Platform.OS === "android" ? 4 : 0,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 3,
                        }}
                        onPress={() => {
                          setSelectedGender(gender);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-center font-CairoRegular ${
                            selectedGender === gender ? "text-white" : "text-gray-700"
                          }`}
                        >
                          {gender}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View className="mb-3">
                  <Text className="text-lg font-CairoBold text-right mb-2 text-gray-800">هل الرحلة متكررة؟</Text>
                  <View className="flex-row">
                    <TouchableOpacity
                      className={`p-3 mb-2 mr-2 rounded-xl border ${
                        isRecurring ? "bg-orange-500 border-orange-500" : "bg-white border-gray-100"
                      }`}
                      style={{
                        width: "49%",
                        elevation: Platform.OS === "android" ? 4 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                      }}
                      onPress={() => toggleRecurring(true)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-center font-CairoRegular ${
                          isRecurring ? "text-white" : "text-gray-700"
                        }`}
                      >
                        نعم
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`p-3 mb-2 ml-2 rounded-xl border ${
                        !isRecurring ? "bg-orange-500 border-orange-500" : "bg-white border-gray-100"
                      }`}
                      style={{
                        width: "49%",
                        elevation: Platform.OS === "android" ? 4 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                      }}
                      onPress={() => toggleRecurring(false)}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-center font-CairoRegular ${
                          !isRecurring ? "text-white" : "text-gray-700"
                        }`}
                      >
                        لا
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Floating Action Buttons */}
                <View className="flex-row justify-between px-4 mt-6">
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
                          width: 60,
                          height: 60,
                          borderRadius: 30,
                          justifyContent: "center",
                          alignItems: "center",
                          elevation: Platform.OS === "android" ? 6 : 0,
                          shadowColor: "#000",
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.2,
                          shadowRadius: 3,
                        }}
                      >
                        <Image source={icons.backArrow} style={{ width: 24, height: 24, tintColor: "#fff" }} />
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
                        colors={["#f97316", "#ea580c"]}
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
              <View className="mb-6">
                <Text className="text-2xl font-CairoBold text-right mt-4 mb-2 text-gray-800">قوانين السيارة</Text>
                <Text className="text-sm font-CairoRegular text-right text-gray-500 leading-5">
                  حدد القوانين التي تريد تطبيقها في رحلتك لضمان رحلة مريحة وآمنة
                </Text>
              </View>

              <View className="space-y-3">
                <TouchableOpacity
                  className={`flex-row justify-between items-center p-4 rounded-2xl border-2 ${
                    rules.noSmoking ? "bg-orange-50 border-orange-500" : "bg-white border-gray-100"
                  }`}
                  style={{
                    elevation: Platform.OS === "android" ? (rules.noSmoking ? 5 : 2) : 0,
                    shadowColor: rules.noSmoking ? "#f97316" : "#000",
                    shadowOffset: { width: 0, height: rules.noSmoking ? 3 : 1 },
                    shadowOpacity: rules.noSmoking ? 0.3 : 0.1,
                    shadowRadius: rules.noSmoking ? 4.65 : 1.0,
                    transform: [{ scale: rules.noSmoking ? 1.02 : 1 }],
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleRule("noSmoking");
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center flex-1">
                    <View 
                      className={`w-10 h-10 rounded-xl mr-4 justify-center items-center ${
                        rules.noSmoking ? "bg-orange-100" : "bg-gray-50"
                      }`}
                      style={{
                        elevation: Platform.OS === "android" ? 2 : 0,
                        shadowColor: rules.noSmoking ? "#f97316" : "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                      }}
                    >
                      <Image 
                        source={icons.smoking} 
                        className={`w-5 h-5 ${rules.noSmoking ? "tint-orange-500" : "tint-gray-400"}`}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-base font-CairoBold ${
                          rules.noSmoking ? "text-orange-500" : "text-gray-800"
                        }`}
                      >
                        بدون تدخين
                      </Text>
                      <Text
                        className={`text-xs font-CairoRegular mt-0.5 ${
                          rules.noSmoking ? "text-orange-400" : "text-gray-500"
                        }`}
                      >
                        ممنوع التدخين في السيارة لضمان رحلة صحية
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 justify-center items-center ${
                      rules.noSmoking ? "bg-orange-500 border-orange-500" : "border-gray-300"
                    }`}
                    style={{
                      elevation: Platform.OS === "android" ? 2 : 0,
                      shadowColor: rules.noSmoking ? "#f97316" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    }}
                  >
                    {rules.noSmoking && (
                      <Image 
                        source={icons.checkmark} 
                        className="w-3.5 h-3.5 tint-white"
                      />
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-row justify-between items-center p-4 rounded-2xl border-2 ${
                    rules.noChildren ? "bg-orange-50 border-orange-500" : "bg-white border-gray-100"
                  }`}
                  style={{
                    elevation: Platform.OS === "android" ? (rules.noChildren ? 5 : 2) : 0,
                    shadowColor: rules.noChildren ? "#f97316" : "#000",
                    shadowOffset: { width: 0, height: rules.noChildren ? 3 : 1 },
                    shadowOpacity: rules.noChildren ? 0.3 : 0.1,
                    shadowRadius: rules.noChildren ? 4.65 : 1.0,
                    transform: [{ scale: rules.noChildren ? 1.02 : 1 }],
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleRule("noChildren");
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center flex-1">
                    <View 
                      className={`w-10 h-10 rounded-xl justify-center items-center mr-4 ${
                        rules.noChildren ? "bg-orange-100" : "bg-gray-50"
                      }`}
                      style={{
                        elevation: Platform.OS === "android" ? 2 : 0,
                        shadowColor: rules.noChildren ? "#f97316" : "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                      }}
                    >
                      <Image 
                        source={icons.children} 
                        className={`w-5 h-5 ${rules.noChildren ? "tint-orange-500" : "tint-gray-400"}`}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-base font-CairoBold ${
                          rules.noChildren ? "text-orange-500" : "text-gray-800"
                        }`}
                      >
                        بدون أطفال
                      </Text>
                      <Text
                        className={`text-xs font-CairoRegular mt-0.5 ${
                          rules.noChildren ? "text-orange-400" : "text-gray-500"
                        }`}
                      >
                        ممنوع اصطحاب الأطفال لضمان رحلة هادئة
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 justify-center items-center ${
                      rules.noChildren ? "bg-orange-500 border-orange-500" : "border-gray-300"
                    }`}
                    style={{
                      elevation: Platform.OS === "android" ? 2 : 0,
                      shadowColor: rules.noChildren ? "#f97316" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    }}
                  >
                    {rules.noChildren && (
                      <Image 
                        source={icons.checkmark} 
                        className="w-3.5 h-3.5 tint-white"
                      />
                    )}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-row justify-between items-center p-4 rounded-2xl border-2 ${
                    rules.noMusic ? "bg-orange-50 border-orange-500" : "bg-white border-gray-100"
                  }`}
                  style={{
                    elevation: Platform.OS === "android" ? (rules.noMusic ? 5 : 2) : 0,
                    shadowColor: rules.noMusic ? "#f97316" : "#000",
                    shadowOffset: { width: 0, height: rules.noMusic ? 3 : 1 },
                    shadowOpacity: rules.noMusic ? 0.3 : 0.1,
                    shadowRadius: rules.noMusic ? 4.65 : 1.0,
                    transform: [{ scale: rules.noMusic ? 1.02 : 1 }],
                  }}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleRule("noMusic");
                  }}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center flex-1">
                    <View 
                      className={`w-10 h-10 rounded-xl justify-center items-center mr-4 ${
                        rules.noMusic ? "bg-orange-100" : "bg-gray-50"
                      }`}
                      style={{
                        elevation: Platform.OS === "android" ? 2 : 0,
                        shadowColor: rules.noMusic ? "#f97316" : "#000",
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 3,
                      }}
                    >
                      <Image 
                        source={icons.music} 
                        className={`w-5 h-5 ${rules.noMusic ? "tint-orange-500" : "tint-gray-400"}`}
                      />
                    </View>
                    <View className="flex-1">
                      <Text
                        className={`text-base font-CairoBold ${
                          rules.noMusic ? "text-orange-500" : "text-gray-800"
                        }`}
                      >
                        بدون أغاني
                      </Text>
                      <Text
                        className={`text-xs font-CairoRegular mt-0.5 ${
                          rules.noMusic ? "text-orange-400" : "text-gray-500"
                        }`}
                      >
                        ممنوع تشغيل الموسيقى لضمان رحلة هادئة
                      </Text>
                    </View>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 justify-center items-center ${
                      rules.noMusic ? "bg-orange-500 border-orange-500" : "border-gray-300"
                    }`}
                    style={{
                      elevation: Platform.OS === "android" ? 2 : 0,
                      shadowColor: rules.noMusic ? "#f97316" : "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3,
                    }}
                  >
                    {rules.noMusic && (
                      <Image 
                        source={icons.checkmark} 
                        className="w-3.5 h-3.5 tint-white"
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </View>

              {/* Floating Action Buttons */}
              <View className="flex-row justify-between px-4 mt-6">
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
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        justifyContent: "center",
                        alignItems: "center",
                        elevation: Platform.OS === "android" ? 6 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.2,
                        shadowRadius: 3,
                      }}
                    >
                      <Image source={icons.backArrow} style={{ width: 24, height: 24, tintColor: "#fff" }} />
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
                      colors={["#38A169", "#38A169"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 30,
                        justifyContent: "center",
                        alignItems: "center",
                        elevation: Platform.OS === "android" ? 8 : 0,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 4.65,
                      }}
                    >
                      <Image source={icons.checkmark} style={{ width: 24, height: 24, tintColor: "#fff" }} />
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

  // Update the day selection UI to show the next occurrence date
  const renderDayButton = (day: string) => {
    const isSelected = selectedDay === day;
    const nextDate = selectedDateRange.startDate ? getNextOccurrence(day, selectedDateRange.startDate) : null;
    
    return (
                <TouchableOpacity
        key={day}
        className={`p-3 mb-2 rounded-xl border ${
          isSelected
            ? "bg-orange-500 border-orange-500"
            : "bg-white border-gray-100"
                  }`}
                  style={{
          width: "30%",
          elevation: Platform.OS === "android" ? 4 : 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        }}
        onPress={() => toggleDaySelection(day)}
        activeOpacity={0.7}
      >
        <Text
          className={`text-center font-CairoRegular ${
            isSelected ? "text-white" : "text-gray-700"
          }`}
        >
          {day}
        </Text>
        {isSelected && nextDate && (
          <Text className="text-center text-white text-xs mt-1 font-CairoRegular">
            {formatDate(nextDate)}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  useEffect(() => {
    const fetchCarInfo = async () => {
      if (!user?.id) return;
      
      try {
        const userDoc = await getDoc(doc(db, "users", user.id));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.driver && userData.driver.car_seats) {
            setCarInfo({
              seats: userData.driver.car_seats,
              model: userData.driver.car_model || "",
              color: userData.driver.car_color || ""
            });
          }
        }
      } catch (error) {
        console.error("Error fetching car info:", error);
      }
    };

    fetchCarInfo();
  }, [user?.id]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={{ flex: 1 }}>
        {/* Header with step indicator */}
        <View style={{ 
          paddingHorizontal: 16, 
          paddingTop: 16,
          paddingBottom: 4,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
          elevation: 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
        }}>
          <View className="flex-row justify-between items-center mb-2">
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (currentStep === 0) {
                  router.back();
                } else {
                  handleBack();
                }
              }}
              className="p-2"
              activeOpacity={0.7}
            >
              <Image 
                source={icons.backArrow} 
                className="w-6 h-6 tint-gray-800"
              />
            </TouchableOpacity>
            <Text className="text-xl font-CairoBold text-right text-gray-800">إنشاء رحلة جديدة</Text>
          </View>
          <View className="mb-2">
            <StepIndicator
              customStyles={{
                ...stepIndicatorStyles,
                labelAlign: "center" as "center" | "flex-start" | "flex-end" | "stretch" | "baseline",
              }}
              currentPosition={currentStep}
              labels={steps}
              stepCount={steps.length}
            />
          </View>
        </View>

        {/* Content area */}
        <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
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
                backgroundColor: "rgba(255, 255, 255, 0.9)",
                zIndex: 1000,
              }}
            >
              <View style={{
                backgroundColor: "#fff",
                padding: 20,
                borderRadius: 15,
                elevation: 5,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
              }}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={{ 
                  marginTop: 10, 
                  color: "#1f2937",
                  fontFamily: "CairoBold",
                  textAlign: "center"
                }}>
                  جاري إنشاء الرحلة...
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Success Modal */}
      <ReactNativeModal
        isVisible={success}
        onBackdropPress={handleSuccessModalClose}
        backdropOpacity={0.7}
        animationIn="fadeIn"
        animationOut="fadeOut"
      >
        <View
          className="flex flex-col items-center justify-center bg-white p-8 rounded-3xl mx-4"
          style={{
            elevation: Platform.OS === "android" ? 10 : 0,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.34,
            shadowRadius: 6.27,
          }}
        >
          <View style={{
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: "#fef3c7",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 20,
          }}>
            <Image source={images.check} className="w-16 h-16" resizeMode="contain" />
          </View>
          <Text className="text-2xl text-center font-CairoBold text-gray-800">
            تم إنشاء الرحلة بنجاح
          </Text>
          <Text className="text-md text-gray-600 font-CairoRegular text-center mt-3 mb-6">
            شكرًا لإنشاء الرحلة. يرجى المتابعة مع رحلتك.
          </Text>
          <LinearGradient
            colors={["#f97316", "#ea580c"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="rounded-xl w-full"
          >
            <TouchableOpacity
              className="py-4 px-5 items-center"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                handleSuccessModalClose();
              }}
              activeOpacity={0.8}
            >
              <Text className="text-white font-CairoBold text-lg">العودة للرئيسية</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ReactNativeModal>

      {/* Date and Time Pickers */}
      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        date={new Date()}
        minimumDate={new Date()}
        onConfirm={handleDateConfirm}
        onCancel={() => setDatePickerVisible(false)}
        buttonTextColorIOS="#f97316"
        confirmTextIOS="تأكيد"
        cancelTextIOS="إلغاء"
      />
      <DateTimePickerModal
        isVisible={isTimePickerVisible}
        mode="time"
        date={new Date()}
        onConfirm={handleTimeConfirm}
        onCancel={() => setTimePickerVisible(false)}
        buttonTextColorIOS="#f97316"
        confirmTextIOS="تأكيد"
        cancelTextIOS="إلغاء"
      />
    </SafeAreaView>
  );
};

const WaypointLocationPicker = ({ onLocationSelect }: { onLocationSelect: (location: Location) => void }) => {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <View className="p-4 border-b border-gray-200 flex-row justify-between items-center">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 bg-gray-50 rounded-lg"
          activeOpacity={0.7}
        >
          <Image 
            source={icons.close} 
            className="w-5 h-5 tint-gray-500"
          />
        </TouchableOpacity>
        <Text className="text-lg font-CairoBold text-right text-gray-800">اختر نقطة المرور</Text>
      </View>
      <View className="p-4">
        <Text className="text-sm font-CairoRegular text-right text-gray-500 mb-4">
          اختر موقع نقطة المرور من الخريطة أو ابحث عن العنوان
        </Text>
        <GoogleTextInput
          icon={icons.map}
          initialLocation=""
          containerStyle="bg-white rounded-xl border border-gray-100"
          textInputBackgroundColor="#fff"
          handlePress={onLocationSelect}
          placeholder="ابحث عن موقع"
        />
      </View>
    </View>
  );
};

export default RideCreationScreen;