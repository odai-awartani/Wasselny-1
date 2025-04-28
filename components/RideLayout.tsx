import { View, Text, Image, TouchableOpacity } from 'react-native';
import React, { useCallback, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { icons } from '@/constants';
import { router, usePathname, useLocalSearchParams } from 'expo-router';
import Map from '@/components/Map';
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
  MapComponent = Map,
  expandSheet,
}: {
  title: string;
  snapPoints?: string[];
  children: React.ReactNode;
  origin?: Location;
  destination?: Location;
  MapComponent?: React.ComponentType<any>;
  expandSheet?: string;
}) => {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const pathname = usePathname();
  const { expandSheet: expandSheetParam } = useLocalSearchParams<{ expandSheet?: string }>();

  React.useEffect(() => {
    // Use a small delay to ensure the component is fully mounted
    const timer = setTimeout(() => {
      if (expandSheetParam === 'true') {
        // Get the last valid index (length - 1)
        const lastIndex = (snapPoints || ['25%', '50%', '90%']).length - 1;
        bottomSheetRef.current?.snapToIndex(lastIndex);
      } else if (pathname === '/') {
        // Start at 90% height by default
        const lastIndex = (snapPoints || ['25%', '50%', '90%']).length - 1;
        bottomSheetRef.current?.snapToIndex(lastIndex);
      } else {
        // Start at 90% height by default
        const lastIndex = (snapPoints || ['25%', '50%', '90%']).length - 1;
        bottomSheetRef.current?.snapToIndex(lastIndex);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [pathname, expandSheetParam, snapPoints]);

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

  const handleChange = useCallback((index: number) => {
    // Prevent snapping to invalid indices
    if (index >= 0 && index < (snapPoints || ['25%', '50%', '90%']).length) {
      bottomSheetRef.current?.snapToIndex(index);
    }
  }, [snapPoints]);

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
          snapPoints={snapPoints || ['25%', '50%', '90%']}
          index={(snapPoints || ['25%', '50%', '90%']).length - 1} // Start with the last snap point (90%)
          enablePanDownToClose={false}
          enableOverDrag={false}
          onChange={handleChange}
          topInset={50}
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 5,
          }}
          backgroundStyle={{
            borderRadius: 24,
            backgroundColor: '#fff',
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