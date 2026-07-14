import { useEffect, useState } from 'react';
import { applyWalletRouteAction } from '@/components/wallet/apply-wallet-route-action';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import { startWalletFundingSession } from '@/lib/wallet-funding-session';

interface UseWalletRouteActionSetupParams {
  bankTransfer: {
    canCreateFundingAccount: boolean;
    createFundingAccount: () => void;
    hasFundingAccount: boolean;
    hasWalletData: boolean;
    isCreating: boolean;
    needsPhone: boolean;
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
  // customerId is deliberately NOT in this key: async auth hydration flips it
  // undefined→id right after mount, and re-running applyWalletRouteAction then
  // would re-seed a fund URL's amount / reset panels mid-input.
  const routeActionKey = `${routeAction ?? ''}|${routeRequiredAmount}|${walletReturnTo ?? ''}`;
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

  // Re-arm the bank-transfer latch ONLY when the customer changes on a
  // bank-transfer route, so a customer switch provisions the new customer's
  // DVA — without re-running applyWalletRouteAction (which would disturb a
  // fund/redeem/savings surface). Scoped so async customer hydration on a
  // NON-bank-transfer route is a no-op.
  const [prevCustomerId, setPrevCustomerId] = useState(customerId);
  if (customerId !== prevCustomerId) {
    setPrevCustomerId(customerId);
    if (isBankTransferAction) {
      setPendingBankTransfer(true);
    }
  }

  // Landing on `/wallet?action=bank-transfer` IS the moment the customer
  // expressed bank-transfer funding intent — the earliest point at which we know
  // it, and strictly before any account number can be shown (the DVA is created
  // below), so no transfer can have happened yet. Persist it: the credit watch
  // baselines its ledger snapshot on this timestamp, which must survive the
  // customer leaving for their bank app and the screen remounting (or the app
  // being killed) with the credit already in the ledger. Re-running on remount is
  // safe — `startWalletFundingSession` preserves an existing unexpired session
  // rather than restamping it.
  useEffect(() => {
    if (!isBankTransferAction || !customerId) {
      return;
    }
    void startWalletFundingSession(customerId);
  }, [customerId, isBankTransferAction]);

  const {
    canCreateFundingAccount,
    createFundingAccount,
    hasFundingAccount,
    hasWalletData,
    isCreating,
    needsPhone,
  } = bankTransfer;
  useEffect(() => {
    if (!pendingBankTransfer || !hasWalletData) {
      return;
    }
    if (hasFundingAccount) {
      setPendingBankTransfer(false);
      return;
    }
    if (needsPhone) {
      // Can't auto-create without a phone — open the fund panel so its prompt
      // collects it, then let the panel's auto-create complete the intent.
      setShowFundPanel(true);
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
    needsPhone,
    pendingBankTransfer,
    setShowFundPanel,
  ]);
}
