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
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { icons, images } from "@/constants";
import Header from "@/components/Header";

// Define the type for city objects
interface City {
  id: string;
  name: string;
}

const CheckpointsScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const cities: City[] = [
    { id: "nablus", name: "نابلس" },
    { id: "hebron", name: "الخليل" },
    { id: "ramallah", name: "رام الله" },
    { id: "jenin", name: "جنين" },
    { id: "bethlehem", name: "بيت لحم" },
    { id: "gaza", name: "غزة" },
    { id: "jerusalem", name: "القدس" },
    { id: "tulkarem", name: "طولكرم" },
    { id: "qalqilya", name: "قلقيلية" },
    { id: "tubas", name: "طوباس" },
    { id: "salfit", name: "سلفيت" },
  ];

  const handleCityPress = (cityId: string): void => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/(root)/cityCheckpoints/${cityId}`);
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#f4f4f4" }}>
      <Header pageTitle="Barriers" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
      >

        {/* Cities Section */}
        <View className="px-4 py-4">
          <Text className="text-xl font-CairoBold text-right mb-3 text-gray-800">
            اختر مدينة
          </Text>
          {cities.map((city) => (
            <TouchableOpacity
              key={city.id}
              onPress={() => handleCityPress(city.id)}
              className="bg-white p-4 rounded-xl mb-3 border border-gray-200"
              style={{
                elevation: Platform.OS === "android" ? 3 : 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
              }}
            >
              <Text className="text-lg font-CairoSemiBold text-right text-gray-800">
                {city.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
};

export default CheckpointsScreen;