import { useEffect, useState } from 'react';
import {
  type CustomerPaymentMethod,
  listCustomerPaymentMethods,
} from '@/lib/customer-savings';
import type { SavingsSourceMode } from './start-savings.types';
import { getErrorMessage } from './start-savings-controller.utils';

type UseStartSavingsPaymentMethodsInput = {
  activeMerchantId?: string;
  activeMerchantSlug?: string;
  sourceMode: SavingsSourceMode;
};

export function useStartSavingsPaymentMethods({
  activeMerchantId,
  activeMerchantSlug,
  sourceMode,
}: UseStartSavingsPaymentMethodsInput) {
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<
    CustomerPaymentMethod[]
  >([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<
    string | null
  >(null);
  const [paymentMethodsError, setPaymentMethodsError] = useState<string | null>(
    null
  );
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);

  useEffect(() => {
    if (sourceMode !== 'auto_debit') {
      setPaymentMethodsError(null);
      setIsLoadingPaymentMethods(false);
      setSavedPaymentMethods([]);
      setSelectedPaymentMethodId(null);
      return;
    }
    let isCancelled = false;
    setIsLoadingPaymentMethods(true);
    setPaymentMethodsError(null);
    void listCustomerPaymentMethods({
      merchantId: activeMerchantId,
      merchantSlug: activeMerchantSlug,
    })
      .then((methods) => {
        if (isCancelled) {
          return;
        }
        setSavedPaymentMethods(methods);
        setSelectedPaymentMethodId((currentId) =>
          currentId && methods.some((method) => method.id === currentId)
            ? currentId
            : null
        );
      })
      .catch((error) => {
        if (!isCancelled) {
          setPaymentMethodsError(
            getErrorMessage(error, 'Unable to load saved cards.')
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingPaymentMethods(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeMerchantId, activeMerchantSlug, sourceMode]);

  return {
    isLoadingPaymentMethods,
    paymentMethodsError,
    savedPaymentMethods,
    selectedPaymentMethodId,
    setPaymentMethodsError,
    setSelectedPaymentMethodId,
  };
}
