import React, { useState } from 'react';
import { View, TouchableOpacity, Text, Alert } from 'react-native';
import { testRideReminder } from '@/lib/notifications';

const TestRideReminder = () => {
  const [isTesting, setIsTesting] = useState(false);

  const handleTest = async () => {
    try {
      setIsTesting(true);
      const result = await testRideReminder();
      if (result) {
        Alert.alert(
          'Test Started',
          'You should receive a test notification in 5 seconds. Please make sure your phone is not in silent mode.'
        );
      } else {
        Alert.alert(
          'Test Failed',
          'Failed to schedule test notification. Please check your notification permissions.'
        );
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      Alert.alert('Error', 'An error occurred while testing the notification system.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <TouchableOpacity
        onPress={handleTest}
        disabled={isTesting}
        style={{
          backgroundColor: isTesting ? '#ccc' : '#007AFF',
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 16 }}>
          {isTesting ? 'Testing...' : 'Test Ride Reminder'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default TestRideReminder; 