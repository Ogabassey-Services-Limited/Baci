import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { DARK_COLORS } from '@/constants/theme';
import { useOnboarding } from '@/context/OnboardingContext';
import { useAuth } from '@/hooks/useAuth';
import { useMerchant } from '@/hooks/useMerchant';
import {
  buildStaffInviteRoute,
  getPendingStaffInviteToken,
} from '@/lib/staff-invite-pending';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { hasSeenOnboarding, isLoading: onboardingLoading } = useOnboarding();
  // Only try to fetch merchant if we are authenticated
  const {
    merchant,
    isLoading: merchantLoading,
    error: merchantError,
  } = useMerchant();

  // Only auth + onboarding gate the initial branch. The merchant fetch is
  // awaited later so a pending staff invite can be resumed before any
  // merchant-based routing.
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

  // 1. Initial Launch -> Onboarding
  if (!hasSeenOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // 2. Resume a pending staff invite BEFORE the auth/merchant branches. The
  // invite screen itself decides what to do (unauthenticated -> account-only
  // staff signup; authenticated -> accept), so this must run for signed-out
  // invitees too. Otherwise a cold start after /invite saved a token would drop
  // an unauthenticated invitee on the generic login/register screens, from
  // which merchant registration would create the owner store that pins them.
  // The retry error's "Cancel" action clears the token, so this can't trap a
  // user in a redirect loop.
  const pendingInviteToken = getPendingStaffInviteToken();
  if (pendingInviteToken) {
    return <Redirect href={buildStaffInviteRoute(pendingInviteToken)} />;
  }

  // 3. Not Authenticated -> Login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 4. Wait for the merchant context before deciding owner vs no-merchant.
  if (merchantLoading && merchant === null) {
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

  // 5. Merchant fetch failed -> show an error instead of misrouting an existing
  // owner into onboarding (which risks a duplicate merchant). Mirrors AuthLayout.
  if (merchantError) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: DARK_COLORS.background,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Text style={{ color: '#DC2626', textAlign: 'center' }}>
          Unable to load your merchant profile right now.
        </Text>
      </View>
    );
  }

  // 6. Authenticated but No Merchant -> Complete Profile
  if (!merchant) {
    if (__DEV__) {
      console.log(
        '[Index] Authenticated default redirect to Complete Profile (No Merchant)'
      );
    }
    return <Redirect href="/(auth)/complete-profile" />;
  }

  // 7. Authenticated & Merchant -> Dashboard
  return <Redirect href="/(admin)/(tabs)" />;
}
