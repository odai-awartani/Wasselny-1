import { icons } from "@/constants";
import { Tabs, Redirect } from "expo-router";
import { View, Image, ImageSourcePropType } from "react-native";
import { useEffect, useState, createContext, useContext } from "react";
import { NotificationProvider } from '@/context/NotificationContext';
import { useUser } from "@clerk/clerk-expo";
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Create context for driver status
export const DriverStatusContext = createContext<{
  isDriver: boolean;
  recheckDriverStatus: () => Promise<void>;
}>({ 
  isDriver: false,
  recheckDriverStatus: async () => {}
});

const TabIcon = ({ focused, source }: { focused: boolean; source: ImageSourcePropType }) => (
  <View
    className={`w-12 h-12 items-center justify-center rounded-full ${focused ? 'bg-orange-100' : ''}`}
  >
    <Image source={source} tintColor="white" resizeMode="contain" className="w-7 h-7" />
  </View>
);

export const useDriverStatus = () => useContext(DriverStatusContext);

const Layout = () => {
  const { user } = useUser();
  const [isDriver, setIsDriver] = useState(false);

  const checkIfUserIsDriver = async () => {
    if (!user?.id) return;
    
    try {
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setIsDriver(userData.driver?.is_active === true);
      } else {
        setIsDriver(false);
      }
    } catch (error) {
      console.error('Error checking driver status:', error);
      setIsDriver(false);
    }
  };

  useEffect(() => {
    checkIfUserIsDriver();
  }, [user?.id]);

  return (
    <DriverStatusContext.Provider value={{ isDriver, recheckDriverStatus: checkIfUserIsDriver }}>
      <NotificationProvider>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "white",
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "black",
          borderRadius: 50,
          paddingBottom: 25,
          marginHorizontal: 10,
          marginBottom: 25,
          height: 78,
          display: "flex",
          justifyContent: "space-evenly",
          alignItems: "center",
          flexDirection: "row",
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          borderTopWidth: 0,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.home} />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "rides",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.list} />
          ),
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.add} />
          ),
          href: isDriver ? "/(root)/(tabs)/add" : null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.chat} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.profile} />
          ),
        }}
      />
      </Tabs>
      </NotificationProvider>
    </DriverStatusContext.Provider>
  );
};

export default Layout;