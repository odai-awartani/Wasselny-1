import { useAuth } from "@clerk/clerk-expo";
import { Link, Redirect } from "expo-router";
import {Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";


const Home = () => {
    const { isSignedIn } = useAuth()

    if (isSignedIn) {
      return <Redirect href={'/home'} />
    }
    return (
        <Redirect href="/(auth)/language" />
    )
}

export default Home;