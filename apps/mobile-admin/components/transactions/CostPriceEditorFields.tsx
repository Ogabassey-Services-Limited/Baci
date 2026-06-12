import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { styles } from '@/components/transactions/transactions.styles';
import {
  isRuntimePlatform,
  selectRuntimePlatform,
} from '@/config/runtime-platform';
import type { ThemeColors } from '@/constants/theme';
import type { TransactionReviewItem } from '@/hooks/useTransactionReview';
import {
  formatPickerDateInput,
  parseDateInputForPicker,
} from '@/lib/transaction-review';

type DatePickerDisplay = 'default' | 'spinner';

interface CostPriceEditorFieldsProps {
  colors: ThemeColors;
  costPriceInput: string;
  currencySymbol: string;
  dateInput: string;
  onChangeCostPrice: (value: string) => void;
  onChangeDate: (value: string) => void;
  onChangeSupplier: (value: string) => void;
  onChangeUpdateProductDefault: (value: boolean) => void;
  onSave: () => void;
  pending: boolean;
  selectedItem: TransactionReviewItem | null;
  supplierInput: string;
  supplierOptions: string[];
  updateProductDefault: boolean;
  visible: boolean;
}

export function CostPriceEditorFields({
  colors,
  costPriceInput,
  currencySymbol,
  dateInput,
  onChangeCostPrice,
  onChangeDate,
  onChangeSupplier,
  onChangeUpdateProductDefault,
  onSave,
  pending,
  selectedItem,
  supplierInput,
  supplierOptions,
  updateProductDefault,
  visible,
}: CostPriceEditorFieldsProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (!visible) {
      setShowDatePicker(false);
    }
  }
  const isAndroid = isRuntimePlatform('android');
  const pickerDisplay =
    selectRuntimePlatform<DatePickerDisplay>({
      default: 'default',
      ios: 'spinner',
    }) ?? 'default';
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
          accessibilityState={{ disabled: pending, expanded: showDatePicker }}
          disabled={pending}
          onPress={() => setShowDatePicker((previous) => !previous)}
          style={[
            styles.datePickerButton,
            { borderColor: colors.border, opacity: pending ? 0.5 : 1 },
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
            display={pickerDisplay}
            maximumDate={new Date()}
            mode="date"
            onChange={(event, selectedDate) => {
              if (isAndroid) {
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
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                key={option}
                onPress={() => {
                  if (!pending) {
                    onChangeSupplier(option);
                  }
                }}
                style={[
                  styles.supplierSuggestionButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pending ? 0.5 : 1,
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
      {selectedItem?.productId ? (
        <View
          style={[
            styles.catalogDefaultRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pending ? 0.55 : 1,
            },
          ]}
        >
          <View style={styles.flexOne}>
            <Text style={[styles.catalogDefaultTitle, { color: colors.text }]}>
              Update catalog default
            </Text>
            <Text
              style={[
                styles.catalogDefaultSubtitle,
                { color: colors.textSecondary },
              ]}
            >
              Also save this cost as the product or variant default.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Update catalog or variant default cost"
            disabled={pending}
            onValueChange={onChangeUpdateProductDefault}
            value={updateProductDefault}
          />
        </View>
      ) : null}
    </View>
  );
}
