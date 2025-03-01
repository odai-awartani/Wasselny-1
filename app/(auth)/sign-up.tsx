// app/(auth)/sign-up.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InputField from '@/components/InputField';
import { useLanguage } from '@/context/LanguageContext';
import CustomButton from '@/components/CustomButton';

const SignUp = () => {
  const { t } = useLanguage();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAgreed, setIsAgreed] = useState(false);
  const [gender, setGender] = useState('');
  const [workIndustry, setWorkIndustry] = useState('');
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showIndustryModal, setShowIndustryModal] = useState(false);

  const genders = ['ذكر', 'أنثى']; // Arabic genders
  const industries = ['طالب', 'موظف', 'أعمال حرة', 'أخرى']; // Arabic industries

  const handleSignUp = () => {
    console.log('Signing up...');
    console.log({
      phoneNumber,
      fullName,
      email,
      password,
      gender,
      workIndustry,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white p-5 justify-center">
      {/* Title */}
      <Text className="text-2xl font-bold text-center mb-6 text-orange-500">{t.signUp}</Text>

      {/* Phone Number Input */}
      <InputField
        label={t.phoneNumber}
        placeholder="+970"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
      />

      {/* Full Name Input */}
      <InputField
        label={t.fullName}
        placeholder={t.enterYourName}
        value={fullName}
        onChangeText={setFullName}
      />

      {/* Email Input */}
      <InputField
        label={t.email}
        placeholder="user@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
      />

      {/* Password Input */}
      <InputField
        label={t.password}
        placeholder="********"
        value={password}
        onChangeText={setPassword}
        secureTextEntry // This enables the show/hide feature
      />

      {/* Gender Selection */}
      <TouchableOpacity
        onPress={() => setShowGenderModal(true)}
        className="my-2"
      >
        <Text className="text-lg font-JakartaSemiBold mb-2 text-orange-500">{t.gender}</Text>
        <View className="flex flex-row justify-start items-center bg-neutral-100 rounded-full p-3 border border-orange-200">
          <Text className="text-gray-500">
            {gender || t.selectGender}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Work Industry Selection */}
      <TouchableOpacity
        onPress={() => setShowIndustryModal(true)}
        className="my-2"
      >
        <Text className="text-lg font-JakartaSemiBold mb-2 text-orange-500">{t.workIndustry}</Text>
        <View className="flex flex-row justify-start items-center bg-neutral-100 rounded-full p-3 border border-orange-200">
          <Text className="text-gray-500">
            {workIndustry || t.selectIndustry}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Agreement Checkbox */}
      <View className="flex-row items-center my-4">
        <TouchableOpacity
          onPress={() => setIsAgreed(!isAgreed)}
          className={`w-5 h-5 border rounded-md mr-2 ${isAgreed ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
        >
          {isAgreed && <Text className="text-white text-center">✓</Text>}
        </TouchableOpacity>
        <Text className="text-sm text-gray-600">{t.agreeToTerms}</Text>
      </View>

      {/* Sign-Up Button */}
      <CustomButton 
        title={t.signUp}
        onPress={handleSignUp} 
        className="mt-4 bg-orange-500"
      />

      {/* Gender Modal */}
      <Modal visible={showGenderModal} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="w-11/12 bg-orange-50 rounded-lg p-5 border border-orange-200">
            <Text className="text-xl font-bold mb-4 text-orange-500">{t.selectGender}</Text>
            {genders.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setGender(item);
                  setShowGenderModal(false);
                }}
                className="py-3 border-b border-orange-100"
              >
                <Text className="text-lg text-orange-500">{item}</Text>
              </TouchableOpacity>
            ))}
            
            <CustomButton 
           title={t.cancel}
           onPress={() => setShowGenderModal(false)}
          className='mt-4 py-3 '
        />
          </View>
        </View>
      </Modal>

      {/* Work Industry Modal */}
      <Modal visible={showIndustryModal} transparent animationType="slide">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="w-11/12 bg-orange-50 rounded-lg p-5 border border-orange-200">
            <Text className="text-xl font-bold mb-4 text-orange-500">{t.selectIndustry}</Text>
            {industries.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  setWorkIndustry(item);
                  setShowIndustryModal(false);
                }}
                className="py-3 border-b border-orange-100"
              >
                <Text className="text-lg text-orange-500">{item}</Text>
              </TouchableOpacity>
              
            ))}
           
            <CustomButton 
           title={t.cancel}
           onPress={() => setShowIndustryModal(false)}
          className='mt-4 py-3 '
        />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SignUp;