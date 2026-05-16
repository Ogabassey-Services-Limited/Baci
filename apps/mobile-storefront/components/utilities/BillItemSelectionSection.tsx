import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import type { BillItem } from '@/hooks/use-vtu-billers';
import type { useVTUVerify } from '@/hooks/use-vtu-verify';
import type { UtilityBeneficiary } from '@/lib/utility-beneficiaries';
import { BeneficiaryList } from './BeneficiaryList';
import {
  IDENTIFIER_LABELS,
  IDENTIFIER_PLACEHOLDERS,
} from './bill-form.constants';
import { getBillItemLevelLabel } from './bill-form.helpers';
import type { BillFormProps } from './bill-form.types';
import { billFormStyles as styles } from './bill-form-styles';
import type { BillItemSelectionState } from './bill-item-selection';
import { VerificationCard } from './VerificationCard';

type VerifyState = ReturnType<typeof useVTUVerify>;

const BILL_ITEM_AMOUNT_FORMATTER = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  currencyDisplay: 'narrowSymbol',
  maximumFractionDigits: 2,
  style: 'currency',
});

function getVerifyErrorMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return String(error);
}

interface BillItemSelectionSectionProps {
  beneficiaries: UtilityBeneficiary[];
  billItemSelection: BillItemSelectionState;
  colors: typeof Colors.light;
  customerId: string;
  handleBillItemSelect: (depth: number, billItem: BillItem) => void;
  handleSelectBeneficiary: (beneficiary: UtilityBeneficiary) => void;
  handleVerify: () => void;
  isBillItemSelectionComplete: boolean;
  isRepeatPaymentActive: boolean;
  verifiedCustomerName?: string | null;
  selectedBillItemIdentifier: string | null;
  selectedBillerId: string;
  setCustomerId: (value: string) => void;
  setIsRepeatPaymentActive: (value: boolean) => void;
  type: BillFormProps['type'];
  verify: VerifyState;
}

export function BillItemSelectionSection({
  beneficiaries,
  billItemSelection,
  colors,
  customerId,
  handleBillItemSelect,
  handleSelectBeneficiary,
  handleVerify,
  isBillItemSelectionComplete,
  isRepeatPaymentActive,
  verifiedCustomerName,
  selectedBillItemIdentifier,
  selectedBillerId,
  setCustomerId,
  setIsRepeatPaymentActive,
  type,
  verify,
}: BillItemSelectionSectionProps) {
  const trimmedCustomerId = customerId.trim();
  const isVerified = isRepeatPaymentActive || (verify.data?.verified ?? false);
  const isVerifyDisabled =
    !trimmedCustomerId || !selectedBillItemIdentifier || verify.isPending;

  return (
    <>
      {billItemSelection.levels.map((level) => (
        <View
          key={`${selectedBillerId}-${level.depth}`}
          style={styles.selectionLevel}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {getBillItemLevelLabel(type, level.depth)}
          </Text>
          <View style={styles.optionGrid}>
            {level.options.map((billItem) => {
              const isSelected = level.selectedCode === billItem.itemCode;
              const formattedAmount =
                billItem.isAmountFixed && billItem.amount > 0
                  ? BILL_ITEM_AMOUNT_FORMATTER.format(billItem.amount)
                  : null;
              const accessibilityLabel = formattedAmount
                ? `${billItem.itemName} - ${formattedAmount}`
                : billItem.itemName;
              return (
                <Pressable
                  key={`${level.depth}-${billItem.itemCode}`}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: isSelected ? BRAND.primary : colors.card,
                      borderColor: isSelected ? BRAND.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleBillItemSelect(level.depth, billItem)}
                  accessibilityRole="button"
                  accessibilityLabel={accessibilityLabel}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.optionName,
                      {
                        color: isSelected
                          ? colors.primaryForeground
                          : colors.text,
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {billItem.itemName}
                  </Text>
                  {formattedAmount ? (
                    <Text
                      style={[
                        styles.optionMeta,
                        {
                          color: isSelected
                            ? colors.primaryForeground
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {formattedAmount}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      {isBillItemSelectionComplete ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              styles.identifierTitle,
              { color: colors.text },
            ]}
          >
            {IDENTIFIER_LABELS[type]}
          </Text>
          <View style={styles.verifyRow}>
            <TextInput
              style={[
                styles.input,
                styles.verifyInput,
                {
                  backgroundColor: colors.muted,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder={IDENTIFIER_PLACEHOLDERS[type]}
              placeholderTextColor={colors.placeholder}
              keyboardType="number-pad"
              value={customerId}
              accessibilityLabel={IDENTIFIER_LABELS[type]}
              onChangeText={(text) => {
                setCustomerId(text);
                setIsRepeatPaymentActive(false);
              }}
            />
            {isVerified ? (
              <View
                style={[
                  styles.verifiedPill,
                  { backgroundColor: colors.success },
                ]}
              >
                <Text
                  style={[styles.verifiedPillText, { color: colors.black }]}
                >
                  Verified
                </Text>
              </View>
            ) : (
              <Pressable
                style={[
                  styles.verifyButton,
                  {
                    opacity: isVerifyDisabled ? 0.6 : 1,
                  },
                ]}
                onPress={handleVerify}
                disabled={isVerifyDisabled}
                accessibilityRole="button"
                accessibilityLabel="Verify bill item"
                accessibilityHint="Verifies the customer details for the selected bill item"
                accessibilityState={{
                  busy: verify.isPending,
                  disabled: isVerifyDisabled,
                }}
              >
                {verify.isPending ? (
                  <ActivityIndicator
                    color={colors.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.verifyButtonText,
                      { color: colors.primaryForeground },
                    ]}
                  >
                    Verify
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          <BeneficiaryList
            beneficiaries={beneficiaries}
            colors={colors}
            onSelect={handleSelectBeneficiary}
          />

          {isRepeatPaymentActive ? (
            <>
              {verifiedCustomerName ? (
                <View style={styles.verificationCardSpacing}>
                  <VerificationCard
                    verified={true}
                    customerName={verifiedCustomerName}
                    isLoading={false}
                  />
                </View>
              ) : null}
              <Text
                style={[
                  styles.repeatReadyText,
                  { color: colors.textSecondary },
                ]}
              >
                Using details from your previous successful purchase.
              </Text>
            </>
          ) : verify.data || verify.isPending || verify.error ? (
            <View style={styles.verificationCardSpacing}>
              <VerificationCard
                verified={verify.data?.verified ?? false}
                customerName={verify.data?.customerName}
                message={
                  verify.data?.message ?? getVerifyErrorMessage(verify.error)
                }
                isLoading={verify.isPending}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </>
  );
}
