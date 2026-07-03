import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import * as NavigationBar from 'expo-navigation-bar';
import { Slot } from 'expo-router';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MobileUpdateController } from '@/components/updates/MobileUpdateController';
import { isRuntimePlatform } from '@/config/runtime-platform';
import { DARK_COLORS, LIGHT_COLORS } from '@/constants/theme';
import { NetworkProvider } from '@/context/NetworkContext';
import { OnboardingProvider } from '@/context/OnboardingContext';
import { useRevenueCat } from '@/hooks/useRevenueCat';
import { QueryProvider } from '@/lib/QueryProvider';
import { initAdminAnalytics } from '@/services/analytics-core';
import { useAuthStore } from '@/stores/auth-store';

SplashScreen.preventAutoHideAsync();

// Module-scope helper: reads the zustand store imperatively (no subscription)
// without referencing the `useAuthStore` hook as a value inside the component,
// which would block React Compiler memoization of RootLayout.
function initializeAuthStore(): () => void {
  return useAuthStore.getState().initialize();
}

const AdminDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: DARK_COLORS.primary,
    background: DARK_COLORS.background,
    card: DARK_COLORS.card,
    text: DARK_COLORS.text,
    border: DARK_COLORS.border,
    notification: DARK_COLORS.notification,
  },
};

const AdminLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: LIGHT_COLORS.primary,
    background: LIGHT_COLORS.background,
    card: LIGHT_COLORS.card,
    text: LIGHT_COLORS.text,
    border: LIGHT_COLORS.border,
    notification: LIGHT_COLORS.notification,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  // Initialize RevenueCat (IAP)
  useRevenueCat();

  useEffect(() => {
    initAdminAnalytics();
  }, []);

  // Initialize auth store ONCE — sets up a single onAuthStateChange listener
  // instead of 21+ independent listeners from each useAuth() call site
  useEffect(() => {
    const unsubscribe = initializeAuthStore();
    return unsubscribe;
  }, []);

  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  useEffect(() => {
    if (!isRuntimePlatform('android')) {
      return;
    }

    void NavigationBar.setStyle(isDark ? 'light' : 'dark');
  }, [isDark]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ThemeProvider value={isDark ? AdminDarkTheme : AdminLightTheme}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
            <NetworkProvider>
              <OnboardingProvider>
                <Slot />
                <MobileUpdateController />
              </OnboardingProvider>
            </NetworkProvider>
          </ThemeProvider>
        </GestureHandlerRootView>
      </QueryProvider>
    </SafeAreaProvider>
  );
}
