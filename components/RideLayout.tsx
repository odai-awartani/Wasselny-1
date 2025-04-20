import { View, Text, Image, TouchableOpacity } from 'react-native';
import React, { useCallback, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { icons } from '@/constants';
import { router, usePathname } from 'expo-router';
import Map from '@/components/Map'; // الكود الأول لـ Map
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

interface Location {
  latitude?: number;
  longitude?: number;
}

const RideLayout = ({
  title,
  snapPoints,
  children,
  origin,
  destination,
  MapComponent = Map, // استخدام الكود الأول لـ Map افتراضيًا
}: {
  title: string;
  snapPoints?: string[];
  children: React.ReactNode;
  origin?: Location;
  destination?: Location;
  MapComponent?: React.ComponentType<any>;
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const pathname = usePathname();

  const handleBackPress = useCallback(() => {
    console.log('Current pathname:', pathname);

    if (pathname === '/locationInfo') {
      console.log('Navigating back from locationInfo...');
      router.push('/(root)/(tabs)/home');
    } else {
      console.log('Navigating back one step...');
      router.back();
    }
  }, [pathname]);

  return (
    <GestureHandlerRootView className="flex-1">
      <View className="flex-1 bg-white">
        <View className="flex flex-col h-screen bg-orange-400">
          <View className="flex flex-row absolute z-10 top-16 items-center justify-start px-5">
            <TouchableOpacity onPress={() => handleBackPress()}>
              <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                <Image source={icons.backArrow} resizeMode="contain" className="w-6 h-6" />
              </View>
            </TouchableOpacity>
            <Text className="text-xl font-CairoBold mt-1.5 ml-5">{title || 'Go back'}</Text>
          </View>
          <MapComponent origin={origin} destination={destination} />
        </View>
        <BottomSheet
          keyboardBehavior="extend"
          ref={bottomSheetRef}
          snapPoints={snapPoints || ['45%', '85%', '100%']}
          index={1}
          backgroundStyle={{
            borderRadius: 24,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
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
  );
};

export default RideLayout;