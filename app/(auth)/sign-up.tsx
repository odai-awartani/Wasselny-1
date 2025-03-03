import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import InputField from '@/components/InputField'; // استيراد InputField المعدل
import { useLanguage } from '@/context/LanguageContext';
import CustomButton from '@/components/CustomButton';
import { icons, images } from '@/constants';
import { Link, router } from 'expo-router';
import { useSignUp } from '@clerk/clerk-expo'; // استيراد useSignUp من Clerk
import ReactNativeModal from 'react-native-modal'


const SignUp = () => {
  const { t, language } = useLanguage();
  const { isLoaded, signUp, setActive } = useSignUp(); // استخدام useSignUp من Clerk
  const [showSuccessModal, setShowSuccessModal] = useState(false); // حالة لعرض نافذة النجاح
  const [isAgreed, setIsAgreed] = useState(false);
  const [form, setForm] = useState({
    phoneNumber: '',
    fullName: '',
    email: '',
    password: '',
    gender: '',
    workIndustry: '',
  });
  const [verification, setVerification] = useState({
    state: 'default', // حالة التحقق: default, pending, success, error
    error: '', // رسالة الخطأ
    code: '', // كود التحقق
  });

  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showIndustryModal, setShowIndustryModal] = useState(false);

  const genders = t.genders; // الجنس بالعربية
  const industries = t.industries; // المجالات بالعربية
