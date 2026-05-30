import { Stack } from 'expo-router';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import { ManageCardsScreen } from '@/components/wallet/ManageCardsScreen';

export default function WalletManageCardsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Manage Cards' }} />
      <StorefrontScreenShell edges={['bottom']} themeBackground>
        <ManageCardsScreen />
      </StorefrontScreenShell>
    </>
  );
}
