'use client';

import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import type { BankFormInput } from './merchant-bank-form-types';

interface MerchantBankFormFeedbackProps {
  autoPayoutEnabled: boolean | undefined;
  hasHydratedAutoPayoutSetting: boolean;
  isPaystackSupported: boolean;
  isSubmitting: boolean;
  isVerifying: boolean;
  verificationError: string | null;
  verifiedName: string | null;
}

export function MerchantBankFormFeedback({
  autoPayoutEnabled,
  hasHydratedAutoPayoutSetting,
  isPaystackSupported,
  isSubmitting,
  isVerifying,
  verificationError,
  verifiedName,
}: MerchantBankFormFeedbackProps) {
  const form = useFormContext<BankFormInput>();

  return (
    <>
      {isPaystackSupported && isVerifying && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Verifying account…
        </div>
      )}

      {isPaystackSupported && verifiedName && (
        <div className="rounded-md bg-green-50 dark:bg-green-950/50 p-4 flex items-start gap-3 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
          <CheckCircle2 className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">Account Verified</p>
            <p className="text-sm">{verifiedName}</p>
          </div>
        </div>
      )}

      {isPaystackSupported && verificationError && (
        <div className="rounded-md bg-red-50 dark:bg-red-950/50 p-4 flex items-center gap-3 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
          <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Verification Failed</p>
            <p className="text-sm">{verificationError}</p>
          </div>
        </div>
      )}

      {isPaystackSupported && verifiedName && (
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            Payout Settings
            <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
              Auto-pilot
            </span>
          </h3>

          {hasHydratedAutoPayoutSetting ? (
            <>
              <FormField
                control={form.control}
                name="autoPayoutEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-medium">
                        Automatic Settlements
                      </FormLabel>
                      <FormDescription className="text-xs">
                        Baci will automatically transfer your earnings to this
                        bank account.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        className="size-5 rounded border-gray-300 text-store-primary focus:ring-store-primary"
                        checked={field.value ?? false}
                        onChange={field.onChange}
                        aria-label="Automatic Settlements"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {autoPayoutEnabled && (
                <p className="text-xs text-muted-foreground">
                  Weekly auto-payouts will run using your wallet settings after
                  this bank account is connected.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Auto-payout preferences are managed from Wallet settings after
              your bank account is connected.
            </p>
          )}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={
          isSubmitting || isVerifying || (isPaystackSupported && !verifiedName)
        }
        aria-busy={isSubmitting || isVerifying}
      >
        {isSubmitting && (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        )}
        {isSubmitting ? 'Saving...' : 'Save Bank Details'}
      </Button>
      <p className="sr-only" role="status" aria-live="polite">
        {isSubmitting
          ? 'Saving bank details.'
          : isVerifying
            ? 'Verifying bank account details.'
            : ''}
      </p>
    </>
  );
}
