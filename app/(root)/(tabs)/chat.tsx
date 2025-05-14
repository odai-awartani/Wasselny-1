import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, getDocs, Timestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@clerk/clerk-expo';
import { findOrCreateChat } from '@/lib/chat';
import ConversationItem from '@/components/chat/ConversationItem';
import { icons } from '@/constants';
import type { Chat as ChatType, LastMessage } from '@/types/type';
import { useLanguage } from '@/context/LanguageContext';
import Header from '@/components/Header';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<ChatType[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  // Fetch user profile image
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfileImageUrl(userData.profile_image_url || userData.driver?.profile_image_url || null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [user?.id]);

  // Fetch chats on mount and when user changes
  useEffect(() => {
    if (user) {
      fetchChats();
      setupChatListener();
    }
  }, [user]);

  // Set up real-time chat listener
  const setupChatListener = () => {
    if (!user) return;

    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', user.id));
    
    return onSnapshot(q, (snapshot) => {
      const chatsList = snapshot.docs.map(doc => {
        const data = doc.data();
        const otherParticipantId = data.participants.find((id: string) => id !== user.id);
        const otherParticipantMetadata = data.metadata?.[otherParticipantId] || {};
        return {
          id: doc.id,
          name: otherParticipantMetadata.name || 'Chat',
          avatar: otherParticipantMetadata.avatar || '',
          lastMessage: data.lastMessage || null,
          lastMessageTime: data.lastMessageTime,
          unreadCount: data.unreadCount?.[user.id] || 0,
          participants: data.participants || []
        };
      });

      const sortedChats = chatsList.sort((a, b) => {
        const timeA = a.lastMessageTime?.toDate().getTime() || 0;
        const timeB = b.lastMessageTime?.toDate().getTime() || 0;
        return timeB - timeA;
      });

      setChats(sortedChats);
      setLoading(false);
    }, (error) => {
      console.error('Error listening to chats:', error);
      setLoading(false);
    });
  };

  const fetchChats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const chatsRef = collection(db, 'chats');
      const q = query(chatsRef, where('participants', 'array-contains', user.id));
      const querySnapshot = await getDocs(q);

      const chatsList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const otherParticipantId = data.participants.find((id: string) => id !== user.id);
        const otherParticipantMetadata = data.metadata?.[otherParticipantId] || {};
        return {
          id: doc.id,
          name: otherParticipantMetadata.name || 'Chat',
          avatar: otherParticipantMetadata.avatar || '',
          lastMessage: data.lastMessage || null,
          lastMessageTime: data.lastMessageTime,
          unreadCount: data.unreadCount?.[user.id] || 0,
          participants: data.participants || []
        };
      });

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

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchChats();
    setRefreshing(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header profileImageUrl={profileImageUrl} title={t.Chat} />

      {/* Search Bar */}
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center bg-gray-50 rounded-full px-4 py-2">
          <Image source={icons.search} className="w-5 h-5 ml-2" tintColor="#6B7280" />
          <TextInput
            placeholder={t.searchDrivers}
            value={searchQuery}
            onChangeText={handleSearch}
            className="flex-1 text-right font-CairoBold text-gray-700"
            style={{ textAlign: 'right' }}
            placeholderTextColor="#9CA3AF"
          />
        </View>
      </View>

      {/* Loading State */}
      {loading && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4F46E5" />
        </View>
      )}

      {/* Search Results - Drivers */}
      {drivers.length > 0 && (
        <View className="px-4 py-3 bg-white border-b border-gray-100">
          <Text className="text-lg font-CairoBold mb-2 text-right text-gray-800">نتائج البحث</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {drivers.map((driver) => (
              <TouchableOpacity
                key={driver.id}
                onPress={() => handleDriverPress(driver)}
                className="ml-4 items-center"
              >
                <View className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden ">
                  {driver.profile_image_url ? (
                    <Image
                      source={{ uri: driver.profile_image_url }}
                      className="w-full h-full"
                    />
                  ) : (
                    <View className="w-full h-full bg-primary items-center justify-center">
                      <Text className="text-white text-xl">
                        {driver.name?.[0]?.toUpperCase() || 'D'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm mt-2 font-CairoBold text-gray-700">{driver.name || 'سائق'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Chats List */}
      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#4F46E5']}
            tintColor="#4F46E5"
          />
        }
      >
        {/* No results message */}
        {chats.length === 0 && drivers.length === 0 && searchQuery.length > 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <Image source={icons.search} className="w-16 h-16 mb-4" tintColor="#9CA3AF" />
            <Text className="text-gray-500 text-lg font-CairoBold">لا توجد نتائج</Text>
            <Text className="text-gray-400 text-base mt-2 font-CairoBold">جرب كلمة بحث مختلفة</Text>
          </View>
        )}

        {/* Empty state */}
        {chats.length === 0 && drivers.length === 0 && searchQuery.length === 0 && (
          <View className="flex-1 items-center justify-center py-20">
            <Image source={icons.chat} className="w-16 h-16 mb-4" tintColor="#9CA3AF" />
            <Text className="text-gray-500 text-lg font-CairoBold">لا توجد محادثات</Text>
            <Text className="text-gray-400 text-base mt-2 font-CairoBold">ابحث عن السائقين للبدء في الدردشة</Text>
          </View>
        )}

        {/* Chats */}
        {chats.map((chat) => (
          <ConversationItem 
            key={chat.id}
            chat={chat}
            onPress={handleChatPress}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}