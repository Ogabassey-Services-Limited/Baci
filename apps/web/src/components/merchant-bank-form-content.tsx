'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import { Form } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { isBaciPaystackSettlementCountry } from '@/lib/checkout/payment-gateway-availability';
import type { Bank } from '@/lib/paystack';
import { merchantBankSchema } from '@/schemas/merchant-bank';
import { MerchantBankAccountFields } from './merchant-bank-account-fields';
import { getMerchantBankFormDefaultValues } from './merchant-bank-form-default-values';
import { MerchantBankFormFeedback } from './merchant-bank-form-feedback';
import {
  loadPaystackBanks,
  resolvePaystackAccount,
  saveBankSubaccount,
} from './merchant-bank-form-requests';
import type {
  BankFormInput,
  BankFormValues,
  MerchantBankFormProps,
  SaveBankPayload,
} from './merchant-bank-form-types';
import { MerchantBankPicker } from './merchant-bank-picker';
export function MerchantBankFormContent({
  merchantId,
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
  const saveRequestIdRef = useRef(0);
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
    defaultValues: getMerchantBankFormDefaultValues(
      initialData,
      isManualBankDetails
    ),
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
      saveRequestIdRef.current += 1;
      if (hideBankSuggestionsTimeoutRef.current) {
        clearTimeout(hideBankSuggestionsTimeoutRef.current);
      }
    };
  }, []);
  const [prevIsPaystackSupported, setPrevIsPaystackSupported] =
    useState(isPaystackSupported);
  if (isPaystackSupported !== prevIsPaystackSupported) {
    setPrevIsPaystackSupported(isPaystackSupported);
    setBanks([]);
    setIsLoadingBanks(isPaystackSupported);
  }
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
  const canVerify =
    isPaystackSupported &&
    Boolean(selectedBankCode) &&
    accountNumber.length === 10;
  const verificationKey = canVerify
    ? `${selectedBankCode}:${accountNumber}`
    : '';

  const [prevVerificationKey, setPrevVerificationKey] = useState('');
  if (verificationKey !== prevVerificationKey) {
    setPrevVerificationKey(verificationKey);
    setVerifiedName(null);
    setVerificationError(null);
    setIsVerifying(canVerify);
  }
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
    const saveRequestId = saveRequestIdRef.current + 1;
    saveRequestIdRef.current = saveRequestId;

    const payload: SaveBankPayload = isManualBankDetails
      ? {
          merchantId,
          accountNumber: data.accountNumber,
          account_name: data.accountName || data.businessName,
          bank_name: data.bankName,
          businessName: data.businessName,
        }
      : {
          merchantId,
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
        if (saveRequestId !== saveRequestIdRef.current) {
          return;
        }

        if (result.status === 'ok') {
          toast({
            title: 'Bank Details Saved',
            description: isManualBankDetails
              ? 'Manual bank details will appear on unpaid invoices.'
              : `Verified: ${result.accountName}`,
          });
          onSuccess?.({
            accountName: isManualBankDetails
              ? data.accountName || data.businessName
              : result.accountName,
            accountNumber: data.accountNumber,
            bankCode: data.bankCode || undefined,
            bankName: isManualBankDetails ? data.bankName : resolvedBankName,
            businessName: data.businessName,
            merchantId,
          });
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
      .finally(() => {
        if (saveRequestId === saveRequestIdRef.current) {
          setIsSubmitting(false);
        }
      });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <MerchantBankAccountFields isManualBankDetails={isManualBankDetails} />
        {isPaystackSupported && (
          <MerchantBankPicker
            bankSearchTerm={bankSearchTerm}
            banks={banks}
            highlightedIndex={highlightedIndex}
            hideBankSuggestionsTimeoutRef={hideBankSuggestionsTimeoutRef}
            isLoadingBanks={isLoadingBanks}
            setBankSearchTerm={setBankSearchTerm}
            setHighlightedIndex={setHighlightedIndex}
            setShowBankSuggestions={setShowBankSuggestions}
            setVerifiedName={setVerifiedName}
            showBankSuggestions={showBankSuggestions}
          />
        )}
        <MerchantBankFormFeedback
          autoPayoutEnabled={autoPayoutEnabled}
          hasHydratedAutoPayoutSetting={hasHydratedAutoPayoutSetting}
          isPaystackSupported={isPaystackSupported}
          isSubmitting={isSubmitting}
          isVerifying={isVerifying}
          verificationError={verificationError}
          verifiedName={verifiedName}
        />
      </form>
    </Form>
  );
}
