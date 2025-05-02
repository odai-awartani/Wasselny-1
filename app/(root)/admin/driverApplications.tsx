import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, addDoc } from 'firebase/firestore';
import { useUser } from '@clerk/clerk-expo';
import CustomButton from '@/components/CustomButton';
import { icons } from '@/constants';
import { router } from 'expo-router';

interface DriverApplication {
  id: string;
  car_type: string;
  car_image_url: string;
  profile_image_url: string;
  car_seats: number;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  user_id: string;
  user_name: string;
  user_email: string;
}

const DriverApplications = () => {
  const { user } = useUser();
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<DriverApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user?.id) {
      router.replace('/(auth)/sign-in');
      return;
    }

    try {
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin') {
          setIsAdmin(true);
          fetchApplications();
        } else {
          Alert.alert('غير مصرح', 'ليس لديك صلاحية الوصول إلى هذه الصفحة');
          router.replace('/(root)/(tabs)/home');
        }
      } else {
        Alert.alert('غير مصرح', 'ليس لديك صلاحية الوصول إلى هذه الصفحة');
        router.replace('/(root)/(tabs)/home');
      }
    } catch (error) {
      console.error('Error checking admin access:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء التحقق من الصلاحيات');
      router.replace('/(root)/(tabs)/home');
    }
  };

  const fetchApplications = async () => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('driver.status', '==', 'pending'));
      const querySnapshot = await getDocs(q);
      
      const pendingApplications: DriverApplication[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.driver) {
          pendingApplications.push({
            id: doc.id,
            ...data.driver
          });
        }
      });
      
      setApplications(pendingApplications);
    } catch (error) {
      console.error('Error fetching applications:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء جلب طلبات السائقين');
    } finally {
      setLoading(false);
    }
  };

  const handleApplication = async (applicationId: string, action: 'approve' | 'reject') => {
    if (action === 'reject') {
      const application = applications.find(app => app.id === applicationId);
      if (application) {
        setSelectedApplication(application);
        setShowRejectionModal(true);
      }
      return;
    }

    try {
      const userRef = doc(db, 'users', applicationId);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data();
      
      await updateDoc(userRef, {
        'driver.status': 'approved',
        'driver.is_active': true,
        'driver.rejection_reason': null
      });

      // Create notification for the user
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        type: 'driver_status',
        title: 'تم قبول طلبك كسائق',
        message: 'مبروك! تم قبول طلبك للتسجيل كسائق في تطبيق وصلني. يمكنك الآن البدء في تقديم خدمات النقل.',
        created_at: new Date(),
        read: false,
        user_id: applicationId,
        data: {
          status: 'approved'
        }
      });

      // Refresh the applications list
      await fetchApplications();

      Alert.alert('نجاح', 'تم قبول طلب السائق بنجاح');
    } catch (error) {
      console.error('Error handling application:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء معالجة الطلب');
    }
  };

  const handleReject = async () => {
    if (!selectedApplication || !rejectionReason.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال سبب الرفض');
      return;
    }

    try {
      const userRef = doc(db, 'users', selectedApplication.id);
      await updateDoc(userRef, {
        'driver.status': 'rejected',
        'driver.is_active': false,
        'driver.rejection_reason': rejectionReason.trim()
      });

      // Create notification for the user
      const notificationsRef = collection(db, 'notifications');
      await addDoc(notificationsRef, {
        type: 'driver_status',
        title: 'تم رفض طلبك كسائق',
        message: `تم رفض طلبك للتسجيل كسائق للأسباب التالية:\n${rejectionReason.trim()}\n\nيمكنك تعديل بياناتك وإعادة التقديم.`,
        created_at: new Date(),
        read: false,
        user_id: selectedApplication.id,
        data: {
          status: 'rejected',
          rejection_reason: rejectionReason.trim()
        }
      });

      // Refresh the applications list
      await fetchApplications();

      // Reset modal state
      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedApplication(null);

      Alert.alert('نجاح', 'تم رفض طلب السائق بنجاح');
    } catch (error) {
      console.error('Error rejecting application:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء رفض الطلب');
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg font-CairoBold">جاري التحقق من الصلاحيات...</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <Text className="text-lg font-CairoBold">جاري التحميل...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-4 py-4">
        <Text className="text-2xl font-CairoBold text-right mb-4">
          طلبات السائقين
        </Text>
      </View>

      <ScrollView className="flex-1 px-4">
        {applications.length === 0 ? (
          <View className="flex-1 items-center justify-center py-8">
            <Text className="text-lg text-gray-500">لا توجد طلبات جديدة</Text>
          </View>
        ) : (
          applications.map((application) => (
            <View 
              key={application.id}
              className="bg-white rounded-xl p-4 mb-4 shadow-sm border border-gray-100"
            >
              <View className="flex-row items-center mb-4">
                <Image
                  source={{ uri: application.profile_image_url }}
                  className="w-16 h-16 rounded-full"
                />
                <View className="flex-1 mr-4">
                  <Text className="text-lg font-CairoBold">
                    {application.user_name}
                  </Text>
                  <Text className="text-gray-500">{application.user_email}</Text>
                </View>
              </View>

              <View className="space-y-2 mb-4">
                <View className="flex-row justify-between">
                  <Text className="text-gray-500">نوع السيارة:</Text>
                  <Text className="font-CairoMedium">{application.car_type}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-500">عدد المقاعد:</Text>
                  <Text className="font-CairoMedium">{application.car_seats}</Text>
                </View>
                <View className="flex-row justify-between">
                  <Text className="text-gray-500">تاريخ التقديم:</Text>
                  <Text className="font-CairoMedium">
                    {new Date(application.created_at).toLocaleDateString('ar-SA')}
                  </Text>
                </View>
              </View>

              <Image
                source={{ uri: application.car_image_url }}
                className="w-full h-48 rounded-lg mb-4"
                resizeMode="cover"
              />

              <View className="flex-row justify-between">
                <CustomButton
                  title="رفض"
                  onPress={() => handleApplication(application.id, 'reject')}
                  bgVariant="danger"
                  className="flex-1 mr-2"
                />
                <CustomButton
                  title="قبول"
                  onPress={() => handleApplication(application.id, 'approve')}
                  bgVariant="success"
                  className="flex-1 ml-2"
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Rejection Modal */}
      <Modal
        visible={showRejectionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowRejectionModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white w-11/12 rounded-xl p-6">
            <Text className="text-xl font-CairoBold text-right mb-4">
              سبب رفض الطلب
            </Text>
            
            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="أدخل سبب رفض الطلب"
              multiline
              numberOfLines={4}
              className="border border-gray-300 rounded-lg p-3 text-right mb-4"
              textAlignVertical="top"
            />

            <View className="flex-row justify-between">
              <CustomButton
                title="إلغاء"
                onPress={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                  setSelectedApplication(null);
                }}
                bgVariant="outline"
                className="flex-1 mr-2"
              />
              <CustomButton
                title="رفض"
                onPress={handleReject}
                bgVariant="danger"
                className="flex-1 ml-2"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default DriverApplications; 