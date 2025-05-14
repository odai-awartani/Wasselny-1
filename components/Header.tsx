import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { useNotifications } from '@/context/NotificationContext';
import { useNavigation, DrawerActions } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

function CustomMenuIcon({ isRTL }: { isRTL: boolean }) {
  return (
    <View style={{ width: 24, height: 24, justifyContent: 'center' }}>
      <View style={{ 
        width: 24, 
        height: 2.5, 
        backgroundColor: '#f97316', 
        borderRadius: 2, 
        marginBottom: 5,
        alignSelf: isRTL ? 'flex-end' : 'flex-start'
      }} />
      <View style={{ 
        width: 16, 
        height: 2.5, 
        backgroundColor: '#f97316', 
        borderRadius: 2, 
        marginBottom: 5,
        alignSelf: isRTL ? 'flex-end' : 'flex-start'
      }} />
      <View style={{ 
        width: 20, 
        height: 2.5, 
        backgroundColor: '#f97316', 
        borderRadius: 2,
        alignSelf: isRTL ? 'flex-end' : 'flex-start'
      }} />
    </View>
  );
}

interface HeaderProps {
  profileImageUrl?: string | null;
  title?: string;
  showProfileImage?: boolean;
}

export default function Header({ profileImageUrl, title, showProfileImage = true }: HeaderProps) {
  const { t, isRTL } = useLanguage();
  const { unreadCount } = useNotifications();
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  return (
    <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
      {isRTL ? (
        <>
          <View className="flex-row items-center space-x-2">
            {showProfileImage && (
              <TouchableOpacity
                onPress={() => router.push('/(root)/profilePage')}
                className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 overflow-hidden"
              >
                {profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialIcons name="person" size={24} color="#f97316" />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push('/(root)/notifications')}
              className="w-10 h-10 items-center justify-center"
            >
              <MaterialIcons name="notifications" size={24} color="#f97316" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                  <Text className="text-[10px] text-white font-bold">{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View className="absolute left-0 right-0 items-center">
            <Text className={`text-xl font-CairoBold text-gray-900`}>{title}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            className="w-10 h-10 items-center justify-center"
          >
            <CustomMenuIcon isRTL={isRTL} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            className="w-10 h-10 items-center justify-center"
          >
            <CustomMenuIcon isRTL={isRTL} />
          </TouchableOpacity>
          <View className="absolute left-0 right-0 items-center">
            <Text className="text-xl font-bold text-gray-900">{title || t.Home}</Text>
          </View>
          <View className="flex-row items-center space-x-2">
            {showProfileImage && (
              <TouchableOpacity
                onPress={() => router.push('/(root)/profilePage')}
                className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 overflow-hidden"
              >
                {profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                    resizeMode="cover"
                  />
                ) : (
                  <MaterialIcons name="person" size={24} color="#f97316" />
                )}
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push('/(root)/notifications')}
              className="w-10 h-10 items-center justify-center"
            >
              <MaterialIcons name="notifications" size={24} color="#f97316" />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                  <Text className="text-[10px] text-white font-bold">{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}