import { ClerkLoaded, ClerkProvider } from "@clerk/clerk-expo";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { LanguageProvider } from '@/context/LanguageContext';
import { tokenCache } from "@/lib/auth";
import { LogBox } from "react-native";
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { setupNotifications, startRideNotificationService } from '@/lib/notifications';
import { useUser } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from "@/types/type";

const BACKGROUND_NOTIFICATION_TASK = 'ride-notification-service';

// Define the background task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
  try {
    // Retrieve userId from AsyncStorage (stored when user logs in)
    const userId = await AsyncStorage.getItem('userId');
    if (userId) {
      await startRideNotificationService(userId);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('Background notification task error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

if (!publishableKey) {
  throw new Error(
    "Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env"
  );
}

LogBox.ignoreLogs(["Clerk:"]);

export default function RootLayout() {
  const [loaded] = useFonts({
    "Jakarta-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "Jakarta-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
    "Jakarta-ExtraLight": require("../assets/fonts/PlusJakartaSans-ExtraLight.ttf"),
    "Jakarta-Light": require("../assets/fonts/PlusJakartaSans-Light.ttf"),
    "Jakarta-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    Jakarta: require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "Jakarta-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    "Cairo-Black": require("../assets/fonts/Cairo-Black.ttf"),
    "Cairo-Bold": require("../assets/fonts/Cairo-Bold.ttf"),
    "Cairo-ExtraBold": require("../assets/fonts/Cairo-ExtraBold.ttf"),
    "Cairo-ExtraLight": require("../assets/fonts/Cairo-ExtraLight.ttf"),
    "Cairo-Light": require("../assets/fonts/Cairo-Light.ttf"),
    "Cairo-Medium": require("../assets/fonts/Cairo-Medium.ttf"),
    "Cairo-Regular": require("../assets/fonts/Cairo-Regular.ttf"),
    "Cairo-SemiBold": require("../assets/fonts/Cairo-SemiBold.ttf"),
  });

  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }

    const initializeNotifications = async () => {
      if (user?.id) {
        // Store userId in AsyncStorage for background task
        await AsyncStorage.setItem('userId', user.id);
        // Setup notification permissions
        await setupNotifications(user.id);
        // Initial check for upcoming rides
        await startRideNotificationService(user.id, true);
      }
    };

    initializeNotifications();

    const registerBackgroundTask = async () => {
      try {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
          minimumInterval: 15 * 60, // Run every 15 minutes
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('Background notification task registered');
      } catch (error) {
        console.error('Error registering background task:', error);
      }
    };

    registerBackgroundTask();
  }, [loaded, user]);

  if (!loaded) {
    return null;
  }

  return (
    <LanguageProvider>
      <ClerkProvider tokenCache={tokenCache} publishableKey={publishableKey}>
        <ClerkLoaded>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(root)" options={{ headerShown: false }} />
            <Stack.Screen name="+not-found" />
          </Stack>
        </ClerkLoaded>
      </ClerkProvider>
    </LanguageProvider>
  );
}