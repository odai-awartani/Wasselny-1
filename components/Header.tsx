import React from 'react';
import { Image, TouchableOpacity, Text, View } from "react-native";
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { icons } from '@/constants';
import { useNotifications } from '@/context/NotificationContext';
import { useUser, useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type HeaderProps = {
  pageTitle: string;
};

const Header: React.FC<HeaderProps> = ({ pageTitle }) => {
  const { unreadCount } = useNotifications();
  const { user } = useUser();
  const { signOut } = useAuth();
  const [profileImageUrl, setProfileImageUrl] = React.useState<string | null>(null);

  const checkUserData = async () => {
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
      console.error('Error fetching user data:', error);
    }
  };

  React.useEffect(() => {
    checkUserData();
  }, [user?.id]);

  const handleSignOut = () => {
    signOut();
    router.replace("/(auth)/sign-in");
  };

  return (
    <View className="py-3 w-full bg-white ">
      <View className="flex-row items-center justify-between px-5">
        <View className="flex-row items-center">
            <TouchableOpacity
            onPress={()=> router.push("/profile")}
            >

           
          {profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              className="w-12 h-12 rounded-full border border-2 mr-2"
              resizeMode="contain"
              onError={(e) => {
                console.log('Image load error:', e.nativeEvent.error);
                setProfileImageUrl(null);
              }}
            />
          ) : (
            <MaterialIcons name="person" size={24} color="#333333" className="mr-2" />
          )}
           </TouchableOpacity>
        </View>
        <Text className="text-lg font-CairoBold text-gray-700">
          {pageTitle}
        </Text>
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(root)/notifications');
            }}
            className="justify-center items-center w-10 h-10"
            activeOpacity={0.8}
          >
            <Image source={icons.ring1} className="w-6 h-6" tintColor="#333333" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full items-center justify-center">
                <Text className="text-[12px] text-white font-JakartaBold">{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default Header;