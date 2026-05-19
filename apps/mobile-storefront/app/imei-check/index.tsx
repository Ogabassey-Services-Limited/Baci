import {
  getVisibleImeiServiceTierKeys,
  IMEI_SERVICE_TIERS,
  type ImeiBrandFilter,
  type ImeiServiceTierKey,
  PRIMARY_IMEI_SERVICE_TIERS,
} from '@baci/shared/imei';
import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { ImeiCheckFormView } from '@/components/imei-check/imei-check-form-view';
import { ImeiCheckResultView } from '@/components/imei-check/imei-check-result-view';
import {
  getPublicVisibleImeiServiceTierKeys,
  hasAdditionalPublicImeiServiceTierKeys,
  resolveImeiCheckFailure,
} from '@/components/imei-check/resolve-imei-check-failure';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { useWallet } from '@/hooks/use-wallet';
import { createLogger } from '@/lib/logger';
import {
  ImeiCheckApiResponseSchema,
  type ImeiResult,
  isValidIMEI,
  parseApiResponse,
} from '@/lib/validation';
import { useAuthStore } from '@/stores/auth-store';

const log = createLogger('ImeiChecker');
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ogabassey.com';

export default function ImeiCheckerScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [imei, setImei] = useState('');
  const [selectedTier, setSelectedTier] = useState<ImeiServiceTierKey>('full');
  const [selectedBrand, setSelectedBrand] = useState<ImeiBrandFilter>('all');
  const [showAllServices, setShowAllServices] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ImeiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useAuthStore((state) => state.session);
  const walletQuery = useWallet();
  const activeIdempotencyRef = useRef<{
    imei: string;
    key: string;
    tier: ImeiServiceTierKey;
  } | null>(null);
  const canToggleServices = hasAdditionalPublicImeiServiceTierKeys(
    getVisibleImeiServiceTierKeys,
    selectedBrand
  );
  const expandedViewEnabled = canToggleServices && showAllServices;

  const currentTier = IMEI_SERVICE_TIERS[selectedTier];
  const visibleTierKeys = getPublicVisibleImeiServiceTierKeys(
    getVisibleImeiServiceTierKeys,
    selectedBrand,
    expandedViewEnabled
  );
  const displayedTierKeys =
    visibleTierKeys.length > 0 ? visibleTierKeys : PRIMARY_IMEI_SERVICE_TIERS;

  const handleImeiChange = (text: string) => {
    activeIdempotencyRef.current = null;
    setImei(text.replace(/\D/g, '').slice(0, 15));
  };

  const handleBrandSelect = (brand: ImeiBrandFilter) => {
    activeIdempotencyRef.current = null;
    setSelectedBrand(brand);
    const nextCanToggle = hasAdditionalPublicImeiServiceTierKeys(
      getVisibleImeiServiceTierKeys,
      brand
    );
    const nextExpanded = nextCanToggle && showAllServices;
    if (!nextCanToggle && showAllServices) {
      setShowAllServices(false);
    }
    const nextVisibleTiers = getPublicVisibleImeiServiceTierKeys(
      getVisibleImeiServiceTierKeys,
      brand,
      nextExpanded
    );
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier('full');
    }
  };

  const handleToggleServices = () => {
    if (!canToggleServices) return;
    const nextExpanded = !showAllServices;
    setShowAllServices(nextExpanded);
    const nextVisibleTiers = getPublicVisibleImeiServiceTierKeys(
      getVisibleImeiServiceTierKeys,
      selectedBrand,
      nextExpanded
    );
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier('full');
      activeIdempotencyRef.current = null;
    }
  };

  const handleTierSelect = (tier: ImeiServiceTierKey) => {
    activeIdempotencyRef.current = null;
    setSelectedTier(tier);
  };

  const getIdempotencyKey = () => {
    const active = activeIdempotencyRef.current;
    if (active && active.imei === imei && active.tier === selectedTier) {
      return active.key;
    }

    const key = Crypto.randomUUID();
    activeIdempotencyRef.current = { imei, key, tier: selectedTier };
    return key;
  };

  const clearIdempotencyKey = () => {
    activeIdempotencyRef.current = null;
  };

  const handleTopUpWallet = (amount: number) => {
    const requiredAmount = Math.max(0, Math.ceil(amount));
    router.push(
      `/wallet?action=fund&requiredAmount=${requiredAmount}&returnTo=/imei-check`
    );
  };
  const walletBalance = walletQuery.data?.wallet.balance ?? 0;

  const handleCheck = async () => {
    Keyboard.dismiss();
    if (isLoading) return;

    if (!isValidIMEI(imei)) {
      Alert.alert('Invalid IMEI', 'Please enter a valid 15-digit IMEI number.');
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

    if (walletBalance < currentTier.price) {
      handleTopUpWallet(currentTier.price - walletBalance);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const idempotencyKey = getIdempotencyKey();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
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
          body: JSON.stringify({ imei, tier: selectedTier }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      const rawData = await response.json();
      if (!response.ok || rawData?.error) {
        const outcome = resolveImeiCheckFailure({
          currentTierPrice: currentTier.price,
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
      setResult(validated.data);
    } catch (err) {
      clearTimeout(timeoutId);
      log.error('IMEI check failed:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError(
          'Request timed out. Please check your connection and try again.'
        );
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    clearIdempotencyKey();
    setResult(null);
    setError(null);
    setImei('');
  };

  if (result) {
    return (
      <ImeiCheckResultView
        colors={colors}
        currentTier={currentTier}
        result={result}
        onReset={handleReset}
      />
    );
  }

  return (
    <ImeiCheckFormView
      colors={colors}
      currentTier={currentTier}
      displayedTierKeys={displayedTierKeys}
      error={error}
      imei={imei}
      isLoading={isLoading}
      isWalletError={Boolean(walletQuery.isError)}
      isWalletLoading={Boolean(walletQuery.isLoading)}
      selectedBrand={selectedBrand}
      selectedTier={selectedTier}
      walletBalance={walletBalance}
      canToggleServices={canToggleServices}
      showAllServices={expandedViewEnabled}
      onBrandSelect={handleBrandSelect}
      onChangeImei={handleImeiChange}
      onCheck={handleCheck}
      onClearImei={() => {
        clearIdempotencyKey();
        setImei('');
      }}
      onTierSelect={handleTierSelect}
      onTopUpWallet={handleTopUpWallet}
      onToggleServices={handleToggleServices}
    />
  );
}
