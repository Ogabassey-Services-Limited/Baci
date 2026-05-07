import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { ExpenseCategorySheet } from '@/components/expenses/ExpenseCategorySheet';
import { ExpenseFormFields } from '@/components/expenses/ExpenseFormFields';
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from '@/components/expenses/expense-categories';
import { expenseFormStyles } from '@/components/expenses/expense-form.styles';
import { AppFormScreen } from '@/components/ui/AppFormScreen';
import { SPACING } from '@/constants/theme';
import { useBranches } from '@/hooks/useBranches';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useMerchant } from '@/hooks/useMerchant';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';
import { createUploadFile, type RNFormData } from '@/types/upload';

export default function AddExpenseScreen() {
  const { colors } = useTheme();
  const { merchant } = useMerchant();
  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const { scope } = useBranchScope();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory>(
    EXPENSE_CATEGORIES[0]
  );
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isCategorySheetVisible, setCategorySheetVisible] = useState(false);
  const parsedAmount = Number.parseFloat(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const selectedBranchId =
    scope.type === 'branch'
      ? (scope.branchId ?? null)
      : (branches.find((branch) => branch.is_default)?.id ??
        branches[0]?.id ??
        null);
  const canSaveExpense =
    hasValidAmount && !branchesLoading && selectedBranchId !== null;

  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error('Merchant ID missing');
      if (!hasValidAmount) throw new Error('Invalid expense amount');
      if (!selectedBranchId) throw new Error('No active branch is available');

      let uploadedReceiptUrl: string | null = null;

      if (receiptUri) {
        const fileExt = receiptUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${merchant.id}/${Date.now()}.${fileExt}`;
        const filePath = `expenses/${fileName}`;
        const fileData = new FormData() as RNFormData;
        fileData.append(
          'file',
          createUploadFile({
            uri: receiptUri,
            name: fileName.split('/').pop() || 'receipt.jpg',
            type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          })
        );

        try {
          const { error: uploadError } = await supabase.storage
            .from('media')
            .upload(filePath, fileData, {
              contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
              upsert: true,
            });

          if (uploadError) {
            throw uploadError;
          }

          const { data } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);
          uploadedReceiptUrl = data.publicUrl;
        } catch (error) {
          console.error('Receipt upload failed:', error);
          throw new Error('Failed to upload receipt image', { cause: error });
        }
      }

      const { error } = await supabase.from('expenses').insert({
        merchant_id: merchant.id,
        branch_id: selectedBranchId,
        amount: parsedAmount,
        category: selectedCategory,
        description: description || null,
        date: new Date().toISOString(),
        receipt_url: uploadedReceiptUrl,
      });

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      Alert.alert('Success', 'Expense saved', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error: Error) => {
      console.error('Failed to save expense:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    },
  });

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/,/g, '');
    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
      setAmount(cleaned);
    }
  };

  const handleImagePick = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setReceiptUri(result.assets[0].uri);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSaveExpense = () => {
    if (!hasValidAmount) {
      Alert.alert('Invalid Amount', 'Enter a valid amount greater than zero.');
      return;
    }

    if (branchesLoading) {
      Alert.alert('Branches loading', 'Please wait for branches to finish loading.');
      return;
    }

    if (!selectedBranchId) {
      Alert.alert('No branch available', 'Create an active branch before saving expenses.');
      return;
    }

    createExpenseMutation.mutate();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Expense',
          headerLeft: () => (
            <Pressable
              accessibilityLabel="Close add expense screen"
              accessibilityRole="button"
              onPress={() => router.back()}
              style={{ padding: SPACING.sm }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />

      <AppFormScreen
        contentContainerStyle={expenseFormStyles.content}
        edges={['bottom']}
        footer={
          <View
            style={[
              expenseFormStyles.footer,
              {
                backgroundColor: colors.card,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Pressable
              accessibilityLabel="Save expense"
              accessibilityRole="button"
              disabled={!canSaveExpense || createExpenseMutation.isPending}
              onPress={handleSaveExpense}
              style={[
                expenseFormStyles.saveButton,
                {
                  backgroundColor: colors.primary,
                  opacity:
                    !canSaveExpense || createExpenseMutation.isPending
                      ? 0.7
                      : 1,
                },
              ]}
            >
              {createExpenseMutation.isPending ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[
                    expenseFormStyles.saveButtonText,
                    { color: colors.textOnPrimary },
                  ]}
                >
                  Save Expense
                </Text>
              )}
            </Pressable>
          </View>
        }
        style={{ backgroundColor: colors.background }}
      >
        <ExpenseFormFields
          amount={amount}
          description={description}
          onAmountChange={handleAmountChange}
          onDescriptionChange={setDescription}
          onOpenCategorySheet={() => setCategorySheetVisible(true)}
          onReceiptPress={handleImagePick}
          receiptUri={receiptUri}
          selectedCategory={selectedCategory}
        />
      </AppFormScreen>

      <ExpenseCategorySheet
        onClose={() => setCategorySheetVisible(false)}
        onSelect={setSelectedCategory}
        selectedCategory={selectedCategory}
        visible={isCategorySheetVisible}
      />
    </>
  );
}
