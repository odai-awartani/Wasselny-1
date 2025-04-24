import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { icons } from '@/constants';
import { sendTestNotification } from '@/lib/notifications';

export default function TestNotification() {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);

  const handleTestNotification = async () => {
    try {
      setIsSending(true);
      const success = await sendTestNotification();
      
      if (success) {
        Alert.alert(
          'Success',
          'Test notification sent successfully!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          'Failed to send test notification. Please check the console for details.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'An unexpected error occurred while sending the test notification.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 w-full bg-white">
      {/* Header */}
      <View className="px-4 pt-4 flex-row justify-between items-center pb-3 border-b border-gray-100">
        <View className="flex-row w-full justify-between items-center">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100"
          >
            <Text className="text-lg">←</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-JakartaBold text-gray-900">Test Notification</Text>
          <View className="w-10" />
        </View>
      </View>

      {/* Test Button */}
      <View className="flex-1 items-center justify-center p-4">
        <TouchableOpacity
          onPress={handleTestNotification}
          disabled={isSending}
          className={`w-full py-4 px-6 rounded-xl ${
            isSending ? 'bg-gray-300' : 'bg-orange-500'
          }`}
        >
          <Text className="text-white text-center font-JakartaMedium text-lg">
            {isSending ? 'Sending...' : 'Send Test Notification'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
} 