import { useEffect, useRef, useState } from 'react';

interface BuilderLoadMerchantParams {
  authLoading: boolean;
  merchantId: string | null;
  merchantLoading: boolean;
  userId: string | null;
}

function clearAiDraftJobIdFromUrl() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has('aiDraftJobId')) return;

  url.searchParams.delete('aiDraftJobId');
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`
  );
}

export function useBuilderLoadMerchantId({
  authLoading,
  merchantId,
  merchantLoading,
  userId,
}: BuilderLoadMerchantParams) {
  const previousMerchantIdRef = useRef<string | null>(null);
  const [loadMerchantId, setLoadMerchantId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || merchantLoading) return;

    if (!userId || !merchantId) {
      setLoadMerchantId(null);
      return;
    }

    if (
      previousMerchantIdRef.current &&
      previousMerchantIdRef.current !== merchantId
    ) {
      clearAiDraftJobIdFromUrl();
    }

    previousMerchantIdRef.current = merchantId;
    setLoadMerchantId(merchantId);
  }, [authLoading, merchantId, merchantLoading, userId]);

  return loadMerchantId;
}
