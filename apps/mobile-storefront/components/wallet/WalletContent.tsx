import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { useDebounce } from '@/hooks/use-debounce';
import { useProducts } from '@/hooks/use-products';
import type { WalletActiveSavingsGoal } from '@/hooks/wallet-query';
import type { Product } from '@/types/product';
import { WalletActionsRow } from './WalletActionsRow';
import { WalletHeroSection } from './WalletHeroSection';
import { WalletPanelActionButtons } from './WalletPanelActionButtons';
import { WalletRedeemPanel } from './WalletRedeemPanel';
import { WalletSavingsDeviceSwapModal } from './WalletSavingsDeviceSwapModal';
import { WalletSavingsProgressModal } from './WalletSavingsProgressModal';
import {
  type WalletTransaction,
  WalletTransactionHistory,
} from './WalletTransactionHistory';
import { styles } from './wallet.styles';
import type { WalletDisplayFundingAccount } from './wallet.types';

type WalletColors = (typeof Colors)['light'];

export interface WalletContentProps {
  activeSavingsGoal: WalletActiveSavingsGoal | null;
  canCreateFundingAccount: boolean;
  colors: WalletColors;
  contentContainerStyle: StyleProp<ViewStyle>;
  createFundingAccountUnavailableMessage?: string;
  earningsBalance: number;
  fundAmount: string;
  fundingAccount: WalletDisplayFundingAccount | null;
  isAddingSavingsContribution: boolean;
  isCreatingFundingAccount: boolean;
  isFundPending: boolean;
  isRedeemPending: boolean;
  isRefetching: boolean;
  loyaltyPoints: number;
  loyaltyTier?: string | null;
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
  redeemPoints: string;
  savingsContributionAmount: string;
  savingsBalance: number;
  showSavingsProgress: boolean;
  showQuickSave: boolean;
  showFundPanel: boolean;
  showRedeemPanel: boolean;
  totalBalance: number;
  transactions: WalletTransaction[];
}

export function WalletContent({
  activeSavingsGoal,
  canCreateFundingAccount,
  colors,
  contentContainerStyle,
  createFundingAccountUnavailableMessage,
  earningsBalance,
  fundAmount,
  fundingAccount,
  isAddingSavingsContribution,
  isCreatingFundingAccount,
  isFundPending,
  isRedeemPending,
  isRefetching,
  loyaltyPoints,
  loyaltyTier,
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
      <ScrollView
        testID="wallet-scroll"
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={BRAND.primary}
          />
        }
      >
        <WalletHeroSection
          canCreateFundingAccount={canCreateFundingAccount}
          createFundingAccountUnavailableMessage={
            createFundingAccountUnavailableMessage
          }
          earningsBalance={earningsBalance}
          fundingAccount={fundingAccount}
          isCreatingFundingAccount={isCreatingFundingAccount}
          loyaltyPoints={loyaltyPoints}
          loyaltyTier={loyaltyTier}
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
          <Animated.View
            entering={FadeIn.duration(200)}
            style={[
              styles.redeemPanel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.redeemPanelTitle, { color: colors.text }]}>
              Add Funds
            </Text>
            <Text
              style={[
                styles.redeemPanelSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              Enter the amount you want to add to your wallet.
            </Text>

            <TextInput
              accessibilityLabel="Wallet top-up amount"
              style={[
                styles.redeemInput,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={fundAmount}
              onChangeText={onChangeFundAmount}
              keyboardType="number-pad"
              placeholder="Enter amount (min ₦100)"
              placeholderTextColor={colors.placeholder}
            />

            <WalletPanelActionButtons
              cancelAccessibilityLabel="Cancel wallet top-up"
              confirmAccessibilityLabel="Confirm wallet top-up"
              confirmText="Continue"
              colors={colors}
              isPending={isFundPending}
              onCancel={onResetFund}
              onConfirm={onConfirmFund}
            />
          </Animated.View>
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
      </ScrollView>
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
