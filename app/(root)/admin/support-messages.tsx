// import React, { useEffect, useState } from 'react';
// import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { MaterialIcons } from '@expo/vector-icons';
// import { useRouter, Stack } from 'expo-router';
// import { useLanguage } from '@/context/LanguageContext';
// import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
// import { db } from '@/lib/firebase';
// import { useUser } from '@clerk/clerk-expo';
// import { sendRideStatusNotification } from '@/lib/notifications';

// interface SupportMessage {
//   id: string;
//   userId: string;
//   userName: string;
//   userEmail: string;
//   message: string;
//   createdAt: any;
//   status: 'pending' | 'in_progress' | 'resolved';
// }

// export default function SupportMessages() {
//   const router = useRouter();
//   const { language } = useLanguage();
//   const { user } = useUser();
//   const [messages, setMessages] = useState<SupportMessage[]>([]);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     // Check if user is admin
//     const checkAdminStatus = async () => {
//       try {
//         const userRef = doc(db, 'users', user?.id || '');
//         const userDoc = await getDoc(userRef);
//         if (!userDoc.exists() || userDoc.data().role !== 'admin') {
//           Alert.alert(
//             language === 'ar' ? 'غير مصرح' : 'Unauthorized',
//             language === 'ar' ? 'ليس لديك صلاحية الوصول إلى هذه الصفحة' : 'You do not have permission to access this page'
//           );
//           router.back();
//           return;
//         }
//       } catch (error) {
//         console.error('Error checking admin status:', error);
//         router.back();
//       }
//     };

//     checkAdminStatus();

//     // Subscribe to support messages
//     const q = query(
//       collection(db, 'support_messages'),
//       orderBy('createdAt', 'desc')
//     );

//     const unsubscribe = onSnapshot(q, (snapshot) => {
//       const messageData: SupportMessage[] = [];
//       snapshot.forEach((doc) => {
//         messageData.push({ id: doc.id, ...doc.data() } as SupportMessage);
//       });
//       setMessages(messageData);
//       setLoading(false);
//     });

//     return () => unsubscribe();
//   }, []);

//   const handleUpdateStatus = async (messageId: string, newStatus: SupportMessage['status']) => {
//     try {
//       const messageRef = doc(db, 'support_messages', messageId);
//       const messageDoc = await getDoc(messageRef);
//       const messageData = messageDoc.data() as SupportMessage;

//       await updateDoc(messageRef, {
//         status: newStatus
//       });

//       // Send notification when message is marked as resolved
//       if (newStatus === 'resolved') {
//         await sendRideStatusNotification(
//           messageData.userId,
//           language === 'ar' ? 'تم حل المشكلة' : 'Problem Resolved',
//           language === 'ar' 
//             ? 'شكراً لمراجعتك. تم حل المشكلة التي أبلغت عنها.'
//             : 'Thank you for your review. The problem you reported has been resolved.',
//           messageId
//         );
//       }
//     } catch (error) {
//       console.error('Error updating message status:', error);
//       Alert.alert(
//         language === 'ar' ? 'خطأ' : 'Error',
//         language === 'ar' ? 'حدث خطأ أثناء تحديث الحالة' : 'Error updating status'
//       );
//     }
//   };

//   const getStatusColor = (status: SupportMessage['status']) => {
//     switch (status) {
//       case 'pending':
//         return 'bg-yellow-100 text-yellow-800';
//       case 'in_progress':
//         return 'bg-blue-100 text-blue-800';
//       case 'resolved':
//         return 'bg-green-100 text-green-800';
//       default:
//         return 'bg-gray-100 text-gray-800';
//     }
//   };

//   const getStatusText = (status: SupportMessage['status']) => {
//     if (language === 'ar') {
//       switch (status) {
//         case 'pending':
//           return 'قيد الانتظار';
//         case 'in_progress':
//           return 'قيد المعالجة';
//         case 'resolved':
//           return 'تم الحل';
//         default:
//           return status;
//       }
//     }
//     return status;
//   };

//   return (
//     <>
//       <Stack.Screen 
//         options={{
//           headerTitle: language === 'ar' ? 'رسائل الدعم' : 'Support Messages',
//           headerTitleStyle: {
//             fontSize: 18,
//             fontFamily: language === 'ar' ? 'Cairo-Bold' : 'PlusJakartaSans-Bold',
//           },
//           headerTitleAlign: 'center',
//         }} 
//       />
//       <SafeAreaView className="flex-1 bg-white">
//         {loading ? (
//           <View className="flex-1 justify-center items-center">
//             <ActivityIndicator size="large" color="#f97316" />
//           </View>
//         ) : (
//           <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
//             {messages.map((message) => (
//               <View key={message.id} className="bg-gray-50 rounded-xl p-4 mb-4">
//                 <View className="flex-row justify-between items-start mb-2">
//                   <Text className={`font-bold ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
//                     {message.userName}
//                   </Text>
//                   <View className={`px-2 py-1 rounded-full ${getStatusColor(message.status)}`}>
//                     <Text className="text-xs font-medium">
//                       {getStatusText(message.status)}
//                     </Text>
//                   </View>
//                 </View>
//                 <Text className={`text-gray-600 mb-2 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'}`}>
//                   {message.userEmail}
//                 </Text>
//                 <Text className={`text-gray-800 mb-4 ${language === 'ar' ? 'font-CairoRegular' : 'font-JakartaRegular'}`}>
//                   {message.message}
//                 </Text>
//                 <View className="flex-row justify-end space-x-2">
//                   {message.status === 'pending' && (
//                     <TouchableOpacity
//                       onPress={() => handleUpdateStatus(message.id, 'in_progress')}
//                       className="bg-blue-500 px-3 py-1 rounded-md"
//                     >
//                       <Text className="text-white text-sm">
//                         {language === 'ar' ? 'بدء المعالجة' : 'Start Processing'}
//                       </Text>
//                     </TouchableOpacity>
//                   )}
//                   {message.status === 'in_progress' && (
//                     <TouchableOpacity
//                       onPress={() => handleUpdateStatus(message.id, 'resolved')}
//                       className="bg-green-500 px-3 py-1 rounded-md"
//                     >
//                       <Text className="text-white text-sm">
//                         {language === 'ar' ? 'تم الحل' : 'Mark Resolved'}
//                       </Text>
//                     </TouchableOpacity>
//                   )}
//                 </View>
//               </View>
//             ))}
//           </ScrollView>
//         )}
//       </SafeAreaView>
//     </>
//   );
// } 