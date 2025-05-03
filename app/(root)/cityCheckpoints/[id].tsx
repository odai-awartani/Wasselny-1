import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { icons } from "@/constants";
import Header from "@/components/Header";

// Define the type for checkpoint objects
interface Checkpoint {
  name: string;
  location: string;
  status: string;
  lastUpdated: string;
}

// Define the type for checkpoint data structure
interface CheckpointData {
  [key: string]: Checkpoint[];
}

// Define the type for city names mapping
interface CityNames {
  [key: string]: string;
}

// Checkpoint data structured by city with last updated time
const checkpointData: CheckpointData = {
  nablus: [
    { name: "حاجز زعترة", location: "جنوب نابلس", status: "مفتوح مع تفتيش", lastUpdated: "2 مايو 2025، 10:00" },
    { name: "حاجز حوارة", location: "جنوب نابلس", status: "مغلق جزئيًا", lastUpdated: "1 مايو 2025، 15:00" },
    { name: "حاجز بيت فوريك", location: "شرق نابلس", status: "مفتوح", lastUpdated: "3 مايو 2025، 09:00" },
    { name: "حاجز المربعة", location: "جنوب غرب نابلس", status: "مفتوح مع تفتيش", lastUpdated: "2 مايو 2025، 14:00" },
    { name: "حاجز البدحان", location: "شمال شرق نابلس", status: "تفتيش عشوائي", lastUpdated: "1 مايو 2025، 12:00" },
    { name: "حاجز 17", location: "على طريق 5715", status: "تفتيش عشوائي", lastUpdated: "3 مايو 2025، 08:00" },
  ],
  hebron: [
    { name: "حاجز ترقوميا", location: "غرب الخليل", status: "مفتوح", lastUpdated: "2 مايو 2025، 11:00" },
    { name: "حاجز الظاهرية", location: "جنوب الخليل", status: "مغلق", lastUpdated: "1 مايو 2025، 16:00" },
    { name: "حاجز بيت كاحل", location: "شمال الخليل", status: "مغلق", lastUpdated: "3 مايو 2025، 10:00" },
    { name: "حاجز الكونتينر", location: "شرق الخليل", status: "مفتوح مع تأخير", lastUpdated: "2 مايو 2025، 13:00" },
  ],
  ramallah: [
    { name: "حاجز قلنديا", location: "شمال رام الله", status: "مفتوح مع تأخير", lastUpdated: "3 مايو 2025، 12:00" },
    { name: "حاجز بيت إيل", location: "جنوب رام الله", status: "مفتوح", lastUpdated: "2 مايو 2025، 09:00" },
    { name: "حاجز عطارة", location: "شمال رام الله", status: "مفتوح مع تفتيش", lastUpdated: "1 مايو 2025، 14:00" },
    { name: "حاجز عين سينيا", location: "شمال رام الله", status: "مفتوح مع تأخير", lastUpdated: "3 مايو 2025، 11:00" },
    { name: "حاجز جبع", location: "جنوب رام الله", status: "مفتوح مع تفتيش", lastUpdated: "2 مايو 2025، 15:00" },
    { name: "حاجز رانيتس", location: "غرب رام الله", status: "مغلق للفلسطينيين", lastUpdated: "1 مايو 2025، 10:00" },
  ],
  jenin: [
    { name: "حاجز جلبوع", location: "شمال جنين", status: "مغلق", lastUpdated: "2 مايو 2025، 13:00" },
    { name: "حاجز دوتان", location: "جنوب جنين", status: "مفتوح", lastUpdated: "3 مايو 2025، 09:00" },
    { name: "حاجز جنين الرئيسي", location: "مدخل جنين", status: "مفتوح مع تفتيش", lastUpdated: "1 مايو 2025، 16:00" },
  ],
  bethlehem: [
    { name: "حاجز الكونتينر", location: "شمال بيت لحم", status: "مفتوح", lastUpdated: "3 مايو 2025، 10:00" },
    { name: "حاجز بيت جالا", location: "غرب بيت لحم", status: "مغلق", lastUpdated: "2 مايو 2025، 14:00" },
    { name: "حاجز 300", location: "جنوب بيت لحم", status: "مفتوح مع تفتيش", lastUpdated: "1 مايو 2025، 12:00" },
  ],
  gaza: [
    { name: "حاجز إيرز", location: "شمال غزة", status: "مغلق", lastUpdated: "2 مايو 2025، 15:00" },
    { name: "حاجز كرم أبو سالم", location: "جنوب غزة", status: "مفتوح جزئيًا", lastUpdated: "3 مايو 2025، 08:00" },
  ],
  jerusalem: [
    { name: "حاجز الزيتون/رأس أبو سبيتان", location: "شرق القدس", status: "مفتوح مع تفتيش", lastUpdated: "1 مايو 2025، 14:00" },
    { name: "حاجز السوانة", location: "شرق القدس", status: "مفتوح مع تأخير", lastUpdated: "3 مايو 2025، 11:00" },
  ],
  tulkarem: [
    { name: "حاجز عناب", location: "شرق طولكرم", status: "مفتوح مع تفتيش", lastUpdated: "2 مايو 2025، 10:00" },
    { name: "حاجز جبارة", location: "جنوب طولكرم", status: "مغلق", lastUpdated: "1 مايو 2025، 13:00" },
  ],
  qalqilya: [
    { name: "حاجز عزون", location: "شرق قلقيلية", status: "مفتوح مع تفتيش", lastUpdated: "3 مايو 2025، 09:00" },
    { name: "حاجز حبلة", location: "جنوب قلقيلية", status: "مغلق", lastUpdated: "2 مايو 2025، 12:00" },
  ],
  tubas: [
    { name: "حاجز طياسير", location: "شرق طوباس", status: "مفتوح مع تفتيش", lastUpdated: "1 مايو 2025، 15:00" },
    { name: "حاجز الحمرا", location: "غرب طوباس", status: "مفتوح مع تأخير", lastUpdated: "3 مايو 2025، 10:00" },
  ],
  salfit: [
    { name: "حاجز زعترة", location: "شمال سلفيت", status: "مفتوح مع تفتيش", lastUpdated: "2 مايو 2025، 14:00" },
    { name: "حاجز دير بلوط", location: "غرب سلفيت", status: "مغلق", lastUpdated: "1 مايو 2025، 11:00" },
  ],
};

