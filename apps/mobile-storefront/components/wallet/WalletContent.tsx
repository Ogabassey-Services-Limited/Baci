import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Alert, RefreshControl } from 'react-native';
import AppKeyboardAwareScrollView from '@/components/ui/AppKeyboardAwareScrollView';
import type Colors from '@/constants/Colors';
import { useDebounce } from '@/hooks/use-debounce';
import { useProducts } from '@/hooks/use-products';
import { useWalletCreditWatch } from '@/hooks/use-wallet-credit-watch';
import type { WalletActiveSavingsGoal } from '@/hooks/wallet-query';
import type { WalletReturnHref } from '@/lib/sanitize-wallet-return-to';
import type { Product } from '@/types/product';
import { WalletActionsRow } from './WalletActionsRow';
import { WalletFundPanel } from './WalletFundPanel';
import type { WalletFundPhoneSubmitResult } from './WalletFundPhonePrompt';
import { WalletHeroSection } from './WalletHeroSection';
import { WalletRedeemPanel } from './WalletRedeemPanel';
import { WalletSavingsDeviceSwapModal } from './WalletSavingsDeviceSwapModal';
import { WalletSavingsProgressModal } from './WalletSavingsProgressModal';
import {
  type WalletTransaction,
  WalletTransactionHistory,
} from './WalletTransactionHistory';
import type { WalletDisplayFundingAccount } from './wallet.types';

type WalletColors = (typeof Colors)['light'];

export interface WalletContentProps {
  activeSavingsGoal: WalletActiveSavingsGoal | null;
  canCreateFundingAccount: boolean;
  colors: WalletColors;
  contentContainerStyle: StyleProp<ViewStyle>;
  createFundingAccountUnavailableMessage?: string;
  /** Scopes the persisted bank-transfer funding session the credit watch reads. */
  customerId?: string;
  earningsBalance: number;
  fundAmount: string;
  fundingAccount: WalletDisplayFundingAccount | null;
  /** Sanitized deep-link for the post-credit "Return to your purchase" CTA. */
  fundReturnTo?: WalletReturnHref;
  isAddingSavingsContribution: boolean;
  isCreatingFundingAccount: boolean;
  isFundPending: boolean;
  isRedeemPending: boolean;
  isRefetching: boolean;
  loyaltyPoints: number;
  loyaltyTier?: string | null;
  needsPhone: boolean;
  onCreateFundingAccount: () => void;
  onChangeFundAmount: (value: string) => void;
  onChangeRedeemPoints: (value: string) => void;
  onConfirmFund: () => void;
  onConfirmRedeem: () => void;
  onAddSavingsContribution: () => void;
  onChangeSavingsDevice: (
    product: Product,
    variantId?: string | null
  ) => Promise<boolean>;
  onChangeSavingsContributionAmount: (value: string) => void;
  onCloseSavingsProgress: () => void;
  onManageCards: () => void;
  onFundSavingsWallet: () => void;
  onOpenFundPanel: () => void;
  onOpenRedeemPanel: () => void;
  onQuickSave: () => void;
  onRefresh: () => void;
  onResetFund: () => void;
  onResetRedeem: () => void;
  onStartSavings: () => void;
  onSubmitPhone: (phone: string) => Promise<WalletFundPhoneSubmitResult>;
  redeemPoints: string;
  savingsContributionAmount: string;
  savingsBalance: number;
  showSavingsProgress: boolean;
  showQuickSave: boolean;
  showFundPanel: boolean;
  showRedeemPanel: boolean;
  totalBalance: number;
  /** Wallet ledger; the credit watch reads bank-transfer top-ups off it. */
  transactions: WalletTransaction[];
}

