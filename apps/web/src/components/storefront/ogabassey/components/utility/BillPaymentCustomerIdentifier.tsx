'use client';

import { Search } from 'lucide-react';

interface BillPaymentCustomerIdentifierProps {
  customerId: string;
  isVerifyDisabled: boolean;
  label: string;
  onCustomerIdChange: (value: string) => void;
  onVerify: () => void;
  placeholder: string;
  verifying: boolean;
}

export function BillPaymentCustomerIdentifier({
  customerId,
  isVerifyDisabled,
  label,
  onCustomerIdChange,
  onVerify,
  placeholder,
  verifying,
}: BillPaymentCustomerIdentifierProps) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor="customer-identifier"
        className="text-sm font-medium text-[var(--store-background-text)]"
      >
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id="customer-identifier"
          type="text"
          value={customerId}
          onChange={(event) => onCustomerIdChange(event.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 rounded-xl border border-[var(--store-border)] focus:border-[var(--store-primary)] focus:ring-1 focus:ring-[var(--store-primary)] outline-hidden transition-all"
          required
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={isVerifyDisabled || verifying}
          aria-busy={verifying}
          className="px-4 py-3 bg-[var(--store-primary)] text-[var(--store-on-primary)] rounded-xl hover:bg-[var(--store-primary)]/90 disabled:opacity-50 transition-all flex items-center gap-1.5"
        >
          <Search size={16} />
          Verify
        </button>
      </div>
    </div>
  );
}
