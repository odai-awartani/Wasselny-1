import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@clerk/clerk-expo';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const Home = () => {
  const router = useRouter();
  const { userId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rides, setRides] = useState([]);

  // ... existing code ...

  return (
    <View className="flex-1 bg-gray-100">
      <ScrollView className="flex-1">
        {/* Existing content */}
        <View className="p-4">
          {/* ... existing content ... */}
        </View>
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        onPress={() => {
          if (Platform.OS === 'android') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          router.push('/create-ride');
        }}
        style={[
          styles.fab,
          Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow,
        ]}
      >
        <MaterialIcons name="add" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 80, // Position above the tab bar
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#f97316', // Orange color
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  androidShadow: {
    elevation: 4,
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default Home; 