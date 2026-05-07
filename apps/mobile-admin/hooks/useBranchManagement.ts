import { useState } from 'react';
import { Alert } from 'react-native';
import type { Branch } from '@/components/staff/types';
import type { UpdateBranchInput } from '@/schemas/branch';

interface MutationCallbacks {
  onError?: () => void;
  onSuccess?: () => void;
}

interface CreateBranchMutation {
  isPending: boolean;
  mutate: (
    input: { name: string; city?: string },
    callbacks?: MutationCallbacks
  ) => void;
}

interface UpdateBranchMutation {
  isPending: boolean;
  mutate: (
    input: { branchId: string; input: UpdateBranchInput },
    callbacks?: MutationCallbacks
  ) => void;
}

interface DeactivateBranchMutation {
  isPending: boolean;
  mutate: (branchId: string, callbacks?: MutationCallbacks) => void;
}

interface UseBranchManagementOptions {
  branches?: Branch[];
  createBranchMutation: CreateBranchMutation;
  updateBranchMutation: UpdateBranchMutation;
  deactivateBranchMutation: DeactivateBranchMutation;
}

export function useBranchManagement({
  branches,
  createBranchMutation,
  updateBranchMutation,
  deactivateBranchMutation,
}: UseBranchManagementOptions) {
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCity, setNewBranchCity] = useState('');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const activeBranches = (branches ?? []).filter((branch) => branch.active);
  const isBranchMutationPending = editingBranchId
    ? updateBranchMutation.isPending
    : createBranchMutation.isPending;

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
      if (updateBranchMutation.isPending) return;

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

    if (createBranchMutation.isPending) return;

    createBranchMutation.mutate(
      {
        name: normalizedName,
        city: normalizedCity,
      },
      {
        onError: () => {
          Alert.alert('Create failed', 'Could not create this branch.');
        },
        onSuccess: closeBranchModal,
      }
    );
  };

  const handleDeactivateBranch = (branchId: string) => {
    Alert.alert(
      'Deactivate branch',
      'This branch will be hidden from branch selectors.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: () => {
            if (deactivateBranchMutation.isPending) return;
            if (activeBranches.length <= 1) {
              Alert.alert(
                'Branch required',
                'At least one active branch is required.'
              );
              return;
            }

            deactivateBranchMutation.mutate(branchId, {
              onError: () => {
                Alert.alert(
                  'Deactivate failed',
                  'Could not deactivate this branch.'
                );
              },
            });
          },
        },
      ]
    );
  };

  return {
    activeBranches,
    closeBranchModal,
    editingBranchId,
    handleBranchSubmit,
    handleDeactivateBranch,
    isBranchMutationPending,
    newBranchCity,
    newBranchName,
    openCreateBranchModal,
    openEditBranchModal,
    setNewBranchCity,
    setNewBranchName,
    showBranchModal,
  };
}
