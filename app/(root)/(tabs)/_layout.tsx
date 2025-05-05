import { icons } from "@/constants";
import { Tabs, Redirect } from "expo-router";
import { View, Image, ImageSourcePropType, Text } from "react-native";
import { createContext} from "react";
import { NotificationProvider } from '@/context/NotificationContext';


// Create context for driver status
export const DriverStatusContext = createContext<{
  isDriver: boolean;
  recheckDriverStatus: () => Promise<void>;
}>({ 
  isDriver: false,
  recheckDriverStatus: async () => {}
});

const TabIcon = ({ focused, source, name }: { focused: boolean; source: ImageSourcePropType; name: string }) => (
  <View className="items-center justify-center w-16">
  <View className={`w-10 h-10 items-center justify-center rounded-full ${focused ? 'bg-orange-100' : ''}`}>
    <Image 
      source={source} 
      tintColor="white" 
      resizeMode="contain" 
      className="w-6 h-6" 
    />
  </View>
  <Text
    className={`text-xs text-center ${focused ? 'text-orange-100 font-bold' : 'text-white'}`}
    numberOfLines={1}
    adjustsFontSizeToFit
  >
    {name}
  </Text>
</View>
);


const Layout = () => {

  return (
      <NotificationProvider>
      <Tabs
      screenOptions={{
        tabBarActiveTintColor: "white",
        tabBarInactiveTintColor: "white",
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: "black",
          borderRadius: 20,
          paddingTop:20,
          paddingBottom: 50,
          marginHorizontal: 0,
          marginBottom: 0,
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
            <TabIcon focused={focused} source={icons.home} name="Home" />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.search} name="Search" />
          ),
        }}
      />
      <Tabs.Screen
        name="rides"
        options={{
          title: "rides",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.list} name="Rides"/>
          ),
        }}
      />
      <Tabs.Screen
        name="barriers"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.barrier} name="Barrier" />
           
          ),
        }}
      />
      
      <Tabs.Screen
        name="chat"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.chat} name="Chat"/>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} source={icons.profile} name="Profile"/>
          ),
        }}
      />
      </Tabs>
      </NotificationProvider>
  );
};

export default Layout;