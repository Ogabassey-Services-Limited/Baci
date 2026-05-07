import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Branch } from '@/components/staff/types';
import { useBranchManagement } from '@/hooks/useBranchManagement';

const alertMock = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({
  Alert: {
    alert: alertMock,
  },
}));

const branches: Branch[] = [
  {
    id: 'branch-1',
    name: 'Lagos main',
    address: null,
    city: 'Lagos',
    is_default: true,
    active: true,
  },
  {
    id: 'branch-2',
    name: 'Abuja',
    address: null,
    city: 'Abuja',
    is_default: false,
    active: true,
  },
];

function renderBranchManagement({
  createPending = false,
  deactivatePending = false,
  updatePending = false,
  branchRows = branches,
} = {}) {
  const createMutate = vi.fn();
  const updateMutate = vi.fn();
  const deactivateMutate = vi.fn();

  const result = renderHook(() =>
    useBranchManagement({
      branches: branchRows,
      createBranchMutation: {
        isPending: createPending,
        mutate: createMutate,
      },
      updateBranchMutation: {
        isPending: updatePending,
        mutate: updateMutate,
      },
      deactivateBranchMutation: {
        isPending: deactivatePending,
        mutate: deactivateMutate,
      },
    })
  );

  return {
    ...result,
    createMutate,
    deactivateMutate,
    updateMutate,
  };
}

describe('useBranchManagement', () => {
  beforeEach(() => {
    alertMock.mockReset();
  });

  it('does not submit duplicate create mutations while create is pending', () => {
    const { createMutate, result } = renderBranchManagement({
      createPending: true,
    });

    act(() => {
      result.current.setNewBranchName('Lekki');
    });
    act(() => {
      result.current.handleBranchSubmit();
    });

    expect(createMutate).not.toHaveBeenCalled();
    expect(result.current.isBranchMutationPending).toBe(true);
  });

  it('does not submit duplicate update mutations while update is pending', () => {
    const { result, updateMutate } = renderBranchManagement({
      updatePending: true,
    });

    act(() => {
      result.current.openEditBranchModal('branch-1');
    });
    act(() => {
      result.current.handleBranchSubmit();
    });

    expect(updateMutate).not.toHaveBeenCalled();
    expect(result.current.isBranchMutationPending).toBe(true);
  });

  it('guards deactivation inside the confirmation action', () => {
    const { deactivateMutate, result } = renderBranchManagement({
      branchRows: [branches[0]],
    });

    act(() => {
      result.current.handleDeactivateBranch('branch-1');
    });

    expect(alertMock).toHaveBeenCalledTimes(1);
    const actions = alertMock.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const deactivateAction = actions.find(
      (action) => action.text === 'Deactivate'
    );
    expect(deactivateAction).toBeDefined();
    act(() => {
      deactivateAction?.onPress?.();
    });

    expect(deactivateMutate).not.toHaveBeenCalled();
    expect(alertMock).toHaveBeenCalledTimes(2);
    expect(alertMock).toHaveBeenCalledWith(
      'Branch required',
      'At least one active branch is required.'
    );
  });

  it('does not submit duplicate deactivate mutations while deactivate is pending', () => {
    const { deactivateMutate, result } = renderBranchManagement({
      deactivatePending: true,
    });

    act(() => {
      result.current.handleDeactivateBranch('branch-1');
    });

    expect(alertMock).toHaveBeenCalledTimes(1);
    const actions = alertMock.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const deactivateAction = actions.find(
      (action) => action.text === 'Deactivate'
    );
    expect(deactivateAction).toBeDefined();
    act(() => {
      deactivateAction?.onPress?.();
    });

    expect(deactivateMutate).not.toHaveBeenCalled();
  });
});
