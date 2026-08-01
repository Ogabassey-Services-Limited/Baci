'use client';

import { Check, Loader2 } from 'lucide-react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { Bank } from '@/lib/paystack';
import { cn } from '@/lib/utils';
import type { BankFormInput } from './merchant-bank-form-types';

interface MerchantBankPickerProps {
  bankSearchTerm: string;
  banks: Bank[];
  highlightedIndex: number;
  hideBankSuggestionsTimeoutRef: RefObject<ReturnType<
    typeof setTimeout
  > | null>;
  isLoadingBanks: boolean;
  setBankSearchTerm: Dispatch<SetStateAction<string>>;
  setHighlightedIndex: Dispatch<SetStateAction<number>>;
  setShowBankSuggestions: Dispatch<SetStateAction<boolean>>;
  setVerifiedName: Dispatch<SetStateAction<string | null>>;
  showBankSuggestions: boolean;
}

export function MerchantBankPicker({
  bankSearchTerm,
  banks,
  highlightedIndex,
  hideBankSuggestionsTimeoutRef,
  isLoadingBanks,
  setBankSearchTerm,
  setHighlightedIndex,
  setShowBankSuggestions,
  setVerifiedName,
  showBankSuggestions,
}: MerchantBankPickerProps) {
  const form = useFormContext<BankFormInput>();
  const filteredBanks = banks.filter(
    (bank) =>
      bank.name.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||
      bank.code.includes(bankSearchTerm)
  );

  return (
    <FormField
      control={form.control}
      name="bankCode"
      render={({ field }) => (
        <FormItem className="flex flex-col relative z-20">
          <FormLabel>Bank</FormLabel>
          <FormControl>
            <div className="relative">
              <Input
                placeholder="Type to search your bank (e.g. GTB, Access)"
                value={bankSearchTerm}
                onChange={(event) => {
                  const value = event.target.value;
                  setBankSearchTerm(value);
                  setShowBankSuggestions(true);
                  setHighlightedIndex(-1);
                  if (value === '') {
                    form.setValue('bankCode', '');
                    setVerifiedName(null);
                  }
                }}
                onFocus={() => {
                  if (bankSearchTerm || banks.length > 0) {
                    setShowBankSuggestions(true);
                  }
                }}
                onBlur={() => {
                  if (hideBankSuggestionsTimeoutRef.current) {
                    clearTimeout(hideBankSuggestionsTimeoutRef.current);
                  }
                  hideBankSuggestionsTimeoutRef.current = setTimeout(() => {
                    setShowBankSuggestions(false);
                    hideBankSuggestionsTimeoutRef.current = null;
                  }, 200);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setHighlightedIndex((previous) =>
                      previous < filteredBanks.length - 1
                        ? previous + 1
                        : previous
                    );
                  } else if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setHighlightedIndex((previous) =>
                      previous > 0 ? previous - 1 : 0
                    );
                  } else if (event.key === 'Enter' && highlightedIndex >= 0) {
                    event.preventDefault();
                    const bank = filteredBanks[highlightedIndex];
                    if (bank) {
                      form.setValue('bankCode', bank.code);
                      setBankSearchTerm(bank.name);
                      setShowBankSuggestions(false);
                      setVerifiedName(null);
                      setHighlightedIndex(-1);
                    }
                  } else if (event.key === 'Escape') {
                    setShowBankSuggestions(false);
                    setHighlightedIndex(-1);
                  }
                }}
                disabled={isLoadingBanks}
                autoComplete="off"
                role="combobox"
                aria-expanded={showBankSuggestions}
                aria-controls="bank-listbox"
                aria-activedescendant={
                  highlightedIndex >= 0
                    ? `bank-option-${highlightedIndex}`
                    : undefined
                }
                aria-autocomplete="list"
              />
              {isLoadingBanks && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2
                    className="size-4 animate-spin text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </FormControl>

          {showBankSuggestions && banks.length > 0 && (
            <div
              id="bank-listbox"
              role="listbox"
              className="absolute top-[75px] w-full max-h-[250px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md z-50"
            >
              {filteredBanks.map((bank, index) => (
                <div
                  key={bank.code}
                  id={`bank-option-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={field.value === bank.code}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-hidden hover:bg-accent hover:text-accent-foreground',
                    field.value === bank.code && 'bg-accent/50',
                    highlightedIndex === index &&
                      'bg-accent text-accent-foreground'
                  )}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    form.setValue('bankCode', bank.code);
                    setBankSearchTerm(bank.name);
                    setShowBankSuggestions(false);
                    setVerifiedName(null);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      form.setValue('bankCode', bank.code);
                      setBankSearchTerm(bank.name);
                      setShowBankSuggestions(false);
                      setVerifiedName(null);
                      setHighlightedIndex(-1);
                    }
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 size-4',
                      field.value === bank.code ? 'opacity-100' : 'opacity-0'
                    )}
                    aria-hidden="true"
                  />
                  {bank.name}
                </div>
              ))}
              {filteredBanks.length === 0 && (
                <div className="py-6 text-center text-muted-foreground text-sm">
                  No bank found.
                </div>
              )}
            </div>
          )}
          <FormDescription>Type your bank name to filter</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
