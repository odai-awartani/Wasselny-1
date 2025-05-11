import React, { useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { Chat } from '@/types/type';
import { useUser } from '@clerk/clerk-expo';

interface Props {
  chat: Chat;
  onPress: (chat: Chat) => void;
}

export default function ConversationItem({ chat, onPress }: Props) {
  const { user } = useUser();

  useEffect(() => {
    console.log('ConversationItem rendered with chat:', {
      id: chat.id,
      name: chat.name,
      lastMessage: chat.lastMessage,
      lastMessageTime: chat.lastMessageTime?.toDate(),
      unreadCount: chat.unreadCount
    });
  }, [chat]);

  const handlePress = () => {
    console.log('ConversationItem pressed:', {
      id: chat.id,
      name: chat.name,
      lastMessage: chat.lastMessage
    });
    onPress(chat);
  };

  return (
    <TouchableOpacity 
      className="flex-row items-center py-3 border-b border-gray-100 w-[90%] mx-auto"
      onPress={handlePress}
    >
      {/* Avatar with unread indicator */}
      <View className="relative">
        {chat.avatar ? (
          <Image 
            source={{ uri: chat.avatar }} 
            className="w-12 h-12 rounded-full" 
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-purple-200 items-center justify-center">
            <Text className="text-lg font-semibold text-orange-800">
              {chat.name?.[0] || '?'}
            </Text>
          </View>
        )}
        {(chat.unreadCount?.[user?.id || ''] || 0) > 0 && (
          <View className="absolute -top-1 -right-1 bg-orange-500 rounded-full min-w-[18px] h-[18px] items-center justify-center">
            <Text className="text-xs text-white font-bold px-1">
              {chat.unreadCount[user?.id || ''] > 99 ? '99+' : chat.unreadCount[user?.id || '']}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-1 ml-3">
        <View className="flex-row justify-between items-center">
          <Text className="font-medium text-base">{chat.name || 'Chat'}</Text>
          {chat.lastMessageTime && (
            <Text className="text-xs text-gray-400">
              {chat.lastMessageTime.toDate().toLocaleTimeString([], { 
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          )}
        </View>
        <Text className="text-sm text-gray-500 truncate">
          {chat.lastMessage?.text || 'No messages yet'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}