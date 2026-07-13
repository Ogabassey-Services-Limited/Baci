import type { RepairBookingResult } from '@baci/shared/repairs';
import { useState } from 'react';
import { submitRepairBooking } from '@/lib/repair-catalog-client';
import type { RepairBookingRequest } from '@/lib/repair-catalog-schemas';

export interface UseRepairBookingResult {
  isSubmitting: boolean;
  result: RepairBookingResult | null;
  error: string | null;
  fieldErrors: Record<string, string[]> | null;
  submit: (input: RepairBookingRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Submits a repair booking to `POST /api/storefront/[slug]/repairs/book`.
 * Never throws — callers read `result`/`error` after `submit` resolves, so
 * the booking form can render success/error state without a try/catch.
 */
export function useRepairBooking(): UseRepairBookingResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RepairBookingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<
    string,
    string[]
  > | null>(null);

  const submit = async (input: RepairBookingRequest) => {
    setIsSubmitting(true);
    setError(null);
    setFieldErrors(null);

    try {
      const booked = await submitRepairBooking(input);
      setResult(booked);
    } catch (err) {
      const fallback = 'Failed to submit repair request. Please try again.';
      setError(err instanceof Error ? err.message : fallback);
      const maybeFieldErrors = (
        err as { fieldErrors?: Record<string, string[]> } | undefined
      )?.fieldErrors;
      setFieldErrors(maybeFieldErrors ?? null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setFieldErrors(null);
  };

  return { isSubmitting, result, error, fieldErrors, submit, reset };
}
