/**
 * Payout Settings Screen
 * Manage bank account details for settlements
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppKeyboardContainer } from '@/components/ui/AppKeyboardContainer';
import { getVirtualizedListProps } from '@/components/ui/virtualized-list-props';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePayoutAccountVerification } from '@/hooks/usePayoutAccountVerification';
import { usePayouts } from '@/hooks/usePayouts';
import { type PaystackBank, usePaystackBanks } from '@/hooks/usePaystackBanks';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

interface MerchantBankSettings {
  business_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_code: string | null;
}

export default function PayoutSettingsScreen() {
  const { colors, shadows } = useTheme();
  const { user, session } = useAuth();
  const { savePayoutSettings } = usePayouts();
  const router = useRouter();

  const [accountnumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<PaystackBank | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Banks from backend (canonical source, deduplicated)
  const { data: banks, isLoading: isLoadingBanks } = usePaystackBanks();

  // Fetch current merchant settings
  const { data: merchant, isLoading: isLoadingMerchant } = useQuery({
    queryKey: ['merchant-payout', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchants')
        .select('id, business_name, bank_name, bank_account_number, bank_code')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data as MerchantBankSettings & { id: string };
    },
    enabled: !!user?.id,
  });

  // Account verification — fires once per settled (accountnumber, bank) pair
  const { accountName, isVerifying, verifyError } =
    usePayoutAccountVerification({
      accountNumber: accountnumber,
      bankCode: selectedBank?.code ?? '',
      isAuthenticated: !!session?.access_token,
    });

  // Initialize state from saved merchant settings
  useEffect(() => {
    if (merchant) {
      setAccountNumber(merchant.bank_account_number || '');
      if (merchant.bank_code && banks) {
        const bank = banks.find((b) => b.code === merchant.bank_code);
        if (bank) setSelectedBank(bank);
        else if (merchant.bank_name) {
          setSelectedBank({
            id: 0,
            name: merchant.bank_name,
            slug: '',
            code: merchant.bank_code,
            active: true,
          });
        }
      }
    }
  }, [merchant, banks]);

  // Filter banks for the picker modal
  const filteredBanks =
    banks?.filter((bank) =>
      bank.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  const handleSave = () => {
    if (!selectedBank) {
      Alert.alert('Error', 'Please select a bank');
      return;
    }
    if (accountnumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid account number');
      return;
    }
    if (verifyError) {
      Alert.alert('Error', `Cannot save: ${verifyError}`);
      return;
    }
    // Block save when no verified name OR verification is still in progress
    if (!accountName || isVerifying) {
      Alert.alert('Error', 'Please wait for account verification');
      return;
    }
    savePayoutSettings.mutate(
      {
        bankCode: selectedBank.code,
        accountNumber: accountnumber,
        businessName: merchant?.business_name || 'My Store',
      },
      {
        onSuccess: () => {
          Alert.alert('Success', 'Payout settings saved successfully', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        },
        onError: (error) => {
          Alert.alert('Error', error.message || 'Failed to update details');
        },
      }
    );
  };

  if (isLoadingMerchant) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Payout Settings',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </Pressable>
          ),
          headerStyle: {
            backgroundColor: colors.card,
          },
          headerTitleStyle: {
            color: colors.text,
          },
          headerRight: () => (
            <Pressable
              onPress={handleSave}
              disabled={savePayoutSettings.isPending}
              style={styles.saveButton}
            >
              {savePayoutSettings.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveText, { color: colors.primary }]}>
                  Save
                </Text>
              )}
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View
            style={[styles.card, { backgroundColor: colors.card }, shadows.sm]}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Bank Details
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Where should we send your payouts?
            </Text>

            {/* Bank Select */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Bank Name
              </Text>
              <Pressable
                style={[
                  styles.selectRef,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
                onPress={() => setShowBankModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Select bank"
                accessibilityHint="Opens a modal to search and select your bank"
              >
                <Text
                  style={{
                    color: selectedBank ? colors.text : colors.textMuted,
                    fontSize: TYPOGRAPHY.size.md,
                  }}
                >
                  {selectedBank?.name || 'Select your bank'}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            {/* Account Number */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Account Number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    color: colors.text,
                    backgroundColor: colors.background,
                  },
                ]}
                value={accountnumber}
                onChangeText={(text) => {
                  setAccountNumber(text.replace(/[^0-9]/g, ''));
                }}
                placeholder="0123456789"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={10}
              />

              {/* Verification Status */}
              {isVerifying && (
                <View style={styles.verificationContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.verificationText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Verifying account...
                  </Text>
                </View>
              )}

              {accountName ? (
                <View
                  style={[
                    styles.verificationContainer,
                    styles.successContainer,
                    { backgroundColor: colors.successLight },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={colors.success}
                  />
                  <Text
                    style={[styles.verificationText, { color: colors.success }]}
                  >
                    {accountName}
                  </Text>
                </View>
              ) : null}

              {verifyError ? (
                <View style={styles.verificationContainer}>
                  <Ionicons
                    name="alert-circle"
                    size={16}
                    color={colors.error}
                  />
                  <Text
                    style={[styles.verificationText, { color: colors.error }]}
                  >
                    {verifyError}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View
            style={[styles.noteCard, { backgroundColor: colors.infoLight }]}
          >
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={[styles.noteText, { color: colors.info }]}>
              Please ensure your bank details match your registered business
              name to avoid settlement issues.
            </Text>
          </View>
        </ScrollView>

        {/* Bank Picker Modal */}
        <Modal
          visible={showBankModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <AppKeyboardContainer
            align="start"
            scrollEnabled={false}
            style={styles.modalContainer}
          >
            <View
              style={[
                styles.modalContainer,
                { backgroundColor: colors.background },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Select Bank
                </Text>
                <Pressable
                  onPress={() => setShowBankModal(false)}
                  style={styles.closeButton}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>

              <View
                style={[
                  styles.searchContainer,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Ionicons name="search" size={20} color={colors.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search banks..."
                  placeholderTextColor={colors.textMuted}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
              </View>

              {isLoadingBanks ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  style={{ marginTop: 20 }}
                />
              ) : (
                <FlatList
                  // ⚡ Bolt Performance Optimization: Explicit getItemLayout avoids asynchronous measurement cycles on the UI thread
                  getItemLayout={(_, index) => ({
                    length: 56,
                    offset: 56 * index,
                    index,
                  })}
                  data={filteredBanks}
                  keyExtractor={(item) => item.code}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  {...getVirtualizedListProps()}
                  renderItem={({ item }) => (
                    <Pressable
                      style={[
                        styles.bankItem,
                        { borderBottomColor: colors.border },
                      ]}
                      onPress={() => {
                        setSelectedBank(item);
                        setShowBankModal(false);
                        setSearchTerm('');
                      }}
                    >
                      <Text style={[styles.bankName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      {selectedBank?.code === item.code && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={colors.primary}
                        />
                      )}
                    </Pressable>
                  )}
                />
              )}
            </View>
          </AppKeyboardContainer>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  backButton: { padding: SPACING.sm, marginLeft: -SPACING.sm },
  saveButton: { padding: SPACING.sm, marginRight: -SPACING.sm },
  saveText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginBottom: SPACING.xl,
  },
  inputGroup: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: SPACING.xs,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
  },
  selectRef: {
    height: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  noteCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  noteText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  closeButton: {
    position: 'absolute',
    right: SPACING.md,
    padding: SPACING.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.md,
    height: 40,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    height: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bankName: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
  },
  verificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  successContainer: {
    backgroundColor: undefined, // provided inline to access colors.successLight
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  verificationText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
