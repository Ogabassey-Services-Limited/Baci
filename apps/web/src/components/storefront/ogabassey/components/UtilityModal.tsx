'use client';

import { useState } from 'react';
import { useOptionalCustomerAuth } from '@/contexts/customer-auth-context';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { captureClientEvent } from '@/lib/posthog/capture-client-event';
import { WALLET_FUNDING_TELEMETRY } from '@/lib/posthog/wallet-funding-events';
import { useWallet } from '@/components/storefront/ogabassey/pages/checkout/hooks/use-wallet';
import { useUtilityPendingIntent } from './use-utility-pending-intent';
import { useUtilityPurchase } from './use-utility-purchase';
import { AirtimeDataForm } from './utility/AirtimeDataForm';
import { BillPaymentForm } from './utility/BillPaymentForm';
import { UtilityPaymentMethodSelector } from './UtilityPaymentMethodSelector';
import { WalletFundingPanel } from './WalletFundingPanel';
import { UtilitySuccessView } from './UtilitySuccessView';
import { UtilityTabs, type UtilityTabId } from './UtilityTabs';
import type { UtilityPaymentMethod } from './utility-types';

interface UtilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'airtime' | 'data' | 'tv' | 'power' | 'betting';
}

export const UtilityModal = ({
  isOpen,
  onClose,
  initialTab = 'airtime',
}: UtilityModalProps) => {
  const [activeTab, setActiveTab] = useState<UtilityTabId>(initialTab);

  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  const auth = useOptionalCustomerAuth();
  const customer = auth?.customer ?? null;
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const isAuthLoading = auth?.isLoading ?? false;
  const user = auth?.user ?? null;
  const {
    fundingAccount,
    payWithWallet,
    refreshWallet,
    requiresFundingAccountConsent,
    setFundingAccount,
    setPayWithWallet,
    setWalletBalance,
    walletBalance,
    walletDvaEnabled,
    walletLoading,
    walletTransactions,
  } = useWallet({
    merchantSlug: merchant?.slug,
    userId: user?.id,
  });
  // Survives the funding detour (reload / backgrounded-tab eviction while the
  // customer is in their bank app). No-op while the check-loop flag is off.
  const { clearIntent, intent, saveIntent } = useUtilityPendingIntent(
    customer?.id
  );
  const [showFundingPanel, setShowFundingPanel] = useState(false);
  const canUseWallet = isAuthenticated && walletBalance > 0;
  // Offer bank-transfer funding when the merchant has wallet DVAs on and
  // either the customer already has an account (viewing needs no phone) or
  // has a usable phone for creation — otherwise the create-account flow
  // returns WALLET_DVA_DISABLED or CUSTOMER_PHONE_REQUIRED.
  const canFundByBankTransfer =
    isAuthenticated &&
    walletDvaEnabled &&
    (Boolean(fundingAccount) || Boolean(customer?.phone?.trim()));
  const selectedPaymentMethod: UtilityPaymentMethod =
    canUseWallet && payWithWallet ? 'wallet' : 'card';

  const {
    handleAirtimeDataSubmit,
    handleBillSubmit,
    loading,
    setStep,
    step,
    successAmount,
    transactionRef,
  } = useUtilityPurchase({
    activeTab,
    clearIntent,
    customer,
    isAuthLoading,
    isAuthenticated,
    merchantSlug: merchant?.slug,
    selectedPaymentMethod,
    setWalletBalance,
    user,
    walletBalance,
  });

  // Stable identity of the currently owned resume draft; null when there is
  // nothing to resume (flag off, no draft, or auth not hydrated yet).
  const intentKey = intent
    ? `${intent.tab}|${intent.amount}|${intent.phoneNumber}|${intent.networkProvider ?? ''}`
    : null;

  // Reset the view when the modal (re)opens or the requested tab changes.
  // Render-time prev-prop comparison avoids a stale-frame effect round-trip.
  // Init `false` (not `isOpen`) so the seed also runs when the modal is
  // rendered already-open — the reload / backgrounded-tab-eviction case the
  // resume feature exists for.
  const [prevIsOpen, setPrevIsOpen] = useState(false);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  // Which owned intent (if any) has already been applied to the form. Doubles
  // as the form remount key so a late-arriving intent forces a re-seed.
  const [appliedIntentKey, setAppliedIntentKey] = useState<string | null>(null);
  // Detect the exact render where auth hydration reveals the signed-in customer
  // (`customer.id` absent -> present). The late reseed must fire only on THAT
  // transition — not when an already-signed-in customer's own first keystroke
  // saves a draft, which also flips `intent` non-null but must never remount
  // the form mid-typing (that drops input focus / dismisses the keyboard).
  const customerId = customer?.id;
  const [prevCustomerId, setPrevCustomerId] = useState(customerId);
  const customerJustHydrated = Boolean(customerId) && !prevCustomerId;
  if (customerId !== prevCustomerId) {
    setPrevCustomerId(customerId);
  }
  if (isOpen !== prevIsOpen || initialTab !== prevInitialTab) {
    setPrevIsOpen(isOpen);
    setPrevInitialTab(initialTab);
    if (isOpen) {
      // Land on the tab that holds a resumed draft so a `data` draft is not
      // stranded on the default `airtime` tab (paired with the form remount
      // key below). Falls back to the caller's requested tab when there is
      // nothing to resume.
      setActiveTab(intent?.tab ?? initialTab);
      setStep('details');
      // Collapse the funding panel so reopening never re-triggers DVA
      // auto-create without a fresh "Pay with Bank Transfer" tap.
      setShowFundingPanel(false);
      // May be null when auth has not hydrated yet — the branch below reseeds
      // once the owned intent resolves.
      setAppliedIntentKey(intentKey);
    } else {
      // Re-arm seeding for the next open.
      setAppliedIntentKey(null);
    }
  } else if (
    isOpen &&
    intent &&
    appliedIntentKey === null &&
    customerJustHydrated
  ) {
    // Auth resolved AFTER the modal mounted open: `customer.id` was absent on
    // the first render, so the owned intent was null and never seeded. Now that
    // the (customer-scoped) intent is available, seed its tab and remount the
    // form exactly once. Gated on the customer-id hydration transition so an
    // already-signed-in customer's first keystroke (which also flips `intent`
    // non-null) never triggers a spurious mid-typing remount.
    setActiveTab(intent.tab);
    setAppliedIntentKey(intentKey);
  }

  // Collapse the funding panel if the signed-in customer OR the storefront
  // merchant changes while the modal stays mounted — a previous session's
  // open bank-transfer panel (with its DVA account number) must not carry
  // over to a different customer or merchant.
  const fundingIdentity = `${user?.id ?? ''}:${merchant?.slug ?? ''}`;
  const [prevFundingIdentity, setPrevFundingIdentity] =
    useState(fundingIdentity);
  if (fundingIdentity !== prevFundingIdentity) {
    setPrevFundingIdentity(fundingIdentity);
    setShowFundingPanel(false);
  }

  const handleSelectPaymentMethod = (method: UtilityPaymentMethod) => {
    captureClientEvent(
      WALLET_FUNDING_TELEMETRY.events.paymentMethodSelected,
      {
        method,
        wallet_balance: walletBalance,
        can_use_wallet: canUseWallet,
        merchant_slug: merchant?.slug,
        customer_id: customer?.id,
      }
    );
    setPayWithWallet(method === 'wallet');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-b border-gray-100">
          <h3 className="font-bold text-lg text-gray-900">Utility Payment</h3>
          <button type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <UtilityTabs
          activeTab={activeTab}
          onSelect={(tab) => {
            setActiveTab(tab);
            setStep('details');
          }}
        />

        <div className="p-6">
          {step === 'success' ? (
            <UtilitySuccessView
              activeTab={activeTab}
              amount={successAmount}
              onClose={onClose}
              reference={transactionRef}
            />
          ) : (
            <>
              <UtilityPaymentMethodSelector
                canUseWallet={canUseWallet}
                isLoading={loading}
                onFundWallet={
                  canFundByBankTransfer
                    ? () => setShowFundingPanel((visible) => !visible)
                    : undefined
                }
                onSelectCard={() => handleSelectPaymentMethod('card')}
                onSelectWallet={() => handleSelectPaymentMethod('wallet')}
                selectedPaymentMethod={selectedPaymentMethod}
                showWalletRow={isAuthenticated}
                walletBalance={walletBalance}
                walletLoading={walletLoading}
              />
              {showFundingPanel && canFundByBankTransfer ? (
                <div className="mt-3">
                  <WalletFundingPanel
                    account={fundingAccount}
                    autoCreate
                    customerId={customer?.id}
                    merchantSlug={merchant?.slug}
                    onAccountCreated={setFundingAccount}
                    onRefreshBalance={refreshWallet}
                    onReturnToPurchase={() => {
                      // Prefill-only resume: collapse the funding panel and
                      // preselect the wallet. The customer still presses Pay.
                      setShowFundingPanel(false);
                      setPayWithWallet(true);
                    }}
                    requiresConsent={requiresFundingAccountConsent}
                    surface={WALLET_FUNDING_TELEMETRY.surfaces.utilityModal}
                    walletTransactions={walletTransactions}
                  />
                </div>
              ) : null}
              {(activeTab === 'airtime' || activeTab === 'data') && (
                <AirtimeDataForm
                  // Remount on tab change AND when a late-hydrating intent is
                  // seeded: AirtimeDataForm reads `initialDraft` only on mount,
                  // so a shared instance would never pick up a resumed draft for
                  // the non-active tab or one that arrived after auth hydrated.
                  key={`${activeTab}|${appliedIntentKey ?? ''}`}
                  type={activeTab}
                  loading={loading}
                  initialDraft={
                    intent?.tab === activeTab ? intent : undefined
                  }
                  onDraftChange={(draft) =>
                    saveIntent({ ...draft, tab: activeTab })
                  }
                  onSubmit={handleAirtimeDataSubmit}
                />
              )}
              {(activeTab === 'tv' ||
                activeTab === 'power' ||
                activeTab === 'betting') && (
                <BillPaymentForm
                  type={activeTab}
                  loading={loading}
                  onSubmit={handleBillSubmit}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
