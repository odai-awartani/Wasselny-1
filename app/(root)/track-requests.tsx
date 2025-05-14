import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, Image } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface TrackRequest {
  sharer_id: string;
  latitude: number;
  longitude: number;
  last_updated: string;
  is_active: boolean;
}

interface SharerInfo {
  id: string;
  full_name: string;
  email: string;
  profile_image?: string;
}

export default function TrackRequestsPage() {
  const { user } = useUser();
  const router = useRouter();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    const q = query(
      collection(db, 'location_sharing'),
      where('recipient_id', '==', user.id),
      where('is_active', '==', true)
    );
    const unsub = onSnapshot(q, async (snapshot) => {
      const reqs: any[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as TrackRequest;
        // Fetch sharer info
        const sharerDoc = await getDoc(doc(db, 'users', data.sharer_id));
        let sharer: SharerInfo = {
          id: data.sharer_id,
          full_name: '',
          email: '',
        };
        if (sharerDoc.exists()) {
          const d = sharerDoc.data();
          sharer = {
            id: data.sharer_id,
            full_name: d.full_name || d.email || 'User',
            email: d.email,
            profile_image: d.profile_image,
          };
        }
        reqs.push({ ...data, sharer });
      }
      setRequests(reqs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.id]);

  // Add timer to update the displayed times every second
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

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white">
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Text className="text-2xl font-bold px-4 pt-6 pb-2">Track Requests</Text>
      <FlatList
        data={requests}
        keyExtractor={item => item.sharer.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center p-4 border-b border-gray-100"
            onPress={() => router.push({ pathname: '/track-user/[id]', params: { id: item.sharer.id } })}
          >
            <View className="w-12 h-12 rounded-full bg-gray-200 justify-center items-center mr-4">
              {item.sharer.profile_image ? (
                <Image source={{ uri: item.sharer.profile_image }} className="w-12 h-12 rounded-full" />
              ) : (
                <Text className="text-gray-500 font-bold text-lg">
                  {(item.sharer.full_name?.charAt(0) || item.sharer.email?.charAt(0) || '?').toUpperCase()}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="font-bold text-gray-800 text-lg">{item.sharer.full_name}</Text>
              <Text className="text-gray-500 text-sm">{item.sharer.email}</Text>
              <Text className="text-xs text-gray-400 mt-1">Last updated: {formatTimeElapsed(item.last_updated)}</Text>
            </View>
            <Text className="text-orange-500 font-bold">View</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text className="text-center text-gray-400 mt-10">No one is sharing their location with you.</Text>}
      />
    </View>
  );
} 