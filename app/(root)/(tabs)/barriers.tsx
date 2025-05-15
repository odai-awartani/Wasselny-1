import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { icons } from "@/constants";
import Header from "@/components/Header";
import { useLanguage } from '@/context/LanguageContext';
import { collection, query, orderBy, onSnapshot, doc, getDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useUser } from '@clerk/clerk-expo';
import { PALESTINIAN_CITIES, CityData, BarrierData } from '@/constants/cities'

interface Barrier {
  id: string;
  barrier: string;
  description: string;
  location: string;
  city: string;
  status: 'open' | 'closed' | 'delayed' | 'heavy_traffic' | 'military_presence' | 'random_check' | 'smooth_traffic';
  imageUrl: string | null;
  created_at: {
    seconds: number;
    nanoseconds: number;
  };
  updated_at: {
    seconds: number;
    nanoseconds: number;
  };
  timestamp: number;
}

interface UserData {
  driver?: {
    // Add any driver-specific fields here if needed
    [key: string]: any;
  };
}

interface CityBarriers {
  [city: string]: Barrier[];
}

const STATUS_OPTIONS = {
  open: {
    en: 'Open',
    ar: 'مفتوح',
    color: '#22c55e'
  },
  closed: {
    en: 'Closed',
    ar: 'مغلق',
    color: '#ef4444'
  },
  open_inward: {
    en: 'Open Inward',
    ar: 'مفتوح للداخل',
    color: '#22c55e'
  },
  open_outward: {
    en: 'Open Outward',
    ar: 'مفتوح للخارج',
    color: '#22c55e'
  },
  closed_inward: {
    en: 'Closed Inward',
    ar: 'مغلق للداخل',
    color: '#ef4444'
  },
  closed_outward: {
    en: 'Closed Outward',
    ar: 'مغلق للخارج',
    color: '#ef4444'
  },
  crisis_inward: {
    en: 'Crisis Inward',
    ar: 'ازمة للداخل',
    color: '#dc2626'
  },
  crisis_outward: {
    en: 'Crisis Outward',
    ar: 'ازمة للخارج',
    color: '#dc2626'
  },
  heavy_traffic: {
    en: 'Heavy Traffic',
    ar: 'كثافة سير',
    color: '#f97316'
  },
  open_with_id_check: {
    en: 'Open with ID Check',
    ar: 'مفتوح مع تفتيش هويات',
    color: '#f59e0b'
  },
  open_with_random_check: {
    en: 'Open with Random Check',
    ar: 'مفتوح مع تفتيش عشوائي',
    color: '#f59e0b'
  },
  settler_presence: {
    en: 'Settler Presence',
    ar: 'تواجد مستوطنين',
    color: '#dc2626'
  },
  heavy_traffic_with_police: {
    en: 'Heavy Traffic with Police',
    ar: 'كثافة سير وشرطة',
    color: '#dc2626'
  }
};

export default function BarriersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { user } = useUser();
  const [barriers, setBarriers] = useState<Barrier[]>([]);
  const [cityBarriers, setCityBarriers] = useState<CityBarriers>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'add'>('view');
  const [isDriver, setIsDriver] = useState(false);
  const [unsubscribeRef, setUnsubscribeRef] = useState<(() => void) | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkDriverStatus = async () => {
      if (user?.id) {
        try {
          const userRef = doc(db, 'users', user.id);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            const userData = userDoc.data() as UserData;
            // Check if user has a driver document
            setIsDriver(!!userData.driver);
          }
        } catch (error) {
          console.error('Error checking driver status:', error);
        }
      }
    };

    checkDriverStatus();
  }, [user]);

  // Fetch user profile image
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfileImageUrl(userData.profile_image_url || userData.driver?.profile_image_url || null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [user?.id]);

  const fetchBarriers = async () => {
    try {
      const barriersRef = collection(db, 'barriers');
      const q = query(barriersRef, orderBy('timestamp', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const barriersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Barrier[];
        setBarriers(barriersList);

        // Group barriers by city
        const groupedBarriers = barriersList.reduce((acc, barrier) => {
          if (!acc[barrier.city]) {
            acc[barrier.city] = [];
          }
          acc[barrier.city].push(barrier);
          return acc;
        }, {} as CityBarriers);

        setCityBarriers(groupedBarriers);
        setLoading(false);
      });

      setUnsubscribeRef(() => unsubscribe);
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching barriers:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarriers();
    return () => {
      if (unsubscribeRef) {
        unsubscribeRef();
      }
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBarriers();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    return STATUS_OPTIONS[status as keyof typeof STATUS_OPTIONS]?.color || 'bg-gray-500';
  };

  const getStatusText = (status: string) => {
    if (language === 'ar') {
      return STATUS_OPTIONS[status as keyof typeof STATUS_OPTIONS]?.ar || status;
    }
    return STATUS_OPTIONS[status as keyof typeof STATUS_OPTIONS]?.en || status;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return { date: 'N/A', time: 'N/A' };
    
    let date: Date;
    if (timestamp.seconds) {
      // Handle Firestore timestamp
      date = new Date(timestamp.seconds * 1000);
    } else if (typeof timestamp === 'number') {
      // Handle our custom timestamp
      date = new Date(timestamp);
    } else {
      return { date: 'N/A', time: 'N/A' };
    }

    const dateStr = date.toLocaleString(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const timeStr = date.toLocaleString(language === 'ar' ? 'en-US' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    return { date: dateStr, time: timeStr };
  };

  const renderTabs = () => {
    if (!isDriver) return null;

    return (
      <View className="flex-row justify-around items-center px-4 py-2 border-b border-gray-200">
        <TouchableOpacity
          onPress={() => setActiveTab('view')}
          className={`flex-1 items-center py-3 ${activeTab === 'view' ? 'border-b-2 border-orange-500' : ''}`}
        >
          <Text className={`${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} ${activeTab === 'view' ? 'text-orange-500' : 'text-gray-500'}`}>
            {language === 'ar' ? 'عرض الحواجز' : 'View Barriers'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('add')}
          className={`flex-1 items-center py-3 ${activeTab === 'add' ? 'border-b-2 border-orange-500' : ''}`}
        >
          <Text className={`${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} ${activeTab === 'add' ? 'text-orange-500' : 'text-gray-500'}`}>
            {language === 'ar' ? 'إضافة حاجز' : 'Add Barrier'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderCities = () => {
    if (selectedCity) return null;

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f97316']} />
        }
      >
        <View className="px-4 py-4">
          {Object.entries(PALESTINIAN_CITIES).map(([city, data]: [string, CityData]) => (
            <TouchableOpacity
              key={city}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedCity(city);
              }}
              className="bg-white p-4 rounded-xl mb-3 border border-gray-200"
              style={{
                elevation: Platform.OS === "android" ? 3 : 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
              }}
            >
              <View className="flex-row justify-between items-center">
                <Text className={`text-xl ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} text-gray-800`}>
                  {language === 'ar' ? data.ar : city}
                </Text>
                <Text className={`text-gray-500 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                  {data.barriers.length} {language === 'ar' ? 'حاجز' : 'Barriers'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderBarriers = () => {
    if (!selectedCity) return null;

    const cityBarriersList = cityBarriers[selectedCity] || [];
    const cityData = PALESTINIAN_CITIES[selectedCity];

    // Sort barriers by their last update time
    const sortedBarriers = cityData.barriers.map(barrierData => {
      const barrier = cityBarriersList.find(b => b.barrier === barrierData.en);
      return {
        barrierData,
        barrier,
        lastUpdate: barrier?.updated_at?.seconds || 0
      };
    }).sort((a, b) => b.lastUpdate - a.lastUpdate);

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#f97316']} />
        }
      >
        <View className="px-4 py-4">
          <TouchableOpacity
            onPress={() => setSelectedCity(null)}
            className="mb-4"
          >
            <Text className={`text-orange-500 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
              {language === 'ar' ? '← العودة إلى المدن' : '← Back to Cities'}
            </Text>
          </TouchableOpacity>

          {sortedBarriers.map(({ barrierData, barrier }) => (
            <TouchableOpacity
              key={barrierData.en}
              onPress={() => {
                if (barrier) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: '/(root)/barrierDetails',
                    params: { id: barrier.id }
                  });
                }
              }}
              className="bg-white p-4 rounded-xl mb-3 border border-gray-200"
              style={{
                elevation: Platform.OS === "android" ? 3 : 0,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 3,
              }}
            >
              <View className={`flex-row ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'} justify-between items-center mb-2`}>
                <View className="flex-1">
                  <Text className={`text-lg ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} text-gray-800`}>
                    {language === 'ar' ? barrierData.ar : barrierData.en}
                  </Text>
                  <Text className={`text-sm ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} text-gray-500`}>
                    {language === 'ar' ? cityData.ar : selectedCity}
                  </Text>
                </View>
                {barrier ? (
                  <View 
                    className={`px-3 py-1 rounded-full ${language === 'ar' ? 'ml-2' : 'mr-2'}`}
                    style={{ backgroundColor: getStatusColor(barrier.status) }}
                  >
                    <Text className="text-white text-sm mt-1 font-CairoBold">
                      {getStatusText(barrier.status)}
                    </Text>
                  </View>
                ) : (
                  <View className={`px-3 py-1 rounded-full ${language === 'ar' ? 'ml-2' : 'mr-2'} bg-gray-200`}>
                    <Text className="text-gray-600 text-sm mt-1 font-CairoBold">
                      {language === 'ar' ? 'لا توجد معلومات' : 'No Info'}
                    </Text>
                  </View>
                )}
              </View>

              {barrier ? (
                <>
                  {barrier.imageUrl && (
                    <Image
                      source={{ uri: barrier.imageUrl }}
                      className="w-full h-40 rounded-lg mb-3"
                      resizeMode="cover"
                    />
                  )}
                  <Text className={`text-gray-600 mb-2 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                    {barrier.location}
                  </Text>
                  {barrier.description && (
                    <Text className={`text-gray-500 mb-2 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                      {barrier.description}
                    </Text>
                  )}
                  <View className={`flex-row ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'} justify-between items-center`}>
                    <View className={`flex-row ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'} items-center`}>
                      <View className="bg-gray-100 px-2 py-1 rounded-full mx-2">
                        <Text className={`text-orange-600 text-sm ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                          {formatDate(barrier.updated_at).time}
                        </Text>
                      </View>
                    </View>
                    <View className={`flex-row ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'} items-center`}>
                      <Text className={`text-gray-400 text-sm ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                        {language === 'ar' ? 'آخر تحديث: ' : 'Last Updated: '}
                        {formatDate(barrier.updated_at).date}
                      </Text>
                    </View>
                  </View>
                </>
              ) : (
                <View className="py-2">
                  <Text className={`text-gray-400 text-sm ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                    {language === 'ar' ? 'لم يتم تحديث معلومات هذا الحاجز بعد' : 'No updates available for this barrier yet'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  const renderContent = () => {
    if (activeTab === 'add') {
      return (
        <View className="flex-1 justify-center items-center p-4">
          <Text className={`text-gray-600 mb-4 ${language === 'ar' ? 'font-CairoBold text-center' : 'font-JakartaBold text-center'}`}>
            {language === 'ar' ? 'اضغط على زر الإضافة أدناه لإضافة حالة حاجز جديدة' : 'Press the add button below to add a new barrier case'}
          </Text>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push('/(root)/addBarrier1');
            }}
            className="bg-orange-500 px-6 py-3 rounded-full flex-row items-center"
          >
            <View className="flex-row-reverse items-center">
            <Text className={`text-white ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}` }>
              {language === 'ar' ? 'إضافة حالة حاجز جديدة' : 'Add New Barrier Cases'}
            </Text>
            <Image
              source={icons.add}
              className="w-6 h-6 mr-2"
              resizeMode="contain"
            />
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    if (loading) {
      return (
        <View className="flex-1 justify-center items-center py-8">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      );
    }

    return (
      <>
        {renderCities()}
        {renderBarriers()}
      </>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header profileImageUrl={profileImageUrl} title={t.barriers} />
      {renderTabs()}
      {renderContent()}

      {/* Add Barrier Button - Only show in view mode */}
      {activeTab === 'view' && (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push('/(root)/addBarrier1');
          }}
          style={{
            position: 'absolute',
            right: 16,
            bottom: insets.bottom + 20,
            width: 56,
            height: 56,
            borderRadius: 28,
            justifyContent: 'center',
            alignItems: 'center',
            elevation: Platform.OS === 'android' ? 4 : 0,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0,
            shadowRadius: Platform.OS === 'ios' ? 3.84 : 0,
            zIndex: 1000,
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#f97316', '#ea580c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text className="text-white text-2xl">+</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}