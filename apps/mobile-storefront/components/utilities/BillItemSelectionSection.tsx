import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import Colors, { BRAND } from '@/constants/Colors';
import type { BillItem } from '@/hooks/use-vtu-billers';
import type { useVTUVerify } from '@/hooks/use-vtu-verify';
import {
  IDENTIFIER_LABELS,
  IDENTIFIER_PLACEHOLDERS,
} from './bill-form.constants';
import { getBillItemLevelLabel } from './bill-form.helpers';
import { billFormStyles as styles } from './bill-form-styles';
import type { BillFormProps } from './bill-form.types';
import type { BillItemSelectionState } from './bill-item-selection';
import { VerificationCard } from './VerificationCard';

type VerifyState = ReturnType<typeof useVTUVerify>;

interface BillItemSelectionSectionProps {
  billItemSelection: BillItemSelectionState;
  colors: typeof Colors.light;
  customerId: string;
  handleBillItemSelect: (depth: number, billItem: BillItem) => void;
  handleVerify: () => void;
  isBillItemSelectionComplete: boolean;
  isRepeatPaymentActive: boolean;
  resetVerification: () => void;
  selectedBillItemIdentifier: string | null;
  selectedBillerId: string;
  setCustomerId: (value: string) => void;
  setIsRepeatPaymentActive: (value: boolean) => void;
  type: BillFormProps['type'];
  verify: VerifyState;
}

export function BillItemSelectionSection({
  billItemSelection,
  colors,
  customerId,
  handleBillItemSelect,
  handleVerify,
  isBillItemSelectionComplete,
  isRepeatPaymentActive,
  resetVerification,
  selectedBillItemIdentifier,
  selectedBillerId,
  setCustomerId,
  setIsRepeatPaymentActive,
  type,
  verify,
}: BillItemSelectionSectionProps) {
  return (
    <>
      {billItemSelection.levels.map((level) => (
        <View
          key={`${selectedBillerId}-${level.depth}`}
          style={{ marginTop: 24 }}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {getBillItemLevelLabel(type, level.depth)}
          </Text>
          <View style={styles.optionGrid}>
            {level.options.map((billItem) => {
              const isSelected = level.selectedCode === billItem.itemCode;
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
                >
                  <Text
                    style={[
                      styles.optionName,
                      { color: isSelected ? '#FFF' : colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {billItem.itemName}
                  </Text>
                  {billItem.isAmountFixed && billItem.amount > 0 ? (
                    <Text
                      style={[
                        styles.optionMeta,
                        {
                          color: isSelected
                            ? 'rgba(255,255,255,0.85)'
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      ₦{billItem.amount.toLocaleString()}
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
            style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}
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
              onChangeText={(text) => {
                setCustomerId(text);
                setIsRepeatPaymentActive(false);
                resetVerification();
              }}
            />
            {isRepeatPaymentActive ? (
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
                    opacity:
                      !customerId ||
                      !selectedBillItemIdentifier ||
                      verify.isPending
                        ? 0.6
                        : 1,
                  },
                ]}
                onPress={handleVerify}
                disabled={
                  !customerId || !selectedBillItemIdentifier || verify.isPending
                }
              >
                {verify.isPending ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify</Text>
                )}
              </Pressable>
            )}
          </View>

          {isRepeatPaymentActive ? (
            <Text
              style={[styles.repeatReadyText, { color: colors.textSecondary }]}
            >
              Using details from your previous successful purchase.
            </Text>
          ) : verify.data || verify.isPending || verify.error ? (
            <View style={{ marginTop: 12 }}>
              <VerificationCard
                verified={verify.data?.verified ?? false}
                customerName={verify.data?.customerName}
                message={verify.data?.message ?? verify.error?.message}
                isLoading={verify.isPending}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </>
  );
}
