import { TextInputProps, TouchableOpacityProps } from "react-native";

declare interface Driver {
  id: number;
  first_name: string;
  last_name: string;
  profile_image_url: string;
  car_image_url: string;
  car_seats: number;
  rating: number;
}

declare interface MarkerData {
  latitude: number;
  longitude: number;
  id: number;
  title: string;
  profile_image_url: string;
  car_image_url: string;
  car_seats: number;
  rating: number;
  first_name: string;
  last_name: string;
  time?: number;
  price?: string;
}

declare interface MapProps {
  destinationLatitude?: number;
  destinationLongitude?: number;
  onDriverTimesCalculated?: (driversWithTimes: MarkerData[]) => void;
  selectedDriver?: number | null;
  onMapReady?: () => void;
}

declare interface Ride {
  id: string;
  origin_address: string;
  destination_address: string;
  created_at: string;
  ride_time: string;
  ride_datetime: string;
  destination_longitude: number;
  destination_latitude: number;
  origin_latitude: number;
  origin_longitude: number;
  available_seats: number;
  driver: {
    first_name: string;
    last_name: string;
    profile_picture: string;
    car_seats: number;
  };
  payment_status: string;
  driver_rating: number;
  status: string;
  driver_id: string;
  recurring: boolean;
  ride_days: string[];
  waypoints: Array<{
    address: string;
    street: string;
    latitude: number;
    longitude: number;
  }>;
  car_type: string;
  priority: number;
  distance: number;
}

declare interface ButtonProps extends TouchableOpacityProps {
  title: string;
  bgVariant?: "primary" | "secondary" | "danger" | "outline" | "success";
  textVariant?: "primary" | "default" | "secondary" | "danger" | "success";
  IconLeft?: React.ComponentType<any>;
  IconRight?: React.ComponentType<any>;
  className?: string;
  [key: string]: any; // For additional props
}

declare interface GoogleInputProps {
  icon?: string;
  initialLocation?: string;
  containerStyle?: string;
  placeholder?: string;
  textInputBackgroundColor?: string;
  handlePress: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  onTextChange?: (text: string) => void;
  autoFocus?: boolean;
  returnKeyType?: "search" | "done" | "go" | "next" | "send";
  onSubmitEditing?: (event: { nativeEvent: { text: string } }) => void;
}

declare interface InputFieldProps extends TextInputProps {
  label: string;
  icon?: any;
  secureTextEntry?: boolean;
  labelStyle?: string;
  containerStyle?: string;
  inputStyle?: string;
  iconStyle?: string;
  className?: string;
  isPhoneNumber?: boolean;
  placeholder?: any; // ✅ اضف هذا السطر

  
}

declare interface PaymentProps {
  fullName: string;
  email: string;
  amount: string;
  driverId: number;
  rideTime: number;
}

declare interface LocationStore {
  userLatitude: number | null;
  userLongitude: number | null;
  userAddress: string | null;
  destinationLatitude: number | null;
  destinationLongitude: number | null;
  destinationAddress: string | null;
  setUserLocation: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
  setDestinationLocation: ({
    latitude,
    longitude,
    address,
  }: {
    latitude: number;
    longitude: number;
    address: string;
  }) => void;
}

declare interface DriverStore {
  drivers: MarkerData[];
  selectedDriver: number | null;
  setSelectedDriver: (driverId: number) => void;
  setDrivers: (drivers: MarkerData[]) => void;
  clearSelectedDriver: () => void;
}

declare interface DriverCardProps {
  item: MarkerData;
  selected: number;
  setSelected: () => void;
  user: User;
}
declare interface UserUnsafeMetadata {
  gender?: string;
  phoneNumber?: string;
  workIndustry?: string;
}

declare interface User {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  emailAddresses: string[];
  imageUrl: string;
  unsafeMetadata: UserUnsafeMetadata;
  // أي حقول إضافية من Clerk مثل:
  createdAt: string;
  updatedAt: string;
}

export interface SuggestedRide {
  id: string;
  origin_address: string;
  destination_address: string;
  origin_longitude: number;
  origin_latitude: number;
  destination_longitude: number;
  destination_latitude: number;
  ride_time: string; // أو يمكن استخدام نوع Date إذا كان الوقت هو تاريخ كامل
  driver: Driver;
  payment_status: 'paid' | 'unpaid'; // حالة الدفع
  created_at: string; // تاريخ الإنشاء
}

declare interface  Ride  {
    id: string;
    origin_address: string;
    destination_address: string;
    created_at: string;
    ride_time: string;
    destination_longitude: number;
    destination_latitude: number;
    driver: {
      first_name: string;
      last_name: string;
      profile_picture: string;
      car_seats: number;
    };
    payment_status: string;
    driver_rating: number;

    
  };
  export interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: {
      toDate: () => Date;
    };
    sent?: boolean;
  }
  
  export interface LastMessage {
    text: string;
    senderId: string;
    senderName: string;
  }
  
  export interface Chat {
    id: string;
    participants: string[];
    lastMessage: LastMessage | null;
    lastMessageTime: {
      toDate: () => Date;
    };
    unreadCount: {
      [userId: string]: number;
    };
    // Optional fields for UI
    name?: string;
    avatar?: string;
  }