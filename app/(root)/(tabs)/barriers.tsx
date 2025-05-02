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

const CheckpointsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Placeholder stories (can be replaced with real data)
  const stories = [
    {
      id: 1,
      title: "تأخير يومي",
      description: "سامي، طالب جامعي، يضطر للانتظار ساعتين يوميًا على حاجز قلنديا للوصول إلى الجامعة.",
    },
    {
      id: 2,
      title: "رحلة إلى المستشفى",
      description: "أم محمد اضطرت لتأخير علاجها بسبب إغلاق حاجز مفاجئ، مما زاد من معاناتها.",
    },
  ];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
      >
        {/* Header */}
        <LinearGradient
          colors={["#15803d", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 20,
            paddingHorizontal: 16,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          <Text className="text-3xl font-CairoBold text-white text-right">
            حواجز الصمود
          </Text>
          <Text className="text-lg font-CairoRegular text-white text-right mt-2">
            توثيق الحواجز في فلسطين وتأثيرها على الحياة اليومية
          </Text>
        </LinearGradient>

        {/* Info Section */}
        <View className="px-4 mt-6">
          <Text className="text-xl font-JakartaBold text-right mb-3">
            ما هي الحواجز؟
          </Text>
          <Text className="text-base font-CairoRegular text-gray-700 text-right leading-6">
            الحواجز هي نقاط تفتيش عسكرية تقيد حركة الفلسطينيين في الضفة الغربية. يوجد أكثر من 700 حاجز، منها حواجز ثابتة وطيارة، تؤثر على الحياة اليومية، التعليم، والرعاية الصحية.
          </Text>
          <View className="flex-row justify-between mt-4">
            <View className="bg-orange-100 p-4 rounded-xl flex-1 mr-2">
              <Text className="text-lg font-JakartaBold text-center text-orange-500">
                700+
              </Text>
              <Text className="text-sm font-CairoRegular text-center text-gray-600">
                حاجز في الضفة
              </Text>
            </View>
            <View className="bg-green-100 p-4 rounded-xl flex-1 ml-2">
              <Text className="text-lg font-JakartaBold text-center text-green-600">
                2M+
              </Text>
              <Text className="text-sm font-CairoRegular text-center text-gray-600">
                متأثر يوميًا
              </Text>
            </View>
          </View>
        </View>

        {/* Stories Section */}
        <View className="px-4 mt-6">
          <Text className="text-xl font-JakartaBold text-right mb-3">
            قصص من الحواجز
          </Text>
          {stories.map((story) => (
            <View
              key={story.id}
              className="bg-white p-4 rounded-xl mb-4 shadow-sm"
              style={{
                elevation: Platform.OS === "android" ? 3 : 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.22,
                shadowRadius: 2.22,
              }}
            >
              <Text className="text-lg font-JakartaSemiBold text-right text-gray-800">
                {story.title}
              </Text>
              <Text className="text-base font-CairoRegular text-right text-gray-600 mt-2">
                {story.description}
              </Text>
            </View>
          ))}
        </View>

        {/* Placeholder Image */}
        <View className="px-4 mt-6">
          <Image
            source={images.palestineMap || images.placeholder}
            className="w-full h-48 rounded-xl"
            resizeMode="cover"
          />
          <Text className="text-sm font-CairoRegular text-gray-500 text-center mt-2">
            خريطة فلسطين
          </Text>
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