import { SignedIn, SignedOut, useUser, useAuth } from '@clerk/clerk-expo'; // استيراد useAuth
import { Link, router } from 'expo-router';
import { StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomButton from '@/components/CustomButton'; // استيراد CustomButton
import { useLanguage } from '@/context/LanguageContext'; // استيراد useLanguage

export default function Page() {
  const { user } = useUser();
  const { isLoaded, signOut } = useAuth(); // استخدام useAuth لتسجيل الخروج
  const { t } = useLanguage(); // استخدام الترجمة

  const handleLogout = async () => {
    if (!isLoaded) return;

    try {
      // تسجيل الخروج
      await signOut();

      // توجيه المستخدم إلى صفحة تسجيل الدخول
      router.replace('/(auth)/sign-in');
    } catch (err) {
      console.error('Error during logout:', err);
    }
  };

  return (
    <SafeAreaView>
      <StatusBar barStyle="dark-content" />
      <SignedIn>
        <View className="p-4">
          <Text className="text-2xl font-bold">
            Hello {user?.firstName} 
          </Text>

          {/* زر تسجيل الخروج */}
          <CustomButton
            title={t.logout}
            onPress={handleLogout}
            className="bg-red-500" // يمكنك تغيير لون الزر حسب التصميم
          />
        </View>
      </SignedIn>

      <SignedOut>
        <View className="p-4">
          <Link href="/(auth)/sign-in">
            <Text className="text-blue-500 text-lg">تسجيل الدخول</Text>
          </Link>
          <Link href="/(auth)/sign-up">
            <Text className="text-blue-500 text-lg mt-2">{t.signUp}</Text>
          </Link>
        </View>
      </SignedOut>
    </SafeAreaView>
  );
}