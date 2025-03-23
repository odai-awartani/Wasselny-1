import React, { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";

import { icons } from "@/constants";
import { useDriverStore, useLocationStore } from "@/store";
import { calculateRegion, generateMarkersFromData } from "@/lib/map";
import { MarkerData } from "@/types/type";
import * as Location from "expo-location";
import { Platform } from 'react-native';

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;

const drivers = [
  {
    "id": 1,
    "first_name": "Abdullrahman",
    "last_name": "Ramadan",
    "profile_image_url": "https://ucarecdn.com/c50ab512-b03b-4d62-b42c-431702777d27/9fb853c8bdf04778b9b3554e9ff8303d",
    "car_image_url": "https://ucarecdn.com/a2dc52b2-8bf7-4e49-9a36-3ffb5229ed02/-/preview/465x466/",
    "car_seats": 4,
    "rating": "4.80"
  },
  {
    "id": 2,
    "first_name": "David",
    "last_name": "Brown",
    "profile_image_url": "https://ucarecdn.com/6ea6d83d-ef1a-483f-9106-837a3a5b3f67/-/preview/1000x666/",
    "car_image_url": "https://ucarecdn.com/a3872f80-c094-409c-82f8-c9ff38429327/-/preview/930x932/",
    "car_seats": 5,
    "rating": "4.60"
  },
  {
    "id": 3,
    "first_name": "Michael",
    "last_name": "Johnson",
    "profile_image_url": "https://ucarecdn.com/0330d85c-232e-4c30-bd04-e5e4d0e3d688/-/preview/826x822/",
    "car_image_url": "https://ucarecdn.com/289764fb-55b6-4427-b1d1-f655987b4a14/-/preview/930x932/",
    "car_seats": 4,
    "rating": "4.70"
  },
  {
    "id": 4,
    "first_name": "Robert",
    "last_name": "Green",
    "profile_image_url": "https://ucarecdn.com/fdfc54df-9d24-40f7-b7d3-6f391561c0db/-/preview/626x417/",
    "car_image_url": "https://ucarecdn.com/b6fb3b55-7676-4ff3-8484-fb115e268d32/-/preview/930x932/",
    "car_seats": 4,
    "rating": "4.90"
  }
];

const Map = () => {
  const {
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  const { selectedDriver, setDrivers } = useDriverStore();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
//   const { data: drivers, loading, error } = useFetch<Driver[]>("/(api)/driver");
const [markers, setMarkers] = useState<MarkerData[]>([]);

useEffect(() => {
  // TODO removed for now
  setDrivers(drivers);
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

//   useEffect(() => {
//     if (
//       markers.length > 0 &&
//       destinationLatitude !== undefined &&
//       destinationLongitude !== undefined
//     ) {
//       calculateDriverTimes({
//         markers,
//         userLatitude,
//         userLongitude,
//         destinationLatitude,
//         destinationLongitude,
//       }).then((drivers) => {
//         setDrivers(drivers as MarkerData[]);
//       });
//     }
//   }, [markers, destinationLatitude, destinationLongitude]);

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


//   if (loading || (!userLatitude && !userLongitude))
//     return (
//       <View className="flex justify-between items-center w-full">
//         <ActivityIndicator size="small" color="#000" />
//       </View>
//     );

//   if (error)
//     return (
//       <View className="flex justify-between items-center w-full">
//         <Text>Error: {error}</Text>
//       </View>
//     );


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
        key={marker.id } 
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