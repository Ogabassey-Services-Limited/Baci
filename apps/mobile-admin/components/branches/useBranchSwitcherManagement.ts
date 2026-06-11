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

interface GuardedMutationOptions {
  fallbackErrorMessage: string;
  guard: { current: boolean };
  run: () => Promise<void>;
  setGuardActive?: (active: boolean) => void;
}

// Module-scope helper so the try/finally stays out of the hook body
// (React Compiler cannot lower try/finally inside components/hooks yet).
async function runGuardedMutation({
  fallbackErrorMessage,
  guard,
  run,
  setGuardActive,
}: GuardedMutationOptions) {
  guard.current = true;
  setGuardActive?.(true);
  try {
    await run();
  } catch (error) {
    Alert.alert(
      'Error',
      error instanceof Error ? error.message : fallbackErrorMessage
    );
  } finally {
    guard.current = false;
    setGuardActive?.(false);
  }
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
  // State mirror of isSubmittingRef: render must not read ref.current.
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    await runGuardedMutation({
      fallbackErrorMessage: 'Failed to create branch',
      guard: isSubmittingRef,
      run: async () => {
        await createBranch.mutateAsync(result.data);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleCloseModal();
      },
      setGuardActive: setIsSubmitting,
    });
  };

  const handleUpdateBranch = async () => {
    if (!editingBranch || isEditingRef.current || updateBranch.isPending) {
      return;
    }
    // Updates send null for cleared fields so the API clears existing metadata.
    const input: UpdateBranchInput = {
      name: editName.trim(),
      address: editAddress.trim() || null,
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
    await runGuardedMutation({
      fallbackErrorMessage: 'Failed to update branch',
      guard: isEditingRef,
      run: async () => {
        await updateBranch.mutateAsync({
          branchId: editingBranch.id,
          input: result.data,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleCloseEditModal();
      },
    });
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
    await runGuardedMutation({
      fallbackErrorMessage: 'Failed to deactivate branch',
      guard: isDeactivatingRef,
      run: async () => {
        await deactivateBranch.mutateAsync(editingBranch.id);
        if (branchId === editingBranch.id) {
          setAllLocations();
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        handleCloseEditModal();
      },
    });
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
    isCreateBranchLoading: createBranch.isPending || isSubmitting,
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
