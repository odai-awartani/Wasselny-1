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

// Define the type for evaluator objects
interface Evaluator {
  name: string;
  date: string;
}

// Define the type for checkpoint objects
interface Checkpoint {
  name: string;
  location: string;
  status: string;
  lastUpdated: string;
  currentEvaluator: Evaluator;
  previousEvaluator: Evaluator;
  userEvaluation: Evaluator;
}

// Define the type for checkpoint data structure
interface CheckpointData {
  [key: string]: Checkpoint[];
}

// Checkpoint data structured by city
const checkpointData: CheckpointData = {
  nablus: [
    { 
      name: "حاجز زعترة", 
      location: "جنوب نابلس", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "2 مايو 2025، 10:00",
      currentEvaluator: { name: "محمد أحمد", date: "2 مايو 2025، 10:00" },
      previousEvaluator: { name: "علي حسن", date: "1 مايو 2025، 09:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز حوارة", 
      location: "جنوب نابلس", 
      status: "مغلق جزئيًا", 
      lastUpdated: "1 مايو 2025، 15:00",
      currentEvaluator: { name: "خالد محمود", date: "1 مايو 2025، 15:00" },
      previousEvaluator: { name: "يوسف خالد", date: "30 أبريل 2025، 12:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز بيت فوريك", 
      location: "شرق نابلس", 
      status: "مفتوح", 
      lastUpdated: "3 مايو 2025، 09:00",
      currentEvaluator: { name: "أحمد سمير", date: "3 مايو 2025، 09:00" },
      previousEvaluator: { name: "محمد سمير", date: "2 مايو 2025، 08:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز المربعة", 
      location: "جنوب غرب نابلس", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "2 مايو 2025، 14:00",
      currentEvaluator: { name: "إبراهيم علي", date: "2 مايو 2025، 14:00" },
      previousEvaluator: { name: "سامي يوسف", date: "1 مايو 2025، 13:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز البدحان", 
      location: "شمال شرق نابلس", 
      status: "تفتيش عشوائي", 
      lastUpdated: "1 مايو 2025، 12:00",
      currentEvaluator: { name: "زياد خالد", date: "1 مايو 2025، 12:00" },
      previousEvaluator: { name: "عمر أحمد", date: "30 أبريل 2025، 11:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز 17", 
      location: "على طريق 5715", 
      status: "تفتيش عشوائي", 
      lastUpdated: "3 مايو 2025، 08:00",
      currentEvaluator: { name: "محسن ياسر", date: "3 مايو 2025، 08:00" },
      previousEvaluator: { name: "طارق محمد", date: "2 مايو 2025، 07:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  hebron: [
    { 
      name: "حاجز ترقوميا", 
      location: "غرب الخليل", 
      status: "مفتوح", 
      lastUpdated: "2 مايو 2025، 11:00",
      currentEvaluator: { name: "أيمن خالد", date: "2 مايو 2025، 11:00" },
      previousEvaluator: { name: "محمد أيمن", date: "1 مايو 2025، 10:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز الظاهرية", 
      location: "جنوب الخليل", 
      status: "مغلق", 
      lastUpdated: "1 مايو 2025، 16:00",
      currentEvaluator: { name: "سامر أحمد", date: "1 مايو 2025، 16:00" },
      previousEvaluator: { name: "علي سامر", date: "30 أبريل 2025، 15:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز بيت كاحل", 
      location: "شمال الخليل", 
      status: "مغلق", 
      lastUpdated: "3 مايو 2025، 10:00",
      currentEvaluator: { name: "خالد ياسر", date: "3 مايو 2025، 10:00" },
      previousEvaluator: { name: "ياسر خالد", date: "2 مايو 2025، 09:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز الكونتينر", 
      location: "شرق الخليل", 
      status: "مفتوح مع تأخير", 
      lastUpdated: "2 مايو 2025، 13:00",
      currentEvaluator: { name: "محمد سمير", date: "2 مايو 2025، 13:00" },
      previousEvaluator: { name: "سمير محمد", date: "1 مايو 2025، 12:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  ramallah: [
    { 
      name: "حاجز قلنديا", 
      location: "شمال رام الله", 
      status: "مفتوح مع تأخير", 
      lastUpdated: "3 مايو 2025، 12:00",
      currentEvaluator: { name: "أحمد زياد", date: "3 مايو 2025، 12:00" },
      previousEvaluator: { name: "زياد أحمد", date: "2 مايو 2025، 11:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز بيت إيل", 
      location: "جنوب رام الله", 
      status: "مفتوح", 
      lastUpdated: "2 مايو 2025، 09:00",
      currentEvaluator: { name: "علي خالد", date: "2 مايو 2025، 09:00" },
      previousEvaluator: { name: "خالد علي", date: "1 مايو 2025، 08:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز عطارة", 
      location: "شمال رام الله", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "1 مايو 2025، 14:00",
      currentEvaluator: { name: "يوسف محمد", date: "1 مايو 2025، 14:00" },
      previousEvaluator: { name: "محمد يوسف", date: "30 أبريل 2025، 13:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز عين سينيا", 
      location: "شمال رام الله", 
      status: "مفتوح مع تأخير", 
      lastUpdated: "3 مايو 2025، 11:00",
      currentEvaluator: { name: "سامي أحمد", date: "3 مايو 2025، 11:00" },
      previousEvaluator: { name: "أحمد سامي", date: "2 مايو 2025، 10:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز جبع", 
      location: "جنوب رام الله", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "2 مايو 2025، 15:00",
      currentEvaluator: { name: "طارق خالد", date: "2 مايو 2025، 15:00" },
      previousEvaluator: { name: "خالد طارق", date: "1 مايو 2025، 14:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز رانيتس", 
      location: "غرب رام الله", 
      status: "مغلق للفلسطينيين", 
      lastUpdated: "1 مايو 2025، 10:00",
      currentEvaluator: { name: "محسن ياسر", date: "1 مايو 2025، 10:00" },
      previousEvaluator: { name: "ياسر محسن", date: "30 أبريل 2025، 09:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  jenin: [
    { 
      name: "حاجز جلبوع", 
      location: "شمال جنين", 
      status: "مغلق", 
      lastUpdated: "2 مايو 2025، 13:00",
      currentEvaluator: { name: "أيمن محمد", date: "2 مايو 2025، 13:00" },
      previousEvaluator: { name: "محمد أيمن", date: "1 مايو 2025، 12:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز دوتان", 
      location: "جنوب جنين", 
      status: "مفتوح", 
      lastUpdated: "3 مايو 2025، 09:00",
      currentEvaluator: { name: "سامر خالد", date: "3 مايو 2025، 09:00" },
      previousEvaluator: { name: "خالد سامر", date: "2 مايو 2025، 08:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز جنين الرئيسي", 
      location: "مدخل جنين", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "1 مايو 2025، 16:00",
      currentEvaluator: { name: "خالد ياسر", date: "1 مايو 2025، 16:00" },
      previousEvaluator: { name: "ياسر خالد", date: "30 أبريل 2025، 15:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  bethlehem: [
    { 
      name: "حاجز الكونتينر", 
      location: "شمال بيت لحم", 
      status: "مفتوح", 
      lastUpdated: "3 مايو 2025، 10:00",
      currentEvaluator: { name: "محمد سمير", date: "3 مايو 2025، 10:00" },
      previousEvaluator: { name: "سمير محمد", date: "2 مايو 2025، 09:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز بيت جالا", 
      location: "غرب بيت لحم", 
      status: "مغلق", 
      lastUpdated: "2 مايو 2025، 14:00",
      currentEvaluator: { name: "أحمد زياد", date: "2 مايو 2025، 14:00" },
      previousEvaluator: { name: "زياد أحمد", date: "1 مايو 2025، 13:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز 300", 
      location: "جنوب بيت لحم", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "1 مايو 2025، 12:00",
      currentEvaluator: { name: "علي خالد", date: "1 مايو 2025، 12:00" },
      previousEvaluator: { name: "خالد علي", date: "30 أبريل 2025، 11:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  gaza: [
    { 
      name: "حاجز إيرز", 
      location: "شمال غزة", 
      status: "مغلق", 
      lastUpdated: "2 مايو 2025، 15:00",
      currentEvaluator: { name: "يوسف محمد", date: "2 مايو 2025، 15:00" },
      previousEvaluator: { name: "محمد يوسف", date: "1 مايو 2025، 14:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز كرم أبو سالم", 
      location: "جنوب غزة", 
      status: "مفتوح جزئيًا", 
      lastUpdated: "3 مايو 2025، 08:00",
      currentEvaluator: { name: "سامي أحمد", date: "3 مايو 2025، 08:00" },
      previousEvaluator: { name: "أحمد سامي", date: "2 مايو 2025، 07:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  jerusalem: [
    { 
      name: "حاجز الزيتون/رأس أبو سبيتان", 
      location: "شرق القدس", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "1 مايو 2025، 14:00",
      currentEvaluator: { name: "طارق خالد", date: "1 مايو 2025، 14:00" },
      previousEvaluator: { name: "خالد طارق", date: "30 أبريل 2025، 13:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز السوانة", 
      location: "شرق القدس", 
      status: "مفتوح مع تأخير", 
      lastUpdated: "3 مايو 2025، 11:00",
      currentEvaluator: { name: "محسن ياسر", date: "3 مايو 2025، 11:00" },
      previousEvaluator: { name: "ياسر محسن", date: "2 مايو 2025، 10:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  tulkarem: [
    { 
      name: "حاجز عناب", 
      location: "شرق طولكرم", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "2 مايو 2025، 10:00",
      currentEvaluator: { name: "أيمن محمد", date: "2 مايو 2025، 10:00" },
      previousEvaluator: { name: "محمد أيمن", date: "1 مايو 2025، 09:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز جبارة", 
      location: "جنوب طولكرم", 
      status: "مغلق", 
      lastUpdated: "1 مايو 2025، 13:00",
      currentEvaluator: { name: "سامر خالد", date: "1 مايو 2025، 13:00" },
      previousEvaluator: { name: "خالد سامر", date: "30 أبريل 2025، 12:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  qalqilya: [
    { 
      name: "حاجز عزون", 
      location: "شرق قلقيلية", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "3 مايو 2025، 09:00",
      currentEvaluator: { name: "خالد ياسر", date: "3 مايو 2025، 09:00" },
      previousEvaluator: { name: "ياسر خالد", date: "2 مايو 2025، 08:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز حبلة", 
      location: "جنوب قلقيلية", 
      status: "مغلق", 
      lastUpdated: "2 مايو 2025، 12:00",
      currentEvaluator: { name: "محمد سمير", date: "2 مايو 2025، 12:00" },
      previousEvaluator: { name: "سمير محمد", date: "1 مايو 2025، 11:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  tubas: [
    { 
      name: "حاجز طياسير", 
      location: "شرق طوباس", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "1 مايو 2025، 15:00",
      currentEvaluator: { name: "أحمد زياد", date: "1 مايو 2025، 15:00" },
      previousEvaluator: { name: "زياد أحمد", date: "30 أبريل 2025، 14:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز الحمرا", 
      location: "غرب طوباس", 
      status: "مفتوح مع تأخير", 
      lastUpdated: "3 مايو 2025، 10:00",
      currentEvaluator: { name: "علي خالد", date: "3 مايو 2025، 10:00" },
      previousEvaluator: { name: "خالد علي", date: "2 مايو 2025، 09:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
  salfit: [
    { 
      name: "حاجز زعترة", 
      location: "شمال سلفيت", 
      status: "مفتوح مع تفتيش", 
      lastUpdated: "2 مايو 2025، 14:00",
      currentEvaluator: { name: "يوسف محمد", date: "2 مايو 2025، 14:00" },
      previousEvaluator: { name: "محمد يوسف", date: "1 مايو 2025، 13:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
    { 
      name: "حاجز دير بلوط", 
      location: "غرب سلفيت", 
      status: "مغلق", 
      lastUpdated: "1 مايو 2025، 11:00",
      currentEvaluator: { name: "سامي أحمد", date: "1 مايو 2025، 11:00" },
      previousEvaluator: { name: "أحمد سامي", date: "30 أبريل 2025، 10:00" },
      userEvaluation: { name: "أنت", date: "3 مايو 2025، 14:00" },
    },
  ],
};

const CheckpointDetails: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { checkpointId } = useLocalSearchParams();

  // Ensure checkpointId is a string and decode it
  const decodedCheckpointId: string = typeof checkpointId === "string" ? decodeURIComponent(checkpointId) : "";

  // Find the checkpoint across all cities
  const findCheckpoint = (name: string): Checkpoint | undefined => {
    for (const city in checkpointData) {
      const checkpoint = checkpointData[city].find((cp) => cp.name === name);
      if (checkpoint) return checkpoint;
    }
    return undefined;
  };

  const checkpoint: Checkpoint | undefined = findCheckpoint(decodedCheckpointId);

  if (!checkpoint) {
    return (
      <SafeAreaView edges={["top"]} className="flex-1 bg-gray-100">
        <Header pageTitle="حاجز غير موجود" />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: insets.bottom + 100,
          }}
        >
          <Text className="text-base font-CairoRegular text-right text-gray-600">
            الحاجز المطلوب غير موجود.
          </Text>
        </ScrollView>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.back();
          }}
          style={{
            position: "absolute",
            right: 16,
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
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-100">
      <Header pageTitle={checkpoint.name} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
      >

          <Text className="text-lg font-CairoRegular text-black text-right mx-4 my-4">
            تفاصيل الحاجز وتقييماته
          </Text>
       

        {/* Checkpoint Details Card */}
        <View className="mx-4 mb-4">
          <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
            <Text className="text-lg font-CairoSemiBold text-right text-gray-800 mb-3">
              تفاصيل الحاجز
            </Text>
            <View className="flex-row-reverse justify-between items-center mb-2">
              <Text className="text-base font-CairoRegular text-gray-600">
                {checkpoint.location} :الموقع
              </Text>
              <Text className="text-base font-CairoSemiBold text-gray-800">📍</Text>
            </View>
            <View className="flex-row-reverse justify-between items-center mb-2">
              <Text
                className="text-base font-CairoRegular text-right"
                style={{
                  color: checkpoint.status.includes("مفتوح") ? "#16a34a" : "#dc2626",
                }}
              >
                {checkpoint.status} :الوضع
              </Text>
              <Text className="text-base font-CairoSemiBold text-gray-800">
                {checkpoint.status.includes("مفتوح") ? "✅" : "❌"}
              </Text>
            </View>
            <View className="flex-row-reverse justify-between items-center">
              <Text className="text-sm font-CairoRegular text-gray-500">
                {checkpoint.lastUpdated} :آخر تحديث
              </Text>
              <Text className="text-base font-CairoSemiBold text-gray-800">⏰</Text>
            </View>
          </View>
        </View>

        {/* Current Evaluator Card */}
        <View className="mx-4 mb-4">
          <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
            <Text className="text-lg font-JakartaSemiBold text-right text-gray-800 mb-3">
              التقييم الحالي
            </Text>
            <View className="flex-row-reverse justify-between items-center mb-2">
              <Text className="text-base font-CairoRegular text-gray-600">
               التقييم بواسطة:  {checkpoint.currentEvaluator.name} 
              </Text>
              <Text className="text-base font-CairoSemiBold text-gray-800">👤</Text>
            </View>
            <View className="flex-row-reverse justify-between items-center">
              <Text className="text-sm font-CairoRegular text-gray-500">
                {checkpoint.currentEvaluator.date} :تاريخ التقييم
              </Text>
              <Text className="text-base font-CairoSemiBold text-gray-800">📅</Text>
            </View>
          </View>
        </View>

        {/* Previous Evaluator Card */}
        <View className="mx-4 mb-4">
          <View className="bg-white p-4 rounded-xl border border-gray-200 shadow-md">
            <Text className="text-lg font-JakartaSemiBold text-right text-gray-800 mb-3">
              التقييم السابق
            </Text>
            <View className="flex-row-reverse justify-between items-center mb-2">
              <Text className="text-base font-CairoRegular text-gray-600">
              التقييم بواسطة:  {checkpoint.previousEvaluator.name} 
              </Text>
              <Text className="text-base font-CairoSemiBold text-gray-800">👤</Text>
            </View>
            <View className="flex-row-reverse justify-between items-center">
              <Text className="text-sm font-CairoRegular text-gray-500">
                {checkpoint.previousEvaluator.date} :تاريخ التقييم
              </Text>
              <Text className="text-base font-CairoSemiBold text-gray-800">📅</Text>
            </View>
          </View>
        </View>

        {/* User Evaluation Card */}
        <View className="mx-4 mb-4">
          <View className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-md">
            <Text className="text-lg font-JakartaSemiBold text-right text-green-800 mb-3">
              تقييمك
            </Text>
            <View className="flex-row-reverse justify-between items-center mb-2">
              <Text className="text-base font-CairoRegular text-green-600">
                {checkpoint.userEvaluation.name} :التقييم بواسطة
              </Text>
              <Text className="text-base font-CairoSemiBold text-green-800">🌟</Text>
            </View>
            <View className="flex-row-reverse justify-between items-center">
              <Text className="text-sm font-CairoRegular text-green-500">
                {checkpoint.userEvaluation.date} :تاريخ التقييم
              </Text>
              <Text className="text-base font-CairoSemiBold text-green-800">📅</Text>
            </View>
          </View>
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

export default CheckpointDetails;