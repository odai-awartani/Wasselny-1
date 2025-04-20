import { View, Text, TextInput, Image } from "react-native";
import React, { useCallback, useState } from "react";
import RideLayout from "@/components/RideLayout";
import GoogleTextInput from "@/components/GoogleTextInput";
import { icons } from "@/constants";
import CustomButton from "@/components/CustomButton";
import { router, useLocalSearchParams } from "expo-router";
import { useLocationStore } from "@/store";

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}
const Add = () => {
  const [street, setStreet] = useState("");
   const { userAddress, destinationAddress, setUserLocation, setDestinationLocation } = useLocationStore();
     const params = useLocalSearchParams();
      const handleFindRide = useCallback(() => {
    if (!userAddress || !destinationAddress || !street.trim()) {
      alert("Please select both 'From' and 'To' locations and enter a street name");
      return;
    }
  
    router.push({
      pathname: "/(root)/rideInfo",
      params: {
        destination_street: street,
        deriverId: params?.driverId
      },
    });
  }, [userAddress, destinationAddress, street]);
  
  const handleFromLocation = useCallback((location: Location) => {
    setUserLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
    });
  }, [setUserLocation]);
  
  const handleToLocation = useCallback((location: Location) => {
    setDestinationLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      address: location.address,
    });
  }, [setDestinationLocation]);
  return (
    <RideLayout title="Location Information" snapPoints={["40%","80% ","90%"]}>
      {/* From Location */}
      <View className="my-3">
        <Text className="text-lg font-JakartaSemiBold mb-3">From</Text>
        <GoogleTextInput
          icon={icons.target}
          initialLocation={userAddress!}
          containerStyle="bg-neutral-100"
          textInputBackgroundColor="#f5f5f5"
          handlePress={handleFromLocation}
          placeholder="Enter starting location"
        />
      </View>

      {/* To Location */}
      <View className="my-3">
        <Text className="text-lg font-JakartaSemiBold mb-3">To</Text>
        <GoogleTextInput
          icon={icons.map}
          initialLocation={destinationAddress!}
          containerStyle="bg-neutral-100"
          textInputBackgroundColor="transparent"
          handlePress={handleToLocation}
          placeholder="Enter destination"
        />
      </View>

      {/* Street Input */}
      <View className="my-3">
        <Text className="text-lg font-JakartaSemiBold mb-3">Street</Text>
        <View className="flex-row items-center rounded-xl p-3 bg-neutral-100">
          <Image source={icons.street} className="w-7 h-7 ml-2" />
          <TextInput
            value={street}
            onChangeText={setStreet}
            placeholder="Enter street name"
            className="flex-1 text-right ml-2.5 mr-5 bg-transparent pt-1 pb-2  font-JakartaBold placeholder:font-CairoBold"
            
            placeholderTextColor="gray"
          />
        </View>
      </View>

      <CustomButton
        title="Find Now"
        onPress={handleFindRide}
        className="mt-5"
      />
    </RideLayout>
  );
};

export default Add;