import { Redirect } from 'expo-router';
import { UnlockOrdersScreen } from '@/components/imei-check/unlock-orders-screen';
import { resolveStorefrontApiBaseUrl } from '@/lib/storefront-api-url';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE_URL = resolveStorefrontApiBaseUrl(
  process.env.EXPO_PUBLIC_STOREFRONT_API_URL,
  process.env.EXPO_PUBLIC_API_URL
);

export default function UnlockOrdersRoute() {
  const accessToken = useAuthStore((state) => state.session?.access_token);
  if (!accessToken) {
    return <Redirect href="/auth/login?returnTo=/unlock-orders" />;
  }
  return (
    <UnlockOrdersScreen accessToken={accessToken} apiBaseUrl={API_BASE_URL} />
  );
}
