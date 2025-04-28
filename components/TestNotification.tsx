import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { sendTestNotification } from '@/lib/notifications';

const TestNotification = () => {
  const handleTest = async () => {
    try {
      const result = await sendTestNotification();
      if (result) {
        console.log('Test notification scheduled successfully');
      } else {
        console.error('Failed to schedule test notification');
      }
    } catch (error) {
      console.error('Error testing notification:', error);
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <TouchableOpacity
        onPress={handleTest}
        style={{
          backgroundColor: '#007AFF',
          padding: 12,
          borderRadius: 8,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: 'white', fontSize: 16 }}>
          Test Ride Notification
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default TestNotification;
