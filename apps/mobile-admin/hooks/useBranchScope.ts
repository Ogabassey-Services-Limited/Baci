import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
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

export function useBranchScope() {
  const { merchant } = useMerchant();
  const { user } = useAuth();
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
    if (!merchantId || !userId) {
      return;
    }

    const parsed = BranchScopeSchema.safeParse(nextScope);
    if (!parsed.success) {
      console.error('[BranchScope] Invalid branch scope:', parsed.error);
      return;
    }

    persistBranchScope(merchantId, userId, parsed.data);
    queryClient.setQueryData(queryKey, parsed.data);
  };

  const setBranchId = (branchId: string) => {
    setBranchScope({ type: 'branch', branchId });
  };

  const setAllLocations = () => {
    setBranchScope(ALL_BRANCH_SCOPE);
  };

  return {
    scope,
    branchId: scope.type === 'branch' ? scope.branchId : null,
    isAllLocations: scope.type === 'all',
    setBranchScope,
    setBranchId,
    setAllLocations,
  };
}
