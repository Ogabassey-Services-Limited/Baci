import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
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
  const { merchant, isLoading: merchantLoading } = useMerchant();

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

  // 2. Not Authenticated -> Login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Resume a pending staff invite BEFORE any merchant-based routing. If the
  // app was killed after staff signup/sign-in but before /invite/{token} ran,
  // an authenticated invitee has no merchant yet and would otherwise be pushed
  // into merchant onboarding (complete-profile) — which creates the owner store
  // that pins them away from the invited store.
  const pendingInviteToken = getPendingStaffInviteToken();
  if (pendingInviteToken) {
    return <Redirect href={buildStaffInviteRoute(pendingInviteToken)} />;
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

  // 5. Authenticated but No Merchant -> Complete Profile
  if (!merchant) {
    if (__DEV__) {
      console.log(
        '[Index] Authenticated default redirect to Complete Profile (No Merchant)'
      );
    }
    return <Redirect href="/(auth)/complete-profile" />;
  }

  // 4. Authenticated & Merchant -> Dashboard
  return <Redirect href="/(admin)/(tabs)" />;
}