// done
  const onSignUpPress = async () => {
    if (!isLoaded) return;
    if (!isAgreed) {
      Alert.alert(t.error, t.agreeToTermsAlert);
      return;
    }
    
    
    if (!form.email || !form.password || !form.fullName || !form.phoneNumber || !form.gender || !form.workIndustry) {
      Alert.alert(t.error, t.fillAllFields);
      return;
    }

    try {
      // Create a new user with Clerk
      await signUp.create({
        emailAddress: form.email,
        password: form.password,
        firstName: form.fullName.split(' ')[0],
        lastName: form.fullName.split(' ')[1] || '',
      });

      // إرسال كود التحقق
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });

      // تغيير حالة التحقق إلى "pending"
      setVerification({
        ...verification,
        state: 'pending',
      });
    } catch (err: any) {
      console.log(JSON.stringify(err, null, 2));
      console.error('Error during sign up:', err);
      Alert.alert(t.error, err.errors[0].longMessage);
    }
  };

  const onVerifyPress = async () => {
    if (!isLoaded) return;
  
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: verification.code,
      });
  
      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
  
        setVerification({
          ...verification,
          state: "success",
        });
  
        setShowSuccessModal(true); // تأكد من أن هذه السطر يتم تنفيذه
      } else {
        setVerification({
          ...verification,
          error: t.verificationFailed,
          state: "failed",
        });
        
      }
    } catch (err: any) {
      setVerification({
        ...verification,
        error: err.errors[0].longMessage,
        state: "failed",
      });
    }
  };

  return (
    <ScrollView className="flex-1 bg-white" showsHorizontalScrollIndicator={false}>
      <View className="flex-1 bg-white">
        <View className="relative w-full h-[250px]">
          <Image source={images.signUpCar} className="z-0 w-full h-[250px]" />
          <Text className={`text-[25px] text-black ${language === 'ar' ? 'font-CairoExtraBold right-5' : 'font-JakartaSemiBold left-5'} absolute bottom-5`}>
            {t.signUp}
          </Text>
        </View>
        <View className="-pt-1 px-5 pb-10">
          {/* حقل رقم الهاتف */}
          <InputField
            label={t.phoneNumber}
            placeholder="599510287"
            value={form.phoneNumber}
            onChangeText={(text) => setForm({ ...form, phoneNumber: text })}
            isPhoneNumber
            labelStyle={language === 'ar' ? 'text-right font-CairoBold text-orange-500' : 'text-left font-JakartaBold text-orange-500'}
            className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold ' : 'text-left placeholder:text-left'}`}
          />

          {/* حقل الاسم الكامل */}
          <InputField
            label={t.fullName}
            placeholder={t.enterYourName}
            value={form.fullName}
            onChangeText={(text) => setForm({ ...form, fullName: text })}
            labelStyle={language === 'ar' ? 'text-right font-CairoBold text-orange-500' : 'text-left font-JakartaBold text-orange-500'}
            className={`${language === 'ar' ? 'text-right placeholder:text-right font-CairoBold ' : 'text-left placeholder:text-left'}`}
          />

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

          {/* اختيار الجنس */}
          <TouchableOpacity
            onPress={() => setShowGenderModal(true)}
            className="my-2"
          >
            <Text className={`text-lg font-JakartaSemiBold mb-3 text-orange-500 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}`}>
              {t.gender}
            </Text>
            <View className={`flex flex-row ${language === 'ar' ? 'flex-row-reverse' : ''} items-center bg-neutral-100 rounded-full p-4 border border-secondary-500`}>
              <Text className={`text-gray-500 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}`}>
                {form.gender || t.selectGender}
              </Text>
            </View>
          </TouchableOpacity>

          {/* اختيار مجال العمل */}
          <TouchableOpacity
            onPress={() => setShowIndustryModal(true)}
            className="my-2"
          >
            <Text className={`text-lg font-JakartaSemiBold mb-3 text-orange-500 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}`}>
              {t.workIndustry}
            </Text>
            <View className={`flex flex-row ${language === 'ar' ? 'flex-row-reverse' : ''} items-center bg-neutral-100 rounded-full p-4 border border-secondary-500`}>
              <Text className={`text-gray-500 ${language === 'ar' ? 'text-right font-CairoBold' : 'text-left font-JakartaBold'}`}>
                {form.workIndustry || t.selectIndustry}
              </Text>
            </View>
          </TouchableOpacity>
                    {/* Terms and Conditions Checkbox */}
      <View className={`flex-row items-center my-4 ${language === 'ar' ? 'flex-row-reverse font-CairoBold' : 'flex-row font-JakartaBold'}`}>
        <TouchableOpacity
          onPress={() => setIsAgreed(!isAgreed)}
          className={`w-5 h-5 border rounded-md mr-2 ${isAgreed ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-300'}`}
        >
          {isAgreed && <Text className="text-white text-center">✓</Text>}
        </TouchableOpacity>
        <Text className="text-sm text-gray-600">{t.agreeToTerms}</Text>
      </View>
          {/* زر التسجيل */}
          <View className="items-center">
            <CustomButton
              title={t.signUpButton}
              onPress={onSignUpPress}
              className="mt-6"
            />
       


            {/* رابط الانتقال إلى تسجيل الدخول */}
            <Link href="/(auth)/sign-in" className="text-lg text-center text-general-200 mt-10">
              <Text>{t.alreadyHaveAccount}</Text>
              <Text className="text-primary-500"> {t.logIn}</Text>
            </Link>
          </View>
        </View>

        {/* نافذة اختيار الجنس */}
        <Modal visible={showGenderModal} transparent animationType="slide">
          <View className="flex-1 justify-center items-center bg-black/50">
            <View className="w-11/12 bg-orange-50 rounded-lg p-5 border border-orange-500">
              <Text className={`text-xl font-bold mb-4 text-orange-500 text-center`}>{t.selectGender}</Text>
              {genders.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setForm({ ...form, gender: item });
                    setShowGenderModal(false);
                  }}
                  className="py-3 border-b border-orange-100"
                >
                  <Text className={`text-lg text-orange-500 ${language === 'ar' ? 'text-right' : 'text-left'}`}>{item}</Text>
                </TouchableOpacity>
              ))}
              <CustomButton
                title={t.cancel}
                onPress={() => setShowGenderModal(false)}
                className="mt-4 bg-orange-500"
              />
            </View>
          </View>
        </Modal>

        {/* نافذة اختيار مجال العمل */}
        <Modal visible={showIndustryModal} transparent animationType="slide">
          <View className="flex-1 justify-center items-center bg-black/50">
            <View className="w-11/12 bg-orange-50 rounded-lg p-5 border border-orange-200">
              <Text className={`text-xl font-bold mb-4 text-orange-500 text-center`}>{t.selectIndustry}</Text>
              {industries.map((item, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setForm({ ...form, workIndustry: item });
                    setShowIndustryModal(false);
                  }}
                  className="py-3 border-b border-orange-100"
                >
                  <Text className={`text-lg text-orange-500 text-center ${language === 'ar' ? 'text-right' : 'text-left'}`}>{item}</Text>
                </TouchableOpacity>
              ))}
              <CustomButton
                title={t.cancel}
                onPress={() => setShowIndustryModal(false)}
                className="mt-4 bg-orange-500"
              />
            </View>
          </View>
        </Modal>
{/* نافذة التحقق */}
<Modal
 key="verification-modal"
  visible={verification.state === "pending"}
  transparent={true} // لجعل الخلفية شفافة
  animationType="slide" // لإضافة رسوم متحركة
  onRequestClose={() => {
    if (verification.state === "success") {
      console.log("Verification successful, showing success modal"); // Debugging
      setShowSuccessModal(true);
    }
  }}
