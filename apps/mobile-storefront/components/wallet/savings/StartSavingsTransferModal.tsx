import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { showAppAlert } from '@/components/ui/show-app-alert';
import { BRAND, palette } from '@/constants/Colors';
import { formatNgnCurrency } from '@/lib/format-ngn-currency';
import { startSavingsStyles as styles } from './start-savings.styles';
import type { StartSavingsColors } from './start-savings.types';
import type { StartSavingsController } from './start-savings-controller.types';
import { SummaryRow } from './start-savings-modal-parts';

type TransferModalProps = {
  colors: StartSavingsColors;
  controller: StartSavingsController;
};

function handleSavingsActionError(
  error: unknown,
  title: string,
  message: string
) {
  console.error(title, error);
  showAppAlert({ title, message, variant: 'error' });
}

// Hoisted: try/finally in a component body blocks React Compiler.
async function runCopyFundingAccount(
  copyFundingAccount: () => Promise<void>,
  setIsCopying: (isCopying: boolean) => void
) {
  setIsCopying(true);
  try {
    await copyFundingAccount();
  } catch (error) {
    handleSavingsActionError(
      error,
      'Unable to copy account',
      'Failed to copy funding account. Please try again.'
    );
  } finally {
    setIsCopying(false);
  }
}

export function StartSavingsTransferModal({
  colors,
  controller,
}: TransferModalProps) {
  const transferAmount = Math.max(
    controller.requiredTopUpAmount,
    controller.contributionValue
  );

  return (
    <ModalSheet
      visible={controller.showTransferModal}
      animationType="slide"
      backdropStyle={styles.modalBackdrop}
      cardStyle={[styles.modalCard, { backgroundColor: colors.background }]}
    >
      <Text style={[styles.modalTitle, { color: colors.text }]}>
        Fund wallet to continue
      </Text>
      <View
        style={[
          styles.transferCard,
          { borderColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <SummaryRow
          label="Transfer amount"
          value={formatNgnCurrency(transferAmount)}
          colors={colors}
        />
        {controller.fundingAccount ? (
          <FundingAccountDetails colors={colors} controller={controller} />
        ) : (
          <Text
            style={[
              styles.emptyFundingAccountText,
              { color: colors.textSecondary },
            ]}
          >
            Create your account number from the wallet funding screen before
            continuing.
          </Text>
        )}
      </View>
      <TransferActions colors={colors} controller={controller} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open wallet funding screen"
        style={styles.modalCloseButton}
        onPress={controller.openWalletFundingScreen}
      >
        <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>
          Open wallet funding screen
        </Text>
      </Pressable>
    </ModalSheet>
  );
}

function TransferActions({ colors, controller }: TransferModalProps) {
  const [isCopying, setIsCopying] = useState(false);

  const handleCopyFundingAccount = () =>
    runCopyFundingAccount(
      () => controller.handleCopyFundingAccount(),
      setIsCopying
    );

  const handleRetrySavingsCreation = async () => {
    try {
      await controller.submitSavingsGoal();
    } catch (error) {
      handleSavingsActionError(
        error,
        'Unable to retry savings',
        'Failed to retry savings creation. Please try again.'
      );
    }
  };

  return (
    <View style={styles.transferActionRow}>
      {controller.fundingAccount ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy savings funding account number"
          accessibilityState={{ disabled: isCopying }}
          disabled={isCopying}
          style={[
            styles.secondaryButton,
            { borderColor: colors.border },
            isCopying ? styles.buttonDisabled : null,
          ]}
          onPress={handleCopyFundingAccount}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            {isCopying ? 'Copying...' : 'Copy account'}
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Retry savings creation"
        accessibilityState={{ disabled: controller.isSubmitting }}
        style={[
          styles.secondaryButton,
          { borderColor: BRAND.primary, backgroundColor: BRAND.primary },
          controller.isSubmitting ? styles.buttonDisabled : null,
        ]}
        onPress={handleRetrySavingsCreation}
        disabled={controller.isSubmitting}
      >
        <Text style={[styles.secondaryButtonText, { color: palette.white }]}>
          I've funded wallet
        </Text>
      </Pressable>
    </View>
  );
}

function FundingAccountDetails({ colors, controller }: TransferModalProps) {
  if (!controller.fundingAccount) {
    return null;
  }

  return (
    <>
      <View style={styles.transferAccountRow}>
        <Text
          style={[styles.transferMetaLabel, { color: colors.textSecondary }]}
        >
          Account number
        </Text>
        <Text style={[styles.transferMetaValue, { color: colors.text }]}>
          {controller.fundingAccount.account_number}
        </Text>
      </View>
      <View style={styles.transferAccountRow}>
        <Text
          style={[styles.transferMetaLabel, { color: colors.textSecondary }]}
        >
          Bank
        </Text>
        <Text style={[styles.transferMetaValue, { color: colors.text }]}>
          {controller.fundingAccount.bank_name}
        </Text>
      </View>
    </>
  );
}
