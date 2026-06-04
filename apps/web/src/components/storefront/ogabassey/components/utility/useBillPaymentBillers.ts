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

export function useBillPaymentBillers(type: string) {
  const [billers, setBillers] = useState<Biller[]>([]);
  const [billersLoading, setBillersLoading] = useState(true);
  const [billersError, setBillersError] = useState<string | null>(null);

  useEffect(() => {
    setBillers([]);
    setBillersLoading(true);
    setBillersError(null);

    const controller = new AbortController();
    const billType =
      BILL_PAYMENT_COPY.tabToBillType[
        type as keyof typeof BILL_PAYMENT_COPY.tabToBillType
      ];
    if (!billType) {
      setBillersLoading(false);
      setBillersError('Unsupported bill type');
      return () => {
        controller.abort();
      };
    }

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
        setBillersError(data.monnifyError ?? data.kudaError ?? null);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Failed to load billers';
        setBillers([]);
        setBillersError(message);
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

  return { billers, billersError, billersLoading };
}
