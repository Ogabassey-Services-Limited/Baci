'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';
import { OgabasseyImeiEntry } from './imei-checker-entry';
import { OgabasseyImeiResults } from './imei-results';
import { SERVICE_TIERS } from './imei-checker-tiers';
import type {
  ImeiRequestIdentity,
  ImeiResult,
  ProductSuggestion,
  ServiceTier,
} from './imei-checker-types';

const UNRESOLVED_IMEI_RESPONSE_CODES = new Set([
  'DEBIT_FAILURE_STATE_SAVE_FAILED',
  'IDEMPOTENT_REQUEST_IN_FLIGHT',
  'LOOKUP_RESULT_SAVE_FAILED',
  'REFUND_PENDING',
  'REFUND_STATE_SAVE_FAILED',
  'REFUNDED_STATE_SAVE_FAILED',
]);

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
 * Module-scope request keeps the try/finally clause out of the component body
 * so React Compiler can memoize the checker.
 */
async function performImeiCheck(
  imei: string,
  tier: ServiceTier,
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
    } = await response.json();
    const keepRequestIdentity =
      typeof data?.code === 'string' &&
      UNRESOLVED_IMEI_RESPONSE_CODES.has(data.code);

    if (!response.ok || !data.success) {
      return {
        result: null,
        error: data.error || 'Unable to check IMEI. Please try again.',
        keepRequestIdentity,
        needsWalletFunding:
          response.status === 402 && data.code === 'WALLET_INSUFFICIENT',
      };
    }

    return {
      result: data.data ?? null,
      error: null,
      keepRequestIdentity,
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
  const [imei, setImei] = useState('');
  const [selectedTier, setSelectedTier] = useState<ServiceTier>('full');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsWalletFunding, setNeedsWalletFunding] = useState(false);
  const [result, setResult] = useState<ImeiResult | null>(null);
  const [showTierPicker, setShowTierPicker] = useState(false);
  const [requestIdentity, setRequestIdentity] =
    useState<ImeiRequestIdentity | null>(null);

  // Device search autocomplete state
  const [deviceQuery, setDeviceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<ProductSuggestion | null>(null);
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

  const handleSelectDevice = (device: ProductSuggestion) => {
    setSelectedDevice(device);
    setDeviceQuery(device.name);
    setShowSuggestions(false);
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imei.trim()) return;

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
      idempotencyKey
    );

    if (!outcome.keepRequestIdentity) {
      setRequestIdentity(null);
    }

    if (outcome.error !== null) {
      setError(outcome.error);
    } else {
      setResult(outcome.result);
    }
    setNeedsWalletFunding(outcome.needsWalletFunding);
    setIsLoading(false);
  };

  const currentTier = SERVICE_TIERS[selectedTier];

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1">
        {!result && (
          <OgabasseyImeiEntry
            currentTier={currentTier}
            deviceQuery={deviceQuery}
            error={error}
            imei={imei}
            isLoading={isLoading}
            needsWalletFunding={needsWalletFunding}
            onCheck={handleCheck}
            onDeviceQueryChange={(value) => {
              setDeviceQuery(value);
              setShowSuggestions(true);
              if (!value) setSelectedDevice(null);
              if (value.length < 2) setSuggestions([]);
            }}
            onDeviceSearchFocus={() => setShowSuggestions(true)}
            onImeiChange={setImei}
            onSelectDevice={handleSelectDevice}
            onSelectedTierChange={setSelectedTier}
            onShowTierPickerChange={setShowTierPicker}
            searchLoading={searchLoading}
            selectedDevice={selectedDevice}
            selectedTier={selectedTier}
            showSuggestions={showSuggestions}
            showTierPicker={showTierPicker}
            suggestions={suggestions}
          />
        )}

        <OgabasseyImeiResults
          currentTierName={currentTier.name}
          result={result}
          onReset={() => {
            setResult(null);
            setError(null);
            setNeedsWalletFunding(false);
            setImei('');
          }}
        />
      </div>
    </div>
  );
};
