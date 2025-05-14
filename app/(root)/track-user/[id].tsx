import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import MapView, { Marker } from 'react-native-maps';

export default function TrackUserDetail() {
  const router = useRouter();
  const { id: sharerId } = useLocalSearchParams();
  const { user } = useUser();
  const [location, setLocation] = useState<any>(null);
  const [sharer, setSharer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!sharerId || !user?.id) return;
    setLoading(true);
    // Listen to the location sharing doc
    const unsub = onSnapshot(doc(db, 'location_sharing', `${sharerId}_${user.id}`), async (docSnap) => {
      if (docSnap.exists()) {
        setLocation(docSnap.data());
        // Fetch sharer info
        const sharerDoc = await getDoc(doc(db, 'users', sharerId as string));
        if (sharerDoc.exists()) setSharer(sharerDoc.data());
      }
      setLoading(false);
    });
    return () => unsub();
  }, [sharerId, user?.id]);

  // Add timer to update the displayed time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Function to format time elapsed
  const formatTimeElapsed = (timestamp: string) => {
    if (!timestamp) return "Never";
    
    const lastUpdated = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    if (seconds < 60) {
      return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else {
      return lastUpdated.toLocaleTimeString();
    }
  };

  if (loading || !location) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <Text style={{ fontSize: 24 }}>{'←'}</Text>
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Tracking {sharer?.full_name || 'User'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <MapView
        style={{ flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' }}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={{ latitude: location.latitude, longitude: location.longitude }}
          title={sharer?.full_name || 'User'}
        />
      </MapView>
      <View className="px-4 pb-6">
        <Text className="text-center text-gray-700 mb-2">Last updated: {formatTimeElapsed(location.last_updated)}</Text>
        <TouchableOpacity
          className="w-full bg-orange-500 py-3 rounded-xl"
          onPress={() => router.back()}
        >
          <Text className="text-center text-white font-bold">Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
} 