'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { apiPost } from '@/lib/api-client';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import type { Bank } from '@/lib/paystack';
import { cn } from '@/lib/utils';
import {
  type MerchantBankFormInput,
  type MerchantBankFormValues,
  merchantBankSchema,
} from '@/schemas/merchant-bank';
export type BankFormInput = MerchantBankFormInput;
type BankFormValues = MerchantBankFormValues;

type AccountVerificationResult =
  | { status: 'verified'; accountName: string }
  | { status: 'empty' }
  | { status: 'error'; message: string };

// Hoisted out of the component so React Compiler can lower the verification
// handler (try/finally is not yet supported inside component bodies).
async function resolvePaystackAccount(
  accountNumber: string,
  bankCode: string
): Promise<AccountVerificationResult> {
  try {
    const data = await apiPost<{
      account_name: string;
      account_number: string;
      bank_id: number | null;
    }>('/api/paystack/resolve', { accountNumber, bankCode });

    if (data.account_name) {
      return { status: 'verified', accountName: data.account_name };
    }
    return { status: 'empty' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to verify account. Please try again.',
    };
  }
}

type LoadBanksResult =
  | { status: 'ok'; banks: Bank[] }
  | { status: 'error'; error: unknown };

// Hoisted so the React Compiler can lower the component body (try/finally is
// not yet supported there). Dedupes bank codes from the Paystack banks API.
async function loadPaystackBanks(): Promise<LoadBanksResult> {
  try {
    const response = await fetch('/api/paystack/banks');
    const data = await response.json();
    if (!data.banks) {
      return { status: 'ok', banks: [] };
    }
    const seenCodes = new Set<string>();
    const uniqueBanks = (data.banks as Bank[]).filter((bank) => {
      if (seenCodes.has(bank.code)) {
        return false;
      }
      seenCodes.add(bank.code);
      return true;
    });
    return { status: 'ok', banks: uniqueBanks };
  } catch (error) {
    return { status: 'error', error };
  }
}

type SaveBankResult =
  | { status: 'ok'; accountName: string }
  | { status: 'noop' }
  | { status: 'error'; message: string };

interface SaveBankPayload {
  accountNumber: string;
  bankCode?: string;
  bank_name?: string;
  account_name?: string;
  businessName: string;
  autoPayoutEnabled?: boolean;
}

async function saveBankSubaccount(
  payload: SaveBankPayload
): Promise<SaveBankResult> {
  try {
    const result = await apiPost<{
      success: boolean;
      accountName: string;
      subaccountCode: string | null;
    }>('/api/paystack/subaccount', payload);
    if (result.success) {
      return { status: 'ok', accountName: result.accountName };
    }
    return { status: 'noop' };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Could not save bank details.',
    };
  }
}

interface MerchantBankFormProps {
  countryCode?: string | null;
  initialData?: {
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    bankCode?: string;
    businessName?: string;
    autoPayoutEnabled?: boolean;
  };
  onSuccess?: () => void;
}

