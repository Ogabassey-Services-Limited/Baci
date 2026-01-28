/**
 * Staff Accounts & Branches Screen
 * Manage payment accounts for staff and branch locations
 */

import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { z } from 'zod';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useStaff } from '@/hooks/useStaff';
import { supabase } from '@/lib/supabase';

interface StaffAccount {
  id: string;
  code: string;
  name: string;
  account_number: string | null;
  account_name: string | null;
  bank: string | null;
  payment_link: string | null;
  active: boolean;
  branch_id: string | null;
  staff_id: string | null;
}

interface Branch {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  is_default: boolean;
  active: boolean;
}

type TabType = 'accounts' | 'branches';

export default function StaffAccountsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  // Fetch merchant ID
  const { data: merchant } = useQuery({
    queryKey: ['merchant', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data } = await supabase
        .from('merchants')
        .select('id, business_name')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch Staff Accounts
  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useQuery({
    queryKey: ['staff-accounts', merchant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('virtual_terminals')
        .select('*')
        .eq('merchant_id', merchant?.id)
        .order('created_at', { ascending: false });
      return (data || []) as StaffAccount[];
    },
    enabled: !!merchant?.id,
  });

  // Fetch Branches
  const {
    data: branches,
    isLoading: branchesLoading,
    isError: branchesError,
  } = useQuery({
    queryKey: ['branches', merchant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('branches')
        .select('*')
        .eq('merchant_id', merchant?.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      return (data || []) as Branch[];
    },
    enabled: !!merchant?.id,
  });

  // Fetch Staff Members
  const { data: staffMembers } = useStaff();

  // Create Staff Account
  const createAccountMutation = useMutation({
    mutationFn: async ({
      name,
      staffId,
      branchId,
    }: {
      name: string;
      staffId?: string | null;
      branchId?: string | null;
    }) => {
      // Client-side Zod validation
      const schema = z.object({
        name: z.string().min(3, 'Account name must be at least 3 characters'),
      });

      const validation = schema.safeParse({ name });
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/paystack/virtual-terminal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            name,
            staffId: staffId || undefined,
            branchId: branchId || undefined,
            destinations: [],
          }),
        }
      );
      if (!response.ok) {
        let errorMessage = 'Failed to create account';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response wasn't JSON, use default message
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts'] });
      setShowAccountModal(false);
      setNewAccountName('');
      setSelectedStaffId(null);
      setSelectedBranchId(null);
      Alert.alert('Success', 'Staff account created successfully!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  // Create Branch
  const createBranchMutation = useMutation({
    mutationFn: async ({ name, city }: { name: string; city: string }) => {
      // Client-side Zod validation
      const schema = z.object({
        name: z.string().min(3, 'Branch name must be at least 3 characters'),
        city: z.string().optional(),
      });

      const validation = schema.safeParse({ name, city });
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }

      // Let the server determine is_default via database trigger/default value
      // to avoid race conditions from stale client-side cache
      const { data, error } = await supabase
        .from('branches')
        .insert({
          merchant_id: merchant?.id,
          name,
          city: city || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      setShowBranchModal(false);
      setNewBranchName('');
      setNewBranchCity('');
      Alert.alert('Success', 'Branch created successfully!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied!', 'Account number copied to clipboard.');
    } catch (_error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const isLoading = accountsLoading || branchesLoading;
  const hasError = accountsError || branchesError;

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (hasError) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color={colors.notification}
          />
          <Text
            style={[
              styles.emptyTitle,
              { color: colors.text, marginTop: SPACING.md },
            ]}
          >
            Failed to load data
          </Text>
          <Text
            style={[styles.emptyDescription, { color: colors.textSecondary }]}
          >
            Please check your connection and try again.
          </Text>
          <Pressable
            style={[
              styles.modalButton,
              { backgroundColor: colors.primary, marginTop: SPACING.lg },
            ]}
            onPress={() => {
              queryClient.invalidateQueries({ queryKey: ['staff-accounts'] });
              queryClient.invalidateQueries({ queryKey: ['branches'] });
            }}
            accessibilityRole="button"
            accessibilityLabel="Retry loading data"
          >
            <Text
              style={{
                color: '#FFF',
                fontFamily: TYPOGRAPHY.fontFamily.semiBold,
              }}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Payment Accounts',
        }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card }]}>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'accounts' && {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => setActiveTab('accounts')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'accounts' }}
            accessibilityLabel="Staff Accounts Tab"
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={activeTab === 'accounts' ? '#FFF' : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'accounts' ? '#FFF' : colors.textMuted,
                },
              ]}
            >
              Staff Accounts
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'branches' && {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => setActiveTab('branches')}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === 'branches' }}
            accessibilityLabel="Branches Tab"
            accessibilityHint="Switch to view and manage branch locations"
          >
            <Ionicons
              name="business-outline"
              size={18}
              color={activeTab === 'branches' ? '#FFF' : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'branches' ? '#FFF' : colors.textMuted,
                },
              ]}
            >
              Branches
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {activeTab === 'accounts' ? (
            <>
              {/* Staff Accounts List */}
              {(accounts?.length || 0) === 0 ? (
                <View
                  style={[
                    styles.emptyState,
                    { backgroundColor: colors.card },
                    shadows.sm,
                  ]}
                >
                  <View
                    style={[
                      styles.emptyIcon,
                      { backgroundColor: colors.primaryLight || '#E8F0FE' },
                    ]}
                  >
                    <Ionicons
                      name="person-add-outline"
                      size={32}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    No Staff Accounts Yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Create accounts to track sales by staff member.
                  </Text>
                </View>
              ) : (
                accounts?.map((account) => (
                  <View
                    key={account.id}
                    style={[
                      styles.card,
                      { backgroundColor: colors.card },
                      shadows.sm,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleRow}>
                        <View
                          style={[
                            styles.cardIcon,
                            {
                              backgroundColor: colors.primaryLight || '#E8F0FE',
                            },
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={20}
                            color={colors.primary}
                          />
                        </View>
                        <View>
                          <Text
                            style={[styles.cardTitle, { color: colors.text }]}
                          >
                            {account.name}
                          </Text>
                          <Text
                            style={[
                              styles.cardSubtitle,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {account.code}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: account.active
                              ? colors.successLight || '#E8F5E9'
                              : colors.cardHover,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: account.active
                                ? colors.success
                                : colors.textMuted,
                            },
                          ]}
                        >
                          {account.active ? 'ACTIVE' : 'INACTIVE'}
                        </Text>
                      </View>
                    </View>

                    {account.account_number && (
                      <Pressable
                        style={[
                          styles.accountDetail,
                          { backgroundColor: colors.cardHover },
                        ]}
                        onPress={() => copyToClipboard(account.account_number!)}
                      >
                        <View>
                          <Text
                            style={[
                              styles.detailLabel,
                              { color: colors.textSecondary },
                            ]}
                          >
                            Account Number
                          </Text>
                          <Text
                            style={[styles.detailValue, { color: colors.text }]}
                          >
                            {account.account_number}
                          </Text>
                          <Text
                            style={[
                              styles.detailBank,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {account.bank}
                          </Text>
                        </View>
                        <Ionicons
                          name="copy-outline"
                          size={20}
                          color={colors.textMuted}
                        />
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              {/* Branches List */}
              {(branches?.length || 0) === 0 ? (
                <View
                  style={[
                    styles.emptyState,
                    { backgroundColor: colors.card },
                    shadows.sm,
                  ]}
                >
                  <View
                    style={[
                      styles.emptyIcon,
                      { backgroundColor: colors.primaryLight || '#E8F0FE' },
                    ]}
                  >
                    <Ionicons
                      name="business-outline"
                      size={32}
                      color={colors.primary}
                    />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    No Branches Yet
                  </Text>
                  <Text
                    style={[
                      styles.emptyDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    Add store locations to organize staff accounts.
                  </Text>
                </View>
              ) : (
                branches?.map((branch) => (
                  <View
                    key={branch.id}
                    style={[
                      styles.card,
                      { backgroundColor: colors.card },
                      shadows.sm,
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.cardTitleRow}>
                        <View
                          style={[
                            styles.cardIcon,
                            {
                              backgroundColor: colors.primaryLight || '#E8F0FE',
                            },
                          ]}
                        >
                          <Ionicons
                            name="location"
                            size={20}
                            color={colors.primary}
                          />
                        </View>
                        <View>
                          <Text
                            style={[styles.cardTitle, { color: colors.text }]}
                          >
                            {branch.name}
                            {branch.is_default && ' ⭐'}
                          </Text>
                          <Text
                            style={[
                              styles.cardSubtitle,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {branch.city || branch.address || 'No address'}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: branch.active
                              ? colors.successLight || '#E8F5E9'
                              : colors.cardHover,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: branch.active
                                ? colors.success
                                : colors.textMuted,
                            },
                          ]}
                        >
                          {branch.active ? 'ACTIVE' : 'INACTIVE'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* Info Notice */}
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.infoLight || '#EFF6FF' },
            ]}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={colors.info || '#3B82F6'}
            />
            <Text
              style={[styles.noticeText, { color: colors.info || '#3B82F6' }]}
            >
              All payments reconcile to your main wallet automatically.
            </Text>
          </View>
        </ScrollView>

        {/* FAB */}
        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() =>
            activeTab === 'accounts'
              ? setShowAccountModal(true)
              : setShowBranchModal(true)
          }
          accessibilityRole="button"
          accessibilityLabel={
            activeTab === 'accounts'
              ? 'Create staff account'
              : 'Create new branch'
          }
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </Pressable>

        {/* Create Account Modal */}
        <Modal
          visible={showAccountModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAccountModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create Staff Account
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.cardHover,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Account name (e.g. Kola's Account)"
                placeholderTextColor={colors.textMuted}
                value={newAccountName}
                onChangeText={setNewAccountName}
              />

              {/* Branch Picker */}
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Assign to Branch (Optional)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pickerScroll}
              >
                <Pressable
                  style={[
                    styles.pickerOption,
                    !selectedBranchId && {
                      borderColor: colors.primary,
                      backgroundColor: `${colors.primary}10`,
                    },
                    {
                      borderColor: !selectedBranchId
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedBranchId(null)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !selectedBranchId }}
                  accessibilityLabel="No branch assigned"
                >
                  <Text
                    style={[
                      styles.pickerText,
                      {
                        color: !selectedBranchId ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    No Branch
                  </Text>
                </Pressable>
                {branches?.map((branch) => (
                  <Pressable
                    key={branch.id}
                    style={[
                      styles.pickerOption,
                      selectedBranchId === branch.id && {
                        borderColor: colors.primary,
                        backgroundColor: `${colors.primary}10`,
                      },
                      {
                        borderColor:
                          selectedBranchId === branch.id
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedBranchId(branch.id)}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: selectedBranchId === branch.id,
                    }}
                    accessibilityLabel={`Branch: ${branch.name}`}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        {
                          color:
                            selectedBranchId === branch.id
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      {branch.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Staff Picker */}
              <Text
                style={[styles.inputLabel, { color: colors.textSecondary }]}
              >
                Assign to Staff (Optional)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pickerScroll}
              >
                <Pressable
                  style={[
                    styles.pickerOption,
                    !selectedStaffId && {
                      borderColor: colors.primary,
                      backgroundColor: `${colors.primary}10`,
                    },
                    {
                      borderColor: !selectedStaffId
                        ? colors.primary
                        : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedStaffId(null)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !selectedStaffId }}
                  accessibilityLabel="No staff assigned"
                >
                  <Text
                    style={[
                      styles.pickerText,
                      {
                        color: !selectedStaffId ? colors.primary : colors.text,
                      },
                    ]}
                  >
                    No Staff
                  </Text>
                </Pressable>
                {staffMembers?.map((staff) => (
                  <Pressable
                    key={staff.id}
                    style={[
                      styles.pickerOption,
                      selectedStaffId === staff.id && {
                        borderColor: colors.primary,
                        backgroundColor: `${colors.primary}10`,
                      },
                      {
                        borderColor:
                          selectedStaffId === staff.id
                            ? colors.primary
                            : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedStaffId(staff.id)}
                    accessibilityRole="radio"
                    accessibilityState={{
                      selected: selectedStaffId === staff.id,
                    }}
                    accessibilityLabel={`Staff: ${staff.name || staff.email}`}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        {
                          color:
                            selectedStaffId === staff.id
                              ? colors.primary
                              : colors.text,
                        },
                      ]}
                    >
                      {staff.name || staff.email}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.modalButtons}>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.cardHover },
                  ]}
                  onPress={() => setShowAccountModal(false)}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() =>
                    createAccountMutation.mutate({
                      name: newAccountName,
                      staffId: selectedStaffId,
                      branchId: selectedBranchId,
                    })
                  }
                  disabled={createAccountMutation.isPending}
                >
                  {createAccountMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: '#FFF' }]}>
                      Create
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Create Branch Modal */}
        <Modal
          visible={showBranchModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowBranchModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={[styles.modalContent, { backgroundColor: colors.card }]}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Create Branch
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.cardHover,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Branch name (e.g. Lagos Main)"
                placeholderTextColor={colors.textMuted}
                value={newBranchName}
                onChangeText={setNewBranchName}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.cardHover,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="City (optional)"
                placeholderTextColor={colors.textMuted}
                value={newBranchCity}
                onChangeText={setNewBranchCity}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.cardHover },
                  ]}
                  onPress={() => setShowBranchModal(false)}
                >
                  <Text
                    style={[styles.modalButtonText, { color: colors.text }]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() =>
                    createBranchMutation.mutate({
                      name: newBranchName,
                      city: newBranchCity,
                    })
                  }
                  disabled={createBranchMutation.isPending}
                >
                  {createBranchMutation.isPending ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={[styles.modalButtonText, { color: '#FFF' }]}>
                      Create
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: SPACING.lg, paddingBottom: 100 },
  tabContainer: {
    flexDirection: 'row',
    padding: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING['2xl'],
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
    marginBottom: SPACING.xs,
  },
  emptyDescription: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    textAlign: 'center',
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  cardSubtitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
  accountDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
  },
  detailLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: TYPOGRAPHY.size.lg,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
  },
  detailBank: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    marginTop: 2,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  noticeText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.regular,
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  pickerScroll: {
    marginBottom: SPACING.sm,
  },
  pickerOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: SPACING.sm,
  },
  pickerText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING['2xl'],
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: RADIUS['2xl'],
    borderTopRightRadius: RADIUS['2xl'],
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.size.xl,
    fontFamily: TYPOGRAPHY.fontFamily.bold,
    marginBottom: SPACING.lg,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.size.md,
    marginBottom: SPACING.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  modalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  modalButtonText: {
    fontSize: TYPOGRAPHY.size.md,
    fontFamily: TYPOGRAPHY.fontFamily.semiBold,
  },
});