const cityNames: CityNames = {
  nablus: "نابلس",
  hebron: "الخليل",
  ramallah: "رام الله",
  jenin: "جنين",
  bethlehem: "بيت لحم",
  gaza: "غزة",
  jerusalem: "القدس",
  tulkarem: "طولكرم",
  qalqilya: "قلقيلية",
  tubas: "طوباس",
  salfit: "سلفيت",
};

const CityCheckpoints: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams();

  // Ensure id is a string
  const cityId: string = typeof id === "string" ? id : "";

  const checkpoints: Checkpoint[] = checkpointData[cityId] || [];
  const cityName: string = cityNames[cityId] || "غير معروف";

  const handleCheckpointPress = (checkpointName: string): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/(root)/checkpointDetails/${encodeURIComponent(checkpointName)}`);
  };

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-100">
      <Header pageTitle={`حواجز ${cityName}`} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
      >

          <Text className="text-base font-CairoRegular text-black text-right mx-4 my-4">
            تفاصيل الحواجز في {cityName}
          </Text>
        

        {/* Checkpoints Section */}
        <View className="px-4">
          {checkpoints.length > 0 ? (
            checkpoints.map((checkpoint, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleCheckpointPress(checkpoint.name)}
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                style={{
                  elevation: Platform.OS === "android" ? 3 : 0,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 3,
                }}
              >
                <Text className="text-lg font-CairoSemiBold text-right text-gray-800">
                  {checkpoint.name}
                </Text>
                <Text className="text-base font-CairoRegular text-right text-gray-600 mt-1">
                  الموقع: {checkpoint.location}
                </Text>
                <Text
                  className="text-base font-CairoRegular text-right mt-1"
                  style={{
                    color: checkpoint.status.includes("مفتوح") ? "#16a34a" : "#dc2626",
                  }}
                >
                  الوضع: {checkpoint.status}
                </Text>
                <Text className="text-sm font-CairoRegular text-right text-gray-500 mt-1">
                  آخر تحديث: {checkpoint.lastUpdated}
                </Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text className="text-base font-CairoRegular text-right text-gray-600">
              لا توجد بيانات متاحة لهذه المدينة.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          router.back();
        }}
        style={{
          position: "absolute",
          left: 16,
          bottom: insets.bottom + 20,
          width: 56,
          height: 56,
          borderRadius: 28,
          justifyContent: "center",
          alignItems: "center",
          elevation: Platform.OS === "android" ? 4 : 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: Platform.OS === "ios" ? 0.25 : 0,
          shadowRadius: Platform.OS === "ios" ? 3.84 : 0,
          zIndex: 1000,
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#f97316", "#ea580c"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Image
            source={icons.backArrow}
            style={{ width: 24, height: 24, tintColor: "#fff" }}
          />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default CityCheckpoints;