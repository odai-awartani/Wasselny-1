import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import * as Haptics from 'expo-haptics';

export default function PrivacyPolicy() {
  const router = useRouter();
  const { language } = useLanguage();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Content */}
      <ScrollView className="flex-1 px-4 py-6">
        <Text className={`text-base ${language === 'ar' ? 'font-CairoRegular text-right' : 'font-JakartaRegular text-left'} text-gray-700 leading-6`}>
          {language === 'ar' ? (
            <>
              مرحباً بك في سياسة الخصوصية لتطبيق وصلني. نحن نقدر خصوصيتك ونلتزم بحماية بياناتك الشخصية.

              {'\n\n'}1. جمع المعلومات
              {'\n'}نقوم بجمع المعلومات الضرورية لتقديم خدماتنا، بما في ذلك:
              {'\n'}• معلومات الموقع
              {'\n'}• معلومات الحساب
              {'\n'}• معلومات الاتصال

              {'\n\n'}2. استخدام المعلومات
              {'\n'}نستخدم معلوماتك لـ:
              {'\n'}• تقديم خدمات التطبيق
              {'\n'}• تحسين تجربة المستخدم
              {'\n'}• التواصل معك

              {'\n\n'}3. حماية المعلومات
              {'\n'}نحن نستخدم تقنيات تشفير متقدمة لحماية بياناتك الشخصية.

              {'\n\n'}4. مشاركة المعلومات
              {'\n'}لا نقوم بمشاركة معلوماتك الشخصية مع أي طرف ثالث دون موافقتك.

              {'\n\n'}5. حقوق المستخدم
              {'\n'}يمكنك في أي وقت:
              {'\n'}• الوصول إلى بياناتك
              {'\n'}• تعديل معلوماتك
              {'\n'}• حذف حسابك
            </>
          ) : (
            <>
              Welcome to Wasselny's Privacy Policy. We value your privacy and are committed to protecting your personal data.

              {'\n\n'}1. Information Collection
              {'\n'}We collect necessary information to provide our services, including:
              {'\n'}• Location information
              {'\n'}• Account information
              {'\n'}• Contact information

              {'\n\n'}2. Information Usage
              {'\n'}We use your information to:
              {'\n'}• Provide app services
              {'\n'}• Improve user experience
              {'\n'}• Communicate with you

              {'\n\n'}3. Information Protection
              {'\n'}We use advanced encryption technologies to protect your personal data.

              {'\n\n'}4. Information Sharing
              {'\n'}We do not share your personal information with any third party without your consent.

              {'\n\n'}5. User Rights
              {'\n'}You can at any time:
              {'\n'}• Access your data
              {'\n'}• Modify your information
              {'\n'}• Delete your account
            </>
          )}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
} 