'use client';

import { Loader2, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  type BillItem,
  getResolvedBillItemCodes,
  resolveBillItemSelection,
  updateBillItemSelection,
} from './bill-item-selection';
import {
  type Biller,
  BillPaymentBillerList,
} from './BillPaymentBillerList';
import { BillItemLevelOptions } from './BillItemLevelOptions';
import { VerificationBadge } from './VerificationBadge';

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

const BILL_ITEM_LABELS: Record<string, string> = {
  tv: 'Package',
  power: 'Meter Type',
  betting: 'Service Type',
};

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
  const [selectedBillItemCodes, setSelectedBillItemCodes] = useState<string[]>(
    []
  );
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [verification, setVerification] = useState<{
    verified: boolean;
    customerName?: string;
    message?: string;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [billersError, setBillersError] = useState<string | null>(null);

  // Fetch billers when type changes
  useEffect(() => {
    setBillers([]);
    setBillersLoading(true);
    setSelectedBiller(null);
    setSelectedBillItemCodes([]);
    setVerification(null);
    setBillersError(null);

    const controller = new AbortController();
    const billType = TAB_TO_BILL_TYPE[type];
    fetch(`/api/vtu/billers?type=${billType}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load billers: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setBillers(data.billers || []);
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

  const billItemSelection = resolveBillItemSelection(
    selectedBiller?.billItems,
    selectedBillItemCodes
  );
  const selectedBillItem = billItemSelection.leaf;
  const selectedBillItemPathLabel = billItemSelection.selectedPath
    .map((item) => item.itemName)
    .join(' / ');
  const requiresBillItemSelection = billItemSelection.levels.length > 0;
  const selectedBillItemIdentifier = requiresBillItemSelection
    ? selectedBillItem?.itemCode
    : selectedBiller?.billerId;
  const isBillItemSelectionComplete =
    !requiresBillItemSelection || billItemSelection.isComplete;
  const isFixedAmount = selectedBillItem?.isAmountFixed ?? false;

  const handleBillerSelect = (biller: Biller) => {
    const nextCodes = getResolvedBillItemCodes(biller.billItems);
    const nextSelection = resolveBillItemSelection(biller.billItems, nextCodes);

    setSelectedBiller(biller);
    setSelectedBillItemCodes(nextCodes);
    setAmount(
      nextSelection.leaf?.isAmountFixed && nextSelection.leaf.amount > 0
        ? String(nextSelection.leaf.amount)
        : ''
    );
    setVerification(null);
  };

  const handleBillItemSelect = (depth: number, billItem: BillItem) => {
    if (!selectedBiller) {
      return;
    }

    const nextCodes = updateBillItemSelection(
      selectedBiller.billItems,
      selectedBillItemCodes,
      depth,
      billItem.itemCode
    );
    const nextSelection = resolveBillItemSelection(
      selectedBiller.billItems,
      nextCodes
    );

    setSelectedBillItemCodes(nextCodes);
    setAmount(
      nextSelection.leaf?.isAmountFixed && nextSelection.leaf.amount > 0
        ? String(nextSelection.leaf.amount)
        : ''
    );
    setVerification(null);
  };

  const handleVerify = async () => {
    if (!selectedBiller || !selectedBillItemIdentifier || !customerId) return;
    setVerifying(true);
    setVerification(null);

    try {
      const res = await fetch('/api/vtu/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billItemIdentifier: selectedBillItemIdentifier,
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
    if (!selectedBiller || !selectedBillItemIdentifier || !verification?.verified || !amount) return;
    onSubmit({
      amount: Number(amount),
      billItemIdentifier: selectedBillItemIdentifier,
      customerIdentifier: customerId,
      billerName: selectedBillItemPathLabel
        ? `${selectedBiller.billerName} - ${selectedBillItemPathLabel}`
        : selectedBiller.billerName,
      type: TAB_TO_BILL_TYPE[type],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <BillPaymentBillerList
        billers={billers}
        isLoading={billersLoading}
        label={TYPE_LABELS[type]}
        selectedBillerId={selectedBiller?.billerId}
        onSelect={handleBillerSelect}
      />
      {billersError && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {billersError}
        </p>
      )}

      {selectedBiller &&
        billItemSelection.levels.map((level) => (
          <BillItemLevelOptions
            key={`${selectedBiller.billerId}-${level.depth}`}
            label={
              level.depth === 0
                ? BILL_ITEM_LABELS[type]
                : `Additional Option ${level.depth}`
            }
            level={level}
            onSelect={handleBillItemSelect}
          />
        ))}

      {/* Customer Identifier */}
      {selectedBiller && isBillItemSelectionComplete && (
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
              disabled={!customerId || !selectedBillItemIdentifier || verifying}
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
              readOnly={isFixedAmount}
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
