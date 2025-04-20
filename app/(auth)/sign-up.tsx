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
import { collection, addDoc, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { StatusBar } from 'expo-status-bar';


const SignUp = () => {
  const { t, language } = useLanguage();
  const { isLoaded, signUp, setActive } = useSignUp(); // استخدام useSignUp من Clerk
  const [showSuccessModal, setShowSuccessModal] = useState(false); // حالة لعرض نافذة النجاح
  const [isAgreed, setIsAgreed] = useState(false);
  const [form, setForm] = useState({
    phoneNumber: '',
    name: '',
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
  const formatPhoneNumber = (phoneNumber: string) => {
    // إذا كان رقم الجوال يبدأ بـ +972، اتركه كما هو
    if (phoneNumber.startsWith('+972')) {
      return phoneNumber;
    }
    // إذا كان رقم الجوال يبدأ بـ 0، استبدل الصفر بـ +972
    if (phoneNumber.startsWith('0')) {
      return `+972${phoneNumber.slice(1)}`;
    }
    // إذا كان رقم الجوال لا يحتوي على مفتاح الدولة، أضف +972
    return `+972${phoneNumber}`;
  };
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [showIndustryModal, setShowIndustryModal] = useState(false);

  const genders = t.genders; // الجنس بالعربية
  const industries = t.industries; // المجالات بالعربية
// done
const genderMap = new Map([
  ['ذكر', 'Male'],
  ['أنثى', 'Female'],
]);

const industryMap = new Map([
  ['طالب', 'Student'],
  ['موظف', 'Employee'],
  ['أعمال حرة', 'Freelancer'],
  ['مهندس', 'Engineer'],
  ['طبيب', 'Doctor'],
  ['معلم', 'Teacher'],
  ['محاسب', 'Accountant'],
  ['مطور برمجيات', 'Software Developer'],
  ['تاجر', 'Merchant'],
  ['عامل في الصحة', 'Healthcare Worker'],
]);
  const onSignUpPress = async () => {
    if (!isLoaded) return;
    if (!isAgreed) {
      Alert.alert(t.error, t.agreeToTermsAlert);
      return;
    }
    
    
    if (!form.email || !form.password || !form.name || !form.phoneNumber || !form.gender || !form.workIndustry) {
      Alert.alert(t.error, t.fillAllFields);
      return;
    }

    
    try {

      
      const formattedPhoneNumber = formatPhoneNumber(form.phoneNumber);
        // تحويل الجنس والمجال إلى الإنجليزية
    const englishGender = genderMap.get(form.gender) || form.gender;
    const englishIndustry = industryMap.get(form.workIndustry) || form.workIndustry;
  

      // Create a new user with Clerk
      await signUp.create({
      emailAddress: form.email,
      password: form.password,
      firstName: form.name.split(' ')[0],
      lastName: form.name.split(' ')[1] || '',
      // إضافة الجنس والمجال إلى البيانات الإضافية (إذا كان مدعومًا)
      unsafeMetadata: {
        gender: englishGender,
        workIndustry: englishIndustry,
        phoneNumber: formattedPhoneNumber, // تخزين رقم الجوال المنسق

      },
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
        const formattedPhoneNumber = formatPhoneNumber(form.phoneNumber);
        const englishGender = genderMap.get(form.gender) || form.gender;
        const englishIndustry = industryMap.get(form.workIndustry) || form.workIndustry;
  
        console.log('Sending data to API:', {
          name: form.name,
          email: form.email,
          phone: formattedPhoneNumber,
          gender: englishGender,
          industry: englishIndustry,
          clerkId: completeSignUp.createdUserId,
        });
  
        // Use setDoc with Clerk ID as document ID
        await setDoc(doc(db, "users", completeSignUp.createdUserId), {
          name: form.name,
          email: form.email,
          phone: formattedPhoneNumber,
          gender: englishGender,
          industry: englishIndustry,
          clerkId: completeSignUp.createdUserId,
          createdAt: new Date().toISOString(),
        });
  
        console.log('User data successfully saved!');
  
        await setActive({ session: completeSignUp.createdSessionId });
        setVerification((prev) => ({ ...prev, state: 'success' }));
        setShowSuccessModal(true);
      } else {
        setVerification({
          ...verification,
          error: "Verification failed. Please try again.",
          state: "failed",
        });
      }
    } catch (err: any) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
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
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
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
        <Text className={`text-sm text-gray-600 ${language === 'ar' ? 'text-right pr-1 font-CairoBold' : 'text-left pr-1 font-JakartaBold'} `}>{t.agreeToTerms}</Text>
      </View>
          {/* زر التسجيل */}
          <View className="items-center">
            <CustomButton
              title={t.signUpButton}
              onPress={onSignUpPress}
              
              
            />
       


            {/* رابط الانتقال إلى تسجيل الدخول */}
 <Link href="/(auth)/sign-in" className={`text-lg text-center text-general-200 mt-4 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
               <Text>{t.alreadyHaveAccount}</Text>
              <Text className="text-orange-500"> {t.logIn}</Text>
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
      <Text className={`${language === 'ar' ? 'text-right font-CairoExtraBold' : 'text-left font-JakartaExtraBold'} text-2xl mb-2`}>
        {t.Verification}
      </Text>
  <Text className={`${language === 'ar' ? 'text-right font-CairoMedium' : 'text-left font-Jakarta '} text-lg mb-5`}>
        {t.SendVCode}{form.email}.
      </Text>
      <InputField
        label={t.Code}
        icon={icons.lock}
        placeholder={"12345"}
        value={verification.code}
        keyboardType="numeric"
        onChangeText={(code) => setVerification({ ...verification, code })}
        iconStyle="mt-3 mr-3"
        maxLength={6}
        accessibilityLabel="Enter verification code"
        labelStyle={language === 'ar' ? 'text-right font-CairoBold ' : 'text-left font-JakartaBold '}

      />
      {verification.error && (
        <Text className="text-red-500 text-sm mt-1">
          {verification.error}
        </Text>
      )}
      <CustomButton
        title={t.VerifyEmail}
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
      <Text className={`text-3xl ${language === 'ar' ? 'font-CairoBold pt-3' : 'font-JakartaBold'} text-center`}>
        {t.verified}
      </Text>
      <Text className={`text-base text-gray-400 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} text-center mt-2`}>
        {t.verificationSuccess}
      </Text>
      <CustomButton
        title={t.browseHome}
        onPress={() => {
          setShowSuccessModal(false);
          router.replace("/home");
        }}
        className="mt-5"
     

        accessibilityLabel="Navigate to Home"
        
      />
    </View>
  </View>
</Modal>


      </View>
    <StatusBar backgroundColor="#fff" style="dark" />
      
    </ScrollView>

  );
};

export default SignUp;