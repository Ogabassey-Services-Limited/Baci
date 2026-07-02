import {
  IMEI_SERVICE_TIERS,
  type ImeiServiceTierKey,
  isValidDeviceIdentifier,
} from '@baci/shared/imei';
import Ionicons from '@react-native-vector-icons/ionicons';
import * as Crypto from 'expo-crypto';
import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Keyboard, Pressable, View } from 'react-native';
import { ImeiCheckPager } from '@/components/imei-check/ImeiCheckPager';
import { ImeiDeviceTabs } from '@/components/imei-check/ImeiDeviceTabs';
import HeroCard from '@/components/imei-check/imei-check-hero-card';
import { ImeiCheckResultView } from '@/components/imei-check/imei-check-result-view';
import { resolveImeiCheckFailure } from '@/components/imei-check/resolve-imei-check-failure';
import { useImeiDeviceNavigation } from '@/components/imei-check/use-imei-device-navigation';
import { StorefrontScreenShell } from '@/components/storefront/StorefrontScreenShell';
import AppKeyboardContainer from '@/components/ui/AppKeyboardContainer';
import { useColorScheme } from '@/components/useColorScheme';
import Colors, { SPACING } from '@/constants/Colors';
import { useWallet } from '@/hooks/use-wallet';
import { createLogger } from '@/lib/logger';
import { resolveStorefrontApiBaseUrl } from '@/lib/storefront-api-url';
import {
  ImeiCheckApiResponseSchema,
  type ImeiResult,
  parseApiResponse,
} from '@/lib/validation';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('ImeiChecker');
const API_BASE_URL = resolveStorefrontApiBaseUrl(
  process.env.EXPO_PUBLIC_STOREFRONT_API_URL,
  process.env.EXPO_PUBLIC_API_URL
);

const getImeiCheckNetworkErrorMessage = (err: unknown) =>
  err instanceof Error && err.name === 'AbortError'
    ? 'Request timed out. Please check your connection and try again.'
    : 'Network error. Please check your connection and try again.';

const handleTopUpWallet = (amount: number): void => {
  const requiredAmount = Math.max(0, Math.ceil(amount));
  router.push(
    `/wallet?action=fund&requiredAmount=${requiredAmount}&returnTo=/imei-check`
  );
};

