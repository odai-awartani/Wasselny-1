import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";

import { icons } from "@/constants";
import { useDriverStore, useLocationStore } from "@/store";
import { calculateDriverTimes, calculateRegion, generateMarkersFromData } from "@/lib/map";
import {Driver, MarkerData } from "@/types/type";
import * as Location from "expo-location";
import { Platform } from 'react-native';
import { useFetch } from "@/lib/fetch";

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;



const Map = () => {
  const { data: drivers, loading, error } = useFetch<Driver[]>("/(api)/driver");
  const { userLongitude, userLatitude, destinationLatitude, destinationLongitude } = useLocationStore();
  const { selectedDriver, setDrivers } = useDriverStore();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);


useEffect(() => {

  if (Array.isArray(drivers)) {
    if (!userLatitude || !userLongitude) return;

    const newMarkers = generateMarkersFromData({
      data: drivers,
      userLatitude,
      userLongitude,
    });

    
    setMarkers(newMarkers);
  }
}, [drivers, userLatitude, userLongitude]);

useEffect(() => {
  if (
    markers.length > 0 &&
    destinationLatitude  &&
    destinationLongitude 
  ) {
    calculateDriverTimes({
      markers,
      userLatitude,
      userLongitude,
      destinationLatitude,
      destinationLongitude,
    }).then((drivers) => {
      setDrivers(drivers as MarkerData[]);
    });
  }
}, [markers, destinationLatitude, destinationLongitude]);


useEffect(() => {
  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        // تحديد المنطقة الأولية بناءً على الموقع
        setCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    } catch (error) {
      console.error("Error getting location: ", error);
    }
  };

  getLocation();
}, []);

if (loading || !userLatitude || !userLongitude) {
  return (
    <View className="flex items-center justify-between w-full">
      <ActivityIndicator size="small" color="#000" />
    </View>
  );
}

if (error) {
  return (
    <View className="flex justify-between items-center w-full">
      <Text>Error: {error}</Text>
    </View>
  );
}

if (!userLocation || !currentLocation) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#0000ff" />
    </View>
  );
}

const region = calculateRegion({
  userLatitude,
  userLongitude,
  destinationLatitude,
  destinationLongitude,
});

return (
  <MapView
    provider={PROVIDER_DEFAULT}
    className="w-full h-full rounded-2xl"
    tintColor="black"
    mapType={Platform.OS === 'android' ? 'standard' : 'mutedStandard'}    showsPointsOfInterest={true}
    initialRegion={currentLocation}
    showsUserLocation={true}
    userInterfaceStyle="light"
  >
    {markers.map((marker) => (
      <Marker
        key={marker.id} 
        coordinate={{
          latitude: marker.latitude,
          longitude: marker.longitude,
        }}
        title={marker.title}
        image={
          selectedDriver === marker.id ? icons.selectedMarker : icons.marker
        }
      />
    ))}

    {destinationLatitude && destinationLongitude && (
      <>
        <Marker
          key="destination"
          coordinate={{
            latitude: destinationLatitude,
            longitude: destinationLongitude,
          }}
          title="Destination"
          image={icons.pin}
        />
        <MapViewDirections
          origin={{
            latitude: userLatitude!,
            longitude: userLongitude!,
          }}
          destination={{
            latitude: destinationLatitude,
            longitude: destinationLongitude,
          }}
          apikey={directionsAPI!}
          strokeColor="#0286FF"
          strokeWidth={2}
        />
      </>
    )}
  </MapView>
);
};

export default Map;