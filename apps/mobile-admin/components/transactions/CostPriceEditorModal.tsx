import Ionicons from '@react-native-vector-icons/ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { styles } from '@/components/transactions/transactions.styles';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import type { ThemeColors } from '@/constants/theme';
import type { TransactionReviewItem } from '@/hooks/useTransactionReview';
import { CostPriceEditorFields } from './CostPriceEditorFields';

interface CostPriceEditorModalProps {
  colors: ThemeColors;
  costPriceInput: string;
  currencySymbol: string;
  dateInput: string;
  onChangeCostPrice: (value: string) => void;
  onChangeDate: (value: string) => void;
  onChangeSupplier: (value: string) => void;
  onChangeUpdateProductDefault: (value: boolean) => void;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
  saveError: string | null;
  selectedItem: TransactionReviewItem | null;
  supplierOptions: string[];
  supplierInput: string;
  updateProductDefault: boolean;
  visible: boolean;
}

export function CostPriceEditorModal({
  colors,
  costPriceInput,
  currencySymbol,
  dateInput,
  onChangeCostPrice,
  onChangeDate,
  onChangeSupplier,
  onChangeUpdateProductDefault,
  onClose,
  onSave,
  pending,
  saveError,
  selectedItem,
  supplierOptions,
  supplierInput,
  updateProductDefault,
  visible,
}: CostPriceEditorModalProps) {
  const handleClose = () => {
    onClose();
  };

  return (
    <BottomSheetModal
      accessibilityLabel="Dismiss cost price editor"
      onDismiss={handleClose}
      visible={visible}
    >
      <View style={styles.modalHeader}>
        <View style={styles.flexOne}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            Update transaction
          </Text>
          <Text style={[styles.orderSubtitle, { color: colors.textSecondary }]}>
            {selectedItem?.name}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Close editor"
          accessibilityRole="button"
          disabled={pending}
          onPress={handleClose}
          style={[
            styles.modalCloseButton,
            {
              backgroundColor: colors.inputBg,
              opacity: pending ? 0.45 : 1,
            },
          ]}
        >
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
      <CostPriceEditorFields
        colors={colors}
        costPriceInput={costPriceInput}
        currencySymbol={currencySymbol}
        dateInput={dateInput}
        onChangeCostPrice={onChangeCostPrice}
        onChangeDate={onChangeDate}
        onChangeSupplier={onChangeSupplier}
        onChangeUpdateProductDefault={onChangeUpdateProductDefault}
        onSave={onSave}
        pending={pending}
        selectedItem={selectedItem}
        supplierInput={supplierInput}
        supplierOptions={supplierOptions}
        updateProductDefault={updateProductDefault}
        visible={visible}
      />
      {saveError ? (
        <Text style={[styles.errorText, { color: colors.error }]}>
          {saveError}
        </Text>
      ) : null}
      <View style={styles.modalActions}>
        <Pressable
          onPress={handleClose}
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