export default function ImeiCheckerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImeiResult | null>(null);
  const [resultTier, setResultTier] = useState<ImeiServiceTierKey>('full');
  const [error, setError] = useState<string | null>(null);
  // Switching device (tab tap or swipe) clears any stale lookup error.
  const {
    deviceOrder,
    handleDeviceTab,
    handlePageSelected,
    pagerRef,
    selectedDevice,
    visitedDevices,
  } = useImeiDeviceNavigation(() => setError(null));
  const session = useAuthStore((state) => state.session);
  const walletQuery = useWallet();
  const activeIdempotencyRef = useRef<{
    imei: string;
    key: string;
    tier: ImeiServiceTierKey;
  } | null>(null);

  const walletBalance = walletQuery.data?.wallet.balance ?? 0;

  const getIdempotencyKey = (tier: ImeiServiceTierKey, imei: string) => {
    const active = activeIdempotencyRef.current;
    if (active && active.imei === imei && active.tier === tier) {
      return active.key;
    }
    const key = Crypto.randomUUID();
    activeIdempotencyRef.current = { imei, key, tier };
    return key;
  };

  const clearIdempotencyKey = () => {
    activeIdempotencyRef.current = null;
  };

  const handleVerify = async (tier: ImeiServiceTierKey, imei: string) => {
    Keyboard.dismiss();
    if (isLoading) return;

    const serviceTier = IMEI_SERVICE_TIERS[tier];
    if (!isValidDeviceIdentifier(imei, serviceTier.identifier)) {
      Alert.alert(
        serviceTier.identifier === 'serial'
          ? 'Invalid serial'
          : 'Invalid number',
        serviceTier.identifier === 'serial'
          ? 'Please enter a valid device serial number.'
          : serviceTier.identifier === 'imei'
            ? 'Please enter a valid 15-digit IMEI number.'
            : 'Please enter a valid IMEI or serial number.'
      );
      return;
    }

    if (walletQuery.isLoading) {
      setError('Loading wallet balance. Please wait a moment and try again.');
      return;
    }
    if (walletQuery.isError) {
      setError(
        'Wallet balance unavailable. Refresh your wallet and try again.'
      );
      return;
    }
    if (walletBalance < serviceTier.price) {
      handleTopUpWallet(serviceTier.price - walletBalance);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const idempotencyKey = getIdempotencyKey(tier, imei);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    const performCheck = async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/storefront/imei-check`,
        {
          method: 'POST',
          headers: {
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({ imei, tier }),
          signal: controller.signal,
        }
      );

      const rawData = await response.json();
      if (!response.ok || rawData?.error) {
        const outcome = resolveImeiCheckFailure({
          currentTierPrice: serviceTier.price,
          payload: rawData,
          responseStatus: response.status,
          walletBalance,
        });

        if (outcome.shouldClearIdempotencyKey) {
          clearIdempotencyKey();
        }
        if (outcome.shouldRedirectToLogin) {
          router.push('/auth/login?returnTo=/imei-check');
          return;
        }
        if (outcome.topUpAmount !== null) {
          handleTopUpWallet(outcome.topUpAmount);
          return;
        }
        if (outcome.shouldRefetchWallet) {
          await walletQuery.refetch?.();
        }
        if (outcome.errorMessage) {
          setError(outcome.errorMessage);
        }
        return;
      }

      const validated = parseApiResponse(
        ImeiCheckApiResponseSchema,
        rawData,
        'IMEI check API'
      );
      if (!validated?.success || !validated.data) {
        clearIdempotencyKey();
        setError('Invalid response from server. Please try again.');
        return;
      }

      clearIdempotencyKey();
      setResultTier(tier);
      setResult(validated.data);
    };

    await performCheck()
      .catch((err: unknown) => {
        log.error('IMEI check failed:', err);
        setError(getImeiCheckNetworkErrorMessage(err));
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsLoading(false);
      });
  };

  const handleReset = () => {
    clearIdempotencyKey();
    setResult(null);
    setError(null);
  };

  return (
    <StorefrontScreenShell
      edges={['left', 'right']}
      style={{ backgroundColor: colors.background }}
    >
      <Stack.Screen
        options={{
          title: 'IMEI Checker',
          headerLeft: () => (
            <Pressable
              accessibilityHint="Returns to the previous screen"
              accessibilityLabel="Back"
              accessibilityRole="button"
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      {result ? (
        <ImeiCheckResultView
          colors={colors}
          currentTier={IMEI_SERVICE_TIERS[resultTier]}
          result={result}
          onReset={handleReset}
        />
      ) : (
        <AppKeyboardContainer style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: SPACING.md,
              paddingTop: SPACING.sm,
            }}
          >
            <HeroCard colors={colors} />
            <ImeiDeviceTabs
              colors={colors}
              selected={selectedDevice}
              onSelect={handleDeviceTab}
            />
          </View>
          <ImeiCheckPager
            colors={colors}
            error={error}
            initialPage={deviceOrder.indexOf(selectedDevice)}
            isLoading={isLoading}
            isWalletError={Boolean(walletQuery.isError)}
            isWalletLoading={Boolean(walletQuery.isLoading)}
            pagerRef={pagerRef}
            visitedDevices={visitedDevices}
            walletBalance={walletBalance}
            onPageSelected={handlePageSelected}
            onVerify={handleVerify}
            onTopUpWallet={handleTopUpWallet}
          />
        </AppKeyboardContainer>
      )}
    </StorefrontScreenShell>
  );
}
