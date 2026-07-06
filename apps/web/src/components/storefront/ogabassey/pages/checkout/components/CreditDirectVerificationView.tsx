'use client';

import { Clock, ShieldCheck, XCircle } from 'lucide-react';
import type { CreditDirectVerificationPhase } from '../hooks/use-credit-direct-verification';

interface CreditDirectVerificationViewProps {
  phase: Exclude<CreditDirectVerificationPhase, 'idle' | 'confirmed'>;
  onKeepWaiting: () => void;
  onRetryPayment: () => void;
  onReturnHome: () => void;
}

/**
 * Shown when a customer returns to the BNPL launcher after the Credit Direct
 * hosted popup flow. The SDK cannot report success across that navigation, so
 * this view reflects the server-verified order status instead of silently
 * relaunching checkout.
 */
export function CreditDirectVerificationView({
  phase,
  onKeepWaiting,
  onRetryPayment,
  onReturnHome,
}: CreditDirectVerificationViewProps) {
  if (phase === 'polling') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="relative size-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-store-primary rounded-full border-t-transparent animate-spin"></div>
            <ShieldCheck
              aria-hidden="true"
              className="absolute inset-0 m-auto text-store-primary size-8"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Confirming your payment
          </h1>
          <p className="text-gray-500">
            We&apos;re checking the status of your Credit Direct application…
          </p>
          <p className="text-xs text-gray-400 mt-8">
            Please do not close this window.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="size-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle aria-hidden="true" className="size-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Order cancelled
          </h2>
          <p className="text-gray-600 mb-6">
            This order can no longer be paid. Please start a new checkout if
            you still want these items.
          </p>
          <button
            type="button"
            onClick={onReturnHome}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
        <div className="size-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock aria-hidden="true" className="size-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Payment confirmation pending
        </h2>
        <p className="text-gray-600 mb-6">
          If you completed your Credit Direct application, your order will be
          confirmed automatically and you&apos;ll receive an email receipt —
          you will not be charged twice. You can keep checking or try the
          payment again.
        </p>
        <button
          type="button"
          onClick={onKeepWaiting}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
        >
          Keep checking
        </button>
        <button
          type="button"
          onClick={onRetryPayment}
          className="w-full mt-3 py-3 border border-gray-300 text-gray-900 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Try payment again
        </button>
        <button
          type="button"
          onClick={onReturnHome}
          className="w-full mt-3 py-3 text-gray-600 font-medium hover:text-gray-900 transition-colors"
        >
          Return to Home
        </button>
      </div>
    </div>
  );
}
