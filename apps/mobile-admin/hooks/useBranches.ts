/**
 * useBranches Hook
 * Manages branch data fetching, active branch state, and branch creation
 * 2026 Best Practice: TanStack Query + MMKV persistence + Zod validation
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useMerchant } from '@/hooks/useMerchant';
import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// Zod schema for branch validation
export const BranchSchema = z.object({
    id: z.string().uuid(),
    merchant_id: z.string().uuid(),
    name: z.string().min(1, 'Branch name is required'),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    manager_id: z.string().uuid().nullable(),
    is_default: z.boolean(),
    active: z.boolean(),
    created_at: z.string(),
});

export type Branch = z.infer<typeof BranchSchema>;

export const CreateBranchSchema = z.object({
    name: z.string().min(1, 'Branch name is required').max(100),
    address: z.string().max(500).optional(),
    phone: z.string().max(20).optional(),
    is_default: z.boolean().optional(),
});

export type CreateBranchInput = z.infer<typeof CreateBranchSchema>;

const ACTIVE_BRANCH_KEY = 'active-branch-id';

/**
 * Get the persisted active branch ID from MMKV
 */
function getPersistedBranchId(): string | null {
    return storage.getString(ACTIVE_BRANCH_KEY) ?? null;
}

/**
 * Persist the active branch ID to MMKV
 */
function persistBranchId(branchId: string | null): void {
    if (branchId) {
        storage.set(ACTIVE_BRANCH_KEY, branchId);
    } else {
        storage.remove(ACTIVE_BRANCH_KEY);
    }
}

/**
 * Fetch all branches for the current merchant
 */
async function fetchBranches(merchantId: string): Promise<Branch[]> {
    const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('active', true)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });

    if (error) {
        console.error('[Branches] Fetch error:', error);
        throw new Error(error.message);
    }

    // Validate with Zod
    const result = z.array(BranchSchema).safeParse(data);
    if (!result.success) {
        console.error('[Branches] Validation error:', result.error);
        return [];
    }

    return result.data;
}

/**
 * Create a new branch
 */
async function createBranch(
    merchantId: string,
    input: CreateBranchInput
): Promise<Branch> {
    // Validate input
    const validated = CreateBranchSchema.parse(input);

    const { data, error } = await supabase
        .from('branches')
        .insert({
            merchant_id: merchantId,
            name: validated.name,
            address: validated.address ?? null,
            phone: validated.phone ?? null,
            is_default: validated.is_default ?? false,
        })
        .select()
        .single();

    if (error) {
        console.error('[Branches] Create error:', error);
        throw new Error(error.message);
    }

    return BranchSchema.parse(data);
}

/**
 * Hook to list all branches for the current merchant
 */
export function useBranches() {
    const { merchant } = useMerchant();

    return useQuery({
        queryKey: ['branches', merchant?.id],
        queryFn: () => {
            if (!merchant?.id) throw new Error('No merchant');
            return fetchBranches(merchant.id);
        },
        enabled: !!merchant?.id,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}

/**
 * Hook to get/set the currently active branch
 * Persists selection to MMKV
 */
export function useActiveBranch() {
    const { data: branches = [] } = useBranches();
    const queryClient = useQueryClient();

    // Get persisted branch ID or default to first branch
    const persistedId = getPersistedBranchId();

    // Find active branch: persisted > default > first
    const activeBranch =
        branches.find((b) => b.id === persistedId) ??
        branches.find((b) => b.is_default) ??
        branches[0] ??
        null;

    const setActiveBranch = (branchId: string | null) => {
        persistBranchId(branchId);
        // Force re-render by invalidating a simple query
        queryClient.invalidateQueries({ queryKey: ['active-branch'] });
    };

    return {
        activeBranch,
        activeBranchId: activeBranch?.id ?? null,
        setActiveBranch,
        branches,
        hasBranches: branches.length > 0,
    };
}

/**
 * Hook to create a new branch
 */
export function useCreateBranch() {
    const { merchant } = useMerchant();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: CreateBranchInput) => {
            if (!merchant?.id) throw new Error('No merchant');
            return createBranch(merchant.id, input);
        },
        onSuccess: () => {
            // Invalidate branches query to refetch
            queryClient.invalidateQueries({ queryKey: ['branches'] });
        },
    });
}
