/**
 * Payout Settings Screen
 * Manage bank account details for settlements
 */

import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePayouts } from '@/hooks/usePayouts';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/lib/supabase';

interface Bank {
  id: number;
  name: string;
  slug: string;
  code: string;
  active: boolean;
}

interface MerchantBankSettings {
  business_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_code: string | null;
}

export default function PayoutSettingsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { user, session } = useAuth();
  const { resolveAccount, savePayoutSettings } = usePayouts();
  const router = useRouter();

  const [accountnumber, setAccountNumber] = useState('');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [showBankModal, setShowBankModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Fetch banks from Paystack (Public Endpoint)
  const { data: banks, isLoading: isLoadingBanks } = useQuery({
    queryKey: ['paystack-banks'],
    queryFn: async () => {
      const response = await fetch(
        'https://api.paystack.co/bank?country=nigeria'
      );
      const json = await response.json();
      if (json.status && json.data) {
        return json.data as Bank[];
      }
      throw new Error('Failed to fetch banks');
    },
  });

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

  const verifyAccount = useCallback(async () => {
    if (!accountnumber || accountnumber.length !== 10) {
      setVerifiedName(null);
      return;
    }

    if (!selectedBank) return;

    setIsVerifying(true);
    setVerifyError(null);

    if (!session?.access_token) {
      setVerifyError('Authentication error');
      setIsVerifying(false);
      return;
    }

    resolveAccount.mutate(
      {
        account_number: accountnumber,
        bank_code: selectedBank.code,
      },
      {
        onSuccess: (data) => {
          setVerifiedName(data.account_name);
          setVerifyError(null);
        },
        onError: (error) => {
          console.error('Resolution error:', error);
          // Fallback for test account - Restricted to DEV
          if (__DEV__ && accountnumber === '0000000000') {
            setVerifiedName('Test Account');
            setVerifyError(null);
            return;
          }

          setVerifyError(
            (error as Error).message || 'Network error checking account'
          );
          setVerifiedName(null);
        },
        onSettled: () => {
          setIsVerifying(false);
        },
      }
    );
  }, [accountnumber, selectedBank, resolveAccount, session]);

  useEffect(() => {
    const timeout = setTimeout(verifyAccount, 500); // Debounce
    return () => clearTimeout(timeout);
  }, [verifyAccount]);

  // Initialize state
  useEffect(() => {
    if (merchant) {
      setAccountNumber(merchant.bank_account_number || '');
      if (merchant.bank_code && banks) {
        const bank = banks.find((b) => b.code === merchant.bank_code);
        if (bank) setSelectedBank(bank);
        else if (merchant.bank_name) {
          // Fallback if code not found but name exists
          setSelectedBank({
            name: merchant.bank_name,
            code: merchant.bank_code,
          } as Bank);
        }
      }
    }
  }, [merchant, banks]);

  // Filter banks
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
    if (!verifiedName && !isVerifying) {
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
              <Ionicons
                name="arrow-back"
                size={24}
                color={isDark ? colors.text : '#fff'}
              />
            </Pressable>
          ),
          headerStyle: {
            backgroundColor: '#0F172A', // Force dark background to match screenshot
          },
          headerTitleStyle: {
            color: '#fff',
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
                  const cleaned = text.replace(/[^0-9]/g, '');
                  setAccountNumber(cleaned);
                  if (cleaned.length !== 10) setVerifiedName(null);
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

              {verifiedName && (
                <View
                  style={[
                    styles.verificationContainer,
                    styles.successContainer,
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
                    {verifiedName}
                  </Text>
                </View>
              )}

              {verifyError && (
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
              )}
            </View>
          </View>

          <View
            style={[
              styles.noteCard,
              { backgroundColor: colors.infoLight || '#EFF6FF' },
            ]}
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
          <View
            style={[
              styles.modalContainer,
              { backgroundColor: colors.background },
            ]}
          >
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
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
                data={filteredBanks}
                keyExtractor={(item) => item.code}
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
    padding: SPACING.lg,
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
    backgroundColor: 'rgba(34, 197, 94, 0.1)', // green-500 with opacity
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  verificationText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
});
