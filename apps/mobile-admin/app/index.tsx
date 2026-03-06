import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { DARK_COLORS } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasSeenOnboarding, isLoading: onboardingLoading } = useOnboarding();
  // Only try to fetch merchant if we are authenticated
  const { merchant, isLoading: merchantLoading } = useMerchant();

  // Wait for all necessary checks
  const isLoading =
    authLoading ||
    onboardingLoading ||
    (isAuthenticated && merchantLoading && merchant === null);

  if (isLoading) {
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

  // 1. Initial Launch -> Onboarding
  if (!hasSeenOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // 2. Not Authenticated -> Login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Authenticated with an incomplete merchant profile -> Complete Profile
  // Loading is handled above; this branch covers missing business_name or slug.
  if (!merchant?.business_name || !merchant.slug) {
    if (__DEV__) {
      console.log(
        '[Index] Authenticated default redirect to Complete Profile (Incomplete Merchant)'
      );
    }
    return <Redirect href="/(auth)/complete-profile" />;
  }

  // 4. Authenticated & Merchant -> Dashboard
  return <Redirect href="/(admin)/(tabs)" />;
}
