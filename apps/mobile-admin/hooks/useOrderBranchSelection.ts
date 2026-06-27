import { type Dispatch, type SetStateAction, useEffect } from 'react';
import type { Branch, BranchScope } from '@/schemas/branch';

interface UseOrderBranchSelectionArgs {
  branches: Branch[];
  enabled?: boolean;
  scope: BranchScope;
  setSelectedBranchId: Dispatch<SetStateAction<string | null>>;
}

export function useOrderBranchSelection({
  branches,
  enabled = true,
  scope,
  setSelectedBranchId,
}: UseOrderBranchSelectionArgs) {
  const defaultBranchId =
    scope.type === 'branch'
      ? scope.branchId
      : (branches.find((branch) => branch.is_default)?.id ??
        branches[0]?.id ??
        null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    setSelectedBranchId((currentBranchId) => {
      if (scope.type === 'branch') {
        return currentBranchId === scope.branchId
          ? currentBranchId
          : scope.branchId;
      }

      if (!currentBranchId) {
        return defaultBranchId;
      }

      return branches.some((branch) => branch.id === currentBranchId)
        ? currentBranchId
        : defaultBranchId;
    });
  }, [branches, defaultBranchId, enabled, scope, setSelectedBranchId]);

  return { defaultBranchId };
}
