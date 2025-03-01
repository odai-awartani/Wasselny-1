// components/InputField.tsx
import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  Image,
  TouchableOpacity,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
} from "react-native";
import { InputFieldProps } from "@/types/type";
import { icons } from "@/constants"; // Import your icons

const InputField = ({
  label,
  icon,
  secureTextEntry = false,
  labelStyle,
  placeholder,
  containerStyle,
  inputStyle,
  iconStyle,
  className,
  ...props
}: InputFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="my-2 w-full">
          {/* Label */}
          <Text className={`text-lg font-JakartaSemiBold mb-3 ${labelStyle}`}>
            {label}
          </Text>

          {/* Input Container */}
          <View
            className={`flex flex-row justify-start items-center relative bg-neutral-100 rounded-full border border-neutral-100 focus:border-primary-500 ${containerStyle}`}
          >
            {/* Left Icon (if provided) */}
            {icon && <Image source={icon} className={`w-6 h-6 ml-4 ${iconStyle}`} />}

            {/* Text Input */}
            <TextInput
              className={`rounded-full p-4 font-JakartaSemiBold text-[15px] flex-1 ${inputStyle} text-left`}
              secureTextEntry={secureTextEntry && !showPassword} // Toggle secureTextEntry
              placeholder={isFocused ? "" : placeholder}
              placeholderTextColor="#9CA3AF"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              {...props}
            />

            {/* Show/Hide Password Icon (only for password fields) */}
            {secureTextEntry && (
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                className="mr-4"
              >
                <Image
                  source={showPassword ? icons.eyecross : icons.eye} // Use your eye and cross-eye icons
                  className="w-6 h-6"
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default InputField;