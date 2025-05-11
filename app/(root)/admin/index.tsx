import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useUser } from '@clerk/clerk-expo';
import { router } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useLanguage } from '@/context/LanguageContext';

interface DashboardStats {
  totalDrivers: number;
  activeDrivers: number;
  pendingApplications: number;
  totalRides: number;
  totalUsers: number;
  pendingSupport: number;
}

type IconName = 'account-group' | 'car' | 'clock-outline' | 'map-marker-path' | 'account-cog' | 'chart-bar' | 'message-text' | 'help-circle';

const AdminDashboard = () => {
  const { user } = useUser();
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalDrivers: 0,
    activeDrivers: 0,
    pendingApplications: 0,
    totalRides: 0,
    totalUsers: 0,
    pendingSupport: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Set up real-time listeners for different collections
        const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
          const users = snapshot.docs;
          const totalUsers = users.length;
          const drivers = users.filter(doc => doc.data().driver);
          const activeDrivers = drivers.filter(doc => doc.data().driver?.is_active).length;
          const pendingApplications = drivers.filter(doc => doc.data().driver?.status === 'pending').length;

          setStats(prev => ({
            ...prev,
            totalUsers,
            totalDrivers: drivers.length,
            activeDrivers,
            pendingApplications
          }));
        });

        const ridesUnsubscribe = onSnapshot(collection(db, 'rides'), (snapshot) => {
          setStats(prev => ({
            ...prev,
            totalRides: snapshot.size
          }));
        });

        // Add support messages listener
        const supportUnsubscribe = onSnapshot(
          query(collection(db, 'support_messages'), where('status', '==', 'pending')),
          (snapshot) => {
            setStats(prev => ({
              ...prev,
              pendingSupport: snapshot.size
            }));
          }
        );

        setLoading(false);

        return () => {
          usersUnsubscribe();
          ridesUnsubscribe();
          supportUnsubscribe();
        };
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const StatCard = ({ title, value, icon, color }: { title: string; value: number; icon: IconName; color: string }) => (
    <View className="bg-white rounded-xl p-4 mb-4 shadow-sm">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className={`text-2xl font-bold text-${color}-600`}>{value}</Text>
          <Text className="text-gray-600 text-sm mt-1">{title}</Text>
        </View>
        <View className={`bg-${color}-100 p-3 rounded-full`}>
          <MaterialCommunityIcons name={icon} size={24} color={`#${color === 'blue' ? '3B82F6' : color === 'green' ? '22C55E' : color === 'orange' ? 'F97316' : '8B5CF6'}`} />
        </View>
      </View>
    </View>
  );

  const QuickActionCard = ({ title, description, icon, onPress, color, badge }: { 
    title: string; 
    description: string; 
    icon: IconName; 
    onPress: () => void;
    color: string;
    badge?: number;
  }) => (
    <TouchableOpacity 
      onPress={onPress}
      className="bg-white rounded-xl p-4 mb-4 shadow-sm"
    >
      <View className="flex-row items-center">
        <View className={`bg-${color}-100 p-3 rounded-full mr-4`}>
          <MaterialCommunityIcons 
            name={icon} 
            size={24} 
            color={`#${
              color === 'blue' ? '3B82F6' : 
              color === 'green' ? '22C55E' : 
              color === 'yellow' ? 'EAB308' : 
              color === 'red' ? 'EF4444' : 
              '8B5CF6'
            }`} 
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-lg font-bold">{title}</Text>
            {badge ? (
              <View className="bg-red-500 rounded-full ml-2 px-2 py-0.5">
                <Text className="text-white text-xs font-bold">{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text className="text-gray-600 text-sm">{description}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#6B7280" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#F97316" />
        <Text className="text-gray-600 mt-4">Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView className="flex-1 px-4">
      <View className="py-4">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity 
              onPress={() => router.back()}
              className="bg-gray-100 p-2 rounded-full"
            >
              <MaterialCommunityIcons name="arrow-left" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold">Admin Dashboard</Text>
            <View className="w-10" />
          </View>
          
          {/* Stats Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-4">Statistics</Text>
            <StatCard 
              title="Total Users" 
              value={stats.totalUsers} 
              icon="account-group" 
              color="blue" 
            />
            <StatCard 
              title="Active Drivers" 
              value={stats.activeDrivers} 
              icon="car" 
              color="green" 
            />
            <StatCard 
              title="Pending Applications" 
              value={stats.pendingApplications} 
              icon="clock-outline" 
              color="red" 
            />
            <StatCard 
              title="Total Rides" 
              value={stats.totalRides} 
              icon="map-marker-path" 
              color="purple" 
            />
          </View>

          {/* Quick Actions Section */}
          <View className="mb-6">
            <Text className="text-lg font-semibold mb-4">Quick Actions</Text>
            <QuickActionCard 
              title="Support Messages" 
              description="View and manage user support messages"
              icon="message-text"
              color="yellow"
              badge={stats.pendingSupport}
              onPress={() => router.push('/(root)/admin/support-messages' as any)}
            />
            <QuickActionCard 
              title="Driver Applications" 
              description="Review and manage driver applications"
              icon="car"
              color="red"
              onPress={() => router.push('/(root)/admin/driverApplications' as any)}
            />
            <QuickActionCard 
              title="User Management" 
              description="Manage user accounts and permissions"
              icon="account-cog"
              color="blue"
              onPress={() => router.push('/(root)/admin/users' as any)}
            />
            <QuickActionCard 
              title="Ride Management" 
              description="Monitor and manage active rides"
              icon="map-marker-path"
              color="purple"
              onPress={() => router.push('/(root)/admin/rides' as any)}
            />
            <QuickActionCard 
              title="Reports" 
              description="View system reports and analytics"
              icon="chart-bar"
              color="green"
              onPress={() => router.push('/(root)/admin/reports' as any)}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminDashboard; 