// context/LanguageContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '@/constants/languages';
import { I18nManager } from 'react-native';

type LanguageContextType = {
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
  t: typeof translations.en;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType>({} as LanguageContextType);

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
    const [language, setLanguage] = useState<'en' | 'ar'>('en');
    const isRTL = language === 'ar';

    useEffect(() => {
      const loadLanguage = async () => {
        const savedLanguage = await AsyncStorage.getItem('language');
        setLanguage(savedLanguage as 'en' | 'ar' || 'en');
      };
      loadLanguage();
    }, []);

    useEffect(() => {
      I18nManager.forceRTL(isRTL);
    }, [isRTL]);

    const value = {
      language,
      setLanguage: async (lang: 'en' | 'ar') => {
        await AsyncStorage.setItem('language', lang);
        setLanguage(lang);
      },
      t: translations[language],
      isRTL
    };

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);