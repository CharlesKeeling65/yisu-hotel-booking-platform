import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import '../global.css';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="list" options={{ headerShown: false, title: '酒店列表' }} />
        <Stack.Screen name="hotel/[id]" options={{ headerShown: false, title: '酒店详情' }} />
        <Stack.Screen name="location" options={{ headerShown: false, title: '位置选择' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: '更多功能' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
