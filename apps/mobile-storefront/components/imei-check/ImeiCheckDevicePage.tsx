import {
  getVisibleImeiServiceTierKeysForDevice,
  IMEI_SERVICE_TIERS,
  type ImeiBrandFilter,
  type ImeiDeviceCategory,
  type ImeiServiceTierKey,
  normalizeDeviceIdentifier,
  RECOMMENDED_TIER_BY_DEVICE,
} from '@baci/shared/imei';
import { useState } from 'react';
import type { ImeiCheckerColors } from './imei-check.types';
import { ImeiCheckFormView } from './imei-check-form-view';
import {
  getPublicVisibleImeiServiceTierKeys,
  hasAdditionalPublicImeiServiceTierKeys,
} from './resolve-imei-check-failure';

interface ImeiCheckDevicePageProps {
  device: ImeiDeviceCategory;
  colors: ImeiCheckerColors;
  error: string | null;
  isLoading: boolean;
  isWalletError: boolean;
  isWalletLoading: boolean;
  walletBalance: number;
  onVerify: (tier: ImeiServiceTierKey, imei: string) => void;
  onTopUpWallet: (amount: number) => void;
}

/**
 * A single swipeable device page. Each device owns its own check-selection
 * state (tier/brand/input); the parent screen owns the shared verify → result
 * flow. Mirrors how each utility page (BillForm) is self-contained.
 */
export function ImeiCheckDevicePage({
  device,
  colors,
  error,
  isLoading,
  isWalletError,
  isWalletLoading,
  walletBalance,
  onVerify,
  onTopUpWallet,
}: ImeiCheckDevicePageProps) {
  const recommendedTier = RECOMMENDED_TIER_BY_DEVICE[device];
  const [selectedTier, setSelectedTier] =
    useState<ImeiServiceTierKey>(recommendedTier);
  const [selectedBrand, setSelectedBrand] = useState<ImeiBrandFilter>('apple');
  const [showAllServices, setShowAllServices] = useState(false);
  const [imei, setImei] = useState('');

  const deviceTierGetter = (brand: ImeiBrandFilter, expanded: boolean) =>
    getVisibleImeiServiceTierKeysForDevice(device, brand, expanded);
  const canToggleServices = hasAdditionalPublicImeiServiceTierKeys(
    deviceTierGetter,
    selectedBrand
  );
  const expandedViewEnabled = canToggleServices && showAllServices;
  const currentTier = IMEI_SERVICE_TIERS[selectedTier];
  const identifier = currentTier.identifier;
  const visibleTierKeys = getPublicVisibleImeiServiceTierKeys(
    deviceTierGetter,
    selectedBrand,
    expandedViewEnabled
  );
  const displayedTierKeys =
    visibleTierKeys.length > 0 ? visibleTierKeys : [recommendedTier];

  const handleBrandSelect = (brand: ImeiBrandFilter) => {
    setSelectedBrand(brand);
    const nextCanToggle = hasAdditionalPublicImeiServiceTierKeys(
      deviceTierGetter,
      brand
    );
    const nextExpanded = nextCanToggle && showAllServices;
    if (!nextCanToggle && showAllServices) {
      setShowAllServices(false);
    }
    const nextVisibleTiers = getPublicVisibleImeiServiceTierKeys(
      deviceTierGetter,
      brand,
      nextExpanded
    );
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier(nextVisibleTiers[0] ?? recommendedTier);
    }
  };

  const handleToggleServices = () => {
    if (!canToggleServices) return;
    const nextExpanded = !showAllServices;
    setShowAllServices(nextExpanded);
    const nextVisibleTiers = getPublicVisibleImeiServiceTierKeys(
      deviceTierGetter,
      selectedBrand,
      nextExpanded
    );
    if (!nextVisibleTiers.includes(selectedTier)) {
      setSelectedTier(nextVisibleTiers[0] ?? recommendedTier);
    }
  };

  return (
    <ImeiCheckFormView
      colors={colors}
      currentTier={currentTier}
      displayedTierKeys={displayedTierKeys}
      error={error}
      identifier={identifier}
      imei={imei}
      isLoading={isLoading}
      isWalletError={isWalletError}
      isWalletLoading={isWalletLoading}
      selectedBrand={selectedBrand}
      selectedDevice={device}
      selectedTier={selectedTier}
      canToggleServices={canToggleServices}
      showAllServices={expandedViewEnabled}
      walletBalance={walletBalance}
      onBrandSelect={handleBrandSelect}
      onChangeImei={(text) =>
        setImei(normalizeDeviceIdentifier(text, identifier))
      }
      onCheck={() => onVerify(selectedTier, imei)}
      onClearImei={() => setImei('')}
      onTierSelect={setSelectedTier}
      onTopUpWallet={onTopUpWallet}
      onToggleServices={handleToggleServices}
    />
  );
}
