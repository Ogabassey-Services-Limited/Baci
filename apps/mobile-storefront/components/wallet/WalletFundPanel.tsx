import Ionicons from '@react-native-vector-icons/ionicons';
import { useState } from 'react';
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
import { useWalletFundPanelAutoCreate } from './use-wallet-fund-panel-auto-create';
import {
  WalletFundPhonePrompt,
  type WalletFundPhoneSubmitResult,
} from './WalletFundPhonePrompt';
import { WalletPanelActionButtons } from './WalletPanelActionButtons';
import { styles as walletStyles } from './wallet.styles';
import type { WalletDisplayFundingAccount } from './wallet.types';

type WalletColors = (typeof Colors)['light'];

const BANK_TRANSFER_TITLE = 'Add Money';
const BANK_TRANSFER_SUBTITLE =
  'Transfer to your account number below and your wallet is credited automatically — 1% fee, capped at ₦300.';
const SETTING_UP_ACCOUNT = 'Setting up your account number...';
const SETUP_FAILED =
  "We couldn't set up your account number just now. Fund with card below, or try bank transfer again later.";
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
  needsPhone: boolean;
  onChangeFundAmount: (value: string) => void;
  onConfirmFund: () => void;
  // Returns a boolean success flag when awaited (false = creation failed);
  // typed as unknown so a plain `() => void` handler is still accepted.
  onCreateFundingAccount: () => unknown;
  onResetFund: () => void;
  onSubmitPhone: (phone: string) => Promise<WalletFundPhoneSubmitResult>;
}

export function WalletFundPanel({
  canCreateFundingAccount,
  colors,
  createFundingAccountUnavailableMessage,
  fundAmount,
  fundingAccount,
  isCreatingFundingAccount,
  isFundPending,
  needsPhone,
  onChangeFundAmount,
  onConfirmFund,
  onCreateFundingAccount,
  onResetFund,
  onSubmitPhone,
}: WalletFundPanelProps) {
  // Tracks the "Fund with card instead" toggle. Card entry is ALSO shown
  // whenever a prefilled amount is present (see cardEntryVisible), which
  // covers a route change that prefills the amount while the panel is open.
  const [showCardEntry, setShowCardEntry] = useState(false);
  const { copyToClipboard, feedback: copyFeedback } = useCopyToClipboard();
  const { autoCreateFailed, openedWithPrefill } = useWalletFundPanelAutoCreate({
    canCreateFundingAccount,
    fundAmount,
    hasFundingAccount: Boolean(fundingAccount),
    isCreatingFundingAccount,
    onCreateFundingAccount,
  });

  // `needsPhone` is excluded so the card entry does NOT auto-expand while the
  // phone prompt is showing — card stays behind the "Fund with card" toggle.
  const bankTransferUnavailable =
    !fundingAccount &&
    !canCreateFundingAccount &&
    !isCreatingFundingAccount &&
    !needsPhone;
  // Reactive to fundAmount so a prefilled amount always reveals card entry,
  // even if it arrives after the panel is already mounted; openedWithPrefill
  // keeps it visible if the customer clears the prefilled input.
  const cardEntryVisible =
    showCardEntry ||
    openedWithPrefill ||
    fundAmount !== '' ||
    bankTransferUnavailable ||
    autoCreateFailed;

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
      ) : needsPhone ? (
        // No account yet and the only blocker is a missing phone — collect it
        // here (takes priority over the spinner/message branches below).
        <WalletFundPhonePrompt colors={colors} onSubmit={onSubmitPhone} />
      ) : autoCreateFailed ? (
        <Text
          style={[
            walletStyles.redeemPanelSubtitle,
            { color: colors.textSecondary },
          ]}
        >
          {SETUP_FAILED}
        </Text>
      ) : !openedWithPrefill &&
        fundAmount === '' &&
        (isCreatingFundingAccount || canCreateFundingAccount) ? (
        // Only while the empty-amount auto-create flow is pending. Prefilled
        // opens never auto-create (even after the input is cleared), so they
        // must not show this spinner above the card entry form.
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
