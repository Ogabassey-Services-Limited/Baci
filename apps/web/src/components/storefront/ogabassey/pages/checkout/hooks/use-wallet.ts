'use client';

import type { StorefrontWalletFundingAccount } from '@baci/shared';
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
  fundingAccount: StorefrontWalletFundingAccount | null;
  requiresFundingAccountConsent: boolean;
  walletDvaEnabled: boolean;
  setFundingAccount: (account: StorefrontWalletFundingAccount | null) => void;
  refreshWallet: () => void;
}

export function useWallet({ userId, merchantSlug }: UseWalletOptions): UseWalletReturn {
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletLoading, setWalletLoading] = useState(false);
  const [payWithWallet, setPayWithWallet] = useState(false);
  const [fundingAccount, setFundingAccount] =
    useState<StorefrontWalletFundingAccount | null>(null);
  const [requiresFundingAccountConsent, setRequiresFundingAccountConsent] =
    useState(false);
  const [walletDvaEnabled, setWalletDvaEnabled] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchWalletBalance = () => {
      if (!userId || !merchantSlug) return;

      setWalletLoading(true);
      fetch(`/api/storefront/customer/wallet?merchant=${merchantSlug}`, {
        signal: abortController.signal,
      })
        .then(async (response) => {
          if (!response.ok) return;
          const data = await response.json();
          const balance = Number(data.balance) || 0;
          setWalletBalance(balance);
          setFundingAccount(data.fundingAccount ?? null);
          setRequiresFundingAccountConsent(
            data.requiresFundingAccountConsent === true
          );
          setWalletDvaEnabled(data.walletDvaEnabled === true);
          if (balance > 0) {
            setPayWithWallet(true);
          }
        })
        .catch((error) => {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Failed to fetch wallet balance:', error);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setWalletLoading(false);
          }
        });
    };

    fetchWalletBalance();

    return () => abortController.abort();
  }, [userId, merchantSlug, refreshToken]);

  return {
    walletBalance,
    walletLoading,
    payWithWallet,
    setPayWithWallet,
    setWalletBalance,
    fundingAccount,
    requiresFundingAccountConsent,
    walletDvaEnabled,
    setFundingAccount: (account) => {
      setFundingAccount(account);
      setRequiresFundingAccountConsent(!account);
    },
    refreshWallet: () => setRefreshToken((token) => token + 1),
  };
}
