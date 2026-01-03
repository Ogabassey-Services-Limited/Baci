/**
 * Baci Mobile Admin - Root Layout
 * 2025 Best Practice: Auth-aware routing with Expo Router
 */

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Ionicons } from '@expo/vector-icons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, View, StyleSheet, Text } from 'react-native';
import { QueryProvider } from '@/lib/QueryProvider';
import { DARK_COLORS, LIGHT_COLORS } from '@/constants/theme';
import { BagLoader } from '@/components/BagLoader';
import { useAuth } from '@/hooks/useAuth';

SplashScreen.preventAutoHideAsync();

// Custom themes matching our design system
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

// function RootLayoutNav() {
//   const colorScheme = useColorScheme();
//   const isDark = colorScheme === 'dark';
//   const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

//   return (
//     <QueryProvider>
//       <GestureHandlerRootView style={{ flex: 1 }}>
//         <ThemeProvider value={isDark ? AdminDarkTheme : AdminLightTheme}>
//           <StatusBar style={isDark ? 'light' : 'dark'} />
//           {/* <AuthGate colors={colors} /> */}
//            <View style={{ flex: 1, backgroundColor: 'blue', alignItems: 'center', justifyContent: 'center' }}>
//              <Text style={{ fontSize: 32, fontWeight: 'bold', color: 'white' }}>PROVIDERS TEST</Text>
//              <Text style={{ fontSize: 16, color: 'white', textAlign: 'center', marginTop: 10 }}>
//                Query, Gesture, Theme Providers are ACTIVE.
//              </Text>
//            </View>
//         </ThemeProvider>
//      </GestureHandlerRootView>
//     </QueryProvider>
//   );
// }

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    ...FontAwesome.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: 'orange', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading Fonts...</Text>
      </View>
    );
  }

  const isDark = colorScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={isDark ? AdminDarkTheme : AdminLightTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {/* Wrap AuthGate in a flex:1 container to ensure it takes space */}
          <View style={{ flex: 1, backgroundColor: 'yellow' }}>
            <AuthGate colors={colors} />
          </View>
        </ThemeProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}

// Commenting out the rest to ensure no interference
/* 
function LoadingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View
      style={[
        styles.loadingContainer,
        { backgroundColor: isDark ? DARK_COLORS.background : '#f0bf58' },
      ]}
    >
      <BagLoader size={48} />
    </View>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;

  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={isDark ? AdminDarkTheme : AdminLightTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <View style={{ flex: 1, backgroundColor: 'purple', alignItems: 'center', justifyContent: 'center', marginTop: 100 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: 'white' }}>ROOT LAYOUT DEBUG</Text>
            <Text style={{ fontSize: 16, color: 'white' }}>If you see this, the App Entry is working.</Text>
          </View>
          {/* <AuthGate colors={colors} /> *//*}
</ThemeProvider>
</GestureHandlerRootView>
</QueryProvider>
);
}
*/

/**
 * Auth Gate - Handles navigation based on auth state
 * 2025 Pattern: Declarative auth-based routing
 */
function AuthGate({ colors }: { colors: typeof LIGHT_COLORS }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <BagLoader size={48} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontFamily: 'Inter_600SemiBold',
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="order/[id]"
        options={{
          title: 'Order Details',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="product/[id]"
        options={{
          title: 'Edit Product',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="scan"
        options={{
          title: 'Scan Barcode',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
