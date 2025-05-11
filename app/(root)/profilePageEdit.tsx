// import React, { useEffect, useState } from "react";
// import { useUser, useAuth } from "@clerk/clerk-expo";
// import { Image, ScrollView, Text, View, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput, Switch, Share, Platform, Linking } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useLanguage } from '@/context/LanguageContext';
// import { AntDesign, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
// import { useRouter, Stack } from "expo-router";
// import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
// import { db } from "@/lib/firebase";
// import { uploadImageToCloudinary } from "@/lib/upload";
// import * as ImagePicker from "expo-image-picker";
// import uploadIcon from '@/assets/icons/upload.png';
// import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
// import * as Notifications from 'expo-notifications';

// interface UserData {
//   driver?: {
//     is_active: boolean;
//     car_type: string;
//     car_seats: number;
//     car_image_url: string;
//     profile_image_url: string;
//     created_at: string;
//   };
//   profile_image_url?: string;
//   role?: string;
// }

// const ProfileEdit = () => {
//   const { user } = useUser();
//   const { signOut } = useAuth();
//   const { language } = useLanguage();
//   const router = useRouter();
//   const storage = getStorage();

//   const [userData, setUserData] = useState<{
//     isDriver: boolean;
//     isLoading: boolean;
//     profileImage: string | null;
//     data: UserData | null;
//     isAdmin: boolean;
//   }>({
//     isDriver: false,
//     isLoading: true,
//     profileImage: null,
//     data: null,
//     isAdmin: false,
//   });

//   const [isUploading, setIsUploading] = useState(false);
//   const [showFullImage, setShowFullImage] = useState(false);
//   const [showFullCarImage, setShowFullCarImage] = useState(false);
//   const [isRefreshing, setIsRefreshing] = useState(false);
//   const [editingField, setEditingField] = useState<string | null>(null);
//   const [editValues, setEditValues] = useState({
//     carType: '',
//     carSeats: '',
//     phoneNumber: '',
//   });

//   const [notificationsEnabled, setNotificationsEnabled] = useState(false);

//   const phoneNumber = user?.unsafeMetadata?.phoneNumber as string || "+972342423423";

//   const fetchUserData = async (isMounted = true) => {
//     if (!user?.id) {
//       if (isMounted) {
//         setUserData(prev => ({
//           ...prev,
//           isLoading: false,
//           isDriver: false,
//           profileImage: user?.imageUrl || null,
//           isAdmin: false,
//         }));
//       }
//       return;
//     }

//     try {
//       const userRef = doc(db, 'users', user.id);
//       const userDoc = await getDoc(userRef);

//       if (!isMounted) return;

//       if (userDoc.exists()) {
//         const data = userDoc.data() as UserData;
//         setUserData({
//           isDriver: !!data.driver?.is_active,
//           isLoading: false,
//           profileImage: data.driver?.profile_image_url || user?.imageUrl || null,
//           data,
//           isAdmin: data.role === 'admin',
//         });
//         setEditValues({
//           carType: data.driver?.car_type || 'Not specified',
//           carSeats: data.driver?.car_seats?.toString() || '0',
//           phoneNumber: phoneNumber,
//         });
//       } else {
//         setUserData(prev => ({
//           ...prev,
//           isDriver: false,
//           isLoading: false,
//           profileImage: user?.imageUrl || null,
//           data: null,
//           isAdmin: false,
//         }));
//         setEditValues({
//           carType: 'Not specified',
//           carSeats: '0',
//           phoneNumber: phoneNumber,
//         });
//       }
//     } catch (error) {
//       console.error('Error fetching user data:', error);
//       if (isMounted) {
//         setUserData(prev => ({
//           ...prev,
//           isDriver: false,
//           isLoading: false,
//           profileImage: user?.imageUrl || null,
//           isAdmin: false,
//         }));
//       }
//     }
//   };

//   useEffect(() => {
//     let isMounted = true;
//     fetchUserData(isMounted);

//     return () => {
//       isMounted = false;
//     };
//   }, [user?.id, user?.imageUrl]);

//   useEffect(() => {
//     checkNotificationPermission();
//   }, []);

