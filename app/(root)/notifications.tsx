import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { icons } from '@/constants';
import { useNotifications } from '@/context/NotificationContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { MaterialIcons } from '@expo/vector-icons';

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'الآن';
  if (diffInSeconds < 3600) return `منذ ${Math.floor(diffInSeconds / 60)} دقيقة`;
  if (diffInSeconds < 86400) return `منذ ${Math.floor(diffInSeconds / 3600)} ساعة`;
  return `منذ ${Math.floor(diffInSeconds / 86400)} يوم`;
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

  const getIcon = () => {
    switch (type) {
      case 'ride_request':
        return <MaterialIcons name="directions-car" size={24} color="#F97316" />;
      case 'ride_complete':
        return <MaterialIcons name="check-circle" size={24} color="#10B981" />;
      case 'ride_status':
        return <MaterialIcons name="notifications" size={24} color="#F97316" />;
      default:
        return <MaterialIcons name="info" size={24} color="#F97316" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'ride_request':
        return 'bg-orange-50';
      case 'ride_complete':
        return 'bg-green-50';
      case 'ride_status':
        return 'bg-blue-50';
      default:
        return 'bg-gray-50';
    }
  };

  return (
    <TouchableOpacity 
      className={`p-4 rounded-2xl mb-3 mx-4 ${!isRead ? getBackgroundColor() : 'bg-white'}`}
      style={Platform.OS === 'android' ? { elevation: 2 } : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      }}
      onPress={onPress}
    >
      <View className="flex-row-reverse  items-start">
        <View className={`w-12 h-12 rounded-xl ${getBackgroundColor()} items-center justify-center ml-3`}>
          {getIcon()}
        </View>
        <View className="flex-1">
          <View className="flex-row-reverse justify-between items-center">
            <Text className="text-base font-CairoBold text-gray-900">{notification.title}</Text>
            {!isRead && (
              <View className="w-2 h-2 rounded-full bg-orange-500" />
            )}
          </View>
          <Text className="text-[15px] text-right text-gray-600 mt-1 leading-relaxed font-CairoRegular">{notification.message}</Text>
          <Text className="text-xs text-gray-400  mt-2 font-CairoMedium">{formatTimeAgo(notification.createdAt)}</Text>
        </View>
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
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="px-4 pt-4 flex-row justify-between items-center pb-3 bg-white border-b border-gray-100">
        <View className="flex-row w-full justify-between items-center">
          <TouchableOpacity 
            onPress={() => router.back()}
            className="w-10 h-10 items-center  pl-2 justify-center rounded-full bg-gray-100"
          >
            <MaterialIcons name="arrow-back-ios"  size={20} color="#374151" />
          </TouchableOpacity>
          <View className="flex-row items-center">
            <Text className="text-2xl font-CairoBold text-gray-900">الإشعارات</Text>
            {unreadCount > 0 && (
              <View className="mr-2 bg-orange-500 rounded-full w-6 h-6 items-center justify-center">
                <Text className="text-white text-xs font-CairoBold">{unreadCount}</Text>
              </View>
            )}
          </View>
          <View className="w-10" />
        </View>
      </View>

      {/* Header Actions */}
      {notifications.length > 0 && (
        <View className="flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-100">
          <Text className="text-gray-600 text-sm font-CairoMedium">{notifications.length} إشعار</Text>
          <TouchableOpacity 
            onPress={markAllAsRead}
            className="flex-row items-center"
          >
            <Text className="text-orange-600 text-sm font-CairoBold">تحديد الكل كمقروء</Text>
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
        contentContainerStyle={{ flexGrow: 1, paddingTop: 12, paddingBottom: 20 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-8">
            <View className="w-24 h-24 rounded-2xl bg-white items-center justify-center mb-5 shadow-sm">
              <MaterialIcons name="notifications-off" size={48} color="#F97316" />
            </View>
            <Text className="text-xl font-CairoBold text-gray-900">لا توجد إشعارات</Text>
            <Text className="text-[15px] text-gray-500 text-center mt-2 max-w-[260px] leading-relaxed font-CairoRegular">
              ستظهر إشعاراتك هنا عند وصولها
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}