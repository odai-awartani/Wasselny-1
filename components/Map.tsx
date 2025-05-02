import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View, Platform, Image } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import * as Location from "expo-location";

import { icons } from "@/constants";
import { useFetch } from "@/lib/fetch";
import { useDriverStore, useLocationStore } from "@/store";
import {
  calculateDriverTimes,
  calculateRegion,
  generateMarkersFromData,
} from "@/lib/map";
import { Driver, MarkerData } from "@/types/type";
import { TouchableOpacity } from "react-native";

const directionsAPI = process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY;

const Map = () => {
  const { data: drivers, loading, error } = useFetch<Driver[]>("/(api)/driver");

  const {
    userLongitude,
    userLatitude,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  const mapRef = useRef<MapView | null>(null);

  const { selectedDriver, setDrivers } = useDriverStore();

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [markers, setMarkers] = useState<MarkerData[]>([]);

  // تحميل معلومات السائقين وتحويلهم إلى علامات على الخريطة
  useEffect(() => {
    if (Array.isArray(drivers) && userLatitude && userLongitude) {
      const newMarkers = generateMarkersFromData({
        data: drivers,
        userLatitude,
        userLongitude,
      });
      setMarkers(newMarkers);
    }
  }, [drivers, userLatitude, userLongitude]);

  // حساب وقت الوصول لكل سائق
  useEffect(() => {
    if (
      markers.length > 0 &&
      destinationLatitude &&
      destinationLongitude
    ) {
      calculateDriverTimes({
        markers,
        userLatitude,
        userLongitude,
        destinationLatitude,
        destinationLongitude,
      }).then((updatedDrivers) => {
        setDrivers(updatedDrivers as MarkerData[]);
      });
    }
  }, [markers, destinationLatitude, destinationLongitude]);

  // الحصول على موقع المستخدم الحالي
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

  // تحميل أو خطأ أو لا يوجد موقع حتى الآن
  if (loading || !userLatitude || !userLongitude) {
    return (
      <View className="flex items-center justify-center w-full h-full">
        <ActivityIndicator size="small" color="#000" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex justify-center items-center w-full h-full">
        <Text>Error: {error}</Text>
      </View>
    );
  }

  if (!userLocation || !currentLocation) {
    return (
      <View className="flex-1 justify-center items-center">
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
        <View className="w-full h-full">
    
    <MapView
      provider={PROVIDER_DEFAULT}
      ref={mapRef}
      className="w-full h-full rounded-2xl"
      mapType={Platform.OS === "android" ? "standard" : "mutedStandard"}
      showsPointsOfInterest={true}
      initialRegion={currentLocation}
      showsUserLocation={true}
      showsMyLocationButton={true}
      followsUserLocation={true}
      zoomEnabled={true}
      loadingEnabled={true}
      loadingIndicatorColor="#F97316"
      loadingBackgroundColor="#FFFFFF"
      moveOnMarkerPress={false}
      minZoomLevel={10}
    >
      {/* السائقين */}
      {markers.map((marker) => (
        <Marker
          key={marker.id}
          coordinate={{
            latitude: marker.latitude,
            longitude: marker.longitude,
          }}
          title={marker.title}
          image={selectedDriver === marker.id ? icons.selectedMarker : icons.marker}
        />
      ))}

      {/* الوجهة + المسار */}
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
     {/* زر الذهاب للموقع الحالي */}
     {Platform.OS === 'ios' &&userLocation && (
            <TouchableOpacity
            onPress={() => {
              mapRef.current?.animateToRegion({
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            }}
            className="absolute right-3 bottom-2/3 -translate-y-1/2 bg-amber-300 p-3 rounded-full shadow-md z-10"
          >
            <Image
              source={icons.target} // أيقونة الموقع
              style={{ width: 30, height: 30 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
          )}
    </View>
  );
};

export default Map;
