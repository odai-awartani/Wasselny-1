import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { icons } from '@/constants';
import Header from '@/components/Header';
import { useLanguage } from '@/context/LanguageContext';
import InputField from '@/components/InputField';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToCloudinary } from '@/lib/upload';
import { Picker } from '@react-native-picker/picker';

interface CityData {
  ar: string;
  barriers: {
    en: string;
    ar: string;
  }[];
}

interface PalestinianCities {
  [key: string]: CityData;
}

interface BarrierFormData {
  city: string;
  barrier: string;
  status: 'open' | 'closed' | 'open_inward' | 'open_outward' | 'closed_inward' | 'closed_outward' | 'crisis_inward' | 'crisis_outward' | 'heavy_traffic' | 'open_with_id_check' | 'open_with_random_check' | 'settler_presence' | 'heavy_traffic_with_police';
  description: string;
  imageUrl: string | null;
}

const STATUS_OPTIONS = {
  open: {
    en: 'Open',
    ar: 'مفتوح',
    color: '#22c55e'
  },
  closed: {
    en: 'Closed',
    ar: 'مغلق',
    color: '#ef4444'
  },
  open_inward: {
    en: 'Open Inward',
    ar: 'مفتوح للداخل',
    color: '#22c55e'
  },
  open_outward: {
    en: 'Open Outward',
    ar: 'مفتوح للخارج',
    color: '#22c55e'
  },
  closed_inward: {
    en: 'Closed Inward',
    ar: 'مغلق للداخل',
    color: '#ef4444'
  },
  closed_outward: {
    en: 'Closed Outward',
    ar: 'مغلق للخارج',
    color: '#ef4444'
  },
  crisis_inward: {
    en: 'Crisis Inward',
    ar: 'ازمة للداخل',
    color: '#dc2626'
  },
  crisis_outward: {
    en: 'Crisis Outward',
    ar: 'ازمة للخارج',
    color: '#dc2626'
  },
  heavy_traffic: {
    en: 'Heavy Traffic',
    ar: 'كثافة سير',
    color: '#f97316'
  },
  open_with_id_check: {
    en: 'Open with ID Check',
    ar: 'مفتوح مع تفتيش هويات',
    color: '#f59e0b'
  },
  open_with_random_check: {
    en: 'Open with Random Check',
    ar: 'مفتوح مع تفتيش عشوائي',
    color: '#f59e0b'
  },
  settler_presence: {
    en: 'Settler Presence',
    ar: 'تواجد مستوطنين',
    color: '#dc2626'
  },
  heavy_traffic_with_police: {
    en: 'Heavy Traffic with Police',
    ar: 'كثافة سير وشرطة',
    color: '#dc2626'
  }
};

