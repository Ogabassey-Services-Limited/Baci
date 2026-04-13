import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ExpenseCategory } from '@/components/expenses/expense-categories';
import { expenseFormStyles } from '@/components/expenses/expense-form.styles';
import SafeImage from '@/components/ui/SafeImage';
import { useTheme } from '@/hooks/useTheme';

interface ExpenseFormFieldsProps {
  amount: string;
  description: string;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onOpenCategorySheet: () => void;
  onReceiptPress: () => void;
  receiptUri: string | null;
  selectedCategory: ExpenseCategory;
}

export function ExpenseFormFields({
  amount,
  description,
  onAmountChange,
  onDescriptionChange,
  onOpenCategorySheet,
  onReceiptPress,
  receiptUri,
  selectedCategory,
}: ExpenseFormFieldsProps) {
  const { colors } = useTheme();
  const formattedAmount = amount
    ? amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : '';

  return (
    <>
      <View style={expenseFormStyles.section}>
        <Text
          style={[expenseFormStyles.label, { color: colors.textSecondary }]}
        >
          Amount <Text style={{ color: colors.error }}>*</Text>
        </Text>
        <View
          style={[
            expenseFormStyles.amountContainer,
            { borderColor: colors.border },
          ]}
        >
          <Text
            style={[expenseFormStyles.currencyPrefix, { color: colors.text }]}
          >
            ₦
          </Text>
          <TextInput
            accessibilityLabel="Expense amount"
            keyboardType="decimal-pad"
            onChangeText={onAmountChange}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            style={[expenseFormStyles.amountInput, { color: colors.text }]}
            value={formattedAmount}
          />
        </View>
      </View>

      <View style={expenseFormStyles.section}>
        <Text
          style={[expenseFormStyles.label, { color: colors.textSecondary }]}
        >
          Category <Text style={{ color: colors.error }}>*</Text>
        </Text>
        <Pressable
          accessibilityLabel="Select expense category"
          accessibilityRole="button"
          onPress={onOpenCategorySheet}
          style={[
            expenseFormStyles.selector,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[expenseFormStyles.selectorText, { color: colors.text }]}
          >
            {selectedCategory}
          </Text>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={expenseFormStyles.section}>
        <Text
          style={[expenseFormStyles.label, { color: colors.textSecondary }]}
        >
          Description (Optional)
        </Text>
        <TextInput
          accessibilityLabel="Expense description"
          multiline
          onChangeText={onDescriptionChange}
          placeholder="What was this for?"
          placeholderTextColor={colors.textMuted}
          style={[
            expenseFormStyles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={description}
        />
      </View>

      <View style={expenseFormStyles.section}>
        <Text
          style={[expenseFormStyles.label, { color: colors.textSecondary }]}
        >
          Receipt
        </Text>
        <Pressable
          accessibilityLabel="Add expense receipt"
          accessibilityRole="button"
          onPress={onReceiptPress}
          style={[
            expenseFormStyles.imageUpload,
            { backgroundColor: colors.card, borderColor: colors.border },
            receiptUri ? null : { borderStyle: 'dashed' },
          ]}
        >
          {receiptUri ? (
            <>
              <SafeImage
                contentFit="cover"
                source={{ uri: receiptUri }}
                style={expenseFormStyles.receiptPreview}
                transition={200}
              />
              <View
                style={[
                  expenseFormStyles.changeImageBadge,
                  { backgroundColor: 'rgba(0,0,0,0.6)' },
                ]}
              >
                <Ionicons name="camera" size={20} color="#FFF" />
                <Text style={expenseFormStyles.changeImageText}>Change</Text>
              </View>
            </>
          ) : (
            <View style={expenseFormStyles.uploadPlaceholder}>
              <Ionicons
                color={colors.primary}
                name="camera-outline"
                size={32}
              />
              <Text
                style={[
                  expenseFormStyles.uploadText,
                  { color: colors.primary },
                ]}
              >
                Add Receipt Photo
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </>
  );
}
