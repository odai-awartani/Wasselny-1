import React from 'react';
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from '@/components/Header';

export default function Rides() {
  return (
    <SafeAreaView className="bg-general-500 flex-1">
      <Header pageTitle="Rides" />
      <View className="flex-1 justify-center items-center">
        <Text className="text-2xl font-JakartaBold text-gray-700">
          Rides Page
        </Text>
      </View>
    </SafeAreaView>
  );
}