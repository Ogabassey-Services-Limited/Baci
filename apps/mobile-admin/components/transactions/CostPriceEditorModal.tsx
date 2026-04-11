import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { styles } from '@/app/(admin)/transactions.styles';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import type { ThemeColors } from '@/constants/theme';
import type { TransactionReviewItem } from '@/hooks/useTransactionReview';

interface CostPriceEditorModalProps {
  colors: ThemeColors;
  costPriceInput: string;
  onChangeCostPrice: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
  saveError: string | null;
  selectedItem: TransactionReviewItem | null;
  visible: boolean;
}

export function CostPriceEditorModal({
  colors,
  costPriceInput,
  onChangeCostPrice,
  onClose,
  onSave,
  pending,
  saveError,
  selectedItem,
  visible,
}: CostPriceEditorModalProps) {
  return (
    <BottomSheetModal
      accessibilityLabel="Dismiss cost price editor"
      onDismiss={onClose}
      visible={visible}
    >
      <Text style={[styles.modalTitle, { color: colors.text }]}>
        Update cost price
      </Text>
      <Text style={[styles.orderSubtitle, { color: colors.textSecondary }]}>
        {selectedItem?.name}
      </Text>
      <TextInput
        editable={!pending}
        keyboardType="decimal-pad"
        onChangeText={onChangeCostPrice}
        onSubmitEditing={onSave}
        placeholder="Enter cost price"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        style={[
          styles.input,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={costPriceInput}
      />
      {saveError ? (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {saveError}
        </Text>
      ) : null}
      <View style={styles.modalActions}>
        <Pressable
          onPress={onClose}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel="Cancel cost price update"
          style={({ pressed }) => ({
            opacity: pending ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={pending}
          accessibilityRole="button"
          accessibilityLabel="Save cost price"
          accessibilityState={{
            busy: pending,
            disabled: pending,
          }}
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.primary,
              opacity: pending ? 0.6 : 1,
            },
          ]}
        >
          {pending ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <Text
              style={[styles.actionButtonText, { color: colors.textOnPrimary }]}
            >
              Save
            </Text>
          )}
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}
