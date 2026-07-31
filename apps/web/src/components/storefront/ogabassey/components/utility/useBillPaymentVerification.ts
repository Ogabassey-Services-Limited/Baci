'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchWithCsrf } from '@/lib/api-client';

export interface BillPaymentVerification {
  verified: boolean;
  customerName?: string;
  address?: string;
  inputKey?: string;
  message?: string;
  requireValidationRef?: boolean;
  validationReference?: string;
}

export type BillPaymentVerifyPayload =
  | {
      billItemIdentifier: string;
      customerIdentifier: string;
      provider: 'kuda';
    }
  | {
      billerCode: string;
      customerIdentifier: string;
      productCode: string;
      provider: 'monnify';
    };

function getString(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

function getBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

async function readJsonRecord(response: Response) {
  const parsed: unknown = await response.json().catch(() => ({}));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return parsed as Record<string, unknown>;
}

function isAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === 'AbortError' || error.code === DOMException.ABORT_ERR)
  );
}

function toVerification(
  data: Record<string, unknown>,
  inputKey: string
): BillPaymentVerification {
  return {
    verified: data.verified === true,
    customerName: getString(data.customerName),
    address: getString(data.address),
    inputKey,
    message: getString(data.message),
    requireValidationRef: getBoolean(data.requireValidationRef),
    validationReference: getString(data.validationReference),
  };
}

function getErrorMessage(data: Record<string, unknown>, fallback: string) {
  return getString(data.error) ?? getString(data.message) ?? fallback;
}

/**
 * Runs the verification request and maps every outcome to a result value.
 * Returns null when the request was aborted. Module-scope so the
 * try/catch/finally stays outside the hook body.
 */
async function requestVerification(
  payload: BillPaymentVerifyPayload,
  inputKey: string,
  signal: AbortSignal
): Promise<BillPaymentVerification | null> {
  try {
    const res = await fetchWithCsrf('/api/vtu/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    const data = await readJsonRecord(res);

    if (!res.ok) {
      return {
        verified: false,
        inputKey,
        message: getErrorMessage(data, res.statusText || 'Verification failed'),
      };
    }

    return toVerification(data, inputKey);
  } catch (error) {
    if (isAbortError(error)) {
      return null;
    }
    return {
      verified: false,
      inputKey,
      message: 'Verification failed',
    };
  }
}

export function useBillPaymentVerification(): {
  setVerification: (nextVerification: BillPaymentVerification | null) => void;
  verification: BillPaymentVerification | null;
  verify: (payload: BillPaymentVerifyPayload, inputKey: string) => Promise<void>;
  verifying: boolean;
} {
  const [verification, setVerificationState] =
    useState<BillPaymentVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const activeControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
    };
  }, []);

  const setVerification = (
    nextVerification: BillPaymentVerification | null
  ) => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    requestIdRef.current += 1;
    setVerifying(false);
    setVerificationState(nextVerification);
  };

  const verify = async (
    payload: BillPaymentVerifyPayload,
    inputKey: string
  ) => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setVerifying(true);
    setVerificationState(null);

    const result = await requestVerification(
      payload,
      inputKey,
      controller.signal
    );

    if (requestId !== requestIdRef.current) {
      return;
    }

    setVerifying(false);
    if (result) {
      setVerificationState(result);
    }
  };

  return { setVerification, verification, verify, verifying };
}
