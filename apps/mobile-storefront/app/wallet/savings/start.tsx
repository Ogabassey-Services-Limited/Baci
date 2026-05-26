import { Stack } from 'expo-router';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { StartSavingsScreen } from '@/components/wallet/savings/StartSavingsScreen';

export default function WalletStartSavingsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Start Savings' }} />
      <StorefrontScreenShell edges={['bottom']} themeBackground>
        <StartSavingsScreen />
      </StorefrontScreenShell>
    </>
  );
}