export function WalletContent({
  activeSavingsGoal,
  canCreateFundingAccount,
  colors,
  contentContainerStyle,
  createFundingAccountUnavailableMessage,
  customerId,
  earningsBalance,
  fundAmount,
  fundingAccount,
  fundReturnTo,
  isAddingSavingsContribution,
  isCreatingFundingAccount,
  isFundPending,
  isRedeemPending,
  isRefetching,
  loyaltyPoints,
  loyaltyTier,
  needsPhone,
  onCreateFundingAccount,
  onChangeFundAmount,
  onChangeRedeemPoints,
  onConfirmFund,
  onConfirmRedeem,
  onAddSavingsContribution,
  onChangeSavingsDevice,
  onChangeSavingsContributionAmount,
  onCloseSavingsProgress,
  onFundSavingsWallet,
  onManageCards,
  onOpenFundPanel,
  onOpenRedeemPanel,
  onQuickSave,
  onRefresh,
  onResetFund,
  onResetRedeem,
  onStartSavings,
  onSubmitPhone,
  redeemPoints,
  savingsContributionAmount,
  savingsBalance,
  showSavingsProgress,
  showQuickSave,
  showFundPanel,
  showRedeemPanel,
  totalBalance,
  transactions,
}: WalletContentProps) {
  const creditWatch = useWalletCreditWatch({
    customerId,
    refetch: onRefresh,
    returnTo: fundReturnTo,
    transactions,
  });
  const [showSavingsDeviceSwap, setShowSavingsDeviceSwap] = useState(false);
  const [savingsDeviceSearch, setSavingsDeviceSearch] = useState('');
  const [isChangingSavingsDevice, setIsChangingSavingsDevice] = useState(false);
  const debouncedSavingsDeviceSearch = useDebounce(savingsDeviceSearch, 250);
  const trimmedSavingsDeviceSearch = debouncedSavingsDeviceSearch.trim();
  const { products: savingsDeviceProducts, isLoading: isSavingsDeviceLoading } =
    useProducts({
      enabled: showSavingsDeviceSwap,
      limit: 8,
      search: trimmedSavingsDeviceSearch || undefined,
    });
  const canAddToSavings =
    activeSavingsGoal !== null && activeSavingsGoal.status !== 'completed';
  const handleSelectSavingsDevice = async (
    product: Product,
    variantId?: string | null
  ) => {
    setIsChangingSavingsDevice(true);
    try {
      const didChange = await onChangeSavingsDevice(product, variantId);
      if (didChange) {
        setShowSavingsDeviceSwap(false);
        setSavingsDeviceSearch('');
      }
    } catch {
      Alert.alert('Unable to change device', 'Please try again in a moment.');
    }
    setIsChangingSavingsDevice(false);
  };

  return (
    <>
      <AppKeyboardAwareScrollView
        testID="wallet-scroll"
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <WalletHeroSection
          accentColor={colors.primary}
          canCreateFundingAccount={canCreateFundingAccount}
          createFundingAccountUnavailableMessage={
            createFundingAccountUnavailableMessage
          }
          creditWatch={showFundPanel ? undefined : creditWatch}
          earningsBalance={earningsBalance}
          fundingAccount={fundingAccount}
          isCreatingFundingAccount={isCreatingFundingAccount}
          loyaltyPoints={loyaltyPoints}
          loyaltyTier={loyaltyTier}
          needsPhone={needsPhone}
          onCreateFundingAccount={onCreateFundingAccount}
          onOpenFundPanel={onOpenFundPanel}
          onOpenRedeemPanel={onOpenRedeemPanel}
          savingsBalance={savingsBalance}
          totalBalance={totalBalance}
        />

        <WalletActionsRow
          colors={colors}
          hasActiveSavingsGoal={canAddToSavings}
          onManageCards={onManageCards}
          onQuickSave={onQuickSave}
          onStartSavings={onStartSavings}
          showQuickSave={showQuickSave && canAddToSavings}
        />

        {showFundPanel ? (
          <WalletFundPanel
            canCreateFundingAccount={canCreateFundingAccount}
            colors={colors}
            createFundingAccountUnavailableMessage={
              createFundingAccountUnavailableMessage
            }
            creditWatch={creditWatch}
            fundAmount={fundAmount}
            fundingAccount={fundingAccount}
            isCreatingFundingAccount={isCreatingFundingAccount}
            isFundPending={isFundPending}
            needsPhone={needsPhone}
            onChangeFundAmount={onChangeFundAmount}
            onConfirmFund={onConfirmFund}
            onCreateFundingAccount={onCreateFundingAccount}
            onResetFund={onResetFund}
            onSubmitPhone={onSubmitPhone}
          />
        ) : null}

        {showRedeemPanel ? (
          <WalletRedeemPanel
            colors={colors}
            isRedeemPending={isRedeemPending}
            loyaltyPoints={loyaltyPoints}
            minimumRedeemablePoints={VTU_MIN_REDEEMABLE_POINTS}
            onChangeRedeemPoints={onChangeRedeemPoints}
            onConfirmRedeem={onConfirmRedeem}
            onResetRedeem={onResetRedeem}
            redeemPoints={redeemPoints}
          />
        ) : null}
        <WalletTransactionHistory colors={colors} transactions={transactions} />
      </AppKeyboardAwareScrollView>
      <WalletSavingsProgressModal
        addAmount={savingsContributionAmount}
        colors={colors}
        goal={activeSavingsGoal}
        isAdding={isAddingSavingsContribution}
        onAddAmountChange={onChangeSavingsContributionAmount}
        onAddSavings={onAddSavingsContribution}
        onChangeDevice={() => setShowSavingsDeviceSwap(true)}
        onClose={onCloseSavingsProgress}
        onFundWallet={onFundSavingsWallet}
        visible={showSavingsProgress}
        walletBalance={earningsBalance}
      />
      <WalletSavingsDeviceSwapModal
        colors={colors}
        currentAmount={activeSavingsGoal?.current_amount ?? 0}
        isLoading={isSavingsDeviceLoading}
        isPending={isChangingSavingsDevice}
        onClose={() => setShowSavingsDeviceSwap(false)}
        onSearchChange={setSavingsDeviceSearch}
        onSelectDevice={handleSelectSavingsDevice}
        products={savingsDeviceProducts}
        searchValue={savingsDeviceSearch}
        visible={showSavingsDeviceSwap && canAddToSavings}
      />
    </>
  );
}
