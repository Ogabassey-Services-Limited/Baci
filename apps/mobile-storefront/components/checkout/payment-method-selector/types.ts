import type { IoniconsIconName } from "@react-native-vector-icons/ionicons";
import type {
  SavingsSelection,
  WalletSelection,
} from '@/lib/wallet-payment-helpers';

export type { SavingsSelection, WalletSelection };

export type PaymentMethodType =
  | 'paystack'
  | 'korapay'
  | 'bank_transfer'
  | 'pay_on_delivery'
  | 'credpal'
  | 'credit_direct'
  | 'klump'
  | 'juicyway'
  | 'invoice'
  | 'payforme';

export type PaymentTab = 'full' | 'installments' | 'pay_later';

export interface PaymentMethod {
  id: PaymentMethodType;
  label: string;
  description: string;
  icon: IoniconsIconName;
  tab: PaymentTab;
  logoUrl?: string | number;
  disabled?: boolean;
  disabledReason?: string;
}

export type WalletMode = 'orders' | 'vtu' | 'off';

export interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType;
  onSelectMethod: (method: PaymentMethodType) => void;
  selectedTab: PaymentTab;
  onSelectTab: (tab: PaymentTab) => void;
  orderTotal: number;
  showInstallmentCalculator?: boolean;
  enabledMethods?: PaymentMethodType[];
  walletMode?: WalletMode;
  walletBalance?: number;
  walletError?: Error | null;
  walletIsLoading?: boolean;
  walletOrderTotal?: number;
  walletSelection?: WalletSelection;
  onWalletToggle?: (selection: WalletSelection) => void;
  savingsBalance?: number;
  savingsFallbackTitle?: string;
  savingsGoalId?: string | null;
  savingsGoalTitle?: string;
  savingsSelection?: SavingsSelection;
  onSavingsToggle?: (selection: SavingsSelection) => void;
  suppressedSelectedMethods?: PaymentMethodType[];
  methodBadgeOverrides?: Partial<Record<PaymentMethodType, string>>;
  methodDescriptionOverrides?: Partial<Record<PaymentMethodType, string>>;
  methodDisabledReasons?: Partial<Record<PaymentMethodType, string>>;
  methodLabelOverrides?: Partial<Record<PaymentMethodType, string>>;
}

export const BNPL_MIN_AMOUNT = 10000;
export const BNPL_MAX_AMOUNT = 5000000;
export const INFO_PANEL_BACKGROUND_OPACITY = '10';
export const DEFAULT_SAVINGS_FALLBACK_TITLE = 'device savings';
