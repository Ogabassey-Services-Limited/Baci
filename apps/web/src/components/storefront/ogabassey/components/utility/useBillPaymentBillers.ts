'use client';

import { useEffect, useState } from 'react';
import { BILL_PAYMENT_COPY } from './bill-payment-form-copy';
import type { Biller } from './BillPaymentBillerList';

interface BillersPayload {
  billers?: Biller[];
  error?: string;
  kudaError?: string;
  monnifyError?: string;
}

function getBillersPayload(value: unknown): BillersPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as BillersPayload;
}

function getBillType(type: string): string | undefined {
  return BILL_PAYMENT_COPY.tabToBillType[
    type as keyof typeof BILL_PAYMENT_COPY.tabToBillType
  ];
}

export function useBillPaymentBillers(type: string) {
  const [billers, setBillers] = useState<Biller[]>([]);
  const [billersLoading, setBillersLoading] = useState(() =>
    Boolean(getBillType(type))
  );
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [prevType, setPrevType] = useState(type);

  // Reset fetch state inline during render when the tab changes
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (type !== prevType) {
    setPrevType(type);
    setBillers([]);
    setBillersLoading(Boolean(getBillType(type)));
    setFetchError(null);
  }

  useEffect(() => {
    const billType = getBillType(type);
    if (!billType) {
      return;
    }

    const controller = new AbortController();

    fetch(
      `/api/vtu/billers?type=${encodeURIComponent(billType)}&includeMonnify=true`,
      {
        signal: controller.signal,
      }
    )
      .then(async (res) => {
        const payload = getBillersPayload(await res.json().catch(() => ({})));
        if (!res.ok) {
          throw new Error(
            payload.error || `Failed to load billers: ${res.status}`
          );
        }
        return payload;
      })
      .then((data) => {
        setBillers(data.billers || []);
        setFetchError(data.monnifyError ?? data.kudaError ?? null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Failed to load billers';
        setBillers([]);
        setFetchError(message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBillersLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [type]);

  const billersError = getBillType(type)
    ? fetchError
    : 'Unsupported bill type';

  return { billers, billersError, billersLoading };
}
