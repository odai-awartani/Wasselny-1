import React, { useEffect, useState } from "react";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Image, ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, StyleSheet, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLanguage } from '@/context/LanguageContext';
import { icons } from '@/constants';
import { AntDesign, MaterialCommunityIcons, Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from "expo-router";
import { doc, getDoc, updateDoc, setDoc, query, getDocs, collection, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import * as ImagePicker from "expo-image-picker";
import { uploadImageToCloudinary } from "@/lib/upload";
import { translations } from '@/constants/languages';

interface UserData {
  driver?: {
    is_active: boolean;
    car_type: string;
    car_seats: number;
    car_image_url: string;
    profile_image_url: string;
    created_at: string;
    rating?: number;
    total_rides?: number;
  };
  profile_image_url?: string;
  role?: string;
}

interface DetailedRating {
  overall: number;
  driving: number;
  behavior: number;
  punctuality: number;
  cleanliness: number;
  comment?: string;
  passenger_name: string;
  created_at: any;
  ride_details: {
    origin_address: string;
    destination_address: string;
    ride_datetime: string;
  };
}

const Profile = () => {
  const { user } = useUser();
  const { signOut } = useAuth();
  const { language } = useLanguage();
  const router = useRouter();
  const t = translations[language];
  
  // Add state for pending applications count
  const [pendingApplicationsCount, setPendingApplicationsCount] = useState(0);

  // Add missing variables
  const totalRides = 24;
  const rating = 4.8;

  // Combine related states into a single state object
  const [userData, setUserData] = useState<{
    isDriver: boolean;
    isLoading: boolean;
    profileImage: string | null;
    data: UserData | null;
    isAdmin: boolean;
  }>({ 
    isDriver: false,
    isLoading: true,
    profileImage: null,
    data: null,
    isAdmin: false
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedCards, setExpandedCards] = useState({
    driverInfo: false,
    carImage: false,
    accountInfo: false,
    ratings: true
  });

  const [ratings, setRatings] = useState<DetailedRating[]>([]);
  const [showRatings, setShowRatings] = useState(false);

  const phoneNumber = user?.unsafeMetadata?.phoneNumber as string || "+1 123-456-7890";

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
          profileImage: user?.imageUrl || null,
          isAdmin: false
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
        
        // Fetch detailed ratings if user is a driver
        if (data.driver?.is_active) {
          const ratingsQuery = query(
            collection(db, 'ratings'),
            where('driver_id', '==', user.id)
          );
          
          const ratingsSnapshot = await getDocs(ratingsQuery);
          const ratingsData = ratingsSnapshot.docs.map(doc => ({
            ...doc.data()
          })) as DetailedRating[];
          
          if (isMounted) {
            setRatings(ratingsData);

            // Calculate average rating
            if (ratingsData.length > 0) {
              const avgRating = ratingsData.reduce((acc, curr) => acc + curr.overall, 0) / ratingsData.length;
              data.driver.rating = avgRating;
              data.driver.total_rides = ratingsData.length;
            }
          }
        }

        if (isMounted) {
          setUserData({
            isDriver: !!data.driver?.is_active,
            isLoading: false,
            profileImage: data.driver?.profile_image_url || user?.imageUrl || null,
            data,
            isAdmin: data.role === 'admin'
          });
        }
      } else {
        console.log('User document does not exist'); // Debug log
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null,
          data: null,
          isAdmin: false
        }));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      if (isMounted) {
        setUserData(prev => ({
          ...prev,
          isDriver: false,
          isLoading: false,
          profileImage: user?.imageUrl || null,
          isAdmin: false
        }));
      }
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchUserData();
    setIsRefreshing(false);
  };

  // Update function to fetch pending applications count with real-time updates
  const fetchPendingApplicationsCount = async () => {
    if (!userData.isAdmin) return;
    
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('driver.status', '==', 'pending')
      );
      
      // Set up real-time listener
      const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
        setPendingApplicationsCount(snapshot.size);
      }, (error) => {
        console.error('Error in pending applications listener:', error);
      });

      // Return cleanup function
      return unsubscribe;
    } catch (error) {
      console.error('Error setting up pending applications listener:', error);
    }
  };

  // Update useEffect to handle real-time updates
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    const setupData = async () => {
      await fetchUserData(isMounted);
      if (userData.isAdmin) {
        unsubscribe = await fetchPendingApplicationsCount();
      }
    };

    setupData();

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.id, user?.imageUrl, userData.isAdmin]);

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
          const userData = userDoc.data() as UserData;
          // If user is a driver, update the profile image in driver data
          if (userData.driver?.is_active) {
            await updateDoc(userRef, {
              'driver.profile_image_url': uploadedImageUrl
            });
          } else {
            // If user is not a driver, update the profile image in user data
            await updateDoc(userRef, {
              profile_image_url: uploadedImageUrl
            });
          }
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

  const formatDate = (date: string) => {
    const d = new Date(date);
    const month = d.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' });
    const year = d.getFullYear();
    return `${month} ${year}`;
  };

  const memberSince = formatDate("2024-04-01"); // Example date, replace with actual date

  const toggleCard = (cardName: keyof typeof expandedCards) => {
    setExpandedCards(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }));
  };

  const renderDetailedRatings = () => {
    if (!userData.isDriver || ratings.length === 0) return null;

    return (
      <TouchableOpacity 
        onPress={() => toggleCard('ratings')}
        className="bg-white rounded-xl p-5 mt-4" 
        style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
      >
        <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
          <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
            {language === 'ar' ? 'التقييمات التفصيلية' : 'Detailed Ratings'}
          </Text>
          <AntDesign 
            name={expandedCards.ratings ? 'up' : 'down'} 
            size={20} 
            color="#374151" 
          />
        </View>

        {expandedCards.ratings && (
          <View className="space-y-4 mt-4">
            {ratings.map((rating, index) => (
              <View key={index} className="bg-gray-50 p-4 rounded-xl">
                <View className={`flex-row justify-between items-center mb-2 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <Text className={`text-sm ${language === 'ar' ? 'font-CairoRegular' : 'font-Jakartab'} text-gray-600`}>
                    {rating.passenger_name}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className={`text-base ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900 ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>
                      {rating.overall.toFixed(1)}
                    </Text>
                    <Image source={icons.star} style={{ width: 16, height: 16 }} />
                  </View>
                </View>

                <View className="space-y-2">
                  <View className={`flex-row justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <Text className={`text-sm ${language === 'ar' ? 'font-CairoRegular' : 'font-Jakartab'} text-gray-600`}>
                      {language === 'ar' ? 'قيادة السيارة' : 'Driving'}
                    </Text>
                    <Text className={`text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900`}>
                      {rating.driving}
                    </Text>
                  </View>
                  <View className={`flex-row justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <Text className={`text-sm ${language === 'ar' ? 'font-CairoRegular' : 'font-Jakartab'} text-gray-600`}>
                      {language === 'ar' ? 'الأخلاق والسلوك' : 'Behavior'}
                    </Text>
                    <Text className={`text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900`}>
                      {rating.behavior}
                    </Text>
                  </View>
                  <View className={`flex-row justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <Text className={`text-sm ${language === 'ar' ? 'font-CairoRegular' : 'font-Jakartab'} text-gray-600`}>
                      {language === 'ar' ? 'الالتزام بالمواعيد' : 'Punctuality'}
                    </Text>
                    <Text className={`text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900`}>
                      {rating.punctuality}
                    </Text>
                  </View>
                  <View className={`flex-row justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <Text className={`text-sm ${language === 'ar' ? 'font-CairoRegular' : 'font-Jakartab'} text-gray-600`}>
                      {language === 'ar' ? 'نظافة السيارة' : 'Cleanliness'}
                    </Text>
                    <Text className={`text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} text-gray-900`}>
                      {rating.cleanliness}
                    </Text>
                  </View>
                </View>

                {rating.comment && (
                  <View className="mt-2 p-2 bg-white rounded-lg">
                    <Text className={`text-sm ${language === 'ar' ? 'font-CairoRegular' : 'font-Jakartab'} text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                      {rating.comment}
                    </Text>
                  </View>
                )}

                <Text className={`text-xs ${language === 'ar' ? 'font-CairoRegular' : 'font-Jakartab'} text-gray-500 mt-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {rating.ride_details.origin_address} → {rating.ride_details.destination_address}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} colors={["#F97316"]}  
          tintColor="#F97316"
          />
        }
        className="px-5"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View className="items-center mt-6 mb-4">
          <TouchableOpacity onPress={() => setShowFullImage(true)} className="relative">
            {userData.profileImage || user?.imageUrl ? (
              <Image
                source={{ uri: userData.profileImage || user?.imageUrl }}
                className="w-24 h-24 rounded-full"
              />
            ) : (
              <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#f97316' }}>
                <MaterialIcons name="person" size={60} color="#f97316" />
              </View>
            )}
            {isUploading && (
              <View className="absolute inset-0 bg-black/50 rounded-full items-center justify-center">
                <ActivityIndicator color="white" />
              </View>
            )}
            <TouchableOpacity 
              onPress={handleImagePick} 
              className={`absolute bottom-0 ${language === 'ar' ? 'left-0' : 'right-0'} bg-gray-800 rounded-full p-2`}
            >
              <MaterialCommunityIcons name="camera" size={16} color="white" />
            </TouchableOpacity>
          </TouchableOpacity>
          <Text className={`text-xl ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} mt-2`}>
            {user?.fullName || "John Doe"}
          </Text>
          <Text className="text-gray-500 text-sm mb-4">
            {user?.primaryEmailAddress?.emailAddress || "john@example.com"}
          </Text>

          {/* Action Icons */}
          <View className={`flex-row justify-center ${language === 'ar' ? 'space-x-reverse' : 'space-x-8'} space-x-8`}>
            <TouchableOpacity 
              onPress={() => router.push('/(root)/profilePageEdit')}
              className="items-center"
            >
              <View className="bg-gray-100 p-3 rounded-full">
                <MaterialIcons name="edit" size={20} color="#374151" />
              </View>
              <Text className={`text-xs text-gray-600 mt-1 ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {language === 'ar' ? 'تعديل الملف' : 'Edit Profile'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => router.push('/(root)/track' as any)}
              className="items-center"
            >
              <View className="bg-gray-100 p-3 rounded-full">
                <MaterialCommunityIcons name="map-marker-path" size={20} color="#374151" />
              </View>
              <Text className={`text-xs text-gray-600 mt-1 ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {language === 'ar' ? 'التتبع' : 'Track'}
              </Text>
            </TouchableOpacity>

            {userData.isAdmin && (
              <TouchableOpacity 
                onPress={() => router.push('/(root)/admin' as any)}
                className="items-center"
              >
                <View className="bg-gray-100 p-3 rounded-full relative">
                  <MaterialCommunityIcons name="shield-account" size={20} color="#374151" />
                  {pendingApplicationsCount > 0 && (
                    <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[20px] h-5 items-center justify-center px-1">
                      <Text className="text-white text-xs font-bold">
                        {pendingApplicationsCount > 99 ? '99+' : pendingApplicationsCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className={`text-xs text-gray-600 mt-1 ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                  {language === 'ar' ? 'لوحة التحكم' : 'Admin'}
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={handleSignOut}
              className="items-center"
            >
              <View className="bg-red-50 p-3 rounded-full">
                <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
              </View>
              <Text className={`text-xs text-gray-600 mt-1 ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className={`flex-row justify-between w-full mt-4 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
          <View className="items-center bg-white rounded-xl p-4 flex-1 mx-2" style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}>
            <Text className={`text-2xl ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {userData.data?.driver?.total_rides || 0}
            </Text>
            <Text className={`text-gray-500 text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {language === 'ar' ? 'إجمالي الرحلات' : 'Total Rides'}
            </Text>
          </View>
          <View className="items-center bg-white rounded-xl p-4 flex-1 mx-2" style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}>
            <View className="flex-row items-center">
              <Text className={`text-2xl ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'} ${language === 'ar' ? 'mr-1' : 'ml-1'}`}>
                {userData.data?.driver?.rating?.toFixed(1) || '0.0'}
              </Text>
              <Image source={icons.star} style={{ width: 20, height: 20 }} />
            </View>
            <Text className={`text-gray-500 text-sm ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {language === 'ar' ? 'التقييم' : 'Rating'}
            </Text>
          </View>
        </View>

        {/* Driver Information Section */}
        {userData.isDriver && (
          <>
            {renderDetailedRatings()}
            <TouchableOpacity 
              onPress={() => toggleCard('driverInfo')}
              className="bg-white rounded-xl p-5 mt-4" 
              style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
            >
              <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                  {language === 'ar' ? 'معلومات السائق' : 'Driver Information'}
                </Text>
                <AntDesign 
                  name={expandedCards.driverInfo ? 'up' : 'down'} 
                  size={20} 
                  color="#374151" 
                />
              </View>
              {expandedCards.driverInfo && (
                <View className="space-y-4 mt-4">
                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'نوع السيارة' : 'Car Type'}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                      <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                        {userData.data?.driver?.car_type || (language === 'ar' ? 'غير محدد' : 'Not specified')}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'عدد المقاعد' : 'Number of Seats'}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                      <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                        {userData.data?.driver?.car_seats || 0}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'تاريخ التسجيل' : 'Registration Date'}
                    </Text>
                    <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                      <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                        {formatDate(userData.data?.driver?.created_at || '')}
                      </Text>
                    </View>
                  </View>

                  <View>
                    <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                      {language === 'ar' ? 'حالة السائق' : 'Driver Status'}
                    </Text>
                    <View className={`flex-row ${language === 'ar' ? 'justify-end' : 'justify-start'}`}>
                      <View className={`px-3 py-1 rounded-full ${userData.data?.driver?.is_active ? 'bg-green-100' : 'bg-red-100'}`}>
                        <Text className={`text-sm ${userData.data?.driver?.is_active ? 'text-green-700' : 'text-red-700'} ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                          {userData.data?.driver?.is_active ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Car Image Card */}
            {userData.data?.driver?.car_image_url && (
              <TouchableOpacity 
                onPress={() => toggleCard('carImage')}
                className="bg-white rounded-xl p-5 mt-4" 
                style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
              >
                <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
                  <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
                    {language === 'ar' ? 'صورة السيارة' : 'Car Image'}
                  </Text>
                  <AntDesign 
                    name={expandedCards.carImage ? 'up' : 'down'} 
                    size={20} 
                    color="#374151" 
                  />
                </View>
                {expandedCards.carImage && (
                  <View className="mt-4">
                    <Image
                      source={{ uri: userData.data.driver.car_image_url }}
                      className="w-full h-48 rounded-lg"
                      resizeMode="cover"
                    />
                  </View>
                )}
              </TouchableOpacity>
            )}
          </>
        )}

        {/* Become a Driver Button */}
        {!userData.isDriver && (
          <TouchableOpacity
            onPress={handleRegisterDriver}
            className="bg-rose-50 rounded-xl p-5 mt-4"
          >
            <View className={`flex-row items-center justify-between ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <AntDesign name={language === 'ar' ? 'left' : 'right'} size={24} color="#F43F5E" />
              <View className={`flex-1 ${language === 'ar' ? 'items-end' : 'items-start'}`}>
                <Text className={`text-lg ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaBold'} text-rose-500`}>
                  {language === 'ar' ? 'كن سائقاً' : 'Become a Driver'}
                </Text>
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                  {language === 'ar' ? 'اكسب المال من خلال تقديم الرحلات' : 'Earn money by giving rides'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Account Information */}
        <TouchableOpacity 
          onPress={() => toggleCard('accountInfo')}
          className="bg-white rounded-xl p-5 mt-4" 
          style={Platform.OS === 'android' ? styles.androidShadow : styles.iosShadow}
        >
          <View className={`flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
            <Text className={`text-lg ${language === 'ar' ? 'font-Cairobold' : 'font-Jakartab'}`}>
              {language === 'ar' ? 'معلومات الحساب' : 'Account Information'}
            </Text>
            <AntDesign 
              name={expandedCards.accountInfo ? 'up' : 'down'} 
              size={20} 
              color="#374151" 
            />
          </View>
          {expandedCards.accountInfo && (
            <View className="space-y-4 mt-4">
              <View>
                <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                  {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
                </Text>
                <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                  <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                    {phoneNumber}
                  </Text>
                </View>
              </View>
              <View>
                <Text className={`text-gray-500 text-sm mb-1 ${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                  {language === 'ar' ? 'عضو منذ' : 'Member Since'}
                </Text>
                <View className="bg-gray-100 rounded-lg p-3 border border-gray-300">
                  <Text className={`${language === 'ar' ? 'font-Cairobold text-right' : 'font-Jakartab text-left'}`}>
                    {memberSince}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>

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
const styles = StyleSheet.create({
  androidShadow: {
    elevation: 5,
  },
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});
export default Profile;