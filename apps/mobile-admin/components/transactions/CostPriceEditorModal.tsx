import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { styles } from '@/components/transactions/transactions.styles';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import type { ThemeColors } from '@/constants/theme';
import type { TransactionReviewItem } from '@/hooks/useTransactionReview';
import {
  formatPickerDateInput,
  parseDateInputForPicker,
} from '@/lib/transaction-review';

interface CostPriceEditorModalProps {
  colors: ThemeColors;
  costPriceInput: string;
  currencySymbol: string;
  dateInput: string;
  onChangeCostPrice: (value: string) => void;
  onChangeDate: (value: string) => void;
  onChangeSupplier: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  pending: boolean;
  saveError: string | null;
  selectedItem: TransactionReviewItem | null;
  supplierOptions: string[];
  supplierInput: string;
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
  onClose,
  onSave,
  pending,
  saveError,
  selectedItem,
  supplierOptions,
  supplierInput,
  visible,
}: CostPriceEditorModalProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const normalizedSupplierInput = supplierInput.trim().toLowerCase();
  const visibleSupplierOptions = normalizedSupplierInput
    ? supplierOptions
        .filter((option) => {
          const normalizedOption = option.toLowerCase();
          return (
            normalizedOption.includes(normalizedSupplierInput) &&
            normalizedOption !== normalizedSupplierInput
          );
        })
        .slice(0, 5)
    : [];

  return (
    <BottomSheetModal
      accessibilityLabel="Dismiss cost price editor"
      onDismiss={onClose}
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
          onPress={onClose}
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
      <View style={styles.modalFields}>
        <View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Cost price
          </Text>
          <TextInput
            accessibilityLabel="Cost price input"
            editable={!pending}
            keyboardType="decimal-pad"
            onChangeText={onChangeCostPrice}
            onSubmitEditing={onSave}
            placeholder={`${currencySymbol}0`}
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
        </View>
        <View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Transaction date
          </Text>
          <TextInput
            accessibilityLabel="Transaction date input"
            autoCapitalize="none"
            editable={!pending}
            keyboardType="numbers-and-punctuation"
            onChangeText={onChangeDate}
            onSubmitEditing={onSave}
            placeholder="YYYY-MM-DD"
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
            value={dateInput}
          />
          <Pressable
            accessibilityLabel="Open transaction date picker"
            accessibilityRole="button"
            accessibilityState={{
              disabled: pending,
              expanded: showDatePicker,
            }}
            disabled={pending}
            onPress={() => setShowDatePicker((previous) => !previous)}
            style={[
              styles.datePickerButton,
              {
                borderColor: colors.border,
                opacity: pending ? 0.5 : 1,
              },
            ]}
          >
            <Text
              style={[styles.datePickerButtonText, { color: colors.primary }]}
            >
              Pick date
            </Text>
          </Pressable>
          {showDatePicker ? (
            <DateTimePicker
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              mode="date"
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') {
                  setShowDatePicker(false);
                  if (event.type === 'dismissed') {
                    return;
                  }
                }
                if (selectedDate) {
                  onChangeDate(formatPickerDateInput(selectedDate));
                }
              }}
              value={parseDateInputForPicker(dateInput)}
            />
          ) : null}
        </View>
        <View>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
            Vendor / supplier
          </Text>
          <TextInput
            accessibilityLabel="Vendor or supplier input"
            autoCapitalize="words"
            editable={!pending}
            onChangeText={onChangeSupplier}
            onSubmitEditing={onSave}
            placeholder="Add supplier name"
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
            value={supplierInput}
          />
          {visibleSupplierOptions.length > 0 ? (
            <View style={styles.supplierSuggestions}>
              {visibleSupplierOptions.map((option) => (
                <Pressable
                  accessibilityLabel={`Select supplier ${option}`}
                  accessibilityRole="button"
                  key={option}
                  onPress={() => onChangeSupplier(option)}
                  style={[
                    styles.supplierSuggestionButton,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.supplierSuggestionText,
                      { color: colors.text },
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>
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
