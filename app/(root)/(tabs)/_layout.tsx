import { icons } from "@/constants";
import { Tabs } from "expo-router";
import { View, Image, ImageSourcePropType } from "react-native";

const TabIcon = ({ focused, source }: { focused: boolean; source: ImageSourcePropType }) => (
    
  <View
    className={`w-12 h-12 items-center justify-center rounded-full ${focused ? 'bg-orange-100' : ''}`}
  >
    <Image source={source} tintColor="white" resizeMode="contain" className="w-7 h-7" />
  </View>
);

const Layout = () => (
  <Tabs
    initialRouteName="chat"
    screenOptions={{
      tabBarActiveTintColor: "white",
      tabBarInactiveTintColor: "white",
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: "black",
        borderRadius: 50,
        paddingBottom: 25, // Slight padding at the bottom for better centering
        marginHorizontal: 10,
        marginBottom: 25,
        height: 78, // Set a fixed height for the tab bar
        display: "flex",
        justifyContent: "center", // Vertically center the items
        alignItems: "center",     // Horizontally center the items
        flexDirection: "row",
        position: "absolute",
      }
    }}
  >
    <Tabs.Screen name="home" options={{
      title: "Home",
      headerShown: false,
      tabBarIcon: ({ focused }) => <TabIcon focused={focused} source={icons.home} />
    }} />
    <Tabs.Screen name="rides" options={{
      title: "rides",
      headerShown: false,
      tabBarIcon: ({ focused }) => <TabIcon focused={focused} source={icons.list} />
    }} />
    <Tabs.Screen name="add" options={{
      title: "add",
      headerShown: false,
      tabBarIcon: ({ focused }) => <TabIcon focused={focused} source={icons.add} />
    }} />
    <Tabs.Screen name="chat" options={{
      title: "chat",
      headerShown: false,
      tabBarIcon: ({ focused }) => <TabIcon focused={focused} source={icons.chat} />
    }} />
    <Tabs.Screen name="profile" options={{
      title: "profile",
      headerShown: false,
      tabBarIcon: ({ focused }) => <TabIcon focused={focused} source={icons.profile} />
    }} />
  </Tabs>
);

export default Layout;