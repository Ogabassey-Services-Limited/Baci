/**
 * Add Expense Screen
 * Record a new business expense
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@/hooks/useTheme';
import { useMerchant } from '@/hooks/useMerchant';
import { supabase } from '@/lib/supabase';
import { SPACING, RADIUS, TYPOGRAPHY } from '@/constants/theme';

const CATEGORIES = [
  'Inventory',
  'Marketing',
  'Salaries',
  'Rent',
  'Utilities',
  'Software',
  'Travel',
  'Meals',
  'Maintenance',
  'Other',
];

export default function AddExpenseScreen() {
  const { colors } = useTheme();
  const { merchant } = useMerchant();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [isCategoryModalVisible, setCategoryModalVisible] = useState(false);

  // Upload state managed within mutation
  const createExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error('Merchant ID missing');
      if (!amount) throw new Error('Amount is required');

      let uploadedReceiptUrl = null;

      // 1. Upload receipt if exists
      if (receiptUri) {
        try {
          const fileExt = receiptUri.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${merchant.id}/${Date.now()}.${fileExt}`;
          const filePath = `expenses/${fileName}`; // Organized in folder

          // Use FormData for reliable file upload in React Native
          const fileData = new FormData();
          fileData.append('file', {
            uri: receiptUri,
            name: fileName.split('/').pop()!,
            type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          } as unknown as { uri: string; name: string; type: string });

          const { error: uploadError } = await supabase.storage
            .from('media') // Reusing media bucket
            .upload(filePath, fileData, {
              contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);
          uploadedReceiptUrl = data.publicUrl;
        } catch (e) {
          console.error('Receipt upload failed:', e);
          // Decide: Fail whole operation or continue without receipt?
          // Let's continue but warn. For now, throw to be safe.
          throw new Error('Failed to upload receipt image');
        }
      }

      // 2. Insert expense record
      const { error } = await supabase.from('expenses').insert({
        merchant_id: merchant.id,
        amount: parseFloat(amount),
        category: selectedCategory,
        description: description || null,
        date: new Date().toISOString(), // Default to now
        receipt_url: uploadedReceiptUrl,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      Alert.alert('Success', 'Expense saved', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    },
  });

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
    } catch (_error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Expense',
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ padding: SPACING.sm }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.content}>
            {/* Amount Input */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Amount <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <View
                style={[styles.amountContainer, { borderColor: colors.border }]}
              >
                <Text style={[styles.currencyPrefix, { color: colors.text }]}>
                  ₦
                </Text>
                <TextInput
                  style={[styles.amountInput, { color: colors.text }]}
                  value={
                    amount ? amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                  }
                  onChangeText={(text) => {
                    const cleaned = text.replace(/,/g, '');
                    if (cleaned === '' || /^\d*\.?\d*$/.test(cleaned)) {
                      setAmount(cleaned);
                    }
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Category Selector */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Category <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <Pressable
                style={[
                  styles.selector,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
                onPress={() => setCategoryModalVisible(true)}
              >
                <Text style={[styles.selectorText, { color: colors.text }]}>
                  {selectedCategory}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {/* Description */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Description (Optional)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: colors.text,
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                value={description}
                onChangeText={setDescription}
                placeholder="What was this for?"
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </View>

            {/* Receipt/Image */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Receipt
              </Text>
              <Pressable
                style={[
                  styles.imageUpload,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  receiptUri ? null : { borderStyle: 'dashed' },
                ]}
                onPress={handleImagePick}
              >
                {receiptUri ? (
                  <>
                    <Image
                      source={receiptUri}
                      style={styles.receiptPreview}
                      contentFit="cover"
                      transition={200}
                    />
                    <View
                      style={[
                        styles.changeImageBadge,
                        { backgroundColor: 'rgba(0,0,0,0.6)' },
                      ]}
                    >
                      <Ionicons name="camera" size={20} color="#FFF" />
                      <Text
                        style={{
                          color: '#FFF',
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        Change
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Ionicons
                      name="camera-outline"
                      size={32}
                      color={colors.primary}
                    />
                    <Text
                      style={[styles.uploadText, { color: colors.primary }]}
                    >
                      Add Receipt Photo
                    </Text>
                  </View>
                )}
              </Pressable>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View
            style={[
              styles.footer,
              { backgroundColor: colors.card, borderTopColor: colors.border },
            ]}
          >
            <Pressable
              style={[
                styles.saveButton,
                {
                  backgroundColor: colors.primary,
                  opacity: !amount || createExpenseMutation.isPending ? 0.7 : 1,
                },
              ]}
              onPress={() => createExpenseMutation.mutate()}
              disabled={!amount || createExpenseMutation.isPending}
            >
              {createExpenseMutation.isPending ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Expense</Text>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>

        {/* Category Modal */}
        <Modal
          visible={isCategoryModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCategoryModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setCategoryModalVisible(false)}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Category
                </Text>
                <Pressable onPress={() => setCategoryModalVisible(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat}
                    style={[
                      styles.categoryOption,
                      { borderBottomColor: colors.border },
                      selectedCategory === cat && {
                        backgroundColor: colors.primary + '10',
                      },
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setCategoryModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        {
                          color:
                            selectedCategory === cat
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      {cat}
                    </Text>
                    {selectedCategory === cat && (
                      <Ionicons
                        name="checkmark"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg },
  section: { marginBottom: SPACING.xl },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
    marginLeft: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    paddingVertical: SPACING.sm,
  },
  currencyPrefix: {
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginRight: SPACING.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size['3xl'],
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  selectorText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },

  imageUpload: {
    height: 200,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadPlaceholder: { alignItems: 'center', gap: SPACING.sm },
  uploadText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  receiptPreview: { width: '100%', height: '100%' },
  changeImageBadge: {
    position: 'absolute',
    bottom: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },

  footer: { padding: SPACING.lg, borderTopWidth: 1 },
  saveButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  categoryOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
  },
  categoryOptionText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
