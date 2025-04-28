import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { icons } from '@/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import { findOrCreateChat } from '@/lib/chat';

interface UserProfile {
  name: string;
  profile_image_url: string;
  gender?: string;
  phone?: string;
  email?: string;
  driver?: {
    car_type: string;
    car_seats: number;
    car_image_url: string;
    rating?: number;
    total_rides?: number;
  };
}
interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
  ride_datetime: string;
  status: string;
  available_seats: number;
}

const DEFAULT_PROFILE_IMAGE = 'https://via.placeholder.com/120';
const DEFAULT_CAR_IMAGE = 'https://via.placeholder.com/200x150';

export default function Profile() {
  const { id } = useLocalSearchParams();
  const [profile, setProfile] = useState<UserProfile>({} as UserProfile);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);
  const { user: currentUser } = useUser();
  const router = useRouter();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const userDoc = await getDoc(doc(db, 'users', id as string));
        
        if (!userDoc.exists()) {
          setError('لم يتم العثور على الملف الشخصي');
          return;
        }

        const userData = userDoc.data();
        setProfile({
          name: userData.name || 'مستخدم',
          profile_image_url: userData.profile_image_url || DEFAULT_PROFILE_IMAGE,
          gender: userData.gender,
          phone: userData.phone,
          email: userData.email,
          driver: userData.driver ? {
            car_type: userData.driver.car_type || 'غير محدد',
            car_seats: userData.driver.car_seats || 4,
            car_image_url: userData.driver.car_image_url || DEFAULT_CAR_IMAGE,
            rating: userData.driver.rating || 0,
            total_rides: userData.driver.total_rides || 0,
          } : undefined
        });

        // Fetch user's rides if they are a driver
        if (userData.driver) {
          const ridesQuery = query(
            collection(db, 'rides'),
            where('driver_id', '==', id),
            where('status', 'in', ['active', 'completed'])
          );
          
          const ridesSnapshot = await getDocs(ridesQuery);
          const ridesData = ridesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Ride[];
          
          setRides(ridesData);
        }

      } catch (err) {
        console.error('Error fetching profile:', err);
        setError('حدث خطأ في تحميل الملف الشخصي');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchProfile();
    }
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-100">
        <Text className="text-red-500 mb-4">{error || 'حدث خطأ غير متوقع'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text className="text-blue-500">العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white ">
      {/* Back Button */}
      <View className="flex-row pl-4 bg-white items-center">
        <TouchableOpacity 
          onPress={() => router.back()}
          className="w-10 h-10 bg-gray-50 rounded-full items-center justify-center"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
      </View>
      {/* Profile Header */}
      <View className="bg-white pb-2">
        <View className="items-center">
          <Image
            source={{ uri: profile.profile_image_url }}
            className="w-24 h-24 rounded-full mb-2"
          />
          <Text className="text-xl font-CairoBold text-gray-900 mb-1">
            {profile.name}
          </Text>
          {profile.gender && (
            <Text className="text-xs font-CairoRegular text-gray-600">
              {profile.gender}
            </Text>
          )}

          {/* Contact Buttons */}
          <View className="flex-row justify-center space-x-6 mt-2">
            <TouchableOpacity 
              onPress={async () => {
                if (!currentUser) return;
                setMessageLoading(true);
                try {
                  const chatId = await findOrCreateChat(
                    { id: currentUser.id, fullName: currentUser.fullName, imageUrl: currentUser.imageUrl },
                    { id: id as string, fullName: profile.name, imageUrl: profile.profile_image_url }
                  );
                  if (chatId) {
                    router.push({
                      pathname: '/(root)/chat/[id]',
                      params: { id: chatId, name: profile.name, avatar: profile.profile_image_url }
                    });
                  }
                } catch (err) {
                  console.error('Error creating chat:', err);
                } finally {
                  setMessageLoading(false);
                }
              }}
              className="items-center"
              disabled={messageLoading}
            >
              <View className="w-12 h-12 bg-purple-50 rounded-full items-center justify-center mb-1">
                {messageLoading ? (
                  <ActivityIndicator color="#A855F7" size="small" />
                ) : (
                  <MaterialCommunityIcons name="message-text" size={24} color="#A855F7" />
                )}
              </View>
              <Text className="text-xs font-CairoRegular text-gray-600">رسالة</Text>
            </TouchableOpacity>

            {profile.phone && (
              <TouchableOpacity 
                onPress={() => Linking.openURL(`tel:${profile.phone}`)}
                className="items-center"
              >
                <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center mb-1">
                  <MaterialCommunityIcons name="phone" size={24} color="#3B82F6" />
                </View>
                <Text className="text-xs font-CairoRegular text-gray-600">اتصال</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Driver Stats */}
        {profile.driver && (
          <View className="flex-row justify-between w-full mt-2">
            <View className="items-center bg-white rounded-xl p-3 flex-1 mx-2 shadow-sm">
              <Text className="text-xl font-CairoBold">
                {profile.driver.total_rides || 0}
              </Text>
              <Text className="text-gray-500 text-xs font-CairoRegular">
                عدد الرحلات
              </Text>
            </View>
            <View className="items-center bg-white rounded-xl p-3 flex-1 mx-2 shadow-sm">
              <View className="flex-row items-center">
                <Text className="text-xl font-CairoBold mr-1">
                  {profile.driver.rating?.toFixed(1) || '0.0'}
                </Text>
                <Image source={icons.star} style={{ width: 16, height: 16 }} />
              </View>
              <Text className="text-gray-500 text-xs font-CairoRegular">
                التقييم
              </Text>
            </View>
          </View>
        )}
      </View>
      <ScrollView className="pt-4 flex-1 bg-gray-100">
      {/* Driver Car Details */}
      {profile.driver && (
        <View className="bg-white mx-4 p-4 rounded-xl shadow-sm mb-6">
          <Text className="text-lg font-CairoBold text-gray-900 mb-4 text-right">
            معلومات السيارة
          </Text>
          <View className="space-y-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-base font-CairoRegular text-gray-900">
                {profile.driver.car_type}
              </Text>
              <Text className="text-base font-CairoBold text-gray-600">
                نوع السيارة
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-base font-CairoRegular text-gray-900">
                {profile.driver.car_seats}
              </Text>
              <Text className="text-base font-CairoBold text-gray-600">
                عدد المقاعد
              </Text>
            </View>
            <Image
              source={{ uri: profile.driver.car_image_url }}
              className="w-full h-40 rounded-xl mt-2"
              resizeMode="cover"
            />
          </View>
        </View>
      )}

      {/* Driver's Rides */}
      {profile.driver && rides.length > 0 && (
        <View className="bg-white mx-4 p-4 rounded-xl shadow-sm mb-6">
          <Text className="text-lg font-CairoBold text-gray-900 mb-4 text-right">
            الرحلات النشطة
          </Text>
          <View className="space-y-4">
            {rides.map((ride) => (
              <TouchableOpacity
                key={ride.id}
                onPress={() => router.push(`/ride-details/${ride.id}`)}
                className="bg-gray-50 p-4 rounded-xl"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-sm font-CairoRegular text-gray-500">
                    {ride.ride_datetime}
                  </Text>
                  <View className="flex-row items-center">
                    <Text className="text-sm font-CairoBold text-gray-900 ml-1">
                      {ride.available_seats}
                    </Text>
                  </View>
                </View>
                <View className="space-y-2">
                  <View className="flex-row items-center">
                    <Image source={icons.point} className="w-4 h-4 ml-2" />
                    <Text className="text-sm font-CairoRegular text-gray-600 flex-1 text-right">
                      {ride.origin_address}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Image source={icons.map} className="w-4 h-4 ml-2" />
                    <Text className="text-sm font-CairoRegular text-gray-600 flex-1 text-right">
                      {ride.destination_address}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
    </SafeAreaView>
  );
}
