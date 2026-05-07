import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  useCreateBranch,
  useDeactivateBranch,
  useUpdateBranch,
} from '@/hooks/useBranches';
import {
  type Branch,
  type CreateBranchInput,
  CreateBranchSchema,
  type UpdateBranchInput,
  UpdateBranchSchema,
} from '@/schemas/branch';

interface UseBranchSwitcherManagementArgs {
  branchId: string | null;
  branches: Branch[];
  setAllLocations: () => void;
}

export function useBranchSwitcherManagement({
  branchId,
  branches,
  setAllLocations,
}: UseBranchSwitcherManagementArgs) {
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const deactivateBranch = useDeactivateBranch();
  const isSubmittingRef = useRef(false);
  const isEditingRef = useRef(false);
  const isDeactivatingRef = useRef(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [nameError, setNameError] = useState('');
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNameError, setEditNameError] = useState('');
  const activeBranches = branches.filter((branch) => branch.active);
  const canDeactivateEditingBranch = activeBranches.length > 1;

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
    if (
      !editingBranch ||
      isDeactivatingRef.current ||
      deactivateBranch.isPending
    ) {
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

  return {
    activeBranches,
    branchAddress,
    branchName,
    canDeactivateEditingBranch,
    editAddress,
    editingBranch,
    editName,
    editNameError,
    handleCloseEditModal,
    handleCloseModal,
    handleCreateBranch,
    handleCreatePress,
    handleDeactivateBranch,
    handleManageBranchPress,
    handleUpdateBranch,
    isCreateBranchLoading: createBranch.isPending || isSubmittingRef.current,
    isDeactivating: deactivateBranch.isPending,
    isModalVisible,
    isUpdating: updateBranch.isPending,
    nameError,
    setBranchAddress,
    setBranchName,
    setEditAddress,
    setEditName,
    setEditNameError,
    setNameError,
  };
}
