import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { icons } from '@/constants';
import { useNotifications } from '@/context/NotificationContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { sendRideStatusNotification } from '@/lib/notifications';
import { collection, query, where, getDocs } from 'firebase/firestore';

const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
};

type NotificationItemProps = {
  id: string;
  type: 'ride_request' | 'ride_complete' | 'ride_status' | 'payment';
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  userId: string;
  data?: {
    rideId?: string;
    status?: string;
  };
};

const NotificationItem = ({ item, onPress }: { item: NotificationItemProps; onPress: () => void }) => {
  const handleAccept = async () => {
    try {
      console.log('Accepting ride request:', item);
      
      // Find the ride request document using driver ID
      const rideRequestsRef = collection(db, 'ride_requests');
      const q = query(
        rideRequestsRef,
        where('driver_id', '==', item.userId),
        where('status', '==', 'waiting')
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('No waiting ride request found for driver:', item.userId);
        return;
      }

      // Get the most recent ride request
      const rideRequestDoc = querySnapshot.docs.reduce((latest, current) => {
        const latestTime = latest.data().created_at?.toDate() || new Date(0);
        const currentTime = current.data().created_at?.toDate() || new Date(0);
        return currentTime > latestTime ? current : latest;
      });

      const rideId = rideRequestDoc.data().ride_id;
      const passengerId = rideRequestDoc.data().user_id;
      
      if (!rideId) {
        console.error('No ride ID found in ride request');
        return;
      }
      
      // Update ride request status
      console.log('Updating ride request:', rideRequestDoc.id);
      await updateDoc(doc(db, 'ride_requests', rideRequestDoc.id), {
        status: 'accepted',
        updated_at: new Date(),
      });

      // Send notification to passenger
      console.log('Sending notification to passenger:', passengerId);
      await sendRideStatusNotification(
        passengerId,
        'تم قبول طلب الحجز!',
        'تم قبول طلب حجزك للرحلة',
        rideId
      );

      // Update notification data
      const notificationRef = doc(db, 'notifications', item.id);
      console.log('Updating notification:', item.id);
      const updateData = {
        read: true,
        data: {
          status: 'accepted',
          rideId: rideId
        }
      };
      await updateDoc(notificationRef, updateData);

      Alert.alert('✅ تم قبول طلب الحجز بنجاح');
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('حدث خطأ أثناء قبول الطلب.');
    }
  };

  const handleReject = async () => {
    try {
      console.log('Rejecting ride request:', item);
      
      // Find the ride request document using driver ID
      const rideRequestsRef = collection(db, 'ride_requests');
      const q = query(
        rideRequestsRef,
        where('driver_id', '==', item.userId),
        where('status', '==', 'waiting')
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.error('No waiting ride request found for driver:', item.userId);
        return;
      }

      // Get the most recent ride request
      const rideRequestDoc = querySnapshot.docs.reduce((latest, current) => {
        const latestTime = latest.data().created_at?.toDate() || new Date(0);
        const currentTime = current.data().created_at?.toDate() || new Date(0);
        return currentTime > latestTime ? current : latest;
      });

      const rideId = rideRequestDoc.data().ride_id;
      const passengerId = rideRequestDoc.data().user_id;
      
      if (!rideId) {
        console.error('No ride ID found in ride request');
        return;
      }
      
      // Update ride request status
      console.log('Updating ride request:', rideRequestDoc.id);
      await updateDoc(doc(db, 'ride_requests', rideRequestDoc.id), {
        status: 'rejected',
        updated_at: new Date(),
      });

      // Send notification to passenger
      console.log('Sending notification to passenger:', passengerId);
      await sendRideStatusNotification(
        passengerId,
        'تم رفض طلب الحجز',
        'عذراً، تم رفض طلب حجزك للرحلة',
        rideId
      );

      // Update notification data
      const notificationRef = doc(db, 'notifications', item.id);
      console.log('Updating notification:', item.id);
      const updateData = {
        read: true,
        data: {
          status: 'rejected',
          rideId: rideId
        }
      };
      await updateDoc(notificationRef, updateData);

      Alert.alert('✅ تم رفض طلب الحجز');
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('حدث خطأ أثناء رفض الطلب.');
    }
  };

  return (
    <TouchableOpacity 
      className={`p-4 border rounded-lg border-gray-200 mb-2 w-[95%] mx-auto ${!item.read ? 'bg-gray-100' : 'bg-white'}`}
      onPress={onPress}
    >
      <View className="flex-row items-start">
        <View className="w-12 h-12 rounded-xl bg-red-50 items-center justify-center mr-3">
          <Image 
            source={
              item.type === 'ride_request' ? icons.map :
              item.type === 'ride_complete' ? icons.checkmark :
              item.type === 'ride_status' ? icons.ring1 :
              icons.dollar
            }
            className="w-5 h-5"
            tintColor="#EA580C"
          />
        </View>
        <View className="flex-1">
          <Text className="text-base font-JakartaBold text-gray-900">{item.title}</Text>
          <Text className="text-[15px] text-gray-600 mt-1 leading-relaxed">{item.message}</Text>
          <Text className="text-xs text-gray-400 mt-2">{formatTimeAgo(item.createdAt)}</Text>
          
          {/* Accept/Reject Buttons for Ride Requests */}
          {item.type === 'ride_request' && !item.data?.status && (
            <View className="flex-row justify-end mt-4 space-x-2">
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleAccept();
                }}
                className="bg-green-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-JakartaMedium">قبول</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleReject();
                }}
                className="bg-red-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-JakartaMedium">رفض</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {!item.read && (
          <View className="w-2 h-2 rounded-full bg-orange-500" />
        )}
      </View>
    </TouchableOpacity>
  );
};

export default function Notifications() {
  const router = useRouter();
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  const handleNotificationPress = async (notification: NotificationItemProps) => {
    await markAsRead(notification.id);
    
    // Navigate to ride details if there's a rideId
    if (notification.data?.rideId) {
      router.push(`/ride-details/${notification.data.rideId}`);
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
            item={item} 
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
