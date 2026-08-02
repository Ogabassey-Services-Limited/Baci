import { useLayoutEffect, useRef } from 'react';

export interface StaffMerchantScope {
  merchantId: string | null;
  revision: number;
}

export function useStaffMutationLifecycle(merchantId?: string | null) {
  const activeMerchantId = merchantId?.trim() || null;
  const activeScopeRef = useRef<StaffMerchantScope>({
    merchantId: activeMerchantId,
    revision: 0,
  });

  useLayoutEffect(() => {
    if (activeScopeRef.current.merchantId === activeMerchantId) return;
    activeScopeRef.current = {
      merchantId: activeMerchantId,
      revision: activeScopeRef.current.revision + 1,
    };
  }, [activeMerchantId]);

  const captureScope = (): StaffMerchantScope => ({
    ...activeScopeRef.current,
  });
  const isCurrentScope = (scope: StaffMerchantScope | undefined) =>
    scope?.merchantId === activeScopeRef.current.merchantId &&
    scope?.revision === activeScopeRef.current.revision;

  return { captureScope, isCurrentScope };
}
