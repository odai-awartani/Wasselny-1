import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@clerk/clerk-expo';
import { findOrCreateChat } from '@/lib/chat';
import ConversationItem from '@/components/chat/ConversationItem';
import { icons } from '@/constants';
import type { Chat as ChatType, LastMessage } from '@/types/type';

interface BaseChat {
  id: string;
  participants: string[];
  lastMessage: LastMessage | null;
  lastMessageTime: Timestamp;
  unreadCount: { [key: string]: number };
}

interface Chat extends BaseChat {
  name?: string;
  avatar?: string;
}

interface Driver {
  id: string;
  name?: string;
  email?: string;
  profile_image_url?: string;
}

export default function ChatListScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<ChatType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChats();
  }, [user]);

  const fetchChats = async () => {
    if (!user) return;

    try {
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', user.id));
      const querySnapshot = await getDocs(q);

      const chatsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        // Find the other participant's ID
        const otherParticipantId = data.participants.find((id: string) => id !== user.id);
        // Get the metadata for the other participant
        const otherParticipantMetadata = data.metadata?.[otherParticipantId] || {};
        const chat: ChatType = {
          id: doc.id,
          name: otherParticipantMetadata.name || 'Chat',
          avatar: otherParticipantMetadata.avatar || '',
          lastMessage: data.lastMessage || null,
          lastMessageTime: data.lastMessageTime,
          unreadCount: data.unreadCount?.[user.id] || 0,
          participants: data.participants || []
        };
        return chat;
      });

      // Sort chats by lastMessageTime in descending order (newest first)
      const sortedChats = chatsList.sort((a, b) => {
        const timeA = a.lastMessageTime?.toDate().getTime() || 0;
        const timeB = b.lastMessageTime?.toDate().getTime() || 0;
        return timeB - timeA;
      });

      setChats(sortedChats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchDrivers = async (query: string) => {
    if (!query.trim()) {
      setDrivers([]);
      return;
    }

    try {
      const driversRef = collection(db, 'users');
      const q = query.toLowerCase();
      const querySnapshot = await getDocs(driversRef);
      
      const driversList = querySnapshot.docs
        .map(doc => {
          const data = doc.data();
          // Only include users who are drivers
          if (!data.driver) return null;
          
          const name = data.name || '';
          if (name.toLowerCase().includes(q)) {
            return {
              id: doc.id,
              name: data.name,
              email: data.email,
              profile_image_url: data.driver.profile_image_url
            };
          }
          return null;
        })
        .filter(Boolean) as Driver[];

      setDrivers(driversList);
    } catch (error) {
      console.error('Error searching drivers:', error);
    }
  };

  const handleDriverPress = async (driver: Driver) => {
    if (!user) return;

    try {
      const chatId = await findOrCreateChat(
        {
          id: user.id,
          fullName: user.fullName || 'User',
          firstName: user.firstName || 'User',
          lastName: user.lastName || '',
          emailAddresses: user.emailAddresses || [],
          imageUrl: user.imageUrl || '',
          unsafeMetadata: user.unsafeMetadata || {},
          createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: user.updatedAt?.toISOString() || new Date().toISOString()
        },
        {
          id: driver.id,
          fullName: driver.name || '',
          firstName: driver.name?.split(' ')[0] || '',
          lastName: driver.name?.split(' ')[1] || '',
          emailAddresses: [{ emailAddress: driver.email || '' }],
          imageUrl: driver.profile_image_url || '',
          unsafeMetadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      );

      if (chatId) {
        router.push({
          pathname: "/(root)/chat/[id]",
          params: { 
            id: chatId,
            name: driver.name || 'Driver',
            avatar: driver.profile_image_url || '',
          }
        });
      }
    } catch (error) {
      console.error('Error creating chat with driver:', error);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    searchDrivers(text);
  };

  const handleChatPress = (chat: ChatType) => {
    router.push({
      pathname: "/(root)/chat/[id]",
      params: { 
        id: chat.id,
        name: chat.name,
        avatar: chat.avatar
      }
    });
  };

  return (
    <View className="flex-1 bg-white px-4 pt-10">
      <Text className="text-xl font-bold mb-4 text-right">المحادثات الأخيرة</Text>

      {/* Search */}
      <View className="mt-12 mb-4">
        <View className="flex-row items-center bg-gray-100 rounded-full px-4 py-2">
          <TextInput
            placeholder="ابحث عن السائقين..."
            value={searchQuery}
            onChangeText={handleSearch}
            className="flex-1 text-right font-CairoBold"
            style={{ textAlign: 'right' }}
          />
          <Image source={icons.search} className="w-5 h-5 ml-2" />
        </View>
      </View>

      {/* Search Results - Drivers */}
      {drivers.length > 0 && (
        <View className="mb-4">
          <Text className="text-lg font-CairoBold mb-2 text-right">السائقين</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {drivers.map((driver) => (
              <TouchableOpacity
                key={driver.id}
                onPress={() => handleDriverPress(driver)}
                className="ml-4 items-center"
              >
                <View className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                  {driver.profile_image_url ? (
                    <Image
                      source={{ uri: driver.profile_image_url }}
                      className="w-full h-full"
                    />
                  ) : (
                    <View className="w-full h-full bg-purple-500 items-center justify-center">
                      <Text className="text-white text-lg">
                        {driver.name?.[0]?.toUpperCase() || 'D'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm mt-1 font-CairoBold">{driver.name || 'سائق'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* No results message */}
      {chats.length === 0 && drivers.length === 0 && searchQuery.length > 0 && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 text-lg font-CairoBold">لا توجد نتائج</Text>
          <Text className="text-gray-400 text-base mt-2 font-CairoBold">جرب كلمة بحث مختلفة</Text>
        </View>
      )}

      {/* Empty state */}
      {chats.length === 0 && drivers.length === 0 && searchQuery.length === 0 && (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500 text-lg font-CairoBold">لا توجد محادثات</Text>
          <Text className="text-gray-400 text-base mt-2 font-CairoBold">ابحث عن السائقين للبدء في الدردشة</Text>
        </View>
      )}

      {/* Chats */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {chats.map((chat) => (
          <ConversationItem 
            key={chat.id}
            chat={chat}
            onPress={handleChatPress}
          />
        ))}
      </ScrollView>
    </View>
  );
}