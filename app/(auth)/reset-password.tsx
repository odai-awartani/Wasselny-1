import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InputField from '@/components/InputField';
import { useLanguage } from '@/context/LanguageContext';
import CustomButton from '@/components/CustomButton';
import { icons, images } from '@/constants';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useSignIn, useAuth } from '@clerk/clerk-expo'; // استيراد useAuth
import { StatusBar } from 'expo-status-bar';

const ResetPassword = () => {
  const { t, language } = useLanguage();
  const { isLoaded, signIn } = useSignIn();
  const { signOut } = useAuth(); // استخدام useAuth لتسجيل الخروج
  const { email } = useLocalSearchParams();
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const onResetPasswordPress = async () => {
    if (!isLoaded) return;

    if (!code || !newPassword) {
      Alert.alert(t.error, t.fillAllFields);
      return;
    }

    try {
      // محاولة إعادة تعيين كلمة المرور باستخدام الرمز
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });

      if (result.status === 'complete') {
        // تم إعادة تعيين كلمة المرور بنجاح
        Alert.alert(t.success, t.passwordResetSuccess); // عرض رسالة نجاح

        // تسجيل خروج المستخدم تلقائيًا
        await signOut();

        // توجيه المستخدم إلى صفحة تسجيل الدخول
        router.replace('/sign-in');
      } else {
        // في حالة وجود خطأ
        Alert.alert(t.error, t.passwordResetFailed);
      }
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
          {t.resetPassword}
        </Text>

        {/* وصف الصفحة */}
        <Text className={`text-base text-gray-500 ${language === 'ar' ? 'font-CairoRegular text-right' : 'font-Jakarta text-left'} mt-2`}>
          {t.resetPasswordDescription}
        </Text>

        {/* حقل رمز التحقق */}
        <InputField
          label={t.verificationCode}
          placeholder="123456"
          value={code}
          onChangeText={(text) => setCode(text)}
          keyboardType="numeric"
          labelStyle={language === 'ar' ? 'text-right font-CairoBold text-orange-500' : 'text-left font-JakartaBold text-orange-500'}
          className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold ' : 'text-left placeholder:text-left'}`}
        />

        {/* حقل كلمة المرور الجديدة */}
        <InputField
          label={t.newPassword}
          placeholder="**********"
          value={newPassword}
          onChangeText={(text) => setNewPassword(text)}
          secureTextEntry
          labelStyle={language === 'ar' ? 'text-right font-CairoBold text-orange-500' : 'text-left font-JakartaBold text-orange-500'}
          className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold ' : 'text-left placeholder:text-left'}`}
        />

        {/* زر إعادة تعيين كلمة المرور */}
        <CustomButton
          title={t.resetPasswordButton}
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

export default ResetPassword;