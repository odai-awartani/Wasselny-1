import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, Alert, Image } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Share {
  recipient_id: string;
  latitude: number;
  longitude: number;
  last_updated: string;
  is_active: boolean;
}

interface RecipientInfo {
  id: string;
  full_name: string;
  email: string;
  profile_image?: string;
}

export default function MySharesPage() {
  const { user } = useUser();
  const [shares, setShares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    const q = query(
      collection(db, 'location_sharing'),
      where('sharer_id', '==', user.id),
      where('is_active', '==', true)
    );
    const unsub = onSnapshot(q, async (snapshot) => {
      const s: any[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as Share;
        // Fetch recipient info
        const recDoc = await getDoc(doc(db, 'users', data.recipient_id));
        let recipient: RecipientInfo = {
          id: data.recipient_id,
          full_name: '',
          email: '',
        };
        if (recDoc.exists()) {
          const d = recDoc.data();
          recipient = {
            id: data.recipient_id,
            full_name: d.full_name || d.email || 'User',
            email: d.email,
            profile_image: d.profile_image,
          };
        }
        s.push({ ...data, recipient, docId: docSnap.id });
      }
      setShares(s);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.id]);

  const stopSharing = async (docId: string) => {
    try {
      await updateDoc(doc(db, 'location_sharing', docId), { is_active: false });
      Alert.alert('Stopped', 'Location sharing stopped.');
    } catch (e) {
      Alert.alert('Error', 'Could not stop sharing.');
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
      <Text className="text-2xl font-bold px-4 pt-6 pb-2">My Shares</Text>
      <FlatList
        data={shares}
        keyExtractor={item => item.recipient.id}
        renderItem={({ item }) => (
          <View className="flex-row items-center p-4 border-b border-gray-100">
            <View className="w-12 h-12 rounded-full bg-gray-200 justify-center items-center mr-4">
              {item.recipient.profile_image ? (
                <Image source={{ uri: item.recipient.profile_image }} className="w-12 h-12 rounded-full" />
              ) : (
                <Text className="text-gray-500 font-bold text-lg">
                  {(item.recipient.full_name?.charAt(0) || item.recipient.email?.charAt(0) || '?').toUpperCase()}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="font-bold text-gray-800 text-lg">{item.recipient.full_name}</Text>
              <Text className="text-gray-500 text-sm">{item.recipient.email}</Text>
              <Text className="text-xs text-gray-400 mt-1">Last updated: {new Date(item.last_updated).toLocaleTimeString()}</Text>
            </View>
            <TouchableOpacity
              className="bg-red-500 px-4 py-2 rounded-xl"
              onPress={() => stopSharing(item.docId)}
            >
              <Text className="text-white font-bold">Stop</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text className="text-center text-gray-400 mt-10">You are not sharing your location with anyone.</Text>}
      />
    </View>
  );
} 