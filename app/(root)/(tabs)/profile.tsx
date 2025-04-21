import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-expo";
import { Image, ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from '@/context/LanguageContext';
import { icons } from '@/constants';
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "@/lib/upload";

const Profile = () => {
  const { user } = useUser();
  const { language } = useLanguage();
  const router = useRouter();
  const [isDriver, setIsDriver] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const phoneNumber = user?.unsafeMetadata?.phoneNumber as string || "+1 123-456-7890";
  const memberSince = "April 2024";
  const totalRides = 24;
  const rating = 4.8;

  useEffect(() => {
    const checkDriverStatus = async () => {
      if (user?.id) {
        const userRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setIsDriver(!!userData.driver?.is_active);
          // If user has a custom profile image in Firestore, use it
          if (userData.profile_image_url) {
            setProfileImage(userData.profile_image_url);
          }
        }
      }
    };

    checkDriverStatus();
    // Set initial profile image from user data if not found in Firestore
    if (!profileImage) {
      setProfileImage(user?.imageUrl || null);
    }
  }, [user?.id, user?.imageUrl]);

  const handleRegisterDriver = () => {
    router.push("/(root)/(tabs)/add");
  };

  const handleEditImage = async () => {
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
      setProfileImage(asset.uri);
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
        setProfileImage(uploadedImageUrl);
        
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
      setProfileImage(user?.imageUrl || null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Profile Header */}
        <View className="items-center mt-6 mb-4">
          <View className="relative">
            <Image
              source={{
                uri: profileImage || user?.imageUrl || "https://example.com/default-avatar.png",
              }}
              className="w-24 h-24 rounded-full mb-2"
            />
            {isUploading && (
              <View className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-full">
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            )}
            <TouchableOpacity
              onPress={handleEditImage}
              disabled={isUploading}
              className="absolute bottom-0 right-0 bg-white rounded-full p-1 shadow-sm"
            >
              <Image source={icons.upload} style={{ width: 24, height: 24 }} />
            </TouchableOpacity>
          </View>
          <Text className="text-xl font-JakartaBold mb-1">
            {user?.fullName || "John Doe"}
          </Text>
          <Text className="text-gray-500 mb-4">
            {user?.primaryEmailAddress?.emailAddress || "john@example.com"}
          </Text>
          
          <View className="flex-row justify-between w-full">
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
        </View>

        {/* Account Information */}
        <View className="bg-white rounded-xl p-5 mt-4">
          <Text className="text-lg font-JakartaBold mb-4">Account Information</Text>
          
          <View className="space-y-4">
            <View>
              <Text className="text-gray-500 text-sm mb-1">Phone Number</Text>
              <Text className="font-JakartaMedium">{phoneNumber}</Text>
            </View>
            
            <View>
              <Text className="text-gray-500 text-sm mb-1">Member Since</Text>
              <Text className="font-JakartaMedium">{memberSince}</Text>
            </View>
          </View>
        </View>

        {/* Become a Driver Card - Only show if not already a driver */}
        {!isDriver && (
          <View className="bg-rose-50 rounded-xl p-5 mt-4">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-lg font-JakartaBold mb-1">Become a Driver</Text>
                <Text className="text-gray-600 text-sm">Earn money by giving rides</Text>
              </View>
              <TouchableOpacity 
                className="bg-orange-500 px-4 py-2 rounded-lg"
                onPress={handleRegisterDriver}
              >
                <Text className="text-white font-JakartaMedium">Register</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default Profile;