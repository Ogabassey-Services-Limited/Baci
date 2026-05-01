import { Redirect, Stack, useSegments } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';

export default function AuthLayout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasSeenOnboarding, isLoading: onboardingLoading } = useOnboarding();
  const {
    merchant,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchant();
  const { colors } = useTheme();
  const segments = useSegments();

  const inAuthGroup = segments[0] === '(auth)';
  const authSegment = segments.at(1);
  const isVerifyScreen = inAuthGroup && authSegment === 'verify';
  const isCompleteProfileScreen =
    inAuthGroup && authSegment === 'complete-profile';
  const shouldResolveMerchantRedirect =
    isAuthenticated &&
    hasSeenOnboarding &&
    !isVerifyScreen &&
    !isCompleteProfileScreen;

  if (
    authLoading ||
    onboardingLoading ||
    (shouldResolveMerchantRedirect && merchantLoading)
  ) {
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

  if (shouldResolveMerchantRedirect && merchantError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ color: colors.error ?? '#DC2626' }}>
          Unable to load your merchant profile right now.
        </Text>
      </View>
    );
  }

  if (shouldResolveMerchantRedirect) {
    if (!merchant) {
      return <Redirect href="/(auth)/complete-profile" />;
    }

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
