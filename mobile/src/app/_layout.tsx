import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MonitorProvider } from '../MonitorContext';

export const unstable_settings = { initialRouteName: 'index' };

export default function RootLayout() {
  return <SafeAreaProvider><MonitorProvider>
    <Stack screenOptions={{ headerStyle: { backgroundColor: '#F3F6F3' }, headerTintColor: '#183B30', headerShadowVisible: false, contentStyle: { backgroundColor: '#F3F6F3' } }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="bin/[id]" options={{ title: 'Chi tiết thùng', headerBackTitle: 'Quay lại' }} />
    </Stack>
  </MonitorProvider></SafeAreaProvider>;
}
