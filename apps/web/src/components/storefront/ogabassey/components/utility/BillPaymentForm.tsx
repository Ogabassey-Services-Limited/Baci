'use client';

import { Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { VerificationBadge } from './VerificationBadge';

interface Biller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
  billerIconUrl?: string;
}

const TYPE_LABELS: Record<string, string> = {
  tv: 'TV Subscription',
  power: 'Electricity',
  betting: 'Betting Top-up',
};

const IDENTIFIER_LABELS: Record<string, string> = {
  tv: 'Smart Card Number',
  power: 'Meter Number',
  betting: 'Account ID',
};

const IDENTIFIER_PLACEHOLDERS: Record<string, string> = {
  tv: 'Enter smart card number',
  power: 'Enter meter number',
  betting: 'Enter betting account ID',
};

/** Maps web UI tab names to API bill type values */
const TAB_TO_BILL_TYPE: Record<string, string> = {
  tv: 'cable_tv',
  power: 'electricity',
  betting: 'betting',
};

interface BillPaymentFormProps {
  type: 'tv' | 'power' | 'betting';
  loading: boolean;
  onSubmit: (data: {
    amount: number;
    billItemIdentifier: string;
    customerIdentifier: string;
    billerName: string;
    type: string;
  }) => void;
}

export function BillPaymentForm({
  type,
  loading,
  onSubmit,
}: BillPaymentFormProps) {
  const [billers, setBillers] = useState<Biller[]>([]);
  const [billersLoading, setBillersLoading] = useState(true);
  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [verification, setVerification] = useState<{
    verified: boolean;
    customerName?: string;
    message?: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Fetch billers when type changes
  useEffect(() => {
    setBillers([]);
    setBillersLoading(true);
    setSelectedBiller(null);
    setVerification(null);

    const billType = TAB_TO_BILL_TYPE[type];
    fetch(`/api/vtu/billers?type=${billType}`)
      .then((res) => res.json())
      .then((data) => setBillers(data.billers || []))
      .catch(() => setBillers([]))
      .finally(() => setBillersLoading(false));
  }, [type]);

  const handleVerify = async () => {
    if (!selectedBiller || !customerId) return;
    setVerifying(true);
    setVerification(null);

    try {
      const res = await fetch('/api/vtu/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billItemIdentifier: selectedBiller.billerId,
          customerIdentifier: customerId,
        }),
      });
      const data = await res.json();
      setVerification(data);
    } catch {
      setVerification({ verified: false, message: 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBiller || !verification?.verified || !amount) return;
    onSubmit({
      amount: Number(amount),
      billItemIdentifier: selectedBiller.billerId,
      customerIdentifier: customerId,
      billerName: selectedBiller.billerName,
      type: TAB_TO_BILL_TYPE[type],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Biller Selection */}
      <div className="space-y-1.5">
        <label id="biller-selection-label" className="text-sm font-medium text-gray-700">
          Select {TYPE_LABELS[type]} Provider
        </label>
        {billersLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={18} />
            Loading providers...
          </div>
        ) : billers.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            No providers available for {TYPE_LABELS[type]}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto" role="radiogroup" aria-labelledby="biller-selection-label">
            {billers.map((biller) => (
              <button
                key={biller.billerId}
                type="button"
                role="radio"
                aria-checked={selectedBiller?.billerId === biller.billerId}
                onClick={() => {
                  setSelectedBiller(biller);
                  setVerification(null);
                }}
                className={cn(
                  'text-left p-3 rounded-xl border-2 transition-all text-sm font-medium',
                  selectedBiller?.billerId === biller.billerId
                    ? 'border-red-600 bg-red-50 text-red-700'
                    : 'border-gray-100 hover:border-gray-200 text-gray-700'
                )}
              >
                {biller.billerName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Customer Identifier */}
      {selectedBiller && (
        <div className="space-y-1.5">
          <label htmlFor="customer-identifier" className="text-sm font-medium text-gray-700">
            {IDENTIFIER_LABELS[type]}
          </label>
          <div className="flex gap-2">
            <input
              id="customer-identifier"
              type="text"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setVerification(null);
              }}
              placeholder={IDENTIFIER_PLACEHOLDERS[type]}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all"
              required
            />
            <button
              type="button"
              onClick={handleVerify}
              disabled={!customerId || verifying}
              className="px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              <Search size={16} />
              Verify
            </button>
          </div>
        </div>
      )}

      {/* Verification Result */}
      {(verification || verifying) && (
        <VerificationBadge
          verified={verification?.verified ?? false}
          customerName={verification?.customerName}
          message={verification?.message}
          isLoading={verifying}
        />
      )}

      {/* Amount (shown after verification) */}
      {verification?.verified && (
        <div className="space-y-1.5">
          <label htmlFor="bill-amount" className="text-sm font-medium text-gray-700">Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
              ₦
            </span>
            <input
              id="bill-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none transition-all"
              required
              min="50"
            />
          </div>
        </div>
      )}

      {/* Submit */}
      {verification?.verified && (
        <button
          type="submit"
          disabled={loading || !amount}
          className="w-full bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20 active:scale-95 disabled:opacity-70 disabled:scale-100 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              Processing...
            </>
          ) : (
            <>Pay ₦{amount ? Number(amount).toLocaleString() : '0.00'}</>
          )}
        </button>
      )}

      <p className="text-center text-xs text-gray-400">
        Secured by Kuda Bank
      </p>
    </form>
  );
}
