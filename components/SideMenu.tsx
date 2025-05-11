import React, { useState } from 'react';
import { View, Text, Switch, TouchableOpacity, Share, Platform, Linking, Image } from 'react-native';
import { ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '@/context/LanguageContext';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useLocationStore } from '@/store';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';

export default function SideMenu(props: DrawerContentComponentProps) {
  const { language, setLanguage, t } = useLanguage();
  const { userAddress } = useLocationStore();
  const { signOut } = useAuth();
  const { user } = useUser();
  const isRTL = language === 'ar';

  const [locationEnabled, setLocationEnabled] = useState(true);



  const toggleLocation = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!locationEnabled) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationEnabled(status === 'granted');
    } else {
      setLocationEnabled(false);
    }
  };
  const handleSignOut = () => {
    signOut();
    router.replace("/(auth)/sign-in");
  };

  const toggleLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLanguage(language === 'ar' ? 'en' : 'ar');
    props.navigation.closeDrawer();
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: t.shareAppMessage,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleRate = () => {
    const storeUrl = Platform.select({
      ios: 'https://apps.apple.com/app/idYOUR_APP_ID',
      android: 'market://details?id=YOUR_APP_ID',
    });
    if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  };

  return (
    <DrawerContentScrollView {...props}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: '#fff',
          paddingHorizontal: 18,
          paddingTop: 24,
          paddingBottom: 12,
        }}
        className="rounded-tr-[22px] rounded-br-[22px]"
      >
        {/* User Info Section */}
        <View className="mt-4 mb-6 items-center w-full">
          <Text className="text-xl font-bold text-black mb-1 text-center">
            {user?.fullName || user?.firstName || t.user}
          </Text>
          {user?.primaryEmailAddress?.emailAddress && (
            <Text className="text-[15px] text-gray-500 text-center">{user.primaryEmailAddress.emailAddress}</Text>
          )}
        </View>

        {/* Decorative Orange Line */}
        <View className="h-[6px] w-full rounded bg-orange-100 mb-4" />

        {/* Account Section */}
        <Text className={`text-gray-400 text-xs mb-2 mt-2 font-semibold tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>{t.account}</Text>
        
        <TouchableOpacity
          onPress={() => router.push('/(root)/profilePageEdit')}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="edit" size={22} color="#fff" />
          </View>
          <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>{t.editProfile}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleLanguage}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="language" size={22} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>{t.language}</Text>
            <Text className={`text-gray-500 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'العربية' : 'English'}
            </Text>
          </View>
        </TouchableOpacity>





        <TouchableOpacity
          onPress={() => router.push('/(root)/location')}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="location-on" size={22} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>{t.location}</Text>
            <Text className={`text-gray-500 text-[13px] mt-0.5 ${isRTL ? 'text-right' : 'text-left'}`}>{userAddress || t.currentLocation}</Text>
          </View>
        </TouchableOpacity>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 }} />

        {/* Support Section */}
        <Text className={`text-gray-400 text-xs mb-2 mt-2 font-semibold tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>{t.support}</Text>
        <View className="mb-2">
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.7}
            className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
              <MaterialIcons name="share" size={22} color="#fff" />
            </View>
            <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>{t.shareApp}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleRate}
            activeOpacity={0.7}
            className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
              <MaterialIcons name="star" size={22} color="#fff" />
            </View>
            <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>{t.rateUs}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(root)/privacy-policy')}
            activeOpacity={0.7}
            className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
              <MaterialIcons name="privacy-tip" size={22} color="#fff" />
            </View>
            <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>{t.privacyPolicy}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(root)/help')}
            activeOpacity={0.7}
            className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
              <MaterialIcons name="help-outline" size={22} color="#fff" />
            </View>
            <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>{t.helpAndSupport}</Text>
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 }} />

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
          style={{ backgroundColor: '#fee2e2', borderRadius: 12 }}
        >
          <View className={`w-9 h-9 rounded-full bg-red-100 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="logout" size={22} color="#ef4444" />
          </View>
          <Text className={`text-base font-bold text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>{t.logout}</Text>
        </TouchableOpacity>
      </ScrollView>
    </DrawerContentScrollView>
  );
}