>
  <View className="flex-1 justify-center items-center bg-black/50">
    <View className="bg-white p-7 rounded-2xl min-h-[300px] w-11/12">
      <Text className="font-JakartaExtraBold text-2xl mb-2">
        Verification
      </Text>
      <Text className="font-Jakarta text-lg mb-5">
        We've sent a verification code to {form.email}.
      </Text>
      <InputField
        label={"Code"}
        icon={icons.lock}
        placeholder={"12345"}
        value={verification.code}
        keyboardType="numeric"
        onChangeText={(code) => setVerification({ ...verification, code })}
        iconStyle="mt-3 mr-3"
        maxLength={6}
        accessibilityLabel="Enter verification code"
      />
      {verification.error && (
        <Text className="text-red-500 text-sm mt-1">
          {verification.error}
        </Text>
      )}
      <CustomButton
        title="Verify Email"
        onPress={onVerifyPress}
        className="mt-5 bg-success-500"
        accessibilityLabel="Verify Email Button"
        disabled={verification.code.length < 6} // Disable until 6 digits are entered
      />
    </View>
  </View>
</Modal>

{/* نافذة التحقق */}
<Modal
  key="verification-modal-success"
  visible={verification.state === "pending"}
  transparent={true} // لجعل الخلفية شفافة
  animationType="slide" // لإضافة رسوم متحركة
  onRequestClose={() => {
    if (verification.state === "success") {
      console.log("Verification successful, showing success modal"); // Debugging
      setShowSuccessModal(true);
    }
  }}
>
  <View className="flex-1 justify-center items-center bg-black/50">
    <View className="bg-white p-7 rounded-2xl min-h-[300px] w-11/12">
      <Text className="font-JakartaExtraBold text-2xl mb-2">
        Verification
      </Text>
      <Text className="font-Jakarta text-lg mb-5">
        We've sent a verification code to {form.email}.
      </Text>
      <InputField
        label={"Code"}
        icon={icons.lock}
        placeholder={"12345"}
        value={verification.code}
        keyboardType="numeric"
        onChangeText={(code) => setVerification({ ...verification, code })}
        iconStyle="mt-3 mr-3"
        maxLength={6}
        accessibilityLabel="Enter verification code"
      />
      {verification.error && (
        <Text className="text-red-500 text-sm mt-1">
          {verification.error}
        </Text>
      )}
      <CustomButton
        title="Verify Email"
        onPress={onVerifyPress}
        className="mt-5 bg-success-500"
        accessibilityLabel="Verify Email Button"
        disabled={verification.code.length < 6} // Disable until 6 digits are entered
      />
    </View>
  </View>
</Modal>

{/* نافذة النجاح */}
<Modal
  key="success-modal"
  visible={showSuccessModal}
  transparent={true} // لجعل الخلفية شفافة
  animationType="slide" // لإضافة رسوم متحركة
  onRequestClose={() => {
    console.log("Success modal hidden"); // Debugging
  }}
>
  <View className="flex-1 justify-center items-center bg-black/50">
    <View className="bg-white p-7 rounded-2xl min-h-[300px] w-11/12">
      <Image
        source={images.check}
        className="w-[110px] h-[110px] mx-auto my-5"
        accessibilityLabel="Success check icon"
      />
      <Text className="text-3xl font-JakartaBold text-center">
        Verified
      </Text>
      <Text className="text-base text-gray-400 font-Jakarta text-center mt-2">
        You have successfully verified your account.
      </Text>
      <CustomButton
        title="Browse Home"
        onPress={() => {
          setShowSuccessModal(false);
          router.push("/home");
        }}
        className="mt-5"
        accessibilityLabel="Navigate to Home"
      />
    </View>
  </View>
</Modal>


      </View>
    </ScrollView>
  );
};

export default SignUp;