import { Redirect, useLocalSearchParams } from 'expo-router';
import { UsdtWalletFundingScreen } from '@/components/wallet/UsdtWalletFundingScreen';
import { CONFIG } from '@/lib/config';
import { resolveStorefrontApiBaseUrl } from '@/lib/storefront-api-url';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE_URL = resolveStorefrontApiBaseUrl(
  process.env.EXPO_PUBLIC_STOREFRONT_API_URL,
  process.env.EXPO_PUBLIC_API_URL
);

export default function UsdtWalletFundingRoute() {
  const { amount } = useLocalSearchParams<{ amount?: string }>();
  const customer = useAuthStore((state) => state.customer);
  const accessToken = useAuthStore((state) => state.session?.access_token);
  const numericAmount = Number(amount);
  if (!accessToken) {
    return <Redirect href="/auth/login?returnTo=/wallet/usdt" />;
  }
  return (
    <UsdtWalletFundingScreen
      accessToken={accessToken}
      apiBaseUrl={API_BASE_URL}
      customerName={
        [customer?.first_name, customer?.last_name].filter(Boolean).join(' ') ||
        undefined
      }
      customerPhone={customer?.phone ?? undefined}
      initialAmount={
        Number.isFinite(numericAmount) &&
        numericAmount >= 1 &&
        numericAmount <= 10_000
          ? numericAmount
          : undefined
      }
      merchantSlug={CONFIG.MERCHANT_SLUG || 'ogabassey'}
    />
  );
}
