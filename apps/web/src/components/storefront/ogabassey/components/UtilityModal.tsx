'use client';

import { useRef, useState } from 'react';
import { useOptionalCustomerAuth } from '@/contexts/customer-auth-context';
import { toast } from '@/hooks/use-toast';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { fetchWithCsrf } from '@/lib/api-client';
import { useWallet } from '@/components/storefront/ogabassey/pages/checkout/hooks/use-wallet';
import {
  createWalletIdempotencyKey,
  getCheckoutErrorMessage,
  isUtilityCheckoutResponse,
  redirectToPaymentCheckout,
  type UtilityCheckoutPayload,
} from './utility-checkout';
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

interface UtilityCheckoutRequest {
  payload: UtilityCheckoutPayload;
  merchantSlug: string;
  customerName: string;
  customerPhone: string | null | undefined;
  walletAmount: number;
  getWalletIdempotencyKey: (payloadSignature: string) => string;
}

type UtilityCheckoutResult =
  | { kind: 'redirected' }
  | {
      kind: 'wallet-success';
      reference: string;
      amount: number;
      processing: boolean;
    }
  | { kind: 'error'; message: string };

// Module-scope helper: keeps try/finally + throw-in-try out of the component
// body so React Compiler can memoize UtilityModal.
const submitUtilityCheckout = async ({
  payload,
  merchantSlug,
  customerName,
  customerPhone,
  walletAmount,
  getWalletIdempotencyKey,
}: UtilityCheckoutRequest): Promise<UtilityCheckoutResult> => {
  try {
    const checkoutPayload = {
      merchantSlug,
      customerName,
      ...(customerPhone ? { customerPhone } : {}),
      ...payload,
    };
    const isWalletOnly = walletAmount > 0 && walletAmount >= payload.amount;
    const walletPayload = {
      ...checkoutPayload,
      walletAmount: payload.amount,
    };
    const response = await fetchWithCsrf(
      isWalletOnly
        ? '/api/vtu/checkout/wallet-only'
        : '/api/vtu/checkout/initialize',
      {
        method: 'POST',
        headers: isWalletOnly
          ? {
              'Idempotency-Key': getWalletIdempotencyKey(
                JSON.stringify(walletPayload)
              ),
            }
          : undefined,
        body: JSON.stringify({
          ...(isWalletOnly ? walletPayload : checkoutPayload),
          ...(isWalletOnly
            ? {}
            : {
                gateway: 'paystack',
                ...(walletAmount > 0 ? { walletAmount } : {}),
              }),
        }),
      }
    );

    const rawResponse = await response.text();
    let parsedData: unknown;
    try {
      parsedData = JSON.parse(rawResponse);
    } catch {
      throw new Error(
        response.ok
          ? 'Payment checkout returned an invalid response'
          : `Payment checkout failed (${response.status})`
      );
    }
    if (!response.ok) throw new Error(getCheckoutErrorMessage(parsedData));
    if (!isUtilityCheckoutResponse(parsedData)) {
      throw new Error('Payment checkout returned an invalid response');
    }
    const data = parsedData;

    if (!isWalletOnly) {
      const checkoutUrl = data.checkout_url || data.authorization_url;
      if (!checkoutUrl) {
        throw new Error('Payment checkout URL was not returned');
      }
      redirectToPaymentCheckout(checkoutUrl);
      return { kind: 'redirected' };
    }

    return {
      kind: 'wallet-success',
      reference: data.reference ?? '',
      amount: data.amount ?? payload.amount,
      processing: data.status === 'processing',
    };
  } catch (error) {
    return {
      kind: 'error',
      message:
        error instanceof Error ? error.message : 'Something went wrong',
    };
  }
};

