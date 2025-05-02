import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View, Platform, TouchableOpacity, Image } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import * as Location from "expo-location";

import { icons } from "@/constants";
import { calculateRegion } from "@/lib/map";

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface Location {
  latitude?: number;
  longitude?: number;
}

interface RideMapProps {
  origin?: Location;
  destination?: Location;
  onTargetPress?: () => void;
}

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;

const RideMap = ({ origin, destination, onTargetPress }: RideMapProps) => {
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const mapRef = useRef<MapView | null>(null);

  const hasOrigin = origin?.latitude && origin?.longitude;
  const hasDestination = destination?.latitude && destination?.longitude;

  // Validate coordinates
  const isValidCoordinate = (coord: number) => {
    return coord >= -90 && coord <= 90;
  };

  const isValidRoute = hasOrigin && 
    hasDestination && 
    isValidCoordinate(origin.latitude!) && 
    isValidCoordinate(origin.longitude!) && 
    isValidCoordinate(destination.latitude!) && 
    isValidCoordinate(destination.longitude!);

  // جلب موقع المستخدم الحالي
  useEffect(() => {
    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;

        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        setUserLocation({ latitude, longitude });
      } catch (error) {
        console.error("Error getting location", error);
      }
    };

    fetchLocation();
  }, []);

  if (!hasOrigin || !hasDestination) {
    return (
      <View className="flex items-center justify-center w-full h-full bg-white">
        <ActivityIndicator size="small" color="#0286FF" />
      </View>
    );
  }

  const region = calculateRegion({
    userLatitude: origin.latitude!,
    userLongitude: origin.longitude!,
    destinationLatitude: destination.latitude!,
    destinationLongitude: destination.longitude!,
  });

  return (
    <View className="w-full h-full">
      <MapView
        ref={(ref) => (mapRef.current = ref)}
        provider={PROVIDER_DEFAULT}
        className="w-full h-full rounded-2xl"
        mapType={Platform.OS === "android" ? "standard" : "mutedStandard"}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={false} // نستخدم زر مخصص بدل الزر الافتراضي
        userInterfaceStyle="light"
      >
        {/* نقطة الانطلاق */}
        <Marker
          coordinate={{
            latitude: origin.latitude!,
            longitude: origin.longitude!,
          }}
          title="نقطة الانطلاق"
          description="مكان بداية الرحلة"
          image={icons.pin}
        />

        {/* نقطة الوصول */}
        <Marker
          coordinate={{
            latitude: destination.latitude!,
            longitude: destination.longitude!,
          }}
          title="نقطة الوصول"
          description="مكان نهاية الرحلة"
          image={icons.pin}
        />

        {/* رسم المسار */}
        {isValidRoute && (
          <MapViewDirections
            origin={{
              latitude: origin.latitude!,
              longitude: origin.longitude!,
            }}
            destination={{
              latitude: destination.latitude!,
              longitude: destination.longitude!,
            }}
            apikey={directionsAPI!}
            strokeColor="#0286FF"
            strokeWidth={2}
            optimizeWaypoints={true}
            onError={(errorMessage) => {
              console.warn("حدث خطأ في رسم المسار:", errorMessage);
            }}
            onReady={(result) => {
              console.log("Route calculated successfully:", result);
            }}
          />
        )}
      </MapView>

      {/* زر الذهاب للموقع الحالي */}
      {userLocation && (
        <TouchableOpacity
          onPress={() => {
            // First, collapse the bottom sheet
            onTargetPress?.();
            // Then, zoom to user's location after a short delay
            setTimeout(() => {
              mapRef.current?.animateToRegion({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }, 300); // 300ms delay to let the bottom sheet animation start
          }}
          className="absolute right-3 top-1/4 -translate-y-1/2 bg-amber-300 p-3 rounded-full shadow-md "

        >
          <Image
            source={icons.target}
            style={{ width: 30, height: 30 }}
            resizeMode="contain"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default RideMap;