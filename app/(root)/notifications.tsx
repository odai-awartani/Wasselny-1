import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { icons } from '@/constants';
import { useNotifications } from '@/context/NotificationContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
};

interface NotificationData {
  rideId?: string;
  status?: string;
  type?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  user_id: string;
  data?: NotificationData;
}

interface NotificationItemProps {
  notification: Notification;
  onPress: () => void;
}

const NotificationItem = ({ notification, onPress }: NotificationItemProps) => {
  const [isRead, setIsRead] = useState(notification.read);
  const type = notification.type || 'ride_request';

  return (
    <TouchableOpacity 
      className={`p-4 border rounded-lg border-gray-200 mb-2 w-[95%] mx-auto ${!isRead ? 'bg-gray-100' : 'bg-white'}`}
      onPress={onPress}
    >
      <View className="flex-row items-start">
        <View className="w-12 h-12 rounded-xl bg-red-50 items-center justify-center mr-3">
          <Image 
            source={
              type === 'ride_request' ? icons.map :
              type === 'ride_complete' ? icons.checkmark :
              type === 'ride_status' ? icons.ring1 :
              icons.dollar
            }
            className="w-5 h-5"
            tintColor="#EA580C"
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-JakartaBold text-gray-900">{notification.title}</Text>
          <Text className="text-[15px] text-gray-600 mt-1 leading-relaxed">{notification.message}</Text>
          <Text className="text-xs text-gray-400 mt-2">{formatTimeAgo(notification.createdAt)}</Text>
        </View>
        {!isRead && (
          <View className="w-2 h-2 rounded-full bg-orange-500" />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function Notifications() {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  const handleNotificationPress = async (notification: Notification) => {
    try {
      await markAsRead(notification.id);
      
      // Navigate to ride details if there's a rideId
      if (notification.data?.rideId) {
        router.push({
          pathname: '/(root)/ride-details/[id]',
          params: { id: notification.data.rideId, expandSheet: 'true' }
        });
      }
    } catch (error) {
      console.error('Error handling notification press:', error);
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
            <Image source={icons.backArrow} className="w-5 h-5" />
          </TouchableOpacity>
          <View className="flex-row items-center">
            <Text className="text-2xl font-JakartaBold text-gray-900">Notifications</Text>
            {unreadCount > 0 && (
              <View className="ml-2 bg-orange-500 rounded-full w-6 h-6 items-center justify-center">
                <Text className="text-white text-xs font-JakartaBold">{unreadCount}</Text>
              </View>
            )}
          </View>
          <View className="w-10" />
        </View>
      </View>

      {/* Header Actions */}
      {notifications.length > 0 && (
        <View className="flex-row justify-between items-center px-4 py-2.5 border-b border-gray-100 bg-orange-50">
          <Text className="text-gray-600 text-sm">{notifications.length} Notifications</Text>
          <TouchableOpacity 
            onPress={markAllAsRead}
            className="flex-row items-center"
          >
            <Text className="text-orange-600 text-sm font-JakartaMedium">Mark all as read</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NotificationItem 
            notification={item} 
            onPress={() => handleNotificationPress(item)}
          />
        )}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 6, paddingBottom: 20 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <View className="w-24 h-24 rounded-2xl bg-white items-center justify-center mb-5">
              <Image 
                source={icons.ring1}
                className="w-14 h-14"
                tintColor="#EA580C"
              />
            </View>
            <Text className="text-xl font-JakartaBold text-gray-900">No Notifications</Text>
            <Text className="text-[15px] text-gray-500 text-center mt-2 max-w-[260px] leading-relaxed">
              You'll see your notifications here when they arrive
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