export function MerchantBankForm({
  countryCode,
  initialData,
  onSuccess,
}: MerchantBankFormProps) {
  const { toast } = useToast();
  const isPaystackSupported = isBaciPaystackSettlementCountry(countryCode);
  const isManualBankDetails = !isPaystackSupported;
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(isPaystackSupported);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [showBankSuggestions, setShowBankSuggestions] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(
    isPaystackSupported ? initialData?.accountName || null : null
  );
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const verifyRequestIdRef = useRef(0);
  const hideBankSuggestionsTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const hasHydratedAutoPayoutSetting =
    typeof initialData?.autoPayoutEnabled === 'boolean';
  const resolver = zodResolver(merchantBankSchema) as Resolver<
    BankFormInput,
    unknown,
    BankFormValues
  >;

  const form = useForm<BankFormInput, unknown, BankFormValues>({
    resolver,
    defaultValues: {
      accountNumber: initialData?.accountNumber || '',
      bankCode: initialData?.bankCode || '',
      bankName: isManualBankDetails ? initialData?.bankName || '' : '',
      accountName: initialData?.accountName || initialData?.businessName || '',
      businessName: initialData?.businessName || '',
      autoPayoutEnabled: initialData?.autoPayoutEnabled,
      manualBankDetails: isManualBankDetails,
    },
  });

  useEffect(() => {
    const setModeValueOptions = {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: false,
    };

    form.setValue(
      'manualBankDetails',
      isManualBankDetails,
      setModeValueOptions
    );

    if (isManualBankDetails) {
      form.setValue('bankCode', '', setModeValueOptions);
      setBankSearchTerm('');
      setShowBankSuggestions(false);
      setHighlightedIndex(-1);
      setVerifiedName(null);
      setVerificationError(null);
      setIsVerifying(false);
      return;
    }

    form.setValue('bankName', '', setModeValueOptions);
  }, [form, isManualBankDetails]);

  // useWatch (instead of form.watch) keeps React Compiler from skipping this
  // component — form.watch returns interior-mutable values it cannot memoize.
  const accountNumber = useWatch({
    control: form.control,
    name: 'accountNumber',
  });
  const selectedBankCode = useWatch({
    control: form.control,
    name: 'bankCode',
  });
  const autoPayoutEnabled = useWatch({
    control: form.control,
    name: 'autoPayoutEnabled',
  });

  useEffect(() => {
    return () => {
      if (hideBankSuggestionsTimeoutRef.current) {
        clearTimeout(hideBankSuggestionsTimeoutRef.current);
      }
    };
  }, []);

  // Reset bank state during render when the settlement support flips (derived
  // from the `countryCode` prop). Adjusting inline with a prev-prop comparison
  // avoids a stale frame an effect would introduce. `banks`/`isLoadingBanks`
  // already initialize from `isPaystackSupported`, so the first render needs no
  // adjustment — only a runtime change does.
  const [prevIsPaystackSupported, setPrevIsPaystackSupported] =
    useState(isPaystackSupported);
  if (isPaystackSupported !== prevIsPaystackSupported) {
    setPrevIsPaystackSupported(isPaystackSupported);
    setBanks([]);
    setIsLoadingBanks(isPaystackSupported);
  }

  // Fetch banks on mount / when settlement support is enabled. State is set in
  // the async callback so the effect never calls setState synchronously.
  useEffect(() => {
    if (!isPaystackSupported) {
      return;
    }

    let active = true;
    loadPaystackBanks().then((result) => {
      if (!active) return;
      if (result.status === 'ok') {
        setBanks(result.banks);
      } else {
        console.error('Failed to fetch banks:', result.error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load bank list. Please refresh.',
        });
      }
      setIsLoadingBanks(false);
    });

    return () => {
      active = false;
    };
  }, [isPaystackSupported, toast]);

  // Seed the search input with the selected bank's name once banks load,
  // adjusting during render via a prev-comparison instead of an effect (which
  // would briefly render an empty field). Keyed on bankCode + bank availability
  // so it runs only when the resolvable selection first becomes available; user
  // edits to `bankSearchTerm` are preserved because we only seed an empty term.
  const resolvedBankName =
    selectedBankCode && banks.length > 0
      ? (banks.find((b) => b.code === selectedBankCode)?.name ?? '')
      : '';
  const [prevResolvedBankName, setPrevResolvedBankName] =
    useState(resolvedBankName);
  if (resolvedBankName !== prevResolvedBankName) {
    setPrevResolvedBankName(resolvedBankName);
    if (resolvedBankName && !bankSearchTerm) {
      setBankSearchTerm(resolvedBankName);
    }
  }

  // Get selected bank name - for verification logic if needed
  // const selectedBankName = banks.find(b => b.code === selectedBankCode)?.name;

  // A verifiable combination is a supported country with a 10-digit account
  // number and a selected bank.
  const canVerify =
    isPaystackSupported &&
    Boolean(selectedBankCode) &&
    accountNumber.length === 10;
  const verificationKey = canVerify
    ? `${selectedBankCode}:${accountNumber}`
    : '';

  // Reset stale verification UI during render (instead of in an effect) the
  // moment the watched inputs change away from the last verified combination.
  // Routing this through an effect would briefly show the previous result.
  // Seeding `prevVerificationKey` empty makes the first render with a
  // verifiable combination kick off the same reset-then-verify lifecycle the
  // mount effect used to perform.
  const [prevVerificationKey, setPrevVerificationKey] = useState('');
  if (verificationKey !== prevVerificationKey) {
    setPrevVerificationKey(verificationKey);
    setVerifiedName(null);
    setVerificationError(null);
    setIsVerifying(canVerify);
  }

  // Trigger verification when both fields are filled. This synchronizes with
  // the external Paystack resolve API, so state is set in the async callback.
  useEffect(() => {
    if (!canVerify || !selectedBankCode) {
      return;
    }

    const requestId = verifyRequestIdRef.current + 1;
    verifyRequestIdRef.current = requestId;

    resolvePaystackAccount(accountNumber, selectedBankCode).then((result) => {
      if (requestId !== verifyRequestIdRef.current) {
        return;
      }

      if (result.status === 'verified') {
        setVerifiedName(result.accountName);
        // Auto-fill business name if empty
        if (!form.getValues('businessName')) {
          form.setValue('businessName', result.accountName);
        }
      } else if (result.status === 'error') {
        setVerificationError(result.message);
      }

      setIsVerifying(false);
    });
  }, [canVerify, selectedBankCode, accountNumber, form]);

  const onSubmit = (data: BankFormValues) => {
    if (isPaystackSupported && !verifiedName) {
      toast({
        variant: 'destructive',
        title: 'Verification Required',
        description: 'Please wait for account verification to complete.',
      });
      return;
    }

    setIsSubmitting(true);

    const payload: SaveBankPayload = isManualBankDetails
      ? {
          accountNumber: data.accountNumber,
          account_name: data.accountName || data.businessName,
          bank_name: data.bankName,
          businessName: data.businessName,
        }
      : {
          accountNumber: data.accountNumber,
          businessName: data.businessName,
          bankCode: data.bankCode,
        };

    if (
      isPaystackSupported &&
      hasHydratedAutoPayoutSetting &&
      form.formState.dirtyFields.autoPayoutEnabled
    ) {
      payload.autoPayoutEnabled = data.autoPayoutEnabled ?? false;
    }

    return saveBankSubaccount(payload)
      .then((result) => {
        if (result.status === 'ok') {
          toast({
            title: 'Bank Details Saved',
            description: isManualBankDetails
              ? 'Manual bank details will appear on unpaid invoices.'
              : `Verified: ${result.accountName}`,
          });
          onSuccess?.();
          return;
        }
        if (result.status === 'error') {
          toast({
            variant: 'destructive',
            title: 'Save Failed',
            description: result.message,
          });
        }
      })
      .then(() => {
        setIsSubmitting(false);
      });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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

        {/* 1. Account Number */}
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
                  maxLength={isManualBankDetails ? 34 : 10}
                  inputMode={isManualBankDetails ? 'text' : 'numeric'}
                  {...field}
                  onChange={(e) => {
                    const value = isManualBankDetails
                      ? e.target.value
                      : e.target.value.replace(/\D/g, '');
                    field.onChange(value);
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

        {/* 2. Bank Selection - Google-style Autocomplete */}
        {isPaystackSupported && (
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
                      value={
                        // Be careful: if we have a selected bank code but user hasn't typed,
                        // show the bank name. Otherwise show what they are typing.
                        bankSearchTerm
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        setBankSearchTerm(value);
                        setShowBankSuggestions(true);
                        setHighlightedIndex(-1);

                        // If they clear the input, clear the selection
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
                      // Delay hiding suggestions to allow clicking them
                      onBlur={() => {
                        if (hideBankSuggestionsTimeoutRef.current) {
                          clearTimeout(hideBankSuggestionsTimeoutRef.current);
                        }
                        hideBankSuggestionsTimeoutRef.current = setTimeout(
                          () => {
                            setShowBankSuggestions(false);
                            hideBankSuggestionsTimeoutRef.current = null;
                          },
                          200
                        );
                      }}
                      onKeyDown={(e) => {
                        const filteredBanks = banks.filter(
                          (bank) =>
                            bank.name
                              .toLowerCase()
                              .includes(bankSearchTerm.toLowerCase()) ||
                            bank.code.includes(bankSearchTerm)
                        );

                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setHighlightedIndex((prev) =>
                            prev < filteredBanks.length - 1 ? prev + 1 : prev
                          );
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setHighlightedIndex((prev) =>
                            prev > 0 ? prev - 1 : 0
                          );
                        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                          e.preventDefault();
                          const selectedBank = filteredBanks[highlightedIndex];
                          if (selectedBank) {
                            form.setValue('bankCode', selectedBank.code);
                            setBankSearchTerm(selectedBank.name);
                            setShowBankSuggestions(false);
                            setVerifiedName(null);
                            setHighlightedIndex(-1);
                          }
                        } else if (e.key === 'Escape') {
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

                {/* Suggestions Dropdown */}
                {showBankSuggestions && banks.length > 0 && (
                  <div
                    id="bank-listbox"
                    role="listbox"
                    className="absolute top-[75px] w-full max-h-[250px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md z-50"
                  >
                    {banks
                      .filter(
                        (bank) =>
                          bank.name
                            .toLowerCase()
                            .includes(bankSearchTerm.toLowerCase()) ||
                          // Also match prominent synonyms if we wanted, but name search is usually enough
                          bank.code.includes(bankSearchTerm)
                      )
                      .map((bank, index) => (
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
                          onMouseDown={(e) => {
                            // Prevent blur from hiding before click registers
                            e.preventDefault();
                          }}
                          onMouseEnter={() => setHighlightedIndex(index)}
                          onClick={() => {
                            form.setValue('bankCode', bank.code);
                            setBankSearchTerm(bank.name); // Set input to full name
                            setShowBankSuggestions(false);
                            setVerifiedName(null); // Re-verify with new bank
                            setHighlightedIndex(-1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
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
                              field.value === bank.code
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                            aria-hidden="true"
                          />
                          {bank.name}
                        </div>
                      ))}
                    {/* Empty state for search */}
                    {banks.filter(
                      (b) =>
                        b.name
                          .toLowerCase()
                          .includes(bankSearchTerm.toLowerCase()) ||
                        b.code.includes(bankSearchTerm)
                    ).length === 0 && (
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
        )}

        {/* Verification Status */}
        {isPaystackSupported && isVerifying && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Verifying account…
          </div>
        )}

        {isPaystackSupported && verifiedName && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/50 p-4 flex items-start gap-3 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
            <CheckCircle2
              className="size-5 shrink-0 mt-0.5"
              aria-hidden="true"
            />
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

        {/* 4. Payout Automation Settings */}
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
                    Weekly auto-payouts will run using your wallet settings
                    after this bank account is connected.
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
            isSubmitting ||
            isVerifying ||
            (isPaystackSupported && !verifiedName)
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
      </form>
    </Form>
  );
}
