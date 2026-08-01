'use client';

import { useLayoutEffect, useRef } from 'react';

type TaxSettingsMutation = 'legalEntity' | 'taxId' | 'vat';

export function useTaxSettingsMutationScope(merchantId: string) {
  const activeScopeRef = useRef({ merchantId, mounted: false });
  const generationsRef = useRef<Record<TaxSettingsMutation, number>>({
    legalEntity: 0,
    taxId: 0,
    vat: 0,
  });

  useLayoutEffect(() => {
    activeScopeRef.current = { merchantId, mounted: true };
    return () => {
      activeScopeRef.current.mounted = false;
      generationsRef.current.legalEntity += 1;
      generationsRef.current.taxId += 1;
      generationsRef.current.vat += 1;
    };
  }, [merchantId]);

  const beginRequest = (mutation: TaxSettingsMutation) => {
    const requestMerchantId = merchantId;
    const requestGeneration = ++generationsRef.current[mutation];
    return () =>
      activeScopeRef.current.mounted &&
      activeScopeRef.current.merchantId === requestMerchantId &&
      generationsRef.current[mutation] === requestGeneration;
  };

  return { beginRequest };
}
