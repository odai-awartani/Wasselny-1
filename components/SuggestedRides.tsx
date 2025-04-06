// // components/SuggestedRides.tsx
// import { useState, useEffect } from "react";
// import { FlatList, View, Text, Image, TouchableOpacity } from "react-native";
// import * as Location from "expo-location";
// import { router } from "expo-router";
// import { Ionicons } from "@expo/vector-icons";

// interface Ride {
//   id: string;
//   origin_address: string;
//   destination_address: string;
//   created_at: string;
//   ride_time: string;
//   destination_longitude: number;
//   destination_latitude: number;
//   driver: {
//     first_name: string;
//     last_name: string;
//     profile_picture: string;
//     car_seats: number;
//   };
//   payment_status: string;
//   driver_rating: number;
// }

// const SuggestedRideCard = ({ ride }: { ride: Ride }) => {
//   const handlePress = () => {
//     router.push({ pathname: "/(root)/book-ride", params: { rideId: ride.id } });
//   };

//   return (
//     <TouchableOpacity
//       onPress={handlePress}
//       className="bg-white rounded-lg p-4 mb-3 w-full border border-gray-200"
//     >
//       <View className="flex-row items-center">
//         <Image
//           source={{ uri: ride.driver.profile_picture }}
//           className="w-12 h-12 rounded-full"
//           resizeMode="cover"
//         />
//         <View className="ml-3 flex-1">
//           <Text className="text-lg font-semibold">
//             {ride.driver.first_name} {ride.driver.last_name}
//           </Text>
//           <View className="flex-row items-center mt-1">
//             <Ionicons name="star" size={16} color="#FFD700" />
//             <Text className="ml-1 text-sm text-gray-600">
//               {ride.driver_rating || "N/A"}
//             </Text>
//             <Text className="ml-2 text-sm text-gray-500">
//               {new Date(ride.created_at).toLocaleString("en-US", {
//                 hour: "numeric",
//                 minute: "numeric",
//                 hour12: true,
//               })}{" "}
//               • {new Date(ride.created_at).toLocaleDateString("en-US")}
//             </Text>
//           </View>
//         </View>
//       </View>
//       <View className="mt-3">
//         <Text className="text-sm text-gray-700">From: {ride.origin_address}</Text>
//         <Text className="text-sm text-gray-700">To: {ride.destination_address}</Text>
//         <Text className="text-sm text-gray-700">Time: {ride.ride_time}</Text>
//         <Text className="text-sm text-gray-700">
//           Car Seats: {ride.driver.car_seats}
//         </Text>
//       </View>
//     </TouchableOpacity>
//   );
// };

// type FetchType = "closest" | "recent";

// interface SuggestedRidesProps {
//   fetchType: FetchType;
// }

// const SuggestedRides = ({ fetchType }: SuggestedRidesProps) => {
//   const [rides, setRides] = useState<Ride[]>([]);
//   const [error, setError] = useState<string | null>(null);
//   const [userLocation, setUserLocation] = useState<{
//     latitude: number;
//     longitude: number;
//   } | null>(null);

//   useEffect(() => {
//     (async () => {
//       try {
//         let { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== "granted") {
//           setError("Permission to access location was denied");
//           return;
//         }

//         let location = await Location.getCurrentPositionAsync({});
//         setUserLocation({
//           latitude: location.coords.latitude,
//           longitude: location.coords.longitude,
//         });
//       } catch (err: any) {
//         setError("Failed to fetch location: " + err.message);
//       }
//     })();
//   }, []);

//   useEffect(() => {
//     const fetchRides = async () => {
//       if (fetchType === "closest" && !userLocation) return;

//       try {
//         let url = `/api/ride/suggested?fetchType=${fetchType}&limit=5`;
//         if (fetchType === "closest" && userLocation) {
//           const { latitude, longitude } = userLocation;
//           url += `&lat=${latitude}&lon=${longitude}`;
//         }

//         const response = await fetch(url);
//         if (!response.ok) throw new Error("Failed to fetch rides");

//         const data: Ride[] = await response.json();
//         setRides(data);
//       } catch (err: any) {
//         setError("Failed to fetch rides: " + err.message);
//       }
//     };

//     fetchRides();
//   }, [fetchType, userLocation]);

//   if (error) {
//     return (
//       <View className="p-4">
//         <Text className="text-red-500">Error: {error}</Text>
//       </View>
//     );
//   }

//   return (
//     <FlatList
//       data={rides}
//       renderItem={({ item }) => <SuggestedRideCard ride={item} />}
//       keyExtractor={(item) => item.id}
//       contentContainerStyle={{ padding: 16 }} // FlatList لا يدعم className مباشرة
//     />
//   );
// };

// export default SuggestedRides;
