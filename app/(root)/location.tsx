import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/context/LanguageContext';
import { useUser } from '@clerk/clerk-expo';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LinearGradient } from 'expo-linear-gradient';

interface SavedLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  address?: string;
}

export default function LocationScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<SavedLocation | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationAddresses, setLocationAddresses] = useState<{[key: string]: string}>({});

  // Get user's current location
  const getCurrentLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          language === 'ar' ? 'خطأ' : 'Error',
          language === 'ar' ? 'لم يتم منح إذن الوصول إلى الموقع' : 'Location permission was denied'
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تحديد موقعك' : 'Error getting your location'
      );
    } finally {
      setLoading(false);
    }
  };

  // Get address from coordinates
  const getAddressFromCoordinates = async (latitude: number, longitude: number) => {
    try {
      const result = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });
      
      if (result && result[0]) {
        const address = result[0];
        return [
          address.street,
          address.district,
          address.city,
          address.region
        ].filter(Boolean).join(', ');
      }
      return '';
    } catch (error) {
      console.error('Error getting address:', error);
      return '';
    }
  };

  // Fetch addresses for all locations
  const fetchAddresses = async (locations: SavedLocation[]) => {
    const addresses: {[key: string]: string} = {};
    for (const location of locations) {
      const address = await getAddressFromCoordinates(location.latitude, location.longitude);
      addresses[location.id] = address;
    }
    setLocationAddresses(addresses);
  };

  // Fetch saved locations
  const fetchSavedLocations = async () => {
    try {
      const locationsRef = collection(db, 'user_locations');
      const q = query(locationsRef, where('userId', '==', user?.id));
      const querySnapshot = await getDocs(q);
      
      const locations: SavedLocation[] = [];
      querySnapshot.forEach((doc) => {
        locations.push({ id: doc.id, ...doc.data() } as SavedLocation);
      });
      
      setSavedLocations(locations);
      const defaultLocation = locations.find(loc => loc.isDefault);
      if (defaultLocation) {
        setSelectedLocation(defaultLocation);
      }

      // Fetch addresses for all locations
      fetchAddresses(locations);
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  // Save new location
  const saveNewLocation = async () => {
    if (!currentLocation) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'الرجاء تحديد موقعك أولاً' : 'Please get your location first'
      );
      return;
    }

    if (savedLocations.length >= 3) {
      Alert.alert(
        language === 'ar' ? 'تنبيه' : 'Alert',
        language === 'ar' ? 'لا يمكنك حفظ أكثر من 3 مواقع. يرجى حذف موقع قبل إضافة موقع جديد.' : 'You cannot save more than 3 locations. Please delete a location before adding a new one.'
      );
      return;
    }

    setShowNameModal(true);
  };

  // Handle save location with name
  const handleSaveLocation = async () => {
    if (!locationName.trim()) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى إدخال اسم للموقع' : 'Please enter a location name'
      );
      return;
    }

    try {
      const locationData = {
        userId: user?.id,
        name: locationName.trim(),
        latitude: currentLocation!.coords.latitude,
        longitude: currentLocation!.coords.longitude,
        isDefault: savedLocations.length === 0,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'user_locations'), locationData);
      const newLocation = { id: docRef.id, ...locationData };
      setSavedLocations([...savedLocations, newLocation]);

      if (locationData.isDefault) {
        setSelectedLocation(newLocation);
      }

      setShowNameModal(false);
      setLocationName('');
      
      Alert.alert(
        language === 'ar' ? 'نجاح' : 'Success',
        language === 'ar' ? 'تم حفظ الموقع بنجاح' : 'Location saved successfully'
      );
    } catch (error) {
      console.error('Error saving location:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء حفظ الموقع' : 'Error saving location'
      );
    }
  };

  // Set location as default
  const setAsDefault = async (location: SavedLocation) => {
    try {
      setLoading(true);
      
      // If there's already a default location, unset it
      const previousDefault = savedLocations.find(loc => loc.isDefault);
      if (previousDefault) {
        const prevDefaultRef = doc(db, 'user_locations', previousDefault.id);
        await updateDoc(prevDefaultRef, {
          isDefault: false
        });
      }

      // Set new default location
      const newDefaultRef = doc(db, 'user_locations', location.id);
      await updateDoc(newDefaultRef, {
        isDefault: true
      });

      // Update local state
      const updatedLocations = savedLocations.map(loc => ({
        ...loc,
        isDefault: loc.id === location.id
      }));
      
      setSavedLocations(updatedLocations);
      setSelectedLocation(location);

      Alert.alert(
        language === 'ar' ? 'نجاح' : 'Success',
        language === 'ar' ? 'تم تعيين الموقع الافتراضي بنجاح' : 'Default location set successfully'
      );
    } catch (error) {
      console.error('Error setting default location:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء تعيين الموقع الافتراضي' : 'Error setting default location'
      );
    } finally {
      setLoading(false);
    }
  };

  // Delete location
  const deleteLocation = async (locationId: string) => {
    try {
      await deleteDoc(doc(db, 'user_locations', locationId));
      setSavedLocations(savedLocations.filter(loc => loc.id !== locationId));
      Alert.alert(
        language === 'ar' ? 'نجاح' : 'Success',
        language === 'ar' ? 'تم حذف الموقع بنجاح' : 'Location deleted successfully'
      );
    } catch (error) {
      console.error('Error deleting location:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'حدث خطأ أثناء حذف الموقع' : 'Error deleting location'
      );
    }
  };

  // Confirm delete
  const confirmDelete = (location: SavedLocation) => {
    Alert.alert(
      language === 'ar' ? 'تأكيد الحذف' : 'Confirm Delete',
      language === 'ar' ? 'هل أنت متأكد أنك تريد حذف هذا الموقع؟' : 'Are you sure you want to delete this location?',
      [
        {
          text: language === 'ar' ? 'إلغاء' : 'Cancel',
          style: 'cancel'
        },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: () => deleteLocation(location.id)
        }
      ],
      { cancelable: true }
    );
  };

  // Helper function to detect if text contains Arabic
  const containsArabic = (text: string) => {
    const arabicPattern = /[\u0600-\u06FF]/;
    return arabicPattern.test(text);
  };

  useEffect(() => {
    getCurrentLocation();
    fetchSavedLocations();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1">
        {/* Map View */}
        <View className="h-[300px]">
          {currentLocation ? (
            <MapView
              provider={PROVIDER_GOOGLE}
              className="w-full h-full"
              initialRegion={{
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
            >
              <Marker
                coordinate={{
                  latitude: currentLocation.coords.latitude,
                  longitude: currentLocation.coords.longitude,
                }}
                title={language === 'ar' ? 'موقعك الحالي' : 'Your Current Location'}
              />
              {savedLocations.map((loc) => (
                <Marker
                  key={loc.id}
                  coordinate={{
                    latitude: loc.latitude,
                    longitude: loc.longitude,
                  }}
                  title={loc.name}
                  pinColor={loc.isDefault ? 'red' : 'blue'}
                />
              ))}
            </MapView>
          ) : (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#f97316" />
            </View>
          )}
        </View>

        {/* Actions */}
        <View className="p-4">
          <TouchableOpacity
            onPress={saveNewLocation}
            className="bg-orange-500 rounded-lg p-4 mb-4 flex-row items-center justify-center"
            disabled={!currentLocation || loading}
          >
            <MaterialIcons name="add-location" size={24} color="white" className="mr-2" />
            <Text className={`text-white text-center ml-2 ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
              {loading 
                ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...')
                : (language === 'ar' ? 'حفظ الموقع الحالي' : 'Save Current Location')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Saved Locations */}
        <View className="flex-1 px-4">
          <Text className={`text-lg mb-4 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
            {language === 'ar' ? 'المواقع المحفوظة' : 'Saved Locations'}
          </Text>
          
          {savedLocations.map((location) => {
            const isArabicName = containsArabic(location.name);
            return (
              <TouchableOpacity
                key={location.id}
                onPress={() => setAsDefault(location)}
                className="p-4 mb-3 rounded-xl border border-gray-200 bg-white shadow-sm relative"
              >
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    confirmDelete(location);
                  }}
                  className={`absolute top-1.5 ${isArabicName ? 'left-1.5' : 'right-1.5'} z-10`}
                >
                  <MaterialIcons name="close" size={16} color="#ef4444" />
                </TouchableOpacity>

                <View className={`flex-row items-center justify-between ${isArabicName ? 'flex-row-reverse' : ''}`}>
                  <View className="flex-1">
                    <Text className={`text-base ${isArabicName ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
                      {location.name}
                    </Text>
                    <Text className={`text-sm text-gray-500 mt-0.5 ${isArabicName ? 'font-Cairo text-right' : 'font-Jakarta text-left'}`}>
                      {locationAddresses[location.id] || (language === 'ar' ? 'جاري تحميل العنوان...' : 'Loading address...')}
                    </Text>
                    {location.isDefault && (
                      <Text className={`text-xs text-orange-500 mt-1 ${isArabicName ? 'text-right' : 'text-left'}`}>
                        {language === 'ar' ? 'الموقع الافتراضي' : 'Default Location'}
                      </Text>
                    )}
                  </View>
                  {location.isDefault ? (
                    <View className={`w-7 h-7 rounded-full border-2 border-orange-500 items-center justify-center ${isArabicName ? 'ml-3' : 'mr-3'}`}>
                      <View className="w-4 h-4 rounded-full bg-orange-500" />
                    </View>
                  ) : (
                    <View className={`w-7 h-7 rounded-full border-2 border-orange-500 ${isArabicName ? 'ml-3' : 'mr-3'}`} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Location Name Modal */}
      <Modal
        visible={showNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNameModal(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white w-[90%] rounded-2xl p-6">
            <Text className={`text-xl mb-4 ${language === 'ar' ? 'font-CairoBold text-right' : 'font-JakartaBold text-left'}`}>
              {language === 'ar' ? 'اسم الموقع' : 'Location Name'}
            </Text>
            
            <TextInput
              className={`border border-gray-300 rounded-lg p-4 mb-4 text-base ${
                language === 'ar' ? 'font-Cairo text-right' : 'font-Jakarta text-left'
              }`}
              placeholder={language === 'ar' ? 'أدخل اسماً للموقع' : 'Enter a name for this location'}
              value={locationName}
              onChangeText={setLocationName}
              autoFocus
            />

            <View className={`flex-row justify-end space-x-3 ${language === 'ar' ? 'flex-row-reverse' : ''}`}>
              <TouchableOpacity
                onPress={() => {
                  setShowNameModal(false);
                  setLocationName('');
                }}
                className="px-4 py-2 rounded-lg bg-gray-200"
              >
                <Text className={`${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                  {language === 'ar' ? 'إلغاء' : 'Cancel'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleSaveLocation}
                className="px-4 py-2 rounded-lg bg-orange-500"
              >
                <Text className={`text-white ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'}`}>
                  {language === 'ar' ? 'حفظ' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
} 