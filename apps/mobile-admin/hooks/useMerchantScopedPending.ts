import { useState } from 'react';

export function useMerchantScopedPending() {
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>(
    {}
  );

  function begin(merchantId: string | null) {
    if (!merchantId) return;
    setPendingCounts((counts) => ({
      ...counts,
      [merchantId]: (counts[merchantId] ?? 0) + 1,
    }));
  }

  function end(merchantId: string | null) {
    if (!merchantId) return;
    setPendingCounts((counts) => {
      const count = counts[merchantId] ?? 0;
      if (count > 1) return { ...counts, [merchantId]: count - 1 };
      const { [merchantId]: _completed, ...remaining } = counts;
      return remaining;
    });
  }

  function isPending(merchantId: string | null) {
    return merchantId !== null && (pendingCounts[merchantId] ?? 0) > 0;
  }

  return { begin, end, isPending };
}
