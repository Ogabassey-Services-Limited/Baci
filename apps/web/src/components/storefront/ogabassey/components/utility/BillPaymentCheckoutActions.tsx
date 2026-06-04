'use client';

import { Loader2 } from 'lucide-react';
import type { BillPaymentVerification } from './useBillPaymentVerification';
import { VerificationBadge } from './VerificationBadge';

interface BillPaymentCheckoutActionsProps {
  amount: string;
  isFixedAmount: boolean;
  isVerificationCurrent: boolean;
  loading: boolean;
  onAmountChange: (value: string) => void;
  verification: BillPaymentVerification | null;
  verifying: boolean;
}

export function BillPaymentCheckoutActions({
  amount,
  isFixedAmount,
  isVerificationCurrent,
  loading,
  onAmountChange,
  verification,
  verifying,
}: BillPaymentCheckoutActionsProps) {
  const canPay = verification?.verified && isVerificationCurrent;

  return (
    <>
      {(verification || verifying) && (
        <VerificationBadge
          verified={verification?.verified ?? false}
          customerName={verification?.customerName}
          message={verification?.message}
          isLoading={verifying}
        />
      )}

      {canPay && (
        <div className="space-y-1.5">
          <label
            htmlFor="bill-amount"
            className="text-sm font-medium text-gray-700"
          >
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
              ₦
            </span>
            <input
              id="bill-amount"
              type="number"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-hidden transition-all"
              readOnly={isFixedAmount}
              required
              min="50"
            />
          </div>
        </div>
      )}

      {canPay && (
        <button
          type="submit"
          disabled={loading || !amount}
          className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Processing…
            </>
          ) : (
            <>Pay ₦{amount ? Number(amount).toLocaleString() : '0.00'}</>
          )}
        </button>
      )}
    </>
  );
}
