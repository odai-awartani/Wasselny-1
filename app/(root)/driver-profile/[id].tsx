import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, ScrollView, Text, View, ActivityIndicator, TouchableOpacity, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import InputField from "@/components/InputField";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { icons } from "@/constants";  // Import icons
import { red } from "react-native-reanimated/lib/typescript/Colors";

const DriverProfile = () => {
  const { id } = useLocalSearchParams();
  const [user, setUser] = useState<any>(null);
  const [driver, setDriver] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(!!id);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        const userRef = doc(db, "users", id as string);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser(userData);

          const driverData = userData?.driver;
          if (driverData) {
            setDriver(driverData);
          } else {
            console.warn("No driver data found!");
          }
        } else {
          console.warn("No such user found!");
        }
      } catch (err) {
        console.error("Error getting user data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const fullName = user?.name || "";
  const [firstName, lastName] = fullName.split(" ");

  const email = user?.email;
  const phone = user?.phone;
  const industry = user?.industry;
  const gender = user?.gender;

  const carType = driver?.car_type;
  const carSeats = driver?.car_seats;
  const carImage = driver?.car_image_url;
  const profileImage = driver?.profile_image_url;

  const openImageModal = (imageUrl: string | null) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  const navigateToMessages = () => {
    router.push(`/chat/${id}`);
  };

  return (
    <SafeAreaView className="flex-1 pb-[-15] mb-0 bg-gray-100">
      <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 100 }}>
      <View className="flex-row justify-between items-center my-5">
  <View className="flex-row items-center gap-4">
  <TouchableOpacity onPress={() => router.back()}>
                  <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                    <Image source={icons.backArrow} resizeMode="contain" className="w-6 h-6" />
                  </View>
                </TouchableOpacity>

    <TouchableOpacity onPress={navigateToMessages}>
      <Image
        source={icons.chat}
        style={{ width: 45, height: 45 }}
        className="rounded-full p-2 bg-orange-500"
      />
    </TouchableOpacity>
  </View>

  <Text className="text-2xl font-CairoBold text-right">
    {id ? "الملف الشخصي للسائق" : "الملف الشخصي"}
  </Text>
</View>

        <View className="flex items-center justify-center my-5">
          {loading ? (
            <ActivityIndicator size="large" />
          ) : (
            <TouchableOpacity onPress={() => openImageModal(profileImage)}>
              <Image
                source={{ uri: profileImage }}
                style={{ width: 110, height: 110, borderRadius: 55 }}
                className="rounded-full border-[3px] border-white shadow-md"
              />
            </TouchableOpacity>
          )}
        </View>

        {!loading && (
          <View className="bg-white rounded-lg shadow-md px-5 py-3">
            <InputField label="الاسم الأول" placeholder={firstName || "Not Found"} editable={false} labelStyle="font-CairoBold text-right" className="font-CairoBold"/>
            <InputField label="الاسم الأخير" placeholder={lastName || "Not Found"} editable={false} labelStyle="font-CairoBold text-right" className="font-CairoBold"/>
            <InputField label="البريد الإلكتروني" placeholder={email || "Not Found"} editable={false} labelStyle="font-CairoBold text-right" className="font-CairoBold"/>
            <InputField label="رقم الهاتف" placeholder={phone || "Not Found"} editable={false} labelStyle="font-CairoBold text-right" className="font-CairoBold"/>
            <InputField label="النوع" placeholder={gender || "Not Found"} editable={false} labelStyle="font-CairoBold text-right"/>
            <InputField label="الوظيفة / التخصص" placeholder={industry || "Not Found"} editable={false} labelStyle="font-CairoBold text-right" className="font-CairoBold"/>
            
            <InputField label="نوع السيارة" placeholder={carType || "Not Found"} editable={false} labelStyle="font-CairoBold text-right" className="font-CairoBold"/>
            <InputField label="عدد المقاعد" placeholder={carSeats?.toString() || "Not Found"} editable={false} labelStyle="font-CairoBold text-right" className="font-CairoBold"/>
            <View className="my-5 flex-column-reverse items-end">
              <Text className="text-lg font-CairoBold text-right">صورة السيارة:</Text>
              {carImage ? (
                <TouchableOpacity onPress={() => openImageModal(carImage)}>
                  <Image
                    source={{ uri: carImage }}
                    style={{ width: 200, height: 120, borderRadius: 8 }}
                    className="my-2 border-[3px] border-white shadow-md justify-center items-center"
                  />
                </TouchableOpacity>
              ) : (
                <Text className="font-CairoRegular">لا توجد صورة للسيارة</Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={showImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeImageModal}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          onPress={closeImageModal}
        >
          <Image
            source={{ uri: selectedImage!}}
            style={{ width: '90%', height: 500, resizeMode: 'contain', borderRadius: 10 }}
          />
          <Text className="text-white mt-2 font-CairoBold">اضغط في أي مكان للإغلاق</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default DriverProfile;