export const UtilityModal = ({
  isOpen,
  onClose,
  initialTab = 'airtime',
}: UtilityModalProps) => {
  const [activeTab, setActiveTab] = useState<UtilityTabId>(initialTab);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'details' | 'success'>('details');
  const [transactionRef, setTransactionRef] = useState('');
  const [successAmount, setSuccessAmount] = useState(0);
  const walletIdempotencyAttemptRef = useRef<{
    key: string;
    payloadSignature: string;
  } | null>(null);

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
  } = useWallet({
    merchantSlug: merchant?.slug,
    userId: user?.id,
  });
  const [showFundingPanel, setShowFundingPanel] = useState(false);
  const canUseWallet = isAuthenticated && walletBalance > 0;
  // Only offer bank-transfer funding when the merchant has wallet DVAs on —
  // otherwise the CTA routes to a create-account flow that returns
  // WALLET_DVA_DISABLED.
  const canFundByBankTransfer = isAuthenticated && walletDvaEnabled;
  const selectedPaymentMethod: UtilityPaymentMethod =
    canUseWallet && payWithWallet ? 'wallet' : 'card';

  // Reset the view when the modal (re)opens or the requested tab changes.
  // Render-time prev-prop comparison avoids a stale-frame effect round-trip.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (isOpen !== prevIsOpen || initialTab !== prevInitialTab) {
    setPrevIsOpen(isOpen);
    setPrevInitialTab(initialTab);
    if (isOpen) {
      setActiveTab(initialTab);
      setStep('details');
      // Collapse the funding panel so reopening never re-triggers DVA
      // auto-create without a fresh "Pay with Bank Transfer" tap.
      setShowFundingPanel(false);
    }
  }

  const getWalletIdempotencyKey = (payloadSignature: string) => {
    if (walletIdempotencyAttemptRef.current?.payloadSignature !== payloadSignature) {
      walletIdempotencyAttemptRef.current = {
        key: createWalletIdempotencyKey(),
        payloadSignature,
      };
    }
    return walletIdempotencyAttemptRef.current.key;
  };

  const handlePurchase = async (payload: UtilityCheckoutPayload) => {
    if (isAuthLoading) {
      toast({
        title: 'Checking account',
        description: 'Please wait while we confirm your session.',
      });
      return;
    }

    if (!isAuthenticated || !user) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to use utility checkout.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const customerName =
      [customer?.first_name, customer?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || customer?.email || user.email || 'Customer';
    const result = await submitUtilityCheckout({
      payload,
      merchantSlug: merchant?.slug || 'ogabassey',
      customerName,
      customerPhone: customer?.phone,
      walletAmount:
        selectedPaymentMethod === 'wallet'
          ? Math.min(walletBalance, payload.amount)
          : 0,
      getWalletIdempotencyKey,
    });

    if (result.kind === 'wallet-success') {
      walletIdempotencyAttemptRef.current = null;
      setWalletBalance((balance) => Math.max(balance - payload.amount, 0));
      setTransactionRef(result.reference);
      setSuccessAmount(result.amount);
      setStep('success');
      toast({
        title: result.processing ? 'Purchase Processing' : 'Purchase Successful',
        description: result.processing
          ? `Your ${activeTab} purchase is processing.`
          : `Your ${activeTab} purchase was successful!`,
      });
    } else if (result.kind === 'error') {
      toast({
        title: 'Transaction Failed',
        description: result.message,
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const handleAirtimeDataSubmit = (data: {
    phoneNumber: string;
    amount: number;
    networkProvider: string;
    dataPlanCode?: string;
  }) => {
    handlePurchase({
      type: activeTab,
      phoneNumber: data.phoneNumber,
      amount: data.amount,
      networkProvider: data.networkProvider,
      dataPlanCode: data.dataPlanCode,
    });
  };

  const handleBillSubmit = (data: {
    amount: number;
    billItemIdentifier: string;
    billerCode?: string;
    customerAddress?: string;
    customerIdentifier: string;
    billerName: string;
    productCode?: string;
    provider?: 'kuda' | 'monnify';
    requireValidationRef?: boolean;
    type: string;
    validationReference?: string;
  }) => {
    handlePurchase({
      type: data.type,
      amount: data.amount,
      billItemIdentifier: data.billItemIdentifier,
      billerCode: data.billerCode,
      ...(data.customerAddress
        ? { customerAddress: data.customerAddress }
        : {}),
      customerIdentifier: data.customerIdentifier,
      billerName: data.billerName,
      productCode: data.productCode,
      provider: data.provider,
      requireValidationRef: data.requireValidationRef,
      validationReference: data.validationReference,
    });
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
                onSelectCard={() => setPayWithWallet(false)}
                onSelectWallet={() => setPayWithWallet(true)}
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
                    merchantSlug={merchant?.slug}
                    onAccountCreated={setFundingAccount}
                    onRefreshBalance={refreshWallet}
                    requiresConsent={requiresFundingAccountConsent}
                  />
                </div>
              ) : null}
              {(activeTab === 'airtime' || activeTab === 'data') && (
                <AirtimeDataForm
                  type={activeTab}
                  loading={loading}
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
