import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import type { QuizEventResponse } from '@/schemas/quiz';
import { useQuizAgeGate } from './use-quiz-age-gate';

// Shared fixtures/harness for the useQuizAgeGate suites, extracted so neither the
// core-behavior nor the account-switch/concurrency suite exceeds the 300-line
// module limit.
export const event = { id: 'event-1', title: 'Daily Quiz' } as QuizEventResponse;

export function setup(
  overrides: {
    runStart?: (event: QuizEventResponse) => Promise<string | null>;
    updateCustomer?: () => Promise<{ success: boolean; error?: string }>;
    clearStartError?: () => void;
    currentCustomerId?: string | null;
  } = {}
) {
  const runStart = overrides.runStart ?? vi.fn().mockResolvedValue(null);
  const updateCustomer =
    overrides.updateCustomer ?? vi.fn().mockResolvedValue({ success: true });
  const clearStartError = overrides.clearStartError ?? vi.fn();
  const currentCustomerId = overrides.currentCustomerId ?? 'shopper-1';
  const view = renderHook(() =>
    useQuizAgeGate({
      runStart,
      updateCustomer,
      clearStartError,
      currentCustomerId,
    })
  );
  return { view, runStart, updateCustomer, clearStartError };
}
