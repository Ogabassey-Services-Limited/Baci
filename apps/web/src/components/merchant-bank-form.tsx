'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import type { Bank } from '@/lib/paystack';
import { cn } from '@/lib/utils';

const bankSchema = z.object({
  accountNumber: z.string().length(10, 'Account number must be 10 digits'),
  bankCode: z.string().min(1, 'Please select your bank'),
  businessName: z.string().min(2, 'Business name is required'),
});

type BankFormValues = z.infer<typeof bankSchema>;

interface MerchantBankFormProps {
  initialData?: {
    bankCode?: string;
    accountNumber?: string;
    businessName?: string;
    accountName?: string;
    bankName?: string;
  };
  onSuccess?: () => void;
}

export function MerchantBankForm({
  initialData,
  onSuccess,
}: MerchantBankFormProps) {
  const { toast } = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [showBankSuggestions, setShowBankSuggestions] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(
    initialData?.accountName || null
  );
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const form = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema as any),
    defaultValues: {
      accountNumber: initialData?.accountNumber || '',
      bankCode: initialData?.bankCode || '',
      businessName: initialData?.businessName || '',
    },
  });

  const accountNumber = form.watch('accountNumber');
  const selectedBankCode = form.watch('bankCode');

  // Fetch banks on mount
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const response = await fetch('/api/paystack/banks');
        const data = await response.json();
        if (data.banks) {
          // Filter out duplicate bank codes
          const seenCodes = new Set<string>();
          const uniqueBanks = data.banks.filter((bank: Bank) => {
            if (seenCodes.has(bank.code)) {
              return false;
            }
            seenCodes.add(bank.code);
            return true;
          });
          setBanks(uniqueBanks);
        }
      } catch (error) {
        console.error('Failed to fetch banks:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to load bank list. Please refresh.',
        });
      } finally {
        setIsLoadingBanks(false);
      }
    };

    fetchBanks();
  }, [toast]);

  // Set initial search term when banks load if value exists
  useEffect(() => {
    if (selectedBankCode && banks.length > 0 && !bankSearchTerm) {
      const bank = banks.find((b) => b.code === selectedBankCode);
      if (bank) {
        setBankSearchTerm(bank.name);
      }
    }
  }, [selectedBankCode, banks, bankSearchTerm]);

  // Get selected bank name - for verification logic if needed
  // const selectedBankName = banks.find(b => b.code === selectedBankCode)?.name;

  // Verify account when both account number and bank are provided
  const verifyAccount = useCallback(async () => {
    if (accountNumber.length !== 10 || !selectedBankCode) {
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    setVerifiedName(null);

    try {
      const response = await fetch('/api/paystack/verify-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountNumber, bankCode: selectedBankCode }),
      });

      const data = await response.json();

      if (response.ok && data.accountName) {
        setVerifiedName(data.accountName);
        // Auto-fill business name if empty
        if (!form.getValues('businessName')) {
          form.setValue('businessName', data.accountName);
        }
      } else {
        setVerificationError(data.error || 'Could not verify account');
      }
    } catch {
      setVerificationError('Failed to verify account. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [accountNumber, selectedBankCode, form]);

  // Trigger verification when both fields are filled
  useEffect(() => {
    if (selectedBankCode && accountNumber.length === 10) {
      verifyAccount();
    } else {
      setVerifiedName(null);
      setVerificationError(null);
    }
  }, [selectedBankCode, accountNumber, verifyAccount]);

  const onSubmit = async (data: BankFormValues) => {
    if (!verifiedName) {
      toast({
        variant: 'destructive',
        title: 'Verification Required',
        description: 'Please wait for account verification to complete.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await apiPost<{
        success: boolean;
        accountName: string;
        subaccountCode: string;
      }>('/api/paystack/subaccount', {
        accountNumber: data.accountNumber,
        bankCode: data.bankCode,
        businessName: data.businessName,
      });

      if (result.success) {
        toast({
          title: 'Bank Details Saved',
          description: `Verified: ${result.accountName}`,
        });
        onSuccess?.();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Could not save bank details.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 1. Account Number */}
        <FormField
          control={form.control}
          name="accountNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Account Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter 10-digit account number"
                  maxLength={10}
                  inputMode="numeric"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    field.onChange(value);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 2. Bank Selection - Google-style Autocomplete */}
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
                    onBlur={() =>
                      setTimeout(() => setShowBankSuggestions(false), 200)
                    }
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
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                        aria-selected={field.value === bank.code}
                        tabIndex={0}
                        className={cn(
                          'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
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
                            'mr-2 h-4 w-4',
                            field.value === bank.code
                              ? 'opacity-100'
                              : 'opacity-0'
                          )}
                        />
                        {bank.name}
                      </div>
                    ))}
                  {/* Empty state for search */}
                  {banks.filter((b) =>
                    b.name.toLowerCase().includes(bankSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
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

        {/* Verification Status */}
        {isVerifying && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying account...
          </div>
        )}

        {verifiedName && (
          <div className="rounded-md bg-green-50 dark:bg-green-950/50 p-4 flex items-start gap-3 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Account Verified</p>
              <p className="text-sm">{verifiedName}</p>
            </div>
          </div>
        )}

        {verificationError && (
          <div className="rounded-md bg-red-50 dark:bg-red-950/50 p-4 flex items-center gap-3 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">Verification Failed</p>
              <p className="text-sm">{verificationError}</p>
            </div>
          </div>
        )}

        {/* 3. Business Name - Auto-filled, shown after verification */}
        {verifiedName && (
          <FormField
            control={form.control}
            name="businessName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Business Name</FormLabel>
                <FormControl>
                  <Input placeholder="My Business Name" {...field} />
                </FormControl>
                <FormDescription>
                  This name appears on customer bank statements
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || isVerifying || !verifiedName}
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSubmitting ? 'Saving...' : 'Save Bank Details'}
        </Button>
      </form>
    </Form>
  );
}
