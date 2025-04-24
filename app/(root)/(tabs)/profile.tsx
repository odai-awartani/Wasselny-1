import React, { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Image, ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from '@/context/LanguageContext';
import { icons } from '@/constants';
import { AntDesign, MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { useDriverStatus } from "./_layout";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "@/lib/upload";

interface UserData {
  driver?: {
    is_active: boolean;
    car_type: string;
    car_seats: number;
    car_image_url: string;
    profile_image_url: string;
    created_at: string;
  };
  profile_image_url?: string;
}

const Profile = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  
  // Combine related states into a single state object
  const [userData, setUserData] = useState<{
    isDriver: boolean;
    isLoading: boolean;
    profileImage: string | null;
    data: UserData | null;
  }>({ 
    isDriver: false,
    isLoading: true,
    profileImage: null,
    data: null
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const phoneNumber = user?.unsafeMetadata?.phoneNumber as string || "+1 123-456-7890";
  const memberSince = "April 2024";
  const totalRides = 24;
  const rating = 4.8;

  const onRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    fetchUserData().finally(() => setIsRefreshing(false));
  }, []);
  const handleSignOut = () => {
      signOut();
      router.replace("/(auth)/sign-in");
    };

  const fetchUserData = async (isMounted = true) => {
    if (!user?.id) {
      if (isMounted) {
        setUserData(prev => ({
          ...prev,
          isLoading: false,
          isDriver: false,
          profileImage: user?.imageUrl || null
        }));
      }
      return;
    }

    try {
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (!isMounted) return;

      if (userDoc.exists()) {
        const data = userDoc.data() as UserData;
        setUserData({
          isDriver: !!data.driver?.is_active,
          isLoading: false,
          profileImage: data.profile_image_url || user?.imageUrl || null,
          data
        });
      } else {
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null,
          data: null
        }));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (isMounted) {
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null
        }));
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUserData();
    setIsRefreshing(false);
  };

  // Use a single effect to manage user data fetching
  useEffect(() => {
    let isMounted = true;
    fetchUserData(isMounted);

    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.imageUrl]);

  const { recheckDriverStatus } = useDriverStatus();

  const handleRegisterDriver = () => {
    router.push("/(root)/driverInfo");
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'ar' ? 'تم رفض الإذن' : 'Permission Denied',
          language === 'ar' ? 'يجب منح إذن للوصول إلى مكتبة الصور' : 'You need to grant permission to access media library.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset?.uri) return;

      // Validate file type
      const fileExtension = asset.uri.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png'].includes(fileExtension || '')) {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'يجب اختيار صورة بصيغة JPG أو PNG' : 'Please select a JPG or PNG image.'
        );
        return;
      }

      // Show temporary local image while uploading
      setUserData(prev => ({ ...prev, profileImage: asset.uri }));
      setIsUploading(true);

      // Upload to Cloudinary
      const uploadedImageUrl = await uploadImageToCloudinary(asset.uri);

      if (!uploadedImageUrl) {
        throw new Error(language === 'ar' ? 'فشل في تحميل الصورة' : 'Failed to upload image');
      }

      // Update Firestore document
      if (user?.id) {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          // Update the existing user document
          await updateDoc(userRef, {
            profile_image_url: uploadedImageUrl
          });
        } else {
          // Create a new user document with profile image
          await setDoc(userRef, {
            userId: user.id,
            email: user.primaryEmailAddress?.emailAddress,
            firstName: user.firstName,
            lastName: user.lastName,
            createdAt: new Date().toISOString(),
            profile_image_url: uploadedImageUrl
          });
        }

        // Update profile image state with the Cloudinary URL
        setUserData(prev => ({ ...prev, profileImage: uploadedImageUrl }));
        
        Alert.alert(
          language === 'ar' ? 'نجاح' : 'Success',
          language === 'ar' ? 'تم تحديث صورة البروفايل بنجاح' : 'Profile picture updated successfully'
        );
      }
    } catch (error) {
      console.error('Profile image upload error:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تحديث صورة البروفايل' : 'Error updating profile picture'
      );
      // Revert to previous image if available
      setUserData(prev => ({ ...prev, profileImage: user?.imageUrl || null }));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        className="px-5"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View className="items-center mt-6 mb-4">
          <TouchableOpacity onPress={() => setShowFullImage(true)} className="relative">
            <Image
              source={{
                uri: userData.profileImage || user?.imageUrl || 'https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png'
              }}
              className="w-24 h-24 rounded-full"
            />
            {isUploading && (
              <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                <ActivityIndicator color="white" />
              </View>
            )}
            <TouchableOpacity 
              onPress={handleImagePick} 
              className="absolute bottom-0 right-0 bg-gray-800 rounded-full p-2"
            >
              <MaterialCommunityIcons name="camera" size={16} color="white" />
            </TouchableOpacity>
          </TouchableOpacity>
          <Text className="text-xl font-JakartaBold mt-2">
            {user?.fullName || "John Doe"}
          </Text>
          <Text className="text-gray-500 text-sm mb-4">
            {user?.primaryEmailAddress?.emailAddress || "john@example.com"}
          </Text>

          {/* Action Icons */}
          <View className="flex-row justify-center space-x-8">
            <TouchableOpacity 
              onPress={() => router.push('/test-notification')}
              className="items-center"
            >
              <View className="bg-gray-100 p-3 rounded-full">
                <Ionicons name="notifications-outline" size={20} color="#374151" />
              </View>
              <Text className="text-xs text-gray-600 mt-1">Test Notifications</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => Alert.alert('Coming Soon', 'Settings page will be available soon.')}
              className="items-center"
            >
              <View className="bg-gray-100 p-3 rounded-full">
                <Ionicons name="settings-outline" size={20} color="#374151" />
              </View>
              <Text className="text-xs text-gray-600 mt-1">Settings</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => Alert.alert('Coming Soon', 'Track feature will be available soon.')}
              className="items-center"
            >
              <View className="bg-gray-100 p-3 rounded-full">
                <MaterialCommunityIcons name="map-marker-path" size={20} color="#374151" />
              </View>
              <Text className="text-xs text-gray-600 mt-1">Track</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleSignOut}
              className="items-center"
            >
              <View className="bg-red-50 p-3 rounded-full">
                <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
              </View>
              <Text className="text-xs text-gray-600 mt-1">Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View className="flex-row justify-between w-full mt-4">
          <View className="items-center bg-white rounded-xl p-4 flex-1 mx-2 shadow-sm">
            <Text className="text-2xl font-JakartaBold">{totalRides}</Text>
            <Text className="text-gray-500 text-sm">Total Rides</Text>
          </View>
          <View className="items-center bg-white rounded-xl p-4 flex-1 mx-2 shadow-sm">
            <View className="flex-row items-center">
              <Text className="text-2xl font-JakartaBold mr-1">{rating}</Text>
              <Image source={icons.star} style={{ width: 20, height: 20 }} />
            </View>
            <Text className="text-gray-500 text-sm">Rating</Text>
          </View>
        </View>

          {/* Driver Information Section */}
          {userData.isDriver && (
            <View className="bg-white rounded-xl p-5 mt-4">
              <Text className="text-lg font-JakartaBold mb-4">Driver Information</Text>
              <View className="space-y-4">
                <View>
                  <View className="flex-row items-center mb-1">
                    <MaterialCommunityIcons name="car" size={16} color="#6B7280" />
                    <Text className="text-gray-500 text-sm ml-2">Car Type</Text>
                  </View>
                  <Text className="font-JakartaMedium">{userData.data?.driver?.car_type || 'Not specified'}</Text>
                </View>

                <View>
                  <View className="flex-row items-center mb-1">
                    <MaterialCommunityIcons name="car-seat" size={16} color="#6B7280" />
                    <Text className="text-gray-500 text-sm ml-2">Number of Seats</Text>
                  </View>
                  <Text className="font-JakartaMedium">{userData.data?.driver?.car_seats || 0}</Text>
                </View>

                {userData.data?.driver?.car_image_url && (
                  <View>
                    <View className="flex-row items-center mb-1">
                      <MaterialCommunityIcons name="image" size={16} color="#6B7280" />
                      <Text className="text-gray-500 text-sm ml-2">Car Image</Text>
                    </View>
                    <Image
                      source={{ uri: userData.data.driver.car_image_url }}
                      className="w-full h-48 rounded-lg"
                      resizeMode="cover"
                    />
                  </View>
                )}

                <View>
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="shield-checkmark" size={16} color="#6B7280" />
                    <Text className="text-gray-500 text-sm ml-2">Driver Status</Text>
                  </View>
                  <View className="flex-row items-center">
                    <View className={`px-3 py-1 rounded-full ${userData.data?.driver?.is_active ? 'bg-green-100' : 'bg-red-100'} mr-2`}>
                      <Text className={`text-sm ${userData.data?.driver?.is_active ? 'text-green-700' : 'text-red-700'}`}>
                        {userData.data?.driver?.is_active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View>
                  <View className="flex-row items-center mb-1">
                    <FontAwesome5 name="calendar-alt" size={14} color="#6B7280" />
                    <Text className="text-gray-500 text-sm ml-2">Registration Date</Text>
                  </View>
                  <Text className="font-JakartaMedium">
                    {new Date(userData.data?.driver?.created_at || '').toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Become a Driver Button */}
          {!userData.isDriver && (
            <TouchableOpacity
              onPress={handleRegisterDriver}
              className="bg-rose-50 rounded-xl p-5 mt-4"
            >
              <View className="flex-row items-center justify-between">
                <AntDesign name="right" size={24} color="#F43F5E" />
                <View className="flex-1 items-end">
                  <Text className="text-lg font-CairoBold text-rose-500">
                    Become a Driver
                  </Text>
                  <Text className="text-sm text-gray-500 text-right">
                    Earn money by giving rides
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          {/* Account Information */}
          <View className="bg-white rounded-xl p-5 mt-4">
            <Text className="text-lg font-JakartaBold mb-4">Account Information</Text>
            <View className="space-y-4">
              <View>
                <View className="flex-row items-center mb-1">
                  <MaterialCommunityIcons name="phone" size={16} color="#6B7280" />
                  <Text className="text-gray-500 text-sm ml-2">Phone Number</Text>
                </View>
                <Text className="font-JakartaMedium">{phoneNumber}</Text>
              </View>
              <View>
                <View className="flex-row items-center mb-1">
                  <MaterialCommunityIcons name="clock-time-four" size={16} color="#6B7280" />
                  <Text className="text-gray-500 text-sm ml-2">Member Since</Text>
                </View>
                <Text className="font-JakartaMedium">{memberSince}</Text>
              </View>
            </View>
          </View>

          <View className="h-32" />
      </ScrollView>

      {/* Full Image Modal */}
      <Modal
        visible={showFullImage}
        transparent={true}
        onRequestClose={() => setShowFullImage(false)}
      >
        <TouchableOpacity 
          className="flex-1 bg-black/90 items-center justify-center"
          onPress={() => setShowFullImage(false)}
          activeOpacity={1}
        >
          <Image
            source={{
              uri: userData.profileImage || user?.imageUrl || 'https://www.pngitem.com/pimgs/m/146-1468479_my-profile-icon-blank-profile-picture-circle-hd.png'
            }}
            className="w-80 h-80 rounded-xl"
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

export default Profile;