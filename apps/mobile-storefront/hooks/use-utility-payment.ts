import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { listSavedVtuCards, type VTUPaymentGateway } from '@/lib/vtu-checkout';
import type { WalletSelection } from '@/lib/wallet-payment-helpers';
import {
  getEnabledPaymentMethods,
  useMerchantPaymentSettings,
} from './useMerchantPaymentSettings';
import { useWallet } from './use-wallet';
import { useAuthStore } from '@/stores/auth-store';

export type UtilityPaymentGateway = VTUPaymentGateway;

const SUPPORTED_UTILITY_GATEWAYS: UtilityPaymentGateway[] = [
  'paystack',
  'korapay',
];

export function useUtilityPayment() {
  const isAuthenticated = useAuthStore((state) => !!state.session);
  const [selectedGateway, setSelectedGateway] =
    useState<UtilityPaymentGateway>('paystack');
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  const [walletSelection, setWalletSelection] = useState<
    WalletSelection | undefined
  >(undefined);
  // Wallet-only Idempotency-Key. Held in a ref so a network failure
  // doesn't lose the key — the user's retry MUST send the same key
  // for the route's `vtu_idempotency_keys` table to dedupe.
  // Rotated only after a definitive HTTP response (success or 4xx).
  const walletIdempotencyKeyRef = useRef<string | null>(null);
  const paymentSettings = useMerchantPaymentSettings();
  const wallet = useWallet();
  const walletBalance = wallet.data?.wallet.balance ?? 0;
  const savedCardsQuery = useQuery({
    enabled: isAuthenticated,
    queryKey: ['vtu-saved-cards'],
    queryFn: listSavedVtuCards,
    refetchOnMount: 'always',
    staleTime: 5 * 60 * 1000,
  });

  const supportedGateways: UtilityPaymentGateway[] = (() => {
    const enabled = getEnabledPaymentMethods(paymentSettings.data);
    const filtered = enabled.filter((method): method is UtilityPaymentGateway =>
      SUPPORTED_UTILITY_GATEWAYS.some((gateway) => gateway === method)
    );

    return filtered.length > 0 ? filtered : ['paystack'];
  })();

  useEffect(() => {
    if (!supportedGateways.includes(selectedGateway)) {
      setSelectedGateway(supportedGateways[0] ?? 'paystack');
    }
  }, [selectedGateway, supportedGateways]);

  useEffect(() => {
    const defaultCard = savedCardsQuery.data?.find((card) => card.is_default);
    if (
      !selectedSavedCardId &&
      selectedGateway === 'paystack' &&
      defaultCard?.id
    ) {
      setSelectedSavedCardId(defaultCard.id);
    }
  }, [savedCardsQuery.data, selectedGateway, selectedSavedCardId]);

  return {
    cards: savedCardsQuery.data ?? [],
    isLoadingCards: savedCardsQuery.isLoading,
    refetchCards: savedCardsQuery.refetch,
    selectedGateway,
    selectedSavedCardId,
    selectGateway: (gateway: UtilityPaymentGateway) => {
      setSelectedSavedCardId(null);
      setSelectedGateway(gateway);
    },
    selectSavedCard: (cardId: string) => {
      setSelectedSavedCardId(cardId);
      setSelectedGateway('paystack');
    },
    supportedGateways,
    walletBalance,
    walletSelection,
    setWalletSelection,
    /**
     * Returns the active wallet-only Idempotency-Key (UUID), creating
     * one on first call. Subsequent calls within the same submit
     * cycle MUST receive the same key — that's the entire dedupe
     * contract with the wallet-only route.
     */
    getWalletIdempotencyKey: () => {
      if (!walletIdempotencyKeyRef.current) {
        walletIdempotencyKeyRef.current = Crypto.randomUUID();
      }
      return walletIdempotencyKeyRef.current;
    },
    /**
     * Clears the cached key after a definitive response (success or
     * 4xx). The next submit will mint a fresh UUID. Network failures
     * (TimeoutError / NetworkError) MUST NOT call this — the key
     * must survive so the user's retry hits the dedupe table.
     */
    resetWalletIdempotencyKey: () => {
      walletIdempotencyKeyRef.current = null;
    },
  };
}
