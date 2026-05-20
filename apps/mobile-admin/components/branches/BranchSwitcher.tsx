import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useBranches } from '@/hooks/useBranches';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useTheme } from '@/hooks/useTheme';
import type { Branch } from '@/schemas/branch';
import { BranchCreateModal } from './BranchCreateModal';
import { BranchEditModal } from './BranchEditModal';
import { BranchPill } from './BranchPill';
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
  const shouldShowBranchFilters = branchManagement.activeBranches.length > 1;
  const handleAllLocationsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllLocations();
  };
  const handleBranchPress = (branch: Branch) => {
    if (!branch.active) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBranchId(branch.id);
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {shouldShowBranchFilters && (
            <>
              <BranchPill
                icon="business"
                label="All locations"
                selected={isAllLocations}
                colors={colors}
                shadowStyle={shadows.sm}
                onPress={handleAllLocationsPress}
                accessibilityLabel="Show all branch locations"
                accessibilityHint="Double tap to show all branch locations"
              />
              {branchManagement.activeBranches.map((branch) => {
                const isActive = branch.id === branchId;
                return (
                  <View key={branch.id} style={styles.branchItem}>
                    <BranchPill
                      icon="location"
                      label={branch.name}
                      selected={isActive}
                      colors={colors}
                      shadowStyle={shadows.sm}
                      onPress={() => handleBranchPress(branch)}
                      accessibilityLabel={`Switch to ${branch.name} branch`}
                      accessibilityHint="Double tap to set as active branch"
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.manageButton,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                        shadows.sm,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() =>
                        branchManagement.handleManageBranchPress(branch)
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Manage ${branch.name} branch`}
                      accessibilityHint="Double tap to edit or deactivate this branch"
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={16}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  </View>
                );
              })}
            </>
          )}
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
        </ScrollView>
      )}
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
