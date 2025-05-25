import React, { useState } from "react";
import { View, Image, Text } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";

import { icons } from "@/constants";
import { GoogleInputProps } from "@/types/type";
import { useLanguage } from '@/context/LanguageContext';

const googlePlacesApiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
console.log(googlePlacesApiKey);

const GoogleTextInput = ({
  icon,
  placeholder,
  initialLocation,
  containerStyle,
  textInputBackgroundColor,
  handlePress,
  onTextChange,
  autoFocus = false,
  returnKeyType = "search",
  onSubmitEditing,
}: GoogleInputProps) => {
  const { language } = useLanguage();
  const [searchText, setSearchText] = useState('');

  return (
    <View
      className={`flex flex-row items-center justify-center relative z-50 rounded-xl ${containerStyle}`}
    >
      <GooglePlacesAutocomplete
        fetchDetails={true}
        placeholder="Search"
        debounce={200}
        styles={{
          textInputContainer: {
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 20,
            marginHorizontal: 20,
            position: "relative",
            shadowColor: "#d4d4d4",
          },
          textInput: {
            backgroundColor: textInputBackgroundColor
              ? textInputBackgroundColor
              : "white",
            fontSize: 16,
            fontWeight: "600",
            fontFamily: language === 'ar' ? 'Cairo-Bold' : 'JakartaBold',
            marginTop: 5,
            width: "100%",
            borderRadius: 200,
          },
          listView: {
            backgroundColor: textInputBackgroundColor
              ? textInputBackgroundColor
              : "white",
            position: "relative",
            top: 0,
            width: "100%",
            borderRadius: 10,
            shadowColor: "#d4d4d4",
            zIndex: 99,
            elevation: 5, // For Android
          },
        }}
        onPress={(data, details = null) => {
          if (details?.geometry?.location) {
            handlePress({
              latitude: details.geometry.location.lat,
              longitude: details.geometry.location.lng,
              address: data.description,
            });
          } else {
            console.log("No location details available.");
          }
        }}
        query={{
          key: googlePlacesApiKey,
          language: language === 'ar' ? 'ar' : 'en',
          components: 'country:PS',
        }}
        renderLeftButton={() => (
          <View className={`justify-center items-center w-6 h-6`}>
            <Image
              source={icon ? icon : icons.search}
              className="w-6 h-6"
              resizeMode="contain"
            />
          </View>
        )}
        textInputProps={{
          placeholderTextColor: "gray",
          placeholder: initialLocation ?? (language === 'ar' ? 'إلى أين تريد الذهاب؟' : 'Where do you want to go?'),
          underlineColorAndroid: "transparent",
          returnKeyType: returnKeyType,
          autoFocus: autoFocus,
          onChangeText: (text) => {
            setSearchText(text);
            onTextChange?.(text);
          },
          onSubmitEditing: (event) => {
            if (event.nativeEvent.text) {
              onSubmitEditing?.(event);
            }
          },
        }}
        renderRow={(data) => (
          <Text
            style={{
              fontFamily: language === 'ar' ? 'Cairo-Bold' : 'Jakarta',
              fontSize: 12,
              textAlign: language === 'ar' ? 'right' : 'left',
              color: '#222',
              paddingVertical: 6,
              paddingHorizontal: 10,
            }}
            numberOfLines={1}
          >
            {data.description}
          </Text>
        )}
      />
    </View>
  );
};

export default GoogleTextInput;