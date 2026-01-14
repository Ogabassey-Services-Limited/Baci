import { Redirect, Stack, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/context/OnboardingContext';
import { View, ActivityIndicator } from 'react-native';
import { DARK_COLORS } from '@/constants/theme';

export default function AuthLayout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasSeenOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const segments = useSegments();

  if (authLoading || onboardingLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: DARK_COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={DARK_COLORS.primary} size="large" />
      </View>
    );
  }

  // If user is authenticated, redirect to admin home
  // EXCEPTION: If we are on the 'verify' screen, let the screen handle the redirect
  // This prevents race conditions where AuthLayout redirects while VerifyScreen is showing success modal
  const inAuthGroup = segments[0] === '(auth)';
  const isVerifyScreen = inAuthGroup && segments[1] === 'verify';

  if (isAuthenticated && hasSeenOnboarding && !isVerifyScreen) {
    return <Redirect href="/(admin)/(tabs)" />;
  }

  // If user has not seen onboarding, and we are NOT in onboarding, redirect to onboarding?
  // Actually, Onboarding is INSIDE this group. Navigation will be handled by the user flow.
  // But if I am at /login and haven't seen onboarding, maybe I should be there?
  // Let's keep it simple: Access control.

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verify" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
