import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InputField from '@/components/InputField'; // استيراد InputField
import { useLanguage } from '@/context/LanguageContext';
import CustomButton from '@/components/CustomButton';
import { icons, images } from '@/constants';
import { Link, router } from 'expo-router';
import { useSignIn } from '@clerk/clerk-expo'; // استيراد useSignIn من Clerk
import { StatusBar } from 'expo-status-bar';

const ForgotPassword = () => {
  const { t, language } = useLanguage();
  const { isLoaded, signIn } = useSignIn(); // استخدام useSignIn من Clerk
  const [email, setEmail] = useState(''); // حالة لتخزين البريد الإلكتروني

  const onResetPasswordPress = async () => {
    if (!isLoaded) return;

    if (!email) {
      Alert.alert(t.error, t.fillEmailField);
      return;
    }

    try {
      // إرسال رمز التحقق لإعادة تعيين كلمة المرور
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });

      // إعلام المستخدم بأن الرمز قد تم إرساله
      Alert.alert(t.success, t.resetPasswordCodeSent);

      // توجيه المستخدم إلى صفحة إعادة تعيين كلمة المرور
      router.push({
        pathname: '/reset-password',
        params: { email }, // تمرير البريد الإلكتروني كمعامل
      });
    } catch (err: any) {
      console.error('Error during reset password:', err);
      Alert.alert(t.error, err.errors[0].longMessage);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-5 pb-10">
        {/* عنوان الصفحة */}
        <Text className={`text-[25px] text-black ${language === 'ar' ? 'font-CairoExtraBold text-right' : 'font-JakartaSemiBold text-left'} mt-10`}>
          {t.forgotPassword}
        </Text>

        {/* وصف الصفحة */}
        <Text className={`text-base text-gray-500 ${language === 'ar' ? 'font-CairoRegular text-right' : 'font-Jakarta text-left'} mt-2`}>
          {t.forgotPasswordDescription}
        </Text>

        {/* حقل البريد الإلكتروني */}
        <InputField
          label={t.email}
          placeholder="user@example.com"
          value={email}
          onChangeText={(text) => setEmail(text)}
          keyboardType="email-address"
          labelStyle={language === 'ar' ? 'text-right font-CairoBold text-orange-500' : 'text-left font-JakartaBold text-orange-500'}
          className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold ' : 'text-left placeholder:text-left'}`}
        />

        {/* زر إرسال الرابط */}
        <CustomButton
          title={t.sendResetLink}
          onPress={onResetPasswordPress}
          className="mt-6"
        />

        {/* رابط العودة إلى تسجيل الدخول */}
        <TouchableOpacity onPress={() => router.push('/sign-in')} className="mt-4">
          <Text className={`text-sm text-orange-500 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}`}>
            {t.backToSignIn}
          </Text>
        </TouchableOpacity>
      </View>
      <StatusBar backgroundColor="#fff" style="dark" />
      
    </SafeAreaView>
  );
};

export default ForgotPassword;