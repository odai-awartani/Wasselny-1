import { View, Text, Image, TouchableOpacity } from 'react-native'
import React, { useCallback, useRef } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { icons } from '@/constants'
import { router, usePathname } from 'expo-router'
import Map from '@/components/Map'
import BottomSheet, {
    BottomSheetScrollView,
    BottomSheetView,
  } from "@gorhom/bottom-sheet";
import { useRouter } from 'expo-router'

  const RideLayout = ({
    title,
    snapPoints,
    children,
  }: {
    title: string;
    snapPoints?: string[];
    children: React.ReactNode;
  }) => {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const pathname = usePathname();
    const router = useRouter();
  
    const handleBackPress = useCallback(() => {
      console.log("Current pathname:", pathname); // للتحقق من المسار
  
      if (pathname === "/locationInfo") { // تعديل الشرط ليطابق المسار النسبي
        console.log("Navigating back from locationInfo...");
        router.push("/(root)/(tabs)/home"); // الانتقال المباشر إلى صفحة التسجيل
         //أو الرجوع خطوتين إذا كنت تفضل:
      //  router.back();
      //  setTimeout(() => router.back(), 100);
      } else {
        console.log("Navigating back one step...");
        router.back(); // الرجوع خطوة واحدة
      }
    }, [pathname, router]);
  return (
    
    <GestureHandlerRootView className="flex-1">
        <View className='flex-1 bg-white'>
            <View className='flex flex-col h-screen bg-orange-400'>
                <View className='flex flex-row absolute z-10 top-16 items-center justify-start px-5'>
                    <TouchableOpacity onPress={() => handleBackPress()}>
                        <View className='w-10 h-10 bg-white rounded-full items-center justify-center'>
                            <Image 
                            source={icons.backArrow} 
                            resizeMode='contain' className='w-6 h-6' />
                        </View>
                    </TouchableOpacity>
                    <Text className='text-xl font-JakartaSemiBold ml-5'>
                        {title || "Go back"}
                    </Text>
                </View>
                <Map/>
            </View>  
            <BottomSheet
            keyboardBehavior='extend'
                ref={bottomSheetRef}
                snapPoints={snapPoints || ["45%", "85%", "100%"]}
                index={1}
                backgroundStyle={{
                    borderRadius: 24,
                    backgroundColor: '#fff', // ممكن تعدل اللون حسب الثيم حقك
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 5, // لأندرويد
                  }}
                  handleIndicatorStyle={{
                    backgroundColor: '#ccc',
                    width: 60,
                    height: 5,
                    borderRadius: 3,
                    marginTop: 10,
                  }}
                
                
                >
            <BottomSheetView
              style={{
                flex: 1,
                padding: 20,
                
              }}
            >
                {children}
         </BottomSheetView>    
                
            </BottomSheet> 

        </View>
      </GestureHandlerRootView>

  
  )
}

export default RideLayout