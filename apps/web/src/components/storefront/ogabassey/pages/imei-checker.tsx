'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import {
  isValidDeviceIdentifier,
  type ImeiServiceTierDefinition,
  type ImeiServiceTierKey,
} from '@baci/shared/imei';
import { fetchWithCsrf } from '@/lib/api-client';
import { OgabasseyImeiEntry } from './imei-checker-entry';
import {
  DEFAULT_IMEI_CHECK_ERROR_MESSAGE,
  resolveImeiCheckFailure,
} from './imei-checker-resolve-failure';
import type {
  ImeiRequestIdentity,
  ImeiResult,
  ProductSuggestion,
} from './imei-checker-types';
import { OgabasseyImeiResults } from './imei-results';
import { useImeiTierSelection } from './use-imei-tier-selection';

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

const createFallbackUuid = () => {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const createIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure crypto unavailable');
  }

  return createFallbackUuid();
};

/**
 * Module-scope fetch keeps the try/finally clause out of the component body
 * so React Compiler can memoize the checker.
 */
async function fetchDeviceSuggestions(
  query: string
): Promise<ProductSuggestion[] | null> {
  try {
    const response = await fetch(
      `/api/storefront/products?q=${encodeURIComponent(query)}&limit=5`
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return (
      data.data?.map((p: Record<string, unknown>) => ({
        id: p.id as string,
        name: p.name as string,
        category: p.category as string | undefined,
        image: p.image as string | undefined,
      })) || []
    );
  } catch {
    console.warn('Failed to fetch device suggestions');
    return null;
  }
}

interface ImeiCheckOutcome {
  result: ImeiResult | null;
  error: string | null;
  keepRequestIdentity: boolean;
  needsWalletFunding: boolean;
}

/**
 * The 401/402 branches leave errorMessage null for dedicated UI. Resolve the
 * inline copy here while the 402 funding CTA is rendered separately.
 */
function describeCheckFailure(
  outcome: ReturnType<typeof resolveImeiCheckFailure>
): string {
  if (outcome.errorMessage !== null) {
    return outcome.errorMessage;
  }

  if (outcome.shouldRedirectToLogin) {
    return 'Please sign in to check this device.';
  }

  if (outcome.topUpAmount !== null) {
    return `Insufficient wallet balance. You need ${currencyFormatter.format(outcome.topUpAmount)} more to run this check.`;
  }

  return DEFAULT_IMEI_CHECK_ERROR_MESSAGE;
}

/**
 * Module-scope request keeps the try/finally clause out of the component body
 * so React Compiler can memoize the checker.
 */
async function performImeiCheck(
  imei: string,
  tier: ImeiServiceTierKey,
  tierPrice: number,
  idempotencyKey: string
): Promise<ImeiCheckOutcome> {
  try {
    const response = await fetchWithCsrf('/api/storefront/imei-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ imei, tier }),
    });

    const data: {
      success?: boolean;
      error?: string;
      code?: string;
      data?: ImeiResult;
      balance?: number;
      required?: number;
    } = await response.json();

    if (!response.ok || !data.success) {
      const outcome = resolveImeiCheckFailure({
        currentTierPrice: tierPrice,
        payload: data,
        responseStatus: response.status,
        walletBalance: 0,
      });

      return {
        result: null,
        error: describeCheckFailure(outcome),
        keepRequestIdentity: outcome.shouldPreserveIdempotencyKey,
        needsWalletFunding:
          response.status === 402 && data.code === 'WALLET_INSUFFICIENT',
      };
    }

    return {
      result: data.data ?? null,
      error: null,
      keepRequestIdentity: false,
      needsWalletFunding: false,
    };
  } catch (err) {
    console.error('IMEI check failed:', err);
    return {
      result: null,
      error: 'Network error. Please check your connection and try again.',
      keepRequestIdentity: true,
      needsWalletFunding: false,
    };
  }
}

