import { useQuery } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { listSavedVtuCards, type VTUPaymentGateway } from '@/lib/vtu-checkout';
import type { WalletSelection } from '@/lib/wallet-payment-helpers';
import { useAuthStore } from '@/stores/auth-store';
import { useWallet } from './use-wallet';
import {
  getEnabledPaymentMethods,
  useMerchantPaymentSettings,
} from './useMerchantPaymentSettings';

export type UtilityPaymentGateway = VTUPaymentGateway;

// bank_transfer is intentionally NOT a VTU gateway: the VTU initialize
// route maps it to Paystack's hosted pay-with-transfer channel
// (1.5% + ₦100, capped ₦2,000). Bank transfers must go through the
// customer's wallet DVA instead (1%, capped ₦300) — fund wallet, pay wallet.
const SUPPORTED_UTILITY_GATEWAYS: UtilityPaymentGateway[] = [
  'paystack',
  'korapay',
];

export function useUtilityPayment(amount = 0) {
  const isAuthenticated = useAuthStore((state) => !!state.session);
  const [selectedGateway, setSelectedGateway] =
    useState<UtilityPaymentGateway>('paystack');
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(
    null
  );
  const [shouldAutoSelectDefaultCard, setShouldAutoSelectDefaultCard] =
    useState(true);
  // Wallet-first: default ON so eligible balances are applied to the
  // bill automatically (full cover or partial deduct). Users can still
  // opt out via the wallet toggle row.
  const [useWalletPayment, setUseWalletPayment] = useState(true);
  // Wallet-only Idempotency-Key. Held in a ref so a network failure
  // doesn't lose the key — the user's retry MUST send the same key
  // for the route's `vtu_idempotency_keys` table to dedupe.
  // Rotated only after a definitive HTTP response (success or 4xx).
  const walletIdempotencyKeyRef = useRef<string | null>(null);
  const paymentSettings = useMerchantPaymentSettings();
  const wallet = useWallet();
  const walletBalance = wallet.data?.wallet.balance ?? 0;
  const walletError = wallet.error instanceof Error ? wallet.error : null;
  const walletCanRender =
    walletBalance > 0 && !wallet.isLoading && walletError === null;
  const walletSelection: WalletSelection | undefined =
    useWalletPayment && walletCanRender && amount > 0
      ? {
          use: true,
          amount: Math.min(walletBalance, amount),
        }
      : undefined;
  const {
    data: savedCards,
    isLoading: isLoadingCards,
    refetch: refetchCards,
  } = useQuery({
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

  // Render-phase adjustments (react.dev "adjusting state when a prop
  // changes"): both guards converge, so React settles before commit
  // instead of flashing a stale frame through an effect.
  if (!supportedGateways.includes(selectedGateway)) {
    setSelectedGateway(supportedGateways[0] ?? 'paystack');
  }

  const defaultCard = savedCards?.find((card) => card.is_default);
  if (
    shouldAutoSelectDefaultCard &&
    !selectedSavedCardId &&
    selectedGateway === 'paystack' &&
    defaultCard?.id
  ) {
    setSelectedSavedCardId(defaultCard.id);
  }

  return {
    cards: savedCards ?? [],
    isLoadingCards,
    refetchCards,
    selectedGateway,
    selectedSavedCardId,
    selectGateway: (gateway: UtilityPaymentGateway) => {
      setShouldAutoSelectDefaultCard(false);
      setSelectedSavedCardId(null);
      setSelectedGateway(gateway);
    },
    selectSavedCard: (cardId: string) => {
      setShouldAutoSelectDefaultCard(false);
      setSelectedSavedCardId(cardId);
      setSelectedGateway('paystack');
    },
    supportedGateways,
    walletBalance,
    walletCanRender,
    walletError,
    walletIsLoading: wallet.isLoading,
    walletSelection,
    setWalletSelection: (selection: WalletSelection | undefined) => {
      setUseWalletPayment(selection?.use === true);
    },
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
