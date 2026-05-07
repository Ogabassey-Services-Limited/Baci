import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useBranches, useCreateBranch, useDeactivateBranch, useUpdateBranch } from '@/hooks/useBranches';
import { useBranchScope } from '@/hooks/useBranchScope';
import { useTheme } from '@/hooks/useTheme';
import { type Branch, type CreateBranchInput, CreateBranchSchema, type UpdateBranchInput, UpdateBranchSchema } from '@/schemas/branch';
import { BranchCreateModal } from './BranchCreateModal';
import { BranchEditModal } from './BranchEditModal';
import { BranchPill } from './BranchPill';
import { styles } from './BranchSwitcher.styles';

export function BranchSwitcher() {
  const { colors, shadows } = useTheme();
  const {
    data: branches = [],
    error: branchesError,
    isLoading: branchesLoading,
  } = useBranches();
  const { branchId, isAllLocations, setAllLocations, setBranchId } =
    useBranchScope();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deactivateBranch = useDeactivateBranch();
  const isSubmittingRef = useRef(false);
  const isEditingRef = useRef(false);
  const isDeactivatingRef = useRef(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const isCreateBranchLoading = createBranch.isPending || isSubmitting;
  const activeBranches = branches.filter((branch) => branch.active ?? true);
  const activeBranchCount = activeBranches.length;
  const canDeactivateEditingBranch = activeBranchCount > 1;
  const handleAllLocationsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAllLocations();
  };
  const handleBranchPress = (branch: Branch) => {
    if (!(branch.active ?? true)) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBranchId(branch.id);
  };
  const handleManageBranchPress = (branch: Branch) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingBranch(branch);
    setEditName(branch.name);
    setEditAddress(branch.address ?? '');
    setEditNameError('');
  };
  const handleCreatePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsModalVisible(true);
  };
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setBranchName('');
    setBranchAddress('');
    setNameError('');
  };
  const handleCloseEditModal = () => {
    setEditingBranch(null);
    setEditName('');
    setEditAddress('');
    setEditNameError('');
  };
  const handleCreateBranch = async () => {
    if (isSubmittingRef.current || createBranch.isPending) {
      return;
    }
    const input: CreateBranchInput = {
      name: branchName.trim(),
      address: branchAddress.trim() || undefined,
    };
    const result = CreateBranchSchema.safeParse(input);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      if (nameIssue) {
        setNameError(nameIssue.message);
      } else {
        Alert.alert(
          'Error',
          result.error.issues[0]?.message ?? 'Invalid input'
        );
      }
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      await createBranch.mutateAsync(result.data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleCloseModal();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create branch'
      );
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };
  const handleUpdateBranch = async () => {
    if (!editingBranch || isEditingRef.current || updateBranch.isPending) {
      return;
    }
    const input: UpdateBranchInput = {
      name: editName.trim(),
      address: editAddress.trim() || undefined,
    };
    const result = UpdateBranchSchema.safeParse(input);
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) => i.path[0] === 'name');
      if (nameIssue) {
        setEditNameError(nameIssue.message);
      } else {
        Alert.alert(
          'Error',
          result.error.issues[0]?.message ?? 'Invalid branch details'
        );
      }
      return;
    }
    isEditingRef.current = true;
    try {
      await updateBranch.mutateAsync({
        branchId: editingBranch.id,
        input: result.data,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleCloseEditModal();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to update branch'
      );
    } finally {
      isEditingRef.current = false;
    }
  };
  const handleDeactivateBranch = async () => {
    if (!editingBranch || isDeactivatingRef.current || deactivateBranch.isPending) {
      return;
    }
    if (!canDeactivateEditingBranch) {
      Alert.alert(
        'Required',
        'Create another branch before deactivating this one.'
      );
      return;
    }
    isDeactivatingRef.current = true;
    try {
      await deactivateBranch.mutateAsync(editingBranch.id);
      if (branchId === editingBranch.id) {
        setAllLocations();
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleCloseEditModal();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to deactivate branch'
      );
    } finally {
      isDeactivatingRef.current = false;
    }
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
          {activeBranches.map((branch) => {
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
                    { backgroundColor: colors.card, borderColor: colors.border },
                    shadows.sm,
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleManageBranchPress(branch)}
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
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.card, borderColor: colors.border },
              shadows.sm,
              pressed && { opacity: 0.7 },
            ]}
            onPress={handleCreatePress}
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
        visible={isModalVisible}
        onClose={handleCloseModal}
        branchName={branchName}
        setBranchName={setBranchName}
        branchAddress={branchAddress}
        setBranchAddress={setBranchAddress}
        nameError={nameError}
        setNameError={setNameError}
        onSubmit={handleCreateBranch}
        isLoading={isCreateBranchLoading}
        colors={colors}
      />

      <BranchEditModal
        visible={editingBranch !== null}
        onClose={handleCloseEditModal}
        branchName={editName}
        setBranchName={setEditName}
        branchAddress={editAddress}
        setBranchAddress={setEditAddress}
        nameError={editNameError}
        setNameError={setEditNameError}
        onSubmit={handleUpdateBranch}
        onDeactivate={handleDeactivateBranch}
        isUpdating={updateBranch.isPending}
        isDeactivating={deactivateBranch.isPending}
        canDeactivate={canDeactivateEditingBranch}
        colors={colors}
      />
    </View>
  );
}
