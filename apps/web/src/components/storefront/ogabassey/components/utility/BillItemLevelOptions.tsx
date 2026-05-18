'use client';

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { BillItem, BillItemSelectionLevel } from './bill-item-selection';

interface BillItemLevelOptionsProps {
  level: BillItemSelectionLevel;
  label: string;
  onSelect: (depth: number, billItem: BillItem) => void;
}

const currencyFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

export function BillItemLevelOptions({
  level,
  label,
  onSelect,
}: BillItemLevelOptionsProps) {
  const baseId = useId();
  const labelId = `${baseId}-bill-item-level-${level.depth}-label`;
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, level.options.length);
  }, [level.options.length]);

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ) => {
    const isNextKey = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const isPreviousKey = event.key === 'ArrowLeft' || event.key === 'ArrowUp';

    if (!isNextKey && !isPreviousKey) {
      return;
    }

    event.preventDefault();

    const direction = isNextKey ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + level.options.length) % level.options.length;
    const nextBillItem = level.options[nextIndex];

    if (nextBillItem) {
      onSelect(level.depth, nextBillItem);
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  const selectedExists = level.options.some(
    (option) => option.itemCode === level.selectedCode
  );

  return (
    <div className="space-y-1.5">
      <span
        id={labelId}
        className="text-sm font-medium text-store-background-text"
      >
        {label}
      </span>
      <div
        className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {level.options.map((billItem, index) => {
          const isSelected = level.selectedCode === billItem.itemCode;
          const fallbackToFirst =
            (!level.selectedCode || !selectedExists) && index === 0;
          return (
            <button
              key={`${level.depth}-${billItem.itemCode}`}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected || fallbackToFirst ? 0 : -1}
              ref={(button) => {
                buttonRefs.current[index] = button;
              }}
              onClick={() => onSelect(level.depth, billItem)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'text-left p-3 rounded-xl border-2 transition-all text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-store-primary focus-visible:ring-offset-2',
                isSelected
                  ? 'border-store-primary bg-store-primary/10 text-store-primary'
                  : 'border-store-background-text/12 text-store-background-text/72 hover:border-store-primary/35'
              )}
            >
              <span>{billItem.itemName}</span>
              {billItem.isAmountFixed && billItem.amount > 0 ? (
                <span className="block text-xs opacity-75">
                  {currencyFormatter.format(billItem.amount)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
