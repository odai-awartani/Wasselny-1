import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function Help() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user } = useUser();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'الرجاء إدخال رسالة' : 'Please enter a message'
      );
      return;
    }

    setIsSending(true);
    try {
      await addDoc(collection(db, 'support_messages'), {
        userId: user?.id,
        userName: user?.fullName,
        userEmail: user?.primaryEmailAddress?.emailAddress,
        message: message.trim(),
        createdAt: serverTimestamp(),
        status: 'pending'
      });

      Alert.alert(
        language === 'ar' ? 'نجاح' : 'Success',
        language === 'ar' ? 'تم إرسال رسالتك بنجاح' : 'Your message has been sent successfully'
      );
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء إرسال الرسالة' : 'Error sending message'
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Content */}
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
        {/* User Info */}
        <View>
          <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
          </Text>
          <View className="bg-white py-3 px-3 border border-gray-200 rounded-md">
            <Text className={`text-[15px] text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {user?.fullName || (language === 'ar' ? 'غير محدد' : 'Not specified')}
            </Text>
          </View>
        </View>

        {/* Email */}
        <View className="mt-4">
          <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
          </Text>
          <View className="bg-white py-3 px-3 border border-gray-200 rounded-md">
            <Text className={`text-[15px] text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {user?.primaryEmailAddress?.emailAddress || (language === 'ar' ? 'غير محدد' : 'Not specified')}
            </Text>
          </View>
        </View>

        {/* Message Input */}
        <View className="mt-4">
          <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'الرسالة' : 'Message'}
          </Text>
          <View className="bg-white border border-gray-200 rounded-md overflow-hidden">
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              placeholder={language === 'ar' ? 'اكتب رسالتك هنا...' : 'Write your message here...'}
              placeholderTextColor="#9CA3AF"
              className={`py-3 px-3 text-[15px] ${language === 'ar' ? 'text-right' : 'text-left'}`}
              style={{
                textAlignVertical: 'top',
                minHeight: 120,
                fontFamily: language === 'ar' ? 'Cairo-Regular' : 'PlusJakartaSans-Regular'
              }}
            />
          </View>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          onPress={handleSendMessage}
          disabled={isSending}
          className={`bg-orange-500 py-3 px-4 rounded-md mt-4 ${isSending ? 'opacity-50' : ''}`}
        >
          <Text className={`text-white text-center text-[15px] ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
            {isSending 
              ? (language === 'ar' ? 'جاري الإرسال...' : 'Sending...')
              : (language === 'ar' ? 'إرسال الرسالة' : 'Send Message')
            }
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
} 