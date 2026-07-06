import Ionicons from '@react-native-vector-icons/ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type Colors from '@/constants/Colors';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { WalletPanelActionButtons } from './WalletPanelActionButtons';
import { styles as walletStyles } from './wallet.styles';
import type { WalletDisplayFundingAccount } from './wallet.types';

type WalletColors = (typeof Colors)['light'];

const BANK_TRANSFER_TITLE = 'Add Money';
const BANK_TRANSFER_SUBTITLE =
  'Transfer to your account number below and your wallet is credited automatically — 1% fee, capped at ₦300.';
const SETTING_UP_ACCOUNT = 'Setting up your account number...';
const CARD_TOGGLE_LABEL = 'Fund with card instead';
const CARD_SUBTITLE = 'Enter the amount you want to add to your wallet.';

interface WalletFundPanelProps {
  canCreateFundingAccount: boolean;
  colors: WalletColors;
  createFundingAccountUnavailableMessage?: string;
  fundAmount: string;
  fundingAccount: WalletDisplayFundingAccount | null;
  isCreatingFundingAccount: boolean;
  isFundPending: boolean;
  onChangeFundAmount: (value: string) => void;
  onConfirmFund: () => void;
  onCreateFundingAccount: () => void;
  onResetFund: () => void;
}

export function WalletFundPanel({
  canCreateFundingAccount,
  colors,
  createFundingAccountUnavailableMessage,
  fundAmount,
  fundingAccount,
  isCreatingFundingAccount,
  isFundPending,
  onChangeFundAmount,
  onConfirmFund,
  onCreateFundingAccount,
  onResetFund,
}: WalletFundPanelProps) {
  // Flows that arrive with a prefilled amount (savings top-up, checkout
  // returnTo) are explicit card/gateway funding intents — start expanded.
  const [showCardEntry, setShowCardEntry] = useState(fundAmount !== '');
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const { copyToClipboard, feedback: copyFeedback } = useCopyToClipboard();

  // Opening Add Money IS a funding intent, so it doubles as consent:
  // provision the account number immediately when none exists yet.
  useEffect(() => {
    if (
      autoCreateAttempted ||
      fundingAccount ||
      !canCreateFundingAccount ||
      isCreatingFundingAccount
    ) {
      return;
    }
    setAutoCreateAttempted(true);
    onCreateFundingAccount();
  });

  const bankTransferUnavailable =
    !fundingAccount && !canCreateFundingAccount && !isCreatingFundingAccount;
  const cardEntryVisible = showCardEntry || bankTransferUnavailable;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[
        walletStyles.redeemPanel,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text style={[walletStyles.redeemPanelTitle, { color: colors.text }]}>
        {BANK_TRANSFER_TITLE}
      </Text>

      {fundingAccount ? (
        <>
          <Text
            style={[
              walletStyles.redeemPanelSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            {BANK_TRANSFER_SUBTITLE}
          </Text>
          <View
            style={[
              styles.accountCard,
              { backgroundColor: colors.muted, borderColor: colors.primary },
            ]}
          >
            <View style={styles.accountCopy}>
              <Text
                style={[styles.accountBank, { color: colors.textSecondary }]}
              >
                {fundingAccount.bankName}
              </Text>
              <Text style={[styles.accountNumber, { color: colors.text }]}>
                {fundingAccount.accountNumber}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy wallet account number"
              accessibilityHint="Copies your account number"
              style={styles.accountCopyButton}
              onPress={() => copyToClipboard(fundingAccount.accountNumber)}
            >
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
            </Pressable>
          </View>
          {copyFeedback ? (
            <Text
              accessibilityRole="text"
              style={[styles.copyFeedback, { color: colors.textSecondary }]}
            >
              {copyFeedback}
            </Text>
          ) : null}
        </>
      ) : isCreatingFundingAccount || canCreateFundingAccount ? (
        <View style={styles.settingUpRow}>
          <ActivityIndicator color={colors.primary} size="small" />
          <Text
            style={[
              walletStyles.redeemPanelSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            {SETTING_UP_ACCOUNT}
          </Text>
        </View>
      ) : createFundingAccountUnavailableMessage ? (
        <Text
          style={[
            walletStyles.redeemPanelSubtitle,
            { color: colors.textSecondary },
          ]}
        >
          {createFundingAccountUnavailableMessage}
        </Text>
      ) : null}

      {cardEntryVisible ? (
        <>
          <Text
            style={[
              walletStyles.redeemPanelSubtitle,
              styles.cardSubtitle,
              { color: colors.textSecondary },
            ]}
          >
            {CARD_SUBTITLE}
          </Text>
          <TextInput
            accessibilityLabel="Wallet top-up amount"
            style={[
              walletStyles.redeemInput,
              {
                backgroundColor: colors.muted,
                borderColor: colors.primary,
                borderWidth: 2,
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
        </>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={CARD_TOGGLE_LABEL}
          style={styles.cardToggle}
          onPress={() => setShowCardEntry(true)}
        >
          <Ionicons name="card-outline" size={16} color={colors.primary} />
          <Text style={[styles.cardToggleText, { color: colors.primary }]}>
            {CARD_TOGGLE_LABEL}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  accountBank: {
    fontSize: 12,
  },
  accountCard: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 12,
    padding: 14,
  },
  accountCopy: {
    flex: 1,
    gap: 2,
  },
  accountCopyButton: {
    padding: 6,
  },
  accountNumber: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardSubtitle: {
    marginTop: 16,
  },
  cardToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  },
  cardToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  copyFeedback: {
    fontSize: 12,
    marginTop: 6,
  },
  settingUpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
