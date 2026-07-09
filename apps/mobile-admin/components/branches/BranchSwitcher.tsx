import Ionicons from '@react-native-vector-icons/ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useBranches } from '@/hooks/useBranches';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useTheme } from '@/hooks/useTheme';
import type { Branch } from '@/schemas/branch';
import { BranchCreateModal } from './BranchCreateModal';
import { BranchEditModal } from './BranchEditModal';
import { BranchSelectorSheet } from './BranchSelectorSheet';
import { styles } from './BranchSwitcher.styles';
import { useBranchSwitcherManagement } from './useBranchSwitcherManagement';

export function BranchSwitcher() {
  const { colors, shadows } = useTheme();
  const {
    data: branches = [],
    error: branchesError,
    isLoading: branchesLoading,
  } = useBranches();
  const { branchId, isAllLocations, setAllLocations, setBranchId } =
    useBranchScope();
  const branchManagement = useBranchSwitcherManagement({
    branchId,
    branches,
    setAllLocations,
  });
  const [isSheetVisible, setIsSheetVisible] = useState(false);

  const { activeBranches } = branchManagement;
  const hasMultipleBranches = activeBranches.length > 1;

  useEffect(() => {
    if (
      !branchesLoading &&
      !isAllLocations &&
      branchId &&
      !activeBranches.some((branch) => branch.id === branchId)
    ) {
      setAllLocations();
    }
  }, [
    activeBranches,
    branchId,
    branchesLoading,
    isAllLocations,
    setAllLocations,
  ]);

  const currentLabel = isAllLocations
    ? 'All locations'
    : (activeBranches.find((branch) => branch.id === branchId)?.name ??
      'All locations');

  const handleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllLocations();
    setIsSheetVisible(false);
  };

  const handleSelectBranch = (branch: Branch) => {
    if (!branch.active) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBranchId(branch.id);
    setIsSheetVisible(false);
  };

  const handleManageBranch = (branch: Branch) => {
    setIsSheetVisible(false);
    branchManagement.handleManageBranchPress(branch);
  };

  const handleAddBranch = () => {
    setIsSheetVisible(false);
    branchManagement.handleCreatePress();
  };

  return (
    <View style={styles.container}>
      {branchesLoading ? (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : branchesError ? (
        <View style={styles.statusContainer}>
          <Text style={[styles.statusText, { color: colors.notification }]}>
            Could not load branches
          </Text>
        </View>
      ) : (
        <View style={styles.triggerRow}>
          {hasMultipleBranches ? (
            <Pressable
              accessibilityLabel={`Location: ${currentLabel}`}
              accessibilityRole="button"
              accessibilityHint="Opens the location picker"
              onPress={() => setIsSheetVisible(true)}
              style={({ pressed }) => [
                styles.trigger,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons
                name={isAllLocations ? 'business' : 'location'}
                size={14}
                color={colors.primary}
              />
              <Text
                numberOfLines={1}
                style={[styles.triggerLabel, { color: colors.text }]}
              >
                {currentLabel}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.textSecondary}
              />
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.card, borderColor: colors.border },
                shadows.sm,
                pressed && { opacity: 0.7 },
              ]}
              onPress={branchManagement.handleCreatePress}
              accessibilityRole="button"
              accessibilityLabel="Add new branch"
            >
              <Ionicons name="add" size={18} color={colors.primary} />
              <Text style={[styles.addButtonText, { color: colors.primary }]}>
                Add
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <BranchSelectorSheet
        branchId={branchId}
        branches={activeBranches}
        isAllLocations={isAllLocations}
        onAddBranch={handleAddBranch}
        onClose={() => setIsSheetVisible(false)}
        onManageBranch={handleManageBranch}
        onSelectAll={handleSelectAll}
        onSelectBranch={handleSelectBranch}
        visible={isSheetVisible}
      />

      <BranchCreateModal
        visible={branchManagement.isModalVisible}
        onClose={branchManagement.handleCloseModal}
        branchName={branchManagement.branchName}
        setBranchName={branchManagement.setBranchName}
        branchAddress={branchManagement.branchAddress}
        setBranchAddress={branchManagement.setBranchAddress}
        nameError={branchManagement.nameError}
        setNameError={branchManagement.setNameError}
        onSubmit={branchManagement.handleCreateBranch}
        isLoading={branchManagement.isCreateBranchLoading}
        colors={colors}
      />

      <BranchEditModal
        visible={branchManagement.editingBranch !== null}
        onClose={branchManagement.handleCloseEditModal}
        branchName={branchManagement.editName}
        setBranchName={branchManagement.setEditName}
        branchAddress={branchManagement.editAddress}
        setBranchAddress={branchManagement.setEditAddress}
        nameError={branchManagement.editNameError}
        setNameError={branchManagement.setEditNameError}
        onSubmit={branchManagement.handleUpdateBranch}
        onDeactivate={branchManagement.handleDeactivateBranch}
        isUpdating={branchManagement.isUpdating}
        isDeactivating={branchManagement.isDeactivating}
        canDeactivate={branchManagement.canDeactivateEditingBranch}
        colors={colors}
      />
    </View>
  );
}
