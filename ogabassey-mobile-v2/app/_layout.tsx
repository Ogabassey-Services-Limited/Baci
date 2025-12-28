import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Import global CSS for NativeWind
import '../global.css';

import { useColorScheme } from '@/components/useColorScheme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // System serif font will be used via NativeWind font-serif class
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

import { QueryProvider } from '@/lib/QueryProvider';

import { BrandThemeProvider } from '@/components/BrandThemeProvider';
import { ToastProvider } from '@/components/Toast';
import { useAuthStore } from '@/stores/auth-store';
import { ChatWidget } from '@/components/ChatWidget';

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  // Initialize Auth Store
  useEffect(() => {
    useAuthStore.getState().initialize();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider>
        <BrandThemeProvider>
          <ToastProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <View style={{ flex: 1 }}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="product/[slug]" options={{ headerShown: false }} />
                  <Stack.Screen name="checkout" options={{
                    headerShown: false,
                  }} />
                  <Stack.Screen name="order-success" options={{
                    headerShown: false,
                  }} />
                  <Stack.Screen name="search" options={{
                    headerShown: true,
                    headerTitle: "Search Results",
                    headerBackTitle: "Back"
                  }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal' }} />

                  {/* Profile sub-screens - no bottom nav */}
                  <Stack.Screen name="orders" options={{ headerShown: false }} />
                  <Stack.Screen name="addresses" options={{ headerShown: false }} />
                  <Stack.Screen name="help" options={{ headerShown: false }} />
                  <Stack.Screen name="member-status" options={{ headerShown: false }} />
                  <Stack.Screen name="receipts" options={{ headerShown: false }} />
                  <Stack.Screen name="reviews" options={{ headerShown: false }} />

                  {/* Service/utility screens - no bottom nav */}
                  <Stack.Screen name="imei-check" options={{ headerShown: false }} />
                  <Stack.Screen name="repairs" options={{ headerShown: false }} />
                  <Stack.Screen name="swap" options={{ headerShown: false }} />
                </Stack>
                {/* ChatWidget rendered INSIDE the navigation context via View wrapper */}
                <ChatWidget />
              </View>
            </ThemeProvider>
          </ToastProvider>
        </BrandThemeProvider>
      </QueryProvider>
    </GestureHandlerRootView>
  );
}
