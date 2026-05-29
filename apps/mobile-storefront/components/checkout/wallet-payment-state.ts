import type { WalletSelection } from '@/lib/wallet-payment-helpers';
import type {
  PaymentMethodType,
  PaymentTab,
  WalletMode,
} from './PaymentMethodSelector';

export interface WalletPaymentStateInput {
  activeSavingsAmount: number;
  orderTotal: number;
  selectedMethod: PaymentMethodType;
  selectedTab: PaymentTab;
  supportsPartialPayment: boolean;
  walletBalance?: number | null;
  walletError: Error | null;
  walletFundedBankTransferMode: boolean;
  walletIsLoading: boolean;
  walletMode: WalletMode;
  walletOrderTotal?: number;
  walletSelection?: WalletSelection;
}

export interface WalletPaymentState {
  coversFully: boolean;
  effectiveTotal: number;
  infoShouldRender: boolean;
  isActive: boolean;
  portion: number;
  residualToGateway: number;
  shouldRender: boolean;
  statusShouldRender: boolean;
}

export function getWalletPaymentState({
  activeSavingsAmount,
  orderTotal,
  selectedMethod,
  selectedTab,
  supportsPartialPayment,
  walletBalance,
  walletError,
  walletFundedBankTransferMode,
  walletIsLoading,
  walletMode,
  walletOrderTotal,
  walletSelection,
}: WalletPaymentStateInput): WalletPaymentState {
  const effectiveTotal = Math.max(
    (walletOrderTotal ?? orderTotal) - activeSavingsAmount,
    0
  );
  const usableWalletBalance =
    typeof walletBalance === 'number' && Number.isFinite(walletBalance)
      ? walletBalance
      : 0;
  // Wallet attempts need an opted-in mode, a positive total, the full-payment tab, and a compatible payment method.
  const attemptAllowed =
    (walletMode === 'orders' || walletMode === 'vtu') &&
    effectiveTotal > 0 &&
    selectedTab === 'full' &&
    supportsPartialPayment;
  const fundedBankTransferActive =
    walletFundedBankTransferMode &&
    selectedMethod === 'bank_transfer' &&
    selectedTab === 'full';
  const walletCoversTotal = usableWalletBalance >= effectiveTotal;
  const shouldRender =
    attemptAllowed &&
    (!fundedBankTransferActive || walletCoversTotal) &&
    usableWalletBalance > 0 &&
    !walletIsLoading &&
    walletError === null;
  const infoShouldRender =
    attemptAllowed &&
    fundedBankTransferActive &&
    usableWalletBalance > 0 &&
    !walletCoversTotal &&
    !walletIsLoading &&
    walletError === null;
  const statusShouldRender =
    attemptAllowed &&
    !fundedBankTransferActive &&
    !shouldRender &&
    (walletIsLoading || walletError !== null);
  const coversFully = shouldRender && walletCoversTotal;
  const portion =
    shouldRender || infoShouldRender
      ? Math.min(usableWalletBalance, effectiveTotal)
      : 0;

  return {
    coversFully,
    effectiveTotal,
    infoShouldRender,
    isActive: walletSelection?.use === true,
    portion,
    residualToGateway: shouldRender
      ? Math.max(effectiveTotal - usableWalletBalance, 0)
      : 0,
    shouldRender,
    statusShouldRender,
  };
}