export const OgabasseyImeiChecker: React.FC = () => {
  const {
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
    onSelectTier,
    onToggleServices,
  } = useImeiTierSelection();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsWalletFunding, setNeedsWalletFunding] = useState(false);
  const [result, setResult] = useState<ImeiResult | null>(null);
  // Snapshot of the tier that actually produced `result`, frozen at request
  // time — the picker's live `currentTier` can change (device/brand/tier
  // switches stay interactive while a check is in flight) before the
  // response arrives, and rendering against the live value would mislabel
  // a completed, paid-for result.
  const [resultTier, setResultTier] = useState<ImeiServiceTierDefinition | null>(
    null
  );
  const [requestIdentity, setRequestIdentity] =
    useState<ImeiRequestIdentity | null>(null);

  // Device search autocomplete state
  const [deviceQuery, setDeviceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [selectedDeviceSuggestion, setSelectedDeviceSuggestion] =
    useState<ProductSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounced search for product suggestions. Suggestions are cleared in the
  // query change handler, so this effect only syncs with the external API.
  useEffect(() => {
    if (deviceQuery.length < 2) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const fetched = await fetchDeviceSuggestions(deviceQuery);
      if (fetched) {
        setSuggestions(fetched);
      }
      setSearchLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [deviceQuery]);

  const handleSelectDeviceSuggestion = (suggestion: ProductSuggestion) => {
    setSelectedDeviceSuggestion(suggestion);
    setDeviceQuery(suggestion.name);
    setShowSuggestions(false);
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDeviceIdentifier(imei, identifier)) return;

    setIsLoading(true);
    setResult(null);
    setError(null);
    setNeedsWalletFunding(false);

    const normalizedImei = imei.trim();
    const existingIdentityMatches =
      requestIdentity?.imei === normalizedImei &&
      requestIdentity.tier === selectedTier;

    let idempotencyKey: string;
    try {
      idempotencyKey = existingIdentityMatches
        ? requestIdentity.key
        : createIdempotencyKey();
    } catch (err) {
      console.error('IMEI check failed:', err);
      setError('Network error. Please check your connection and try again.');
      setNeedsWalletFunding(false);
      setIsLoading(false);
      return;
    }

    if (idempotencyKey !== requestIdentity?.key) {
      setRequestIdentity({
        imei: normalizedImei,
        tier: selectedTier,
        key: idempotencyKey,
      });
    }

    const outcome = await performImeiCheck(
      normalizedImei,
      selectedTier,
      currentTier.price,
      idempotencyKey
    );

    if (!outcome.keepRequestIdentity) {
      setRequestIdentity(null);
    }

    if (outcome.error !== null) {
      setError(outcome.error);
    } else {
      setResult(outcome.result);
      // `currentTier` here is the value closed over at submit time, not the
      // hook's live value at response time — exactly the snapshot needed.
      setResultTier(currentTier);
    }
    setNeedsWalletFunding(outcome.needsWalletFunding);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1">
        {!result && (
          <OgabasseyImeiEntry
            brand={brand}
            canToggleServices={canToggleServices}
            device={device}
            deviceQuery={deviceQuery}
            displayedTierKeys={displayedTierKeys}
            error={error}
            identifier={identifier}
            imei={imei}
            isLoading={isLoading}
            needsWalletFunding={needsWalletFunding}
            onCheck={handleCheck}
            onDeviceQueryChange={(value) => {
              setDeviceQuery(value);
              setShowSuggestions(true);
              if (!value) setSelectedDeviceSuggestion(null);
              if (value.length < 2) setSuggestions([]);
            }}
            onDeviceSearchFocus={() => setShowSuggestions(true)}
            onImeiChange={onChangeImei}
            onSelectBrand={onSelectBrand}
            onSelectDevice={onSelectDevice}
            onSelectDeviceSuggestion={handleSelectDeviceSuggestion}
            onSelectTier={onSelectTier}
            onToggleServices={onToggleServices}
            searchLoading={searchLoading}
            selectedDeviceSuggestion={selectedDeviceSuggestion}
            selectedTier={selectedTier}
            showAllServices={showAllServices}
            showSuggestions={showSuggestions}
            suggestions={suggestions}
          />
        )}

        <OgabasseyImeiResults
          currentTier={resultTier ?? currentTier}
          onReset={() => {
            setResult(null);
            setResultTier(null);
            setError(null);
            setNeedsWalletFunding(false);
            onClearImei();
          }}
          result={result}
        />
      </div>
    </div>
  );
};
