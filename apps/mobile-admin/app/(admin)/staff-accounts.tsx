import Ionicons from "@react-native-vector-icons/ionicons/static";
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BranchesTabContent } from '@/components/staff/BranchesTabContent';
import { BranchModal } from '@/components/staff/BranchModal';
import { StaffAccountModal } from '@/components/staff/StaffAccountModal';
import { StaffAccountsStatusShell } from '@/components/staff/StaffAccountsStatusShell';
import { StaffAccountsTabContent } from '@/components/staff/StaffAccountsTabContent';
import styles from '@/components/staff/staff-accounts.styles';
import { useDeactivateBranch, useUpdateBranch } from '@/hooks/useBranches';
import { useBranchManagement } from '@/hooks/useBranchManagement';
import { useStaff } from '@/hooks/useStaff';
import { useStaffAccounts } from '@/hooks/useStaffAccounts';
import { useTheme } from '@/hooks/useTheme';

type TabType = 'accounts' | 'branches';

export default function StaffAccountsScreen() {
  const { colors, shadows, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('accounts');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
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
  });
  const updateBranchMutation = useUpdateBranch();
  const deactivateBranchMutation = useDeactivateBranch();
  const branchManagement = useBranchManagement({
    branches,
    createBranchMutation,
    updateBranchMutation,
    deactivateBranchMutation,
  });

  const {
    data: staffMembers,
    isLoading: staffLoading,
    isError: staffError,
  } = useStaff();

  if (isLoading) {
    return <StaffAccountsStatusShell status="loading" colors={colors} />;
  }

  if (hasError) {
    return (
      <StaffAccountsStatusShell
        status="error"
        colors={colors}
        onRetry={retryAll}
      />
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
              color={
                activeTab === 'accounts'
                  ? colors.textOnPrimary
                  : colors.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === 'accounts'
                      ? colors.textOnPrimary
                      : colors.textMuted,
                },
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
              color={
                activeTab === 'branches'
                  ? colors.textOnPrimary
                  : colors.textMuted
              }
            />
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === 'branches'
                      ? colors.textOnPrimary
                      : colors.textMuted,
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
            <StaffAccountsTabContent
              accounts={accounts}
              colors={colors}
              shadows={shadows}
              onCopyAccountNumber={copyToClipboard}
            />
          ) : (
            <BranchesTabContent
              activeBranches={branchManagement.activeBranches}
              colors={colors}
              shadows={shadows}
              onDeactivate={branchManagement.handleDeactivateBranch}
              onEdit={branchManagement.openEditBranchModal}
            />
          )}

          <View style={[styles.notice, { backgroundColor: colors.infoLight }]}>
            <Ionicons name="information-circle" size={20} color={colors.info} />
            <Text style={[styles.noticeText, { color: colors.info }]}>
              All payments reconcile to your main wallet automatically.
            </Text>
          </View>
        </ScrollView>

        <Pressable
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() =>
            activeTab === 'accounts'
              ? setShowAccountModal(true)
              : branchManagement.openCreateBranchModal()
          }
          accessibilityRole="button"
          accessibilityLabel={
            activeTab === 'accounts'
              ? 'Create staff account'
              : 'Create new branch'
          }
        >
          <Ionicons name="add" size={28} color={colors.textOnPrimary} />
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
          branches={branchManagement.activeBranches}
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
          visible={branchManagement.showBranchModal}
          mode={branchManagement.editingBranchId ? 'edit' : 'create'}
          colors={colors}
          branchName={branchManagement.newBranchName}
          onBranchNameChange={branchManagement.setNewBranchName}
          branchCity={branchManagement.newBranchCity}
          onBranchCityChange={branchManagement.setNewBranchCity}
          isPending={branchManagement.isBranchMutationPending}
          onSubmit={branchManagement.handleBranchSubmit}
          onClose={branchManagement.closeBranchModal}
        />
      </SafeAreaView>
    </>
  );
}