const PALESTINIAN_CITIES: PalestinianCities = {
  'Nablus': {
    ar: 'نابلس',
    barriers: [
        { en: 'Sarra', ar: 'صرة' },
        { en: 'Checkpoint 17', ar: 'حاجز ال17'},
        { en: 'Aserah Al-Masaken', ar: ' عصيرة المساكن'},
        { en: 'Al-Murabba\'a', ar: 'المربعة' },
        { en: 'Awarta', ar: 'عورتا' },
        { en: 'Yitzhar-Jit', ar: 'يتسهار-جيت' },
        { en: 'Al-Taneeb', ar: 'الطنيب' },
        { en: 'Deir Sharaf', ar: 'دير شرف' },
        { en: 'Shavei Shomron', ar: 'شافي شومرون' },
        { en: 'Bezzaria', ar: 'بزاريا' },
        { en: 'Beit Furik', ar: 'بيت فوريك' },
        { en: 'Hajez Huwwara', ar: 'حاجز حوارة' },
        { en: 'Al-Badan', ar: 'الباذان' },
        { en: 'Jamma\'in', ar: 'جماعين' },
        { en: 'Jeser-Huwwara', ar: 'جسر-حوارة' },
        { en: 'Huwwara-Aljaded', ar: 'حوارة-الجديد' },
        { en: 'Zaatara', ar: 'زعترة' },
        { en: 'Aqraba', ar: 'عقربا' },
        { en: 'Yitzhar', ar: 'يتسهار' },
        { en: 'Huwwara Albalad', ar: 'حوارة البلد' },
        { en: 'Audala', ar: 'اودلا' },
        { en: 'Beita', ar: 'بيتا' },
        { en: 'Jureish', ar: 'جوريش' },
        { en: 'Al-sawieh', ar: 'الساوية' },
        { en: 'Al-Tur', ar: 'الطور' },
        { en: 'Al-Lubban Al-Sharqiya', ar: 'اللبن الشرقية' },
        { en: 'Burin', ar: 'بورين' },
        { en: 'Majdal Bani Fadil', ar: 'مجدل بني فاضل' },
        { en: 'Einabus', ar: 'عينابوس' },
        { en: 'Burqa', ar: 'برقة' },
        { en: 'Qabalan', ar: 'قبلان' },
        { en: 'Duma', ar: 'دومة' },
        { en: 'Qusra', ar: 'قصرة' },
    ]
  },
  'Jerusalem': {
    ar: 'القدس',
    barriers: [
      { en: 'Qalandiya', ar: 'قلنديا' },
      { en: 'Container', ar: 'الكونتينر' },
      { en: 'Hizma', ar: 'حزما' },
      { en: 'Ras Khamis', ar: 'رأس خميس' },
      { en: 'Ras Shehada', ar: 'رأس شحادة' },
      { en: 'Al-Ram', ar: 'الرام' },
      { en: 'Beit Hanina', ar: 'بيت حنينا' },
      { en: 'Shuafat', ar: 'شعفاط' },
      { en: 'Jabal Al-Mukaber', ar: 'جبل المكبر' },
      { en: 'Silwan', ar: 'سلوان' },
      { en: 'Al-Tur', ar: 'الطور' },
      { en: 'Al-Issawiya', ar: 'العيساوية' },
      { en: 'Wadi Al-Joz', ar: 'وادي الجوز' },
    ]
  },
  'Ramallah': {
    ar: 'رام الله',
    barriers: [
        { en: 'DCO', ar: 'دي سي او' },
        { en: 'Beit El', ar: 'بيت ايل' },
        { en: 'Jalazone', ar: 'الجلزون' },
        { en: 'Ein Sina', ar: 'عين سينا' },
        { en: 'Mekhmas', ar: 'مخماس' },
        { en: 'Eion Al haramieh ', ar: ' عيون الحرامية' },
        { en: 'Atara', ar: 'عطارة' },
        { en: 'Rawabie', ar: 'روابي' },
        { en: 'Dir Ballout', ar: 'دير بلوط' },
        { en: 'Turmus\'ayya', ar: 'ترمس عيا' },
        { en: 'Eely', ar: 'عيلي' },
        { en: 'Sinjil', ar: 'سنجل' },
        { en: 'Aufara', ar: 'عوفرا' },
        { en: 'Karmelo', ar: 'كرملو' },
        { en: 'Aabood', ar: 'عابود' },
        { en: 'Ein Yabrud', ar: 'عين عبرود' },
        { en: 'Deir Abu Mash\'al', ar: 'دير ابو مشعل' },
        { en: 'Al nabi saleh', ar: 'النبي صالح' },
        { en: 'Silwad', ar: 'سلواد' },
        { en: 'Qalandiya', ar: 'قلنديا' },
        { en: 'Surda', ar: 'سردا' },
        { en: 'Ein Yabrud', ar: 'عين عبرود' },
        { en: 'Ein Arik', ar: 'عين عريك' },
        { en: 'Beit Sira', ar: 'بيت سيرا' },
        { en: 'Deir Qaddis', ar: 'دير قديس' },
        { en: 'Kafr Ni\'ma', ar: 'كفر نعمة' },
    ]
  },
  'Bethlehem': {
    ar: 'بيت لحم',
    barriers: [
      { en: 'Rachel\'s Tomb', ar: 'قبة الرشيد' },
      { en: 'Gilo', ar: 'جيلو' },
      { en: 'Tunnel', ar: 'القنطرة' },
      { en: 'Al-Khader', ar: 'الخضر' },
      { en: 'Beit Jala', ar: 'بيت جالا' },
      { en: 'Beit Sahour', ar: 'بيت ساحور' },
      { en: 'Al-Ma\'sara', ar: 'المسارة' },
      { en: 'Artas', ar: 'عرضة' },
      { en: 'Battir', ar: 'بتير' },
      { en: 'Husan', ar: 'هوسان' },
      { en: 'Nahhalin', ar: 'نحالين' },

    ]
  },
  'Hebron': {
    ar: 'الخليل',
    barriers: [
      { en: 'Shuhada Street', ar: 'شوهدة الشارع' },
      { en: 'Al-Haram Al-Ibrahimi', ar: 'الحرم الإبراهيمي' },
      { en: 'Tel Rumeida', ar: 'تل رميدة' },
      { en: 'Al-Salaymeh', ar: 'السليمة' },
      { en: 'Al-Shuhada', ar: 'الشهدة' },
      { en: 'Al-Haram', ar: 'الحرم' },
      { en: 'Al-Sahla', ar: 'السهلة' },
      { en: 'Al-Sala\'a', ar: 'السلعة' },
      { en: 'Al-Qasaba', ar: 'القصبة' },
      { en: 'Al-Sheikh', ar: 'الشيخ' },
      { en: 'Al-Baladiya', ar: 'البلدية' },
      { en: 'Al-Haras', ar: 'الحرس' },

    ]
  },
  'Jenin': {
    ar: 'جنين',
    barriers: [

      { en: 'Al-Jalama', ar: 'الجلمة' },
      { en: 'Homesh', ar: 'حومش' },
      { en: 'Bezzaria', ar: 'بزاريا' },
      { en: 'Al-Selih', ar: 'السيلة' },
      { en: 'Dotan', ar: 'دوتان' },
      { en: 'Harmeesh', ar: 'حرميش' },
      { en: 'Al-Zababda', ar: 'الزبابدة' },
      { en: 'Attara', ar: 'عطارة' },
      { en: 'Al-Fandaqumiya', ar: 'الفندقية' },
      { en: 'Al-Mughayyir', ar: 'المغير' },
      { en: 'Arraba', ar: 'عرابة' },
    ]
  },
  'Tulkarm': {
    ar: 'طولكرم',
    barriers: [
      { en: 'Ennab', ar: 'عناب' },
      { en: 'Jbarin', ar: 'جبارة' },
      { en: 'Bet Lid', ar: 'بيت ليد' },
      { en: 'Wad Qana', ar: 'وادي قانا' },
      { en: 'Saffaren', ar: 'سفارين' },
      { en: 'Rameen', ar: 'رامين' },
      { en: 'Azba-shofa', ar: 'عزبة شوفة' },
      { en: 'Sahel Rameen', ar: 'سهل رامين' },
    ]
  },
  'Qalqilya': {
    ar: 'قلقيلية',
    barriers: [
        { en: 'Hajjah', ar: 'حجة' },
        { en: 'Al-Funduq', ar: 'الفندق' },
        { en: 'Qalqilya Entrance', ar: 'مدخل قلقيلية' },
        { en: 'Izbet Al-Tabib (Main Entrance)', ar: 'عزبة الطبيب (المدخل الرئيسي)' },
        { en: 'D.C.O', ar: 'دي سي او' },
        { en: 'Al-Funduq (Main Entrance)', ar: 'الفندق (المدخل الرئيسي)' },
        { en: 'Al-Funduq (Alternative Entrance)', ar: 'الفندق (المدخل البديل)' },
        { en: 'Sofin', ar: 'سوفين' },
        { en: 'Jaljulia / Haberut 109', ar: 'جلجولية / حابروت 109' },
        { en: 'Kafr Qasim / Kafr Ein', ar: 'كفر قاسم / كفر عين' },
        { en: 'Azzun (North Entrance)', ar: 'عزون (المدخل الشمالي)' },
        { en: 'Jinsafut (North-West Entrance)', ar: 'جينصافوط (المدخل الشمالي الغربي)' },
        { en: 'Kafr Laqif (South Entrance)', ar: 'كفر لاقف (المدخل الجنوبي)' },
        { en: 'Azzun', ar: 'عزون' },
        { en: 'Kafr Laqif', ar: 'كفر لاقف' },
        { en: 'Jinsafut', ar: 'جينصافوط' },
        { en: 'Wadi Qana', ar: 'وادي قانا' }

  
  
    ]
  },
  'Salfit': {
    ar: 'سلفيت',
    barriers: [
        { en: 'Bruqin', ar: 'برقين' },
        { en: 'Northern Salfit', ar: 'سلفيت الشمالي' },
        { en: 'Southern Salfit', ar: 'سلفيت الجنوبي' },
        { en: 'Ara\'el', ar: 'ارائيل' },
        { en: 'Haris', ar: 'حارس' },
        { en: 'Qadommem', ar: 'قدوميم' },
        { en: 'Wad Qana', ar: 'وادي قانا' },
        { en: 'Deir Estia', ar: 'دير استيا' },
        { en: 'Kafr Aldeek', ar: 'كفر الديك' },
        { en: 'Yasuf', ar: 'ياسوف' },
        { en: 'Marda', ar: 'مردا' },
        { en: 'Kifl Haris', ar: 'كفر حارس' },
    ]
  },
  'Jericho': {
    ar: 'أريحا',
    barriers: [
      { en: 'Al-Hamra', ar: 'الحمرا' },
      { en: 'Ma\'ali afraim', ar: 'معالي افرايم' },
      { en: 'Al-90', ar: 'خط 90' },
      { en: 'Al- Moaaraja', ar: 'المعرجات' },
      { en: 'DCO', ar: 'دي سي او' },
      { en: 'Yellow Gate', ar: 'البوابة الصفراء' },
      { en: 'Al-Haiaa ', ar: 'حاجز الهيئة' },
      { en: 'Al-Banan ', ar: 'حاجز البنانا' },
      { en: 'Al-Auja', ar: 'العوجة' },
      { en: 'Esh Al-Gharab', ar: 'عش الغراب' },
    ]
  },
  'Tubas': {
    ar: 'طوباس',
    barriers: [
      { en: 'Al-Hamra', ar: 'الحمرا' },
      { en: 'Al-Taybeh', ar: 'الطيبة' },
      { en: 'Tammun', ar: 'طمون' },
      { en: 'Tayasir', ar: 'تياسير' },
      { en: 'Wadi Al-Far\'a', ar: 'وادي الفرعة' }
    ]
  }
};

