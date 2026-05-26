'use client';

import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';

interface UseWalletOptions {
  userId: string | undefined;
  merchantSlug: string | undefined;
}

interface UseWalletReturn {
  walletBalance: number;
  walletLoading: boolean;
  payWithWallet: boolean;
  setPayWithWallet: (v: boolean) => void;
  setWalletBalance: Dispatch<SetStateAction<number>>;
}

export function useWallet({ userId, merchantSlug }: UseWalletOptions): UseWalletReturn {
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [payWithWallet, setPayWithWallet] = useState(false);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchWalletBalance = async () => {
      if (!userId || !merchantSlug) return;

      setWalletLoading(true);
      try {
        const response = await fetch(
          `/api/storefront/customer/wallet?merchant=${merchantSlug}`,
          { signal: abortController.signal },
        );
        if (response.ok) {
          const data = await response.json();
          const balance = Number(data.balance) || 0;
          setWalletBalance(balance);
          if (balance > 0) {
            setPayWithWallet(true);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Failed to fetch wallet balance:', error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setWalletLoading(false);
        }
      }
    };

    fetchWalletBalance();

    return () => abortController.abort();
  }, [userId, merchantSlug]);

  return { walletBalance, walletLoading, payWithWallet, setPayWithWallet, setWalletBalance };
}
