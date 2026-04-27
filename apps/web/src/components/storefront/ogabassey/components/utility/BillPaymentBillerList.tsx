'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { BillItem } from './bill-item-selection';

export interface Biller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
  billerIconUrl?: string;
  billItems?: BillItem[];
}

interface BillPaymentBillerListProps {
  billers: Biller[];
  isLoading: boolean;
  label: string;
  selectedBillerId?: string;
  onSelect: (biller: Biller) => void;
}

export function BillPaymentBillerList({
  billers,
  isLoading,
  label,
  selectedBillerId,
  onSelect,
}: BillPaymentBillerListProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, billers.length);
  }, [billers.length]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const isNextKey = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const isPreviousKey = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const isHomeKey = event.key === 'Home';
    const isEndKey = event.key === 'End';

    if (!isNextKey && !isPreviousKey && !isHomeKey && !isEndKey) {
      return;
    }

    event.preventDefault();

    const direction = isNextKey ? 1 : -1;
    const nextIndex = isHomeKey
      ? 0
      : isEndKey
        ? billers.length - 1
        : (currentIndex + direction + billers.length) % billers.length;
    const nextBiller = billers[nextIndex];

    if (nextBiller) {
      onSelect(nextBiller);
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="space-y-1.5">
      <span
        id="biller-selection-label"
        className="text-sm font-medium text-gray-700"
      >
        Select {label} Provider
      </span>
      {isLoading ? (
        <div
          className="flex items-center justify-center py-6 text-gray-400"
          role="status"
          aria-label="Loading providers"
        >
          <Loader2 className="animate-spin mr-2" size={18} />
          Loading providers...
        </div>
      ) : billers.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">
          No providers available for {label}
        </p>
      ) : (
        <div
          className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto"
          role="radiogroup"
          aria-labelledby="biller-selection-label"
        >
          {billers.map((biller, index) => {
            const isSelected = selectedBillerId === biller.billerId;
            return (
              <button
                key={biller.billerId}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected || (!selectedBillerId && index === 0) ? 0 : -1}
                ref={(button) => {
                  buttonRefs.current[index] = button;
                }}
                onClick={() => onSelect(biller)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  'text-left p-3 rounded-xl border-2 transition-all text-sm font-medium',
                  isSelected
                    ? 'border-[var(--store-primary,#ef4444)] bg-[var(--store-primary,#ef4444)]/10 text-[var(--store-primary,#ef4444)]'
                    : 'border-[color:color-mix(in_srgb,var(--store-background-text,#111827)_12%,transparent)] text-[color:color-mix(in_srgb,var(--store-background-text,#111827)_72%,transparent)] hover:border-[color:color-mix(in_srgb,var(--store-primary,#ef4444)_35%,transparent)]'
                )}
              >
                {biller.billerName}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