const AddBarrier = () => {
  const router = useRouter();
  const { t, language } = useLanguage();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<BarrierFormData>({
    city: '',
    barrier: '',
    status: 'open',
    description: '',
    imageUrl: null,
  });

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        const uploadedImageUrl = await uploadImageToCloudinary(result.assets[0].uri);
        setFormData(prev => ({ ...prev, imageUrl: uploadedImageUrl }));
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء اختيار الصورة' : 'Error selecting image'
      );
    }
  };

  const handleSubmit = async () => {
    if (!formData.city || !formData.barrier) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Warning',
        language === 'ar' ? 'يرجى اختيار المدينة والحاجز' : 'Please select city and barrier'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const timestamp = Date.now(); // Get current timestamp in milliseconds
      const now = new Date();
      const firestoreTimestamp = {
        seconds: Math.floor(now.getTime() / 1000),
        nanoseconds: (now.getTime() % 1000) * 1000000
      };

      const barriersRef = collection(db, 'barriers');
      
      // Check if barrier already exists
      const q = query(
        barriersRef,
        where('city', '==', formData.city),
        where('barrier', '==', formData.barrier)
      );
      
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Barrier exists, update it
        const barrierDoc = querySnapshot.docs[0];
        const currentData = barrierDoc.data();
        
        // Create update history entry
        const updates = currentData.updates || [];
        updates.push({
          status: currentData.status,
          description: currentData.description,
          updated_at: currentData.updated_at
        });

        // Update the barrier
        await updateDoc(doc(db, 'barriers', barrierDoc.id), {
          status: formData.status,
          description: formData.description,
          imageUrl: formData.imageUrl,
          updated_at: firestoreTimestamp,
          timestamp: timestamp, // Add unique timestamp
          updates: updates
        });
      } else {
        // Create new barrier
        await addDoc(barriersRef, {
          city: formData.city,
          barrier: formData.barrier,
          status: formData.status,
          description: formData.description,
          imageUrl: formData.imageUrl,
          created_at: firestoreTimestamp,
          updated_at: firestoreTimestamp,
          timestamp: timestamp, // Add unique timestamp
          updates: []
        });
      }

      Alert.alert(
        language === 'ar' ? 'نجاح' : 'Success',
        language === 'ar' ? 'تم تحديث حالة الحاجز بنجاح' : 'Barrier status updated successfully',
        [
          {
            text: language === 'ar' ? 'حسناً' : 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error updating barrier:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تحديث حالة الحاجز' : 'Error updating barrier status'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: '#f4f4f4' }}>
      <Header pageTitle={language === 'ar' ? 'تحديث حالة الحاجز' : 'Update Barrier Status'} />
      <View className="px-4 py-2 border-b border-gray-200 bg-white">
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.back();
          }}
          className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <Image
            source={icons.backArrow}
            style={[
              { width: 20, height: 20, tintColor: '#374151' },
              language === 'ar' ? { transform: [{ rotate: '180deg' }] } : {}
            ]}
          />
          <Text className={`${language === 'ar' ? 'mr-2' : 'ml-2'} text-gray-700 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
            {language === 'ar' ? 'العودة' : 'Back'}
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 100,
        }}
      >
        <View className="px-4 py-4">
          {/* Step 1: City Selection */}
          <View className="mb-4">
            <Text className={`text-gray-700 mb-2 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
              {language === 'ar' ? 'الخطوة 1: اختر المدينة' : 'Step 1: Select City'}
            </Text>
            <View className="bg-white rounded-lg border border-gray-200">
              <Picker
                selectedValue={formData.city}
                onValueChange={(value) => {
                  setFormData(prev => ({ ...prev, city: value, barrier: '' }));
                }}
                style={{
                  height: 50,
                  color: '#374151',
                }}
              >
                <Picker.Item 
                  label={language === 'ar' ? 'اختر المدينة' : 'Select City'} 
                  value="" 
                  color="#9CA3AF"
                />
                {Object.entries(PALESTINIAN_CITIES).map(([city, data]) => (
                  <Picker.Item
                    key={city}
                    label={language === 'ar' ? data.ar : city}
                    value={city}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Step 2: Barrier Selection */}
          {formData.city && (
            <View className="mb-4">
              <Text className={`text-gray-700 mb-2 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                {language === 'ar' ? 'الخطوة 2: اختر الحاجز' : 'Step 2: Select Barrier'}
              </Text>
              <View className="bg-white rounded-lg border border-gray-200">
                <Picker
                  selectedValue={formData.barrier}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, barrier: value }))}
                  style={{
                    height: 50,
                    color: '#374151',
                  }}
                >
                  <Picker.Item 
                    label={language === 'ar' ? 'اختر الحاجز' : 'Select Barrier'} 
                    value="" 
                    color="#9CA3AF"
                  />
                  {PALESTINIAN_CITIES[formData.city]?.barriers.map((barrier) => (
                    <Picker.Item
                      key={barrier.en}
                      label={language === 'ar' ? barrier.ar : barrier.en}
                      value={barrier.en}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          {/* Step 3: Status Selection */}
          {formData.barrier && (
            <View className="mb-4">
              <Text className={`text-gray-700 mb-2 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                {language === 'ar' ? 'الخطوة 3: اختر الحالة' : 'Step 3: Select Status'}
              </Text>
              <View className="flex-row flex-wrap justify-between">
                {Object.entries(STATUS_OPTIONS).map(([status, data]) => (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setFormData(prev => ({ ...prev, status: status as BarrierFormData['status'] }))}
                    className={`w-[48%] mb-2 p-3 rounded-lg border ${
                      formData.status === status
                        ? 'border-transparent'
                        : 'bg-white border-gray-200'
                    }`}
                    style={{
                      backgroundColor: formData.status === status ? data.color : 'white',
                    }}
                  >
                    <Text
                      className={`text-center ${
                        formData.status === status
                          ? 'text-white'
                          : 'text-gray-700'
                      } ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}
                    >
                      {language === 'ar' ? data.ar : data.en}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 4: Additional Details */}
          {formData.barrier && (
            <>
              <InputField
                label={language === 'ar' ? 'الوصف' : 'Description'}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder={language === 'ar' ? 'أدخل وصفاً للحالة' : 'Enter status description'}
                multiline
                numberOfLines={4}
                style={{
                  fontFamily: language === 'ar' ? 'Cairo-Bold' : 'JakartaBold',
                  textAlign: language === 'ar' ? 'right' : 'left',
                  backgroundColor: 'white',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 3,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#e5e5e5',
                }}
              />

              <TouchableOpacity
                onPress={handleImagePick}
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                style={{
                  elevation: Platform.OS === 'android' ? 3 : 0,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 3,
                }}
              >
                <Text className={`text-center ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                  {formData.imageUrl
                    ? language === 'ar'
                      ? 'تغيير الصورة'
                      : 'Change Image'
                    : language === 'ar'
                    ? 'إضافة صورة'
                    : 'Add Image'}
                </Text>
              </TouchableOpacity>

              {formData.imageUrl && (
                <Image
                  source={{ uri: formData.imageUrl }}
                  className="w-full h-48 rounded-xl mb-4"
                  resizeMode="cover"
                />
              )}

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting}
                className="bg-orange-500 p-4 rounded-xl"
                style={{
                  elevation: Platform.OS === 'android' ? 3 : 0,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.15,
                  shadowRadius: 3,
                }}
              >
                <Text className={`text-white text-center ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                  {isSubmitting
                    ? language === 'ar'
                      ? 'جاري التحديث...'
                      : 'Updating...'
                    : language === 'ar'
                    ? 'تحديث الحالة'
                    : 'Update Status'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddBarrier;
