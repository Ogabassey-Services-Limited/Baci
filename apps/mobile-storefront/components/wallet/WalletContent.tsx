import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import type { StyleProp, ViewStyle } from 'react-native';
import { RefreshControl, ScrollView, Text, TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import type { WalletActiveSavingsGoal } from '@/hooks/wallet-query';
import { WalletActionsRow } from './WalletActionsRow';
import { WalletHeroSection } from './WalletHeroSection';
import { WalletPanelActionButtons } from './WalletPanelActionButtons';
import { WalletRedeemPanel } from './WalletRedeemPanel';
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
          hasActiveSavingsGoal={showQuickSave}
          onManageCards={onManageCards}
          onQuickSave={onQuickSave}
          onStartSavings={onStartSavings}
          showQuickSave={showQuickSave}
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
        onClose={onCloseSavingsProgress}
        onFundWallet={onFundSavingsWallet}
        visible={showSavingsProgress}
        walletBalance={earningsBalance}
      />
    </>
  );
}
