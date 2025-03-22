import { View, Text, TouchableOpacity, Image } from 'react-native'
import React, { useRef, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Swiper from 'react-native-swiper'
import { onboarding } from '@/constants'
import CustomButton from '@/components/CustomButton'
import { useLanguage } from '@/context/LanguageContext';
import { StatusBar } from 'expo-status-bar'


const Onboarding = () => {
  const swiperRef = useRef<Swiper>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { t, language } = useLanguage(); // استخدام اللغة والترجمة من السياق
  const isLastSlide = activeIndex === onboarding.length - 1;

  return (
    <SafeAreaView className="flex h-full items-center justify-between bg-white">
      {/* زر التخطي */}
      <TouchableOpacity
        onPress={() => router.replace("/(auth)/sign-up")}
        className="w-full flex justify-end items-end p-5"
      >
        <Text className={`text-black text-md ${language === 'ar' ? 'font-bold' : 'font-JakartaBold'}`}>
          {t.skip}
        </Text>
      </TouchableOpacity>

      <Swiper
        ref={swiperRef}
        loop={false}
        dot={
          <View className="w-[15px] h-[4px] mx-1 bg-[#E2E8F0] rounded-full" />
        }
        activeDot={
          <View className="w-[32px] h-[4px] mx-1 bg-orange-100 rounded-full" />
        }
        onIndexChanged={(index) => setActiveIndex(index)}
      >
        {onboarding.map((item, index) => (
          <View key={item.id}
           className="flex items-center justify-center p-5"
           style={{ direction: language === 'ar' ? 'rtl' : 'ltr' }}
           >
            <Image
              source={item.image}
              className="w-full h-[300px]"
              resizeMode="contain"
            />
            <View className="flex flex-row items-center justify-center w-full mt-20">
            <Text className={`text-black pt-3 text-3xl font-bold mx-10 text-center ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                {t.onboarding[index].title}
              </Text>
            </View>
            <Text className={`text-md text-center text-[#858585] mx-10 mt-3 ${language === 'ar' ? 'font-CairoSemiBold' : 'font-JakartaMedium'}`}>
              {t.onboarding[index].description}
            </Text>
          </View>
        ))}
      </Swiper>
        <CustomButton 
           title={isLastSlide ? t.CreateAcc : t.next}
          onPress={() => isLastSlide ? router.replace('/(auth)/sign-up') : swiperRef.current?.scrollBy(1)}
          className='w-11/12 mt-10 mb-10'
        />
        <StatusBar backgroundColor="#fff" style="dark" />
    </SafeAreaView>
  )
}

export default Onboarding