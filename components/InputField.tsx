import React, { useState } from "react";
import {
  TextInput,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
} from "react-native";
import { InputFieldProps } from "@/types/type";
import { icons } from "@/constants"; // استيراد الأيقونات
import { useLanguage } from '@/context/LanguageContext'; // استيراد useLanguage

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
  isPhoneNumber = false, // تفعيل خاصية رقم الهاتف
  ...props
}: InputFieldProps) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { language } = useLanguage(); // الحصول على اللغة الحالية

  return (
    <View className="my-2 w-full">
      {/* Label */}
      <Text className={`text-lg font-JakartaSemiBold mb-3 ${labelStyle}`}>
        {label}
      </Text>

      {/* Input Container */}
      <View
        className={`flex flex-row justify-start items-center relative bg-neutral-100 rounded-full border border-neutral-100 focus:border-orange-500 ${containerStyle}`}
      >
        {/* Country Code (لحقل رقم الهاتف فقط) */}
        {isPhoneNumber && (
          <View className="px-4 border-r border-gray-300">
            <Text className="text-amber-950 font-CairoBold text-lg mt-1">+972</Text>
          </View>
        )}

        {/* بقية العناصر (حقل الإدخال وزر العين) */}
        <View
          style={{ flexDirection: language === 'ar' ? 'row-reverse' : 'row' }} // تغيير الاتجاه بناءً على اللغة
          className="flex-1"
        >
          {/* Left Icon (إذا تم توفيره) */}
          {icon && <Image source={icon} className={`w-6 h-6 ml-4  ${iconStyle}`} />}

          {/* Text Input */}
          <TextInput
            className={`rounded-full p-4 font-JakartaSemiBold text-[15px] flex-1 ${inputStyle} ${language === 'ar' ? 'text-right' : 'text-left'}`}
            secureTextEntry={secureTextEntry && !showPassword} // إظهار/إخفاء النص
            placeholder={isFocused ? "" : placeholder}
            placeholderTextColor="#9CA3AF"
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            keyboardType={isPhoneNumber ? "phone-pad" : "default"} // تحديد لوحة الأرقام لحقل رقم الهاتف
            maxLength={isPhoneNumber ? 9 : undefined} // تحديد طول النص إلى 9 أرقام لحقل رقم الهاتف
            {...props}
          />

          {/* Show/Hide Password Icon (فقط لحقول كلمة السر) */}
          {secureTextEntry && (
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              className={language === 'ar' ? 'ml-4 mt-5' : 'mr-4 mt-3.5'} // تغيير الهامش بناءً على اللغة
            >
              <Image
                source={showPassword ? icons.eyecross : icons.eye} // استخدام أيقونات العين
                className="w-6 h-6"
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default InputField;