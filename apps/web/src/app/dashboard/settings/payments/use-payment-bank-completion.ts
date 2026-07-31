import { useLayoutEffect, useRef, useState } from 'react';
import type { MerchantBankFormSavedValues } from '@/components/merchant-bank-form';

export function usePaymentBankCompletion(
  merchantId: string | undefined,
  reloadMerchant: () => void
) {
  const currentMerchantIdRef = useRef<string | null>(null);
  const currentRevisionRef = useRef(0);
  const [merchantRevision, setMerchantRevision] = useState(0);
  const [savedBanks, setSavedBanks] = useState<
    Record<string, MerchantBankFormSavedValues>
  >({});

  useLayoutEffect(() => {
    currentMerchantIdRef.current = merchantId ?? null;
    const nextRevision = currentRevisionRef.current + 1;
    currentRevisionRef.current = nextRevision;
    setMerchantRevision(nextRevision);
  }, [merchantId]);

  const handleBankSaved = (
    expectedMerchantId: string,
    expectedMerchantRevision: number,
    savedBank: MerchantBankFormSavedValues
  ) => {
    if (
      savedBank.merchantId !== expectedMerchantId ||
      currentMerchantIdRef.current !== expectedMerchantId ||
      currentRevisionRef.current !== expectedMerchantRevision
    ) {
      return;
    }
    setSavedBanks((current) => ({
      ...current,
      [expectedMerchantId]: savedBank,
    }));
    reloadMerchant();
  };

  return {
    merchantRevision,
    savedBank: merchantId ? savedBanks[merchantId] : undefined,
    handleBankSaved,
  };
}
