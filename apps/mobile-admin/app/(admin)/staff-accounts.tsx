/**
 * Staff Accounts & Branches Screen
 * Manage payment accounts for staff and branch locations
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BranchCard } from '@/components/staff/BranchCard';
import { BranchModal } from '@/components/staff/BranchModal';
import { StaffAccountCard } from '@/components/staff/StaffAccountCard';
import { StaffAccountModal } from '@/components/staff/StaffAccountModal';
import styles from '@/components/staff/staff-accounts.styles';
import { SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useDeactivateBranch, useUpdateBranch } from '@/hooks/useBranches';
import { useStaff } from '@/hooks/useStaff';
import { useStaffAccounts } from '@/hooks/useStaffAccounts';
import { useTheme } from '@/hooks/useTheme';

type TabType = 'accounts' | 'branches';

export default function StaffAccountsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const {
    accounts,
    branches,
    isLoading,
    hasError,
    createAccountMutation,
    createBranchMutation,
    copyToClipboard,
    retryAll,
  } = useStaffAccounts({
    onAccountCreated: () => {
      setShowAccountModal(false);
      setNewAccountName('');
      setSelectedStaffId(null);
      setSelectedBranchId(null);
    },
    onBranchCreated: () => {
      setShowBranchModal(false);
      setNewBranchName('');
      setNewBranchCity('');
    },
  });
  const updateBranchMutation = useUpdateBranch();
  const deactivateBranchMutation = useDeactivateBranch();
  const activeBranches = (branches ?? []).filter((branch) => branch.active);

  const {
    data: staffMembers,
    isLoading: staffLoading,
    isError: staffError,
  } = useStaff();

  const closeBranchModal = () => {
    setShowBranchModal(false);
    setEditingBranchId(null);
    setNewBranchName('');
    setNewBranchCity('');
  };

  const openCreateBranchModal = () => {
    setEditingBranchId(null);
    setNewBranchName('');
    setNewBranchCity('');
    setShowBranchModal(true);
  };

  const openEditBranchModal = (branchId: string) => {
    const branch = activeBranches.find((item) => item.id === branchId);
    if (!branch) return;

    setEditingBranchId(branch.id);
    setNewBranchName(branch.name);
    setNewBranchCity(branch.city ?? '');
    setShowBranchModal(true);
  };

  const handleBranchSubmit = () => {
    const normalizedName = newBranchName.trim();
    const normalizedCity = newBranchCity.trim() || undefined;

    if (!normalizedName) {
      Alert.alert('Branch name required', 'Enter a branch name to continue.');
      return;
    }

    if (editingBranchId) {
      updateBranchMutation.mutate(
        {
          branchId: editingBranchId,
          input: {
            name: normalizedName,
            city: normalizedCity,
          },
        },
        {
          onError: () => {
            Alert.alert('Update failed', 'Could not update this branch.');
          },
          onSuccess: closeBranchModal,
        }
      );
      return;
    }

    createBranchMutation.mutate(
      {
        name: normalizedName,
        city: normalizedCity,
      }
    );
  };

  const handleDeactivateBranch = (branchId: string) => {
    if (activeBranches.length <= 1) {
      Alert.alert('Branch required', 'At least one active branch is required.');
      return;
    }

    Alert.alert(
      'Deactivate branch',
      'This branch will be hidden from branch selectors.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => {
            deactivateBranchMutation.mutate(branchId, {
              onError: () => {
                Alert.alert('Deactivate failed', 'Could not deactivate this branch.');
              },
            });
          },
        },
      ]
    );
  };

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
              styles.retryButton,
              { backgroundColor: colors.primary, marginTop: SPACING.lg },
            ]}
            onPress={retryAll}
            accessibilityRole="button"
            accessibilityLabel="Retry loading data"
          >
            <Text
              style={{
                color: colors.textOnPrimary,
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
      <Stack.Screen options={{ title: 'Payment Accounts' }} />
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={['bottom']}
      >
        <SystemBars style={isDark ? 'light' : 'dark'} />

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card }]}>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'accounts' && { backgroundColor: colors.primary },
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
                { color: activeTab === 'accounts' ? '#FFF' : colors.textMuted },
              ]}
            >
              Staff Accounts
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.tab,
              activeTab === 'branches' && { backgroundColor: colors.primary },
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
                { color: activeTab === 'branches' ? '#FFF' : colors.textMuted },
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
            (accounts?.length || 0) === 0 ? (
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
                <StaffAccountCard
                  key={account.id}
                  account={account}
                  colors={colors}
                  shadows={shadows}
                  onCopyAccountNumber={copyToClipboard}
                />
              ))
            )
          ) : activeBranches.length === 0 ? (
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
            activeBranches.map((branch) => (
              <BranchCard
                key={branch.id}
                branch={branch}
                colors={colors}
                shadows={shadows}
                canDeactivate={activeBranches.length > 1}
                onDeactivate={handleDeactivateBranch}
                onEdit={openEditBranchModal}
              />
            ))
          )}

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

        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() =>
            activeTab === 'accounts'
              ? setShowAccountModal(true)
              : openCreateBranchModal()
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

        <StaffAccountModal
          visible={showAccountModal}
          colors={colors}
          accountName={newAccountName}
          onAccountNameChange={setNewAccountName}
          selectedBranchId={selectedBranchId}
          onBranchSelect={setSelectedBranchId}
          selectedStaffId={selectedStaffId}
          onStaffSelect={setSelectedStaffId}
          branches={branches}
          staffMembers={staffMembers}
          staffLoading={staffLoading}
          staffError={staffError}
          isPending={createAccountMutation.isPending}
          onSubmit={() =>
            createAccountMutation.mutate({
              name: newAccountName,
              staffId: selectedStaffId,
              branchId: selectedBranchId,
            })
          }
          onClose={() => setShowAccountModal(false)}
        />

        <BranchModal
          visible={showBranchModal}
          mode={editingBranchId ? 'edit' : 'create'}
          colors={colors}
          branchName={newBranchName}
          onBranchNameChange={setNewBranchName}
          branchCity={newBranchCity}
          onBranchCityChange={setNewBranchCity}
          isPending={
            editingBranchId
              ? updateBranchMutation.isPending
              : createBranchMutation.isPending
          }
          onSubmit={handleBranchSubmit}
          onClose={closeBranchModal}
        />
      </SafeAreaView>
    </>
  );
}
