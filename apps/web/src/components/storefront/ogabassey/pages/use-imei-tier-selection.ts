'use client';

import { useState } from 'react';
import {
  IMEI_IDENTIFIER_BY_DEVICE,
  IMEI_SERVICE_TIERS,
  RECOMMENDED_TIER_BY_DEVICE,
  normalizeDeviceIdentifier,
  resolveInputIdentifier,
  type ImeiBrandFilter,
  type ImeiDeviceCategory,
  type ImeiServiceTierKey,
} from '@baci/shared/imei';
import {
  getVisibleWebImeiServiceTierKeys,
  hasAdditionalWebImeiServiceTierKeys,
} from './imei-checker-visible-tiers';

const DEFAULT_BRAND: ImeiBrandFilter = 'apple';

export interface UseImeiTierSelectionResult {
  brand: ImeiBrandFilter;
  canToggleServices: boolean;
  currentTier: (typeof IMEI_SERVICE_TIERS)[ImeiServiceTierKey];
  device: ImeiDeviceCategory;
  displayedTierKeys: ImeiServiceTierKey[];
  identifier: ReturnType<typeof resolveInputIdentifier>;
  imei: string;
  selectedTier: ImeiServiceTierKey;
  showAllServices: boolean;
  onChangeImei: (raw: string) => void;
  onClearImei: () => void;
  onSelectBrand: (brand: ImeiBrandFilter) => void;
  onSelectDevice: (device: ImeiDeviceCategory) => void;
  onSelectTier: (tier: ImeiServiceTierKey) => void;
  onToggleServices: () => void;
}

/**
 * Owns device/brand/tier/identifier-input selection for the web IMEI checker
 * — the web equivalent of mobile's ImeiCheckDevicePage local state, adapted
 * for a single-page (no swipeable-pager) UI: switching device tabs resets
 * tier/brand/imei to that device's defaults rather than persisting separate
 * state per tab (mobile keeps each tab's page mounted; web has no such
 * multi-instance lifecycle to piggyback on).
 */
export function useImeiTierSelection(): UseImeiTierSelectionResult {
  const [device, setDevice] = useState<ImeiDeviceCategory>('smartphone');
  const [brand, setBrand] = useState<ImeiBrandFilter>(DEFAULT_BRAND);
  const [selectedTier, setSelectedTier] = useState<ImeiServiceTierKey>(
    RECOMMENDED_TIER_BY_DEVICE.smartphone
  );
  const [showAllServices, setShowAllServices] = useState(false);
  const [imei, setImei] = useState('');

  const currentTier = IMEI_SERVICE_TIERS[selectedTier];
  const identifier = resolveInputIdentifier(
    currentTier.identifier,
    IMEI_IDENTIFIER_BY_DEVICE[device]
  );

  const expanded = showAllServices;
  let displayedTierKeys = getVisibleWebImeiServiceTierKeys(
    device,
    brand,
    expanded
  );
  if (displayedTierKeys.length === 0) {
    displayedTierKeys = [RECOMMENDED_TIER_BY_DEVICE[device]];
  }
  const canToggleServices = hasAdditionalWebImeiServiceTierKeys(device, brand);

  function applyTier(nextTierKey: ImeiServiceTierKey, forDevice = device) {
    const nextIdentifier = resolveInputIdentifier(
      IMEI_SERVICE_TIERS[nextTierKey].identifier,
      IMEI_IDENTIFIER_BY_DEVICE[forDevice]
    );
    if (nextIdentifier !== identifier) {
      setImei('');
    }
    setSelectedTier(nextTierKey);
  }

  function onSelectDevice(nextDevice: ImeiDeviceCategory) {
    setDevice(nextDevice);
    setBrand(DEFAULT_BRAND);
    setShowAllServices(false);
    setImei('');
    setSelectedTier(RECOMMENDED_TIER_BY_DEVICE[nextDevice]);
  }

  function onSelectBrand(nextBrand: ImeiBrandFilter) {
    setBrand(nextBrand);
    const nextVisible = getVisibleWebImeiServiceTierKeys(
      device,
      nextBrand,
      showAllServices
    );
    if (!nextVisible.includes(selectedTier)) {
      applyTier(nextVisible[0] ?? RECOMMENDED_TIER_BY_DEVICE[device]);
    }
  }

  function onToggleServices() {
    const nextExpanded = !showAllServices;
    setShowAllServices(nextExpanded);
    const nextVisible = getVisibleWebImeiServiceTierKeys(
      device,
      brand,
      nextExpanded
    );
    if (!nextVisible.includes(selectedTier)) {
      applyTier(nextVisible[0] ?? RECOMMENDED_TIER_BY_DEVICE[device]);
    }
  }

  function onChangeImei(raw: string) {
    setImei(normalizeDeviceIdentifier(raw, identifier));
  }

  function onClearImei() {
    setImei('');
  }

  return {
    brand,
    canToggleServices,
    currentTier,
    device,
    displayedTierKeys,
    identifier,
    imei,
    selectedTier,
    showAllServices,
    onChangeImei,
    onClearImei,
    onSelectBrand,
    onSelectDevice,
    onSelectTier: applyTier,
    onToggleServices,
  };
}
