// app/(auth)/language.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { icons, images } from '@/constants';
import { useLanguage } from '@/context/LanguageContext';
import { translations } from '@/constants/languages';
import CustomButton from '@/components/CustomButton';
import { StatusBar } from 'expo-status-bar';

export default function LanguageScreen() {
  const { language: currentLanguage, setLanguage } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'ar'>(
    currentLanguage || 'ar' // Default to Arabic
  );

  // Get translations based on selected language (not persisted yet)
  const t = translations[selectedLanguage];

  const handleContinue = async () => {
    try {
      await setLanguage(selectedLanguage); // This saves to AsyncStorage and updates context
      router.push('/welcome');
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  // Update local state if language changes in context
  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  return (
    <SafeAreaView className="flex-1 bg-gray-100 ">
      <View className="flex-1 px-5 py-10 items-center ">
        {/* Dynamic title based on selection */}
        <Text className={`text-3xl text-gray-800 text-center mb-8 ${selectedLanguage === 'ar' ? 'font-CairoBold pt-2' : 'font-JakartaBold pt-2'}`}>
          {t.chooseLanguage}
        </Text>

        {/* Main illustration */}
        <View className="w-full items-center justify-center my-10">
          <Image 
            source={images.lang} 
            className="w-11/12 h-72"
            resizeMode="contain"
          />
        </View>

        {/* Language options */}
        <View className="w-full mb-10">
          {/* Arabic option */}
          <TouchableOpacity 
            className={`flex-row items-center justify-between bg-white rounded-xl py-5 px-5 mb-4 shadow-md ${selectedLanguage === 'ar' ? 'border border-gray-300' : ''}`}
            onPress={() => setSelectedLanguage('ar')}
          >
            <Image 
              source={icons.ar} 
              className="w-12 h-8 rounded-sm"
            />
            <Text className="flex-1 text-xl font-semibold text-right ml-4">العربية</Text>
            <View className={`w-6 h-6 rounded-full ml-4 border-2 ${selectedLanguage === 'ar' ? 'border-orange-100' : 'border-gray-300'} flex justify-center items-center`}>
              {selectedLanguage === 'ar' && <View className="w-3 h-3 rounded-full bg-orange-100" />}
            </View>
          </TouchableOpacity>

          {/* English option */}
          <TouchableOpacity 
            className={`flex-row items-center justify-between bg-white rounded-xl py-5 px-5 mb-4 shadow-md ${selectedLanguage === 'en' ? 'border border-gray-300' : ''}`}
            onPress={() => setSelectedLanguage('en')}
          >
            <Image 
              source={icons.en} 
              className="w-12 h-8 rounded-sm"
            />
            <Text className="flex-1 text-xl font-semibold ml-4">English</Text>
            <View className={`w-6 h-6 rounded-full border-2 ${selectedLanguage === 'en' ? 'border-orange-100' : 'border-gray-300'} flex justify-center items-center`}>
              {selectedLanguage === 'en' && <View className="w-3 h-3 rounded-full bg-orange-100" />}
            </View>
          </TouchableOpacity>
        </View>

        {/* Dynamic button text */}
        
        <CustomButton
          title={t.next}
          className="w-full bg-orange-500 rounded-3xl py-4 items-center mt-auto"
          onPress={handleContinue}
        />
      </View>
      <StatusBar backgroundColor="#fff" style="dark" />
      
    </SafeAreaView>
  );
}