import { useEffect, useState } from 'react';
import { applyWalletRouteAction } from '@/components/wallet/apply-wallet-route-action';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';

interface UseWalletRouteActionSetupParams {
  bankTransfer: {
    canCreateFundingAccount: boolean;
    createFundingAccount: () => void;
    hasFundingAccount: boolean;
    hasWalletData: boolean;
    isCreating: boolean;
  };
  customerId: string | undefined;
  routeAction: string | undefined;
  routeRequiredAmount: string;
  setFundAmount: (value: string) => void;
  setFundReturnTo: (value: WalletReturnHref | undefined) => void;
  setShowFundPanel: (value: boolean) => void;
  setShowRedeemPanel: (value: boolean) => void;
  setShowSavingsProgressModal: (value: boolean) => void;
  walletReturnTo: WalletReturnHref | undefined;
}

/**
 * Owns wallet route-action synchronisation: re-applies panel state when the
 * route action changes (render-phase, no stale-frame effect), and handles
 * `action=bank-transfer` — choosing "Pay with Bank Transfer" IS the
 * customer's consent, so their wallet funding account (DVA) is created
 * automatically once the wallet loads, unless one already exists (the hero
 * pill then already shows their account number).
 */
export function useWalletRouteActionSetup({
  bankTransfer,
  customerId,
  routeAction,
  routeRequiredAmount,
  setFundAmount,
  setFundReturnTo,
  setShowFundPanel,
  setShowRedeemPanel,
  setShowSavingsProgressModal,
  walletReturnTo,
}: UseWalletRouteActionSetupParams) {
  const isBankTransferAction = routeAction === 'bank-transfer';
  const [pendingBankTransfer, setPendingBankTransfer] =
    useState(isBankTransferAction);
  // customerId is part of the key so a customer switch on the SAME
  // route re-arms the bank-transfer setup (their own DVA is auto-created)
  // instead of staying consumed by the previous customer.
  const routeActionKey = `${customerId ?? ''}|${routeAction ?? ''}|${routeRequiredAmount}|${walletReturnTo ?? ''}`;
  const [prevRouteActionKey, setPrevRouteActionKey] = useState(routeActionKey);
  if (prevRouteActionKey !== routeActionKey) {
    setPrevRouteActionKey(routeActionKey);
    setPendingBankTransfer(isBankTransferAction);
    applyWalletRouteAction({
      routeAction,
      routeRequiredAmount,
      walletReturnTo,
      setFundAmount,
      setFundReturnTo,
      setShowFundPanel,
      setShowRedeemPanel,
      setShowSavingsProgressModal,
    });
  }

  const {
    canCreateFundingAccount,
    createFundingAccount,
    hasFundingAccount,
    hasWalletData,
    isCreating,
  } = bankTransfer;
  useEffect(() => {
    if (!pendingBankTransfer || !hasWalletData) {
      return;
    }
    if (hasFundingAccount) {
      setPendingBankTransfer(false);
      return;
    }
    if (!canCreateFundingAccount || isCreating) {
      return;
    }
    setPendingBankTransfer(false);
    createFundingAccount();
  }, [
    canCreateFundingAccount,
    createFundingAccount,
    hasFundingAccount,
    hasWalletData,
    isCreating,
    pendingBankTransfer,
  ]);
}
