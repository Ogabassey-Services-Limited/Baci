'use client';

import { AlertCircle } from 'lucide-react';
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
import {
  MANUAL_ACCOUNT_NUMBER_MAX_NORMALIZED_LENGTH,
  MANUAL_ACCOUNT_NUMBER_MAX_RAW_LENGTH,
  normalizeManualAccountNumber,
} from '@/schemas/manual-account-number';
import type { BankFormInput } from './merchant-bank-form-types';

interface MerchantBankAccountFieldsProps {
  isManualBankDetails: boolean;
}

export function MerchantBankAccountFields({
  isManualBankDetails,
}: MerchantBankAccountFieldsProps) {
  const form = useFormContext<BankFormInput>();

  return (
    <>
      {isManualBankDetails && (
        <div className="flex items-start gap-3 rounded-lg border bg-muted/50 p-4 text-muted-foreground text-sm">
          <AlertCircle
            className="size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="font-medium text-foreground">
              Manual invoice bank details
            </p>
            <p>
              These details appear on unpaid invoices and receipts. Transfers
              still need manual confirmation by your team.
            </p>
          </div>
        </div>
      )}

      <FormField
        control={form.control}
        name="accountNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Account Number</FormLabel>
            <FormControl>
              <Input
                placeholder={
                  isManualBankDetails
                    ? 'Enter account number or IBAN'
                    : 'Enter 10-digit account number'
                }
                maxLength={isManualBankDetails ? undefined : 10}
                inputMode={isManualBankDetails ? 'text' : 'numeric'}
                {...field}
                onChange={(event) => {
                  if (isManualBankDetails) {
                    const value = event.target.value;
                    if (
                      value.trim().length <=
                        MANUAL_ACCOUNT_NUMBER_MAX_RAW_LENGTH &&
                      normalizeManualAccountNumber(value).length <=
                        MANUAL_ACCOUNT_NUMBER_MAX_NORMALIZED_LENGTH
                    ) {
                      field.onChange(value);
                    }
                    return;
                  }

                  field.onChange(event.target.value.replace(/\D/g, ''));
                }}
              />
            </FormControl>
            {isManualBankDetails && (
              <FormDescription>
                Use the account identifier your customers should transfer to.
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      {isManualBankDetails && (
        <>
          <FormField
            control={form.control}
            name="bankName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bank Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter bank name"
                    autoComplete="organization"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="accountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter account holder name"
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    </>
  );
}
