import {
  getVisibleImeiServiceTierKeys,
  IMEI_SERVICE_TIERS,
  type ImeiBrandFilter,
  type ImeiServiceTierKey,
  PRIMARY_IMEI_SERVICE_TIERS,
} from '@baci/shared/imei';
import { useState } from 'react';
import { Alert, Keyboard } from 'react-native';
import { ImeiCheckFormView } from '@/components/imei-check/imei-check-form-view';
import { ImeiCheckResultView } from '@/components/imei-check/imei-check-result-view';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { createLogger } from '@/lib/logger';
import {
  ImeiCheckApiResponseSchema,
  type ImeiResult,
  isValidIMEI,
  parseApiResponse,
} from '@/lib/validation';

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

  const currentTier = IMEI_SERVICE_TIERS[selectedTier];
  const visibleTierKeys = getVisibleImeiServiceTierKeys(
    selectedBrand,
    showAllServices
  );
  const displayedTierKeys =
    visibleTierKeys.length > 0 ? visibleTierKeys : PRIMARY_IMEI_SERVICE_TIERS;

  const handleImeiChange = (text: string) => {
    setImei(text.replace(/\D/g, '').slice(0, 15));
  };

  const handleBrandSelect = (brand: ImeiBrandFilter) => {
    setSelectedBrand(brand);
    const nextVisibleTiers = getVisibleImeiServiceTierKeys(
      brand,
      showAllServices
    );
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier('full');
    }
  };

  const handleToggleServices = () => {
    const nextExpanded = !showAllServices;
    setShowAllServices(nextExpanded);
    const nextVisibleTiers = getVisibleImeiServiceTierKeys(
      selectedBrand,
      nextExpanded
    );
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier('full');
    }
  };

  const handleCheck = async () => {
    Keyboard.dismiss();
    if (isLoading) return;

    if (!isValidIMEI(imei)) {
      Alert.alert('Invalid IMEI', 'Please enter a valid 15-digit IMEI number.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/storefront/imei-check`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imei, tier: selectedTier }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      const rawData = await response.json();
      if (!response.ok || rawData?.error) {
        setError(rawData?.error || 'Unable to check IMEI. Please try again.');
        return;
      }

      const validated = parseApiResponse(
        ImeiCheckApiResponseSchema,
        rawData,
        'IMEI check API'
      );
      if (!validated?.success || !validated.data) {
        setError('Invalid response from server. Please try again.');
        return;
      }

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
      selectedBrand={selectedBrand}
      selectedTier={selectedTier}
      showAllServices={showAllServices}
      onBrandSelect={handleBrandSelect}
      onChangeImei={handleImeiChange}
      onCheck={handleCheck}
      onClearImei={() => setImei('')}
      onTierSelect={setSelectedTier}
      onToggleServices={handleToggleServices}
    />
  );
}
