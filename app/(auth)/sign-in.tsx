import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InputField from '@/components/InputField'; // استيراد InputField
import { useLanguage } from '@/context/LanguageContext';
import CustomButton from '@/components/CustomButton';
import { icons, images } from '@/constants';
import { Link, router } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo'; // استيراد useSignIn من Clerk
import { StatusBar } from 'expo-status-bar';

const SignIn = () => {
  const { t, language } = useLanguage();
  const { isLoaded, signIn, setActive } = useSignIn(); // استخدام useSignIn من Clerk
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [verification, setVerification] = useState({
    state: 'default', // حالة التحقق: default, pending, success, error
    error: '', // رسالة الخطأ
    code: '', // كود التحقق
  });

  const onSignInPress = async () => {
    if (!isLoaded) return;

    if (!form.email || !form.password) {
      Alert.alert(t.error, t.fillAllFields);
      return;
    }

    try {
      // محاولة تسجيل الدخول
      const completeSignIn = await signIn.create({
        identifier: form.email,
        password: form.password,
      });

      if (completeSignIn.status === 'complete') {
        // تم تسجيل الدخول بنجاح
        await setActive({ session: completeSignIn.createdSessionId });
        router.replace('/home'); // الانتقال إلى الصفحة الرئيسية
      } else {
        // في حالة وجود خطأ
        Alert.alert(t.error, t.signInFailed);
      }
    } catch (err: any) {
      console.error('Error during sign in:', err);
      Alert.alert(t.error, err.errors[0].longMessage);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
    <View className="flex-1 bg-white">
      <View className="relative w-full h-[250px]">
        <Image source={images.signUpCar} className="z-0 w-full h-[250px]" />
        <Text className={`text-[25px] text-black ${language === 'ar' ? 'font-CairoExtraBold right-5' : 'font-JakartaSemiBold left-5'} absolute bottom-5`}>
                    {t.welcome}
                  </Text>
                </View>
        <View className="-pt-1 px-5 pb-10">
          {/* حقل البريد الإلكتروني */}
          <InputField
            label={t.email}
            placeholder="user@example.com"
            value={form.email}
            onChangeText={(text) => setForm({ ...form, email: text })}
            keyboardType="email-address"
            labelStyle={language === 'ar' ? 'text-right font-CairoBold text-orange-500' : 'text-left font-JakartaBold text-orange-500'}
            className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold ' : 'text-left placeholder:text-left'}`}
          />

          {/* حقل كلمة السر */}
          <InputField
            label={t.password}
            placeholder="**********"
            value={form.password}
            onChangeText={(text) => setForm({ ...form, password: text })}
            secureTextEntry
            labelStyle={language === 'ar' ? 'text-right font-CairoBold text-orange-500' : 'text-left font-JakartaBold text-orange-500'}
            className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold ' : 'text-left placeholder:text-left'}`}
          />

          {/* رابط نسيان كلمة السر */}
           <TouchableOpacity onPress={() => router.push('/forgot-password')}>
            <Text className={`text-sm text-orange-500 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'} mt-2`}>
              {t.forgotPassword}
            </Text>
          </TouchableOpacity> 

          {/* زر تسجيل الدخول */}
          <View className="items-center mt-6">
            <CustomButton
              title={t.logIn}
              onPress={onSignInPress}
              
            />

            {/* رابط الانتقال إلى تسجيل الدخول */}
            <Link href="/(auth)/sign-up" className={`text-lg text-center text-general-200 mt-4 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
              <Text>{t.noAccount}</Text>
              <Text className="text-orange-500"> {t.signUpButton}</Text>
            </Link>
          </View>
        </View>
      </View>
      <StatusBar backgroundColor="#fff" style="dark" />

    </ScrollView>
  );
};

export default SignIn;