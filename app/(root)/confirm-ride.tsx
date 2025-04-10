import { View, Text, FlatList } from 'react-native';
import React from 'react';
import RideLayout from '@/components/RideLayout';
import DriverCard from '@/components/DriverCard';
import CustomButton from '@/components/CustomButton';
import { router } from 'expo-router';
import { useDriverStore } from '@/store';
import { useUser } from '@clerk/clerk-expo'; // استيراد useUser للحصول على بيانات المستخدم

const ConfirmRide = () => {
  const { drivers, selectedDriver, setSelectedDriver } = useDriverStore();
  const { user } = useUser(); // الحصول على بيانات المستخدم

  return (
    <RideLayout title="Choose a Driver" snapPoints={['65%', '85%']}>
     
    

      <FlatList
        data={drivers}
        renderItem={({ item }) => (
          <DriverCard
            selected={selectedDriver!}
            setSelected={() => setSelectedDriver(item.id)!}
            item={item}
            user={user}  
          />
        )}
        ListFooterComponent={() => (
          <View className="mx-5 mt-10">
            <CustomButton title="Select Ride" onPress={() => router.push("/book-ride")} />
          </View>
        )}
      />
    </RideLayout>
  );
};

export default ConfirmRide;