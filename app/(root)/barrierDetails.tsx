import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from '@/constants';
import Header from '@/components/Header';
import { useLanguage } from '@/context/LanguageContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PALESTINIAN_CITIES, CityData, BarrierData } from '@/constants/cities';

interface BarrierUpdate {
  status: 'open' | 'closed' | 'delayed' | 'heavy_traffic' | 'military_presence' | 'random_check' | 'smooth_traffic';
  description: string;
  updated_at: any;
}

interface Barrier {
  id: string;
  barrier: string;
  description: string;
  location: string;
  city: string;
  status: 'open' | 'closed' | 'delayed' | 'heavy_traffic' | 'military_presence' | 'random_check' | 'smooth_traffic';
  imageUrl: string | null;
  created_at: any;
  updated_at: any;
  updates?: BarrierUpdate[];
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

const BarrierDetails = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { t, language } = useLanguage();
  const [barrier, setBarrier] = useState<Barrier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBarrierDetails = async () => {
      try {
        const barrierRef = doc(db, 'barriers', id as string);
        const barrierDoc = await getDoc(barrierRef);
        
        if (barrierDoc.exists()) {
          setBarrier({
            id: barrierDoc.id,
            ...barrierDoc.data()
          } as Barrier);
        }
      } catch (error) {
        console.error('Error fetching barrier details:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBarrierDetails();
  }, [id]);

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

  if (loading) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
        <Header pageTitle={language === 'ar' ? 'تفاصيل الحاجز' : 'Barrier Details'} />
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#f97316" />
        </View>
      </SafeAreaView>
    );
  }

  if (!barrier) {
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
        <Header pageTitle={language === 'ar' ? 'تفاصيل الحاجز' : 'Barrier Details'} />
        <View className="flex-1 justify-center items-center">
          <Text className={`text-gray-500 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
            {language === 'ar' ? 'لم يتم العثور على الحاجز' : 'Barrier not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
      <Header pageTitle={language === 'ar' ? 'تفاصيل الحاجز' : 'Barrier Details'} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >
        {loading ? (
          <View className="flex-1 justify-center items-center py-8">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : barrier ? (
          <View className="px-4 py-4">
            {/* Barrier Info */}
            <View className="bg-white p-4 rounded-xl mb-4 border border-gray-200">
              <View className="flex-row-reverse justify-between items-center mb-2">
                <View className="flex-1">
                  <Text className={`text-lg ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} text-gray-800`}>
                    {PALESTINIAN_CITIES[barrier.city]?.barriers.find((b: BarrierData) => b.en === barrier.barrier)?.ar || barrier.barrier}
                  </Text>
                  <Text className={`text-sm ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} text-gray-500`}>
                    {PALESTINIAN_CITIES[barrier.city]?.ar || barrier.city}
                  </Text>
                </View>
                <View 
                  className="px-3 py-1 rounded-full ml-2"
                  style={{ backgroundColor: getStatusColor(barrier.status) }}
                >
                  <Text className="text-white text-sm mt-1 font-CairoBold">
                    {getStatusText(barrier.status)}
                  </Text>
                </View>
              </View>
              {barrier.description && (
                <Text className={`text-gray-600 mb-2 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                  {barrier.description}
                </Text>
              )}
              {barrier.imageUrl && (
                <Image
                  source={{ uri: barrier.imageUrl }}
                  className="w-full h-48 rounded-lg mb-2"
                  resizeMode="cover"
                />
              )}
              <View className="flex-row-reverse justify-between items-center">
                <View className="flex-row-reverse items-center">
                  <Text className={`text-gray-400 text-sm ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                    {language === 'ar' ? 'آخر تحديث: ' : 'Last Updated: '}
                    {formatDate(barrier.updated_at).date}
                  </Text>
                  <View className="bg-gray-100 px-2 py-1 rounded-full mx-2">
                    <Text className={`text-orange-600 text-sm ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                      {formatDate(barrier.updated_at).time}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Update History */}
            {barrier.updates && barrier.updates.length > 0 && (
              <View className="bg-white p-4 rounded-xl border border-gray-200">
                <Text className={`text-lg mb-4 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'} text-gray-800`}>
                  {language === 'ar' ? 'سجل التحديثات' : 'Update History'}
                </Text>
                {barrier.updates.map((update: any, index: number) => (
                  <View key={index} className="mb-4 pb-4 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
                    <View className="flex-row justify-between items-center mb-2">
                      <View 
                        className="px-3 py-1 rounded-full ml-2"
                        style={{ backgroundColor: getStatusColor(update.status) }}
                      >
                        <Text className="text-white text-sm font-bold">
                          {getStatusText(update.status)}
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Text className={`text-gray-400 text-sm ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                          {formatDate(update.updated_at).date}
                        </Text>
                        <View className="bg-gray-100 px-2 py-1 rounded-full mx-2">
                          <Text className={`text-orange-600 text-sm ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                            {formatDate(update.updated_at).time}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {update.description && (
                      <Text className={`text-gray-600 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                        {update.description}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View className="flex-1 justify-center items-center py-8">
            <Text className={`text-gray-500 ${language === 'ar' ? 'font-CairoBold text-center' : 'font-JakartaBold text-center'}`}>
              {language === 'ar' ? 'لم يتم العثور على الحاجز' : 'Barrier not found'}
            </Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.back();
        }}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 20,
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
          <Image
            source={icons.backArrow}
            style={{ width: 24, height: 24, tintColor: '#fff' }}
          />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default BarrierDetails; 