//   const checkNotificationPermission = async () => {
//     try {
//       const { status } = await Notifications.getPermissionsAsync();
//       setNotificationsEnabled(status === 'granted');
//     } catch (error) {
//       console.log('Error checking notification permission:', error);
//     }
//   };

//   const toggleNotifications = async () => {
//     try {
//       const { status: existingStatus } = await Notifications.getPermissionsAsync();
      
//       if (existingStatus === 'granted') {
//         // If notifications are already enabled, show turn off confirmation
//         Alert.alert(
//           language === 'ar' ? 'تعطيل الإشعارات' : 'Disable Notifications',
//           language === 'ar' 
//             ? 'هل أنت متأكد أنك تريد تعطيل الإشعارات؟' 
//             : 'Are you sure you want to disable notifications?',
//           [
//             {
//               text: language === 'ar' ? 'إلغاء' : 'Cancel',
//               style: 'cancel',
//             },
//             {
//               text: language === 'ar' ? 'تعطيل' : 'Disable',
//               onPress: () => {
//                 setNotificationsEnabled(false);
//                 // Open app settings to let user disable notifications
//                 Linking.openSettings();
//               },
//               style: 'destructive',
//             },
//           ]
//         );
//       } else {
//         // If notifications are disabled, show enable prompt
//         Alert.alert(
//           language === 'ar' ? 'تفعيل الإشعارات' : 'Enable Notifications',
//           language === 'ar' 
//             ? 'هل تريد تلقي إشعارات لتتبع رحلاتك وتحديثاتها؟' 
//             : 'Would you like to receive notifications to track your rides and updates?',
//           [
//             {
//               text: language === 'ar' ? 'لا تسمح' : "Don't Allow",
//               style: 'cancel',
//             },
//             {
//               text: language === 'ar' ? 'السماح' : 'Allow',
//               onPress: async () => {
//                 const { status } = await Notifications.requestPermissionsAsync();
//                 if (status === 'granted') {
//                   setNotificationsEnabled(true);
//                   // Register for push notifications here
//                   const token = await Notifications.getExpoPushTokenAsync({
//                     projectId: 'your-project-id' // Replace with your Expo project ID
//                   });
//                   console.log('Expo push token:', token);
//                   // Here you would typically send this token to your backend
//                 } else {
//                   setNotificationsEnabled(false);
//                 }
//               },
//             },
//           ]
//         );
//       }
//     } catch (error) {
//       console.log('Error toggling notifications:', error);
//       Alert.alert(
//         language === 'ar' ? 'خطأ' : 'Error',
//         language === 'ar' 
//           ? 'حدث خطأ أثناء تحديث إعدادات الإشعارات' 
//           : 'There was an error updating notification settings'
//       );
//     }
//   };

//   const handleEditField = async (field: string) => {
//     if (!user?.id) return;

//     try {
//       const userRef = doc(db, 'users', user.id);
//       if (field === 'carType') {
//         await updateDoc(userRef, { 'driver.car_type': editValues.carType });
//         setUserData(prev => {
//           if (!prev.data?.driver) return prev;
//           return {
//             ...prev,
//             data: {
//               ...prev.data,
//               driver: {
//                 ...prev.data.driver,
//                 car_type: editValues.carType,
//               }
//             }
//           };
//         });
//       } else if (field === 'carSeats') {
//         const seats = parseInt(editValues.carSeats, 10);
//         if (isNaN(seats) || seats < 1) {
//           Alert.alert(
//             language === 'ar' ? 'خطأ' : 'Error',
//             language === 'ar' ? 'يرجى إدخال عدد مقاعد صالح' : 'Please enter a valid number of seats'
//           );
//           return;
//         }
//         await updateDoc(userRef, { 'driver.car_seats': seats });
//         setUserData(prev => {
//           if (!prev.data?.driver) return prev;
//           return {
//             ...prev,
//             data: {
//               ...prev.data,
//               driver: {
//                 ...prev.data.driver,
//                 car_seats: seats,
//               }
//             }
//           };
//         });
//       } else if (field === 'phoneNumber') {
//         await user?.update({ unsafeMetadata: { phoneNumber: editValues.phoneNumber } });
//       }

//       Alert.alert(
//         language === 'ar' ? 'نجاح' : 'Success',
//         language === 'ar' ? 'تم تحديث المعلومات بنجاح' : 'Information updated successfully'
//       );
//     } catch (error) {
//       console.error(`Error updating ${field}:`, error);
//       Alert.alert(
//         language === 'ar' ? 'خطأ' : 'Error',
//         language === 'ar' ? 'حدث خطأ أثناء تحديث المعلومات' : 'Error updating information'
//       );
//     } finally {
//       setEditingField(null);
//     }
//   };

//   const handleImagePick = async () => {
//     try {
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         allowsEditing: true,
//         aspect: [1, 1],
//         quality: 0.5,
//       });

//       if (!result.canceled) {
//         setIsUploading(true);
//         const response = await fetch(result.assets[0].uri);
//         const blob = await response.blob();
//         const filename = result.assets[0].uri.substring(result.assets[0].uri.lastIndexOf('/') + 1);
//         const imageRef = storageRef(storage, `profile_images/${user?.id}/${filename}`);
//         await uploadBytes(imageRef, blob);
//         const url = await getDownloadURL(imageRef);
//         await user?.update({ unsafeMetadata: { profileImageUrl: url } });
//         setUserData(prev => ({ ...prev, profileImage: url }));
//         Alert.alert(
//           language === 'ar' ? 'نجاح' : 'Success',
//           language === 'ar' ? 'تم تحديث الصورة بنجاح' : 'Image updated successfully'
//         );
//       }
//     } catch (error) {
//       console.error('Error uploading image:', error);
//       Alert.alert(
//         language === 'ar' ? 'خطأ' : 'Error',
//         language === 'ar' ? 'حدث خطأ أثناء تحديث الصورة' : 'Error updating image'
//       );
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   const handleCarImagePick = async () => {
//     try {
//       const result = await ImagePicker.launchImageLibraryAsync({
//         mediaTypes: ImagePicker.MediaTypeOptions.Images,
//         allowsEditing: true,
//         aspect: [16, 9],
//         quality: 0.5,
//       });

//       if (!result.canceled) {
//         setIsUploading(true);
//         const response = await fetch(result.assets[0].uri);
//         const blob = await response.blob();
//         const filename = result.assets[0].uri.substring(result.assets[0].uri.lastIndexOf('/') + 1);
//         const imageRef = storageRef(storage, `car_images/${user?.id}/${filename}`);
//         await uploadBytes(imageRef, blob);
//         const url = await getDownloadURL(imageRef);
//         const userRef = doc(db, 'users', user?.id || '');
//         await updateDoc(userRef, {
//           'driver.car_image_url': url
//         });
//         setUserData(prev => {
//           if (!prev.data) return prev;
//           return {
//             ...prev,
//             data: {
//               ...prev.data,
//               driver: {
//                 ...prev.data.driver,
//                 car_image_url: url,
//                 is_active: prev.data.driver?.is_active || false,
//                 car_type: prev.data.driver?.car_type || '',
//                 car_seats: prev.data.driver?.car_seats || 0,
//                 profile_image_url: prev.data.driver?.profile_image_url || '',
//                 created_at: prev.data.driver?.created_at || new Date().toISOString()
//               }
//             }
//           };
//         });
//         Alert.alert(
//           language === 'ar' ? 'نجاح' : 'Success',
//           language === 'ar' ? 'تم تحديث صورة السيارة بنجاح' : 'Car image updated successfully'
//         );
//       }
//     } catch (error) {
//       console.error('Error uploading car image:', error);
//       Alert.alert(
//         language === 'ar' ? 'خطأ' : 'Error',
//         language === 'ar' ? 'حدث خطأ أثناء تحديث صورة السيارة' : 'Error updating car image'
//       );
//     } finally {
//       setIsUploading(false);
//     }
//   };

//   return (
//     <>
//       <Stack.Screen 
//         options={{
//           headerTitle: language === 'ar' ? 'تعديل الملف' : 'Profile Edit',
//           headerTitleStyle: {
//             fontSize: 18,
//             fontFamily: language === 'ar' ? 'Cairo-Bold' : 'PlusJakartaSans-Bold',
//           },
//           headerTitleAlign: 'center',
//         }} 
//       />
//       <SafeAreaView className="flex-1 bg-white">
//         <ScrollView
//           refreshControl={
//             <RefreshControl
//               refreshing={isRefreshing}
//               onRefresh={() => {
//                 setIsRefreshing(true);
//                 fetchUserData().finally(() => setIsRefreshing(false));
//               }}
//               colors={["#F97316"]}
//               tintColor="#F97316"
//             />
//           }
//           className="flex-1"
//           contentContainerStyle={{ padding: 16 }}
//           showsVerticalScrollIndicator={false}
//         >
//           {/* Profile Images */}
//           <View className="flex-row justify-between">
//             <View className="w-[48%]">
//               <TouchableOpacity 
//                 onPress={() => setShowFullImage(true)} 
//                 className="bg-white rounded-2xl overflow-hidden"
//               >
//                 <Image
//                   source={{ uri: userData.profileImage || user?.imageUrl }}
//                   className="w-full aspect-square"
//                   resizeMode="cover"
//                 />
//                 <TouchableOpacity
//                   onPress={handleImagePick}
//                   className="absolute bottom-2 right-2 bg-white rounded-full p-1.5"
//                 >
//                   <Image 
//                     source={uploadIcon} 
//                     style={{ width: 20, height: 20 }} 
//                     resizeMode="contain"
//                   />
//                 </TouchableOpacity>
//               </TouchableOpacity>
//             </View>

//             {userData.isDriver && (
//               <View className="w-[48%]">
//                 <TouchableOpacity 
//                   onPress={() => setShowFullCarImage(true)} 
//                   className="bg-white rounded-2xl overflow-hidden"
//                 >
//                   <Image
//                     source={{ uri: userData.data?.driver?.car_image_url }}
//                     className="w-full aspect-square"
//                     resizeMode="cover"
//                   />
//                   <TouchableOpacity
//                     onPress={handleCarImagePick}
//                     className="absolute bottom-2 right-2 bg-white rounded-full p-1.5"
//                   >
//                     <Image 
//                       source={uploadIcon} 
//                       style={{ width: 20, height: 20 }} 
//                       resizeMode="contain"
//                     />
//                   </TouchableOpacity>
//                 </TouchableOpacity>
//               </View>
//             )}
//           </View>

//           {/* Form Fields */}
//           <View className="mt-8 space-y-6">
//             {/* Full Name */}
//             <View>
//               <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                 {language === 'ar' ? 'الاسم الكامل' : 'Full Name'}
//               </Text>
//               <View className="bg-white py-3 px-3 border border-gray-200 rounded-md">
//                 <Text className={`text-[15px] text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                   {user?.fullName || (language === 'ar' ? 'غير محدد' : 'Not specified')}
//                 </Text>
//               </View>
//             </View>

//             {/* Email */}
//             <View>
//               <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                 {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
//               </Text>
//               <View className="bg-white py-3 px-3 border border-gray-200 rounded-md">
//                 <Text className={`text-[15px] text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                   {user?.primaryEmailAddress?.emailAddress || (language === 'ar' ? 'غير محدد' : 'Not specified')}
//                 </Text>
//               </View>
//             </View>

//             {/* Car Type - Only for drivers */}
//             {userData.isDriver && (
//               <View>
//                 <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                   {language === 'ar' ? 'نوع السيارة' : 'Car Type'}
//                 </Text>
//                 <View className={`bg-white py-3 px-3 border border-gray-200 rounded-md flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
//                   <Text className={`text-[15px] text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                     {userData.data?.driver?.car_type || (language === 'ar' ? 'غير محدد' : 'Not specified')}
//                   </Text>
//                   <TouchableOpacity onPress={() => setEditingField('carType')}>
//                     <MaterialIcons name="edit" size={20} color="#F97316" />
//                   </TouchableOpacity>
//                 </View>
//               </View>
//             )}

//             {/* Car Seats - Only for drivers */}
//             {userData.isDriver && (
//               <View>
//                 <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                   {language === 'ar' ? 'عدد المقاعد' : 'Car Seats'}
//                 </Text>
//                 <View className={`bg-white py-3 px-3 border border-gray-200 rounded-md flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
//                   <Text className={`text-[15px] text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                     {userData.data?.driver?.car_seats || '0'}
//                   </Text>
//                   <TouchableOpacity onPress={() => setEditingField('carSeats')}>
//                     <MaterialIcons name="edit" size={20} color="#F97316" />
//                   </TouchableOpacity>
//                 </View>
//               </View>
//             )}

//             {/* Phone Number */}
//             <View>
//               <Text className={`text-gray-500 text-[13px] mb-1 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                 {language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
//               </Text>
//               <View className={`bg-white py-3 px-3 border border-gray-200 rounded-md flex-row justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
//                 <Text className={`text-[15px] text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                   {phoneNumber}
//                 </Text>
//                 <TouchableOpacity onPress={() => setEditingField('phoneNumber')}>
//                   <MaterialIcons name="edit" size={20} color="#F97316" />
//                 </TouchableOpacity>
//               </View>
//             </View>

//             {/* Notifications */}
//             <TouchableOpacity
//               onPress={toggleNotifications}
//               activeOpacity={0.7}
//               className={`flex-row items-center mb-3 min-h-[44px] ${language === 'ar' ? 'flex-row-reverse' : ''}`}
//             >
//               <View className={`w-9 h-9 rounded-full bg-orange-500 items-center justify-center ${language === 'ar' ? 'ml-3.5' : 'mr-3.5'}`}>
//                 <MaterialIcons name="notifications" size={22} color="#fff" />
//               </View>
//               <View className={`flex-1 flex-row items-center ${language === 'ar' ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
//                 <Text className={`text-base font-bold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
//                   {language === 'ar' ? 'الإشعارات' : 'Notifications'}
//                 </Text>
//                 <Switch
//                   value={notificationsEnabled}
//                   onValueChange={toggleNotifications}
//                   trackColor={{ false: '#d1d5db', true: '#f97316' }}
//                   thumbColor="#fff"
//                 />
//               </View>
//             </TouchableOpacity>
//           </View>
//         </ScrollView>

//         {/* Edit Field Modal */}
//         <Modal
//           visible={!!editingField}
//           transparent={true}
//           animationType="fade"
//           onRequestClose={() => setEditingField(null)}
//         >
//           <View className="flex-1 bg-black/50 justify-center items-center px-5">
//             <View className="bg-white w-full rounded-xl p-4">
//               <TextInput
//                 value={editValues[editingField as keyof typeof editValues]}
//                 onChangeText={(text) => setEditValues(prev => ({ ...prev, [editingField as string]: text }))}
//                 className="border border-gray-200 rounded-xl p-3.5 mb-4 text-[15px]"
//                 placeholder={language === 'ar' ? getArabicPlaceholder(editingField) : `Enter ${editingField}`}
//                 keyboardType={editingField === 'carSeats' || editingField === 'phoneNumber' ? 'numeric' : 'default'}
//                 textAlign={language === 'ar' ? 'right' : 'left'}
//                 style={{
//                   fontFamily: language === 'ar' ? 'Cairo-Regular' : 'PlusJakartaSans-Regular'
//                 }}
//               />
//               <View className={`flex-row justify-end space-x-3 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
//                 <TouchableOpacity
//                   onPress={() => setEditingField(null)}
//                   className="px-4 py-2"
//                 >
//                   <Text className="text-gray-500 text-[15px]">{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   onPress={() => handleEditField(editingField as string)}
//                   className="bg-orange-500 px-4 py-2 rounded-lg"
//                 >
//                   <Text className="text-white text-[15px]">{language === 'ar' ? 'حفظ' : 'Save'}</Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           </View>
//         </Modal>
//       </SafeAreaView>
//     </>
//   );
// };

// // Helper function for Arabic placeholders
// const getArabicPlaceholder = (field: string | null) => {
//   switch (field) {
//     case 'carType':
//       return 'أدخل نوع السيارة';
//     case 'carSeats':
//       return 'أدخل عدد المقاعد';
//     case 'phoneNumber':
//       return 'أدخل رقم الهاتف';
//     default:
//       return '';
//   }
// };

// export default ProfileEdit;