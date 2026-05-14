import {
  type QueryClient,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBranches } from '@/hooks/useBranches';
import { useMerchant } from '@/hooks/useMerchant';
import { storage } from '@/lib/storage';
import {
  ALL_BRANCH_SCOPE,
  BranchScopeSchema,
  type BranchScope,
  parsePersistedBranchScope,
  serializeBranchScope,
} from '@/schemas/branch';

export function getBranchScopeStorageKey(
  merchantId: string,
  userId: string
): string {
  return `branch-scope:${merchantId}:${userId}`;
}

function getStoredBranchScope(merchantId?: string, userId?: string): BranchScope {
  if (!merchantId || !userId) {
    return ALL_BRANCH_SCOPE;
  }

  return parsePersistedBranchScope(
    storage.getString(getBranchScopeStorageKey(merchantId, userId)) ?? null
  );
}

function persistBranchScope(
  merchantId: string | undefined,
  userId: string | undefined,
  scope: BranchScope
) {
  if (!merchantId || !userId) {
    return;
  }

  try {
    const key = getBranchScopeStorageKey(merchantId, userId);
    const serialized = serializeBranchScope(scope);

    if (serialized) {
      storage.set(key, serialized);
    } else {
      storage.remove(key);
    }
  } catch (error) {
    console.error('[BranchScope] Failed to persist branch scope:', error);
  }
}

function commitBranchScope(
  queryClient: QueryClient,
  merchantId: string | undefined,
  userId: string | undefined,
  nextScope: BranchScope
) {
  if (!merchantId || !userId) {
    return;
  }

  const parsed = BranchScopeSchema.safeParse(nextScope);
  if (!parsed.success) {
    console.error('[BranchScope] Invalid branch scope:', parsed.error);
    return;
  }

  persistBranchScope(merchantId, userId, parsed.data);
  queryClient.setQueryData(['branch-scope', merchantId, userId], parsed.data);
}

export function useBranchScope() {
  const { merchant } = useMerchant();
  const { user } = useAuth();
  const { data: branches, isSuccess: branchesLoaded } = useBranches();
  const queryClient = useQueryClient();
  const merchantId = merchant?.id;
  const userId = user?.id;
  const queryKey = ['branch-scope', merchantId, userId] as const;

  const { data: scope = ALL_BRANCH_SCOPE } = useQuery({
    queryKey,
    queryFn: () => getStoredBranchScope(merchantId, userId),
    enabled: Boolean(merchantId && userId),
    initialData: () => getStoredBranchScope(merchantId, userId),
    staleTime: Number.POSITIVE_INFINITY,
  });

  const setBranchScope = (nextScope: BranchScope) => {
    commitBranchScope(queryClient, merchantId, userId, nextScope);
  };

  const setBranchId = (branchId: string) => {
    setBranchScope({ type: 'branch', branchId });
  };

  const setAllLocations = () => {
    setBranchScope(ALL_BRANCH_SCOPE);
  };

  useEffect(() => {
    if (scope.type !== 'branch' || !branchesLoaded) {
      return;
    }

    const selectedBranchIsActive = (branches ?? []).some(
      (branch) => branch.id === scope.branchId && branch.active
    );

    if (!selectedBranchIsActive) {
      commitBranchScope(queryClient, merchantId, userId, ALL_BRANCH_SCOPE);
    }
  }, [branches, branchesLoaded, merchantId, queryClient, scope, userId]);

  return {
    scope,
    branchId: scope.type === 'branch' ? scope.branchId : null,
    isAllLocations: scope.type === 'all',
    setBranchScope,
    setBranchId,
    setAllLocations,
  };
}
