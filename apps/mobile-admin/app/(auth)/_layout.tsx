import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';

export default function AuthLayout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasSeenOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const { colors } = useTheme();
  const segments = useSegments();

  if (authLoading || onboardingLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // If user is authenticated, redirect to admin home
  // EXCEPTION: If we are on the 'verify' screen, let the screen handle the redirect
  // This prevents race conditions where AuthLayout redirects while VerifyScreen is showing success modal
  const inAuthGroup = segments[0] === '(auth)';
  const authSegment = segments.at(1);
  const isVerifyScreen = inAuthGroup && authSegment === 'verify';
  const isCompleteProfileScreen =
    inAuthGroup && authSegment === 'complete-profile';

  if (
    isAuthenticated &&
    hasSeenOnboarding &&
    !isVerifyScreen &&
    !isCompleteProfileScreen
  ) {
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
      <Stack.Screen
        name="forgot-password"
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="complete-profile"
        options={{ gestureEnabled: false }}
      />
    </Stack>
  );
}
