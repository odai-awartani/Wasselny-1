import React, { useState, useEffect } from 'react';
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
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function SideMenu(props: DrawerContentComponentProps) {
  const { language, setLanguage, t } = useLanguage();
  const { userAddress } = useLocationStore();
  const { signOut } = useAuth();
  const { user } = useUser();
  const isRTL = language === 'ar';
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const [locationEnabled, setLocationEnabled] = useState(true);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.id) return;
      
      try {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const imageUrl = userData.profile_image_url || userData.driver?.profile_image_url || null;
          setProfileImageUrl(imageUrl);
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user?.id]);

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
    <DrawerContentScrollView  {...props}>
     
        {/* User Info Section */}
        <View className="mt-2 mb-6 items-center w-full">
          <TouchableOpacity 
            onPress={() => router.push('/(root)/profilePage')}
            className="w-20 h-20 items-center justify-center rounded-full bg-gray-100 overflow-hidden mb-3"
          >
            {profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={{ width: 80, height: 80, borderRadius: 40 }}
                resizeMode="cover"
              />
            ) : (
              <MaterialIcons name="person" size={40} color="#f97316" />
            )}
          </TouchableOpacity>
          <Text className="text-xl font-bold text-black mb-1 text-center">
            {user?.fullName || user?.firstName || t.user}
          </Text>
          {user?.primaryEmailAddress?.emailAddress && (
            <Text className="text-[15px] text-gray-500 text-center">{user.primaryEmailAddress.emailAddress}</Text>
          )}
        </View>

        {/* Decorative Orange Line */}
        <View className="h-[6px] w-full rounded bg-orange-100 mb-4" />
 <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: '#fff',
          paddingHorizontal: 18,
          paddingTop: 5,
          paddingBottom: 5,
        }}
        className="rounded-tr-[22px] rounded-br-[22px]"
      >
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
        

        {/* Tracking Section */}
        <Text className={`text-gray-400 text-xs mb-2 mt-2 font-semibold tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? 'التتبع' : 'Tracking'}
        </Text>
        
        <TouchableOpacity
          onPress={() => {
            router.push('/(root)/track');
            props.navigation.closeDrawer();
          }}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="location-searching" size={22} color="#fff" />
          </View>
          <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'تتبع الرحلات' : 'Track Rides'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            router.push('/(root)/track-requests');
            props.navigation.closeDrawer();
          }}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="notifications" size={22} color="#fff" />
          </View>
          <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'طلبات التتبع' : 'Track Requests'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            router.push('/(root)/my-shares');
            props.navigation.closeDrawer();
          }}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="share" size={22} color="#fff" />
          </View>
          <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'مشاركاتي' : 'My Shares'}
          </Text>
        </TouchableOpacity>
        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#f3f4f6', marginVertical: 10 }} />

{/* Rides Section */}
<Text className={`text-gray-400 text-xs mb-2 mt-2 font-semibold tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>
          {language === 'ar' ? 'الرحلات' : 'Rides'}
        </Text>
        
        <TouchableOpacity
          onPress={() => {
            router.push('/(root)/(tabs)/rides');
            props.navigation.closeDrawer();
          }}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="directions-car" size={22} color="#fff" />
          </View>
          <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'رحلاتي' : 'My Rides'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            router.push('/(root)/create-ride');
            props.navigation.closeDrawer();
          }}
          activeOpacity={0.7}
          className={`flex-row items-center mb-3 min-h-[44px] ${isRTL ? 'flex-row-reverse' : ''}`}
        >
          <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${isRTL ? 'ml-3.5' : 'mr-3.5'}`}>
            <MaterialIcons name="add-circle" size={22} color="#fff" />
          </View>
          <Text className={`text-base font-bold text-gray-800 ${isRTL ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'إنشاء رحلة' : 'Create Ride'}
          </Text>
        </TouchableOpacity>

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