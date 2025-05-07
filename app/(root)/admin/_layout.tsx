import { Stack } from 'expo-router'
import React from 'react'
import { NotificationProvider } from '@/context/NotificationContext'

const RootLayout = () => {
  return (
    <NotificationProvider>
      <Stack>
             
              
               <Stack.Screen name="driverApplications" options={{ headerShown: false }} />
               <Stack.Screen name="rides" options={{ headerShown: false }} />
               <Stack.Screen name="users" options={{ headerShown: false }} />
               <Stack.Screen name="reports" options={{ headerShown: false }} />
               <Stack.Screen name="rideDetails" options={{ headerShown: false }} />
               <Stack.Screen name="userDetails" options={{ headerShown: false }} />
               <Stack.Screen name="index" options={{ headerShown: false }} />
               
               
            


               



               
          
            </Stack>
    </NotificationProvider>
  )
}

export default RootLayout