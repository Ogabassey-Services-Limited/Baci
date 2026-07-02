import {
  getVisibleImeiServiceTierKeysForDevice,
  IMEI_IDENTIFIER_BY_DEVICE,
  IMEI_SERVICE_TIERS,
  type ImeiBrandFilter,
  type ImeiDeviceCategory,
  type ImeiServiceTierKey,
  normalizeDeviceIdentifier,
  RECOMMENDED_TIER_BY_DEVICE,
  resolveInputIdentifier,
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
  // A "both" tier defers to the device's physical identifier, so a laptop/watch
  // tab never accepts a phone IMEI even when the underlying tier allows either.
  const identifier = resolveInputIdentifier(
    currentTier.identifier,
    IMEI_IDENTIFIER_BY_DEVICE[device]
  );
  const visibleTierKeys = getPublicVisibleImeiServiceTierKeys(
    deviceTierGetter,
    selectedBrand,
    expandedViewEnabled
  );
  const displayedTierKeys =
    visibleTierKeys.length > 0 ? visibleTierKeys : [recommendedTier];

  // Switch tiers; if the new tier expects a different identifier (IMEI vs
  // serial) clear the input so stale, wrong-format text never reaches verify.
  // Compare the device-resolved identifiers, not the raw tier ones.
  const applyTier = (nextTier: ImeiServiceTierKey) => {
    const nextIdentifier = resolveInputIdentifier(
      IMEI_SERVICE_TIERS[nextTier].identifier,
      IMEI_IDENTIFIER_BY_DEVICE[device]
    );
    if (nextIdentifier !== identifier) {
      setImei('');
    }
    setSelectedTier(nextTier);
  };

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
      applyTier(nextVisibleTiers[0] ?? recommendedTier);
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
      applyTier(nextVisibleTiers[0] ?? recommendedTier);
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
      onTierSelect={applyTier}
      onTopUpWallet={onTopUpWallet}
      onToggleServices={handleToggleServices}
    />
  );
}
