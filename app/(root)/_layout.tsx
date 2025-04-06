
import { Stack } from 'expo-router'
import React from 'react'

const RootLayout = () => {
  return (
     <Stack>
               <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
               <Stack.Screen name="find-ride" options={{ headerShown: false }} />
               <Stack.Screen name="confirm-ride" options={{ headerShown: false }} />
               <Stack.Screen name="book-ride" options={{ headerShown: false }} /> 
               <Stack.Screen name="rideInfo" options={{ headerShown: false }} /> 
               <Stack.Screen name="carInfo" options={{ headerShown: false }} />


               
          
            </Stack>
  )
}

export default RootLayout