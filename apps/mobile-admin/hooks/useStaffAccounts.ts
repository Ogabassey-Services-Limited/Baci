/**
 * useStaffAccounts
 * Queries and mutations for staff payment accounts and branches
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { z } from 'zod';
import type { Branch, StaffAccount } from '@/components/staff/types';
import { useAuth } from '@/hooks/useAuth';
import { BASE_URL } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';

// 2026 Best Practice: Dynamic imports for native modules
let Clipboard: typeof import('expo-clipboard') | null = null;

const loadClipboardModule = async () => {
  if (Clipboard) return Clipboard;
  try {
    const cb = await import('expo-clipboard');
    Clipboard = cb;
    return Clipboard;
  } catch (_e) {
    console.debug('[StaffAccounts] Clipboard module ignored or failed to load');
    return null;
  }
};

interface UseStaffAccountsCallbacks {
  onAccountCreated: () => void;
  onBranchCreated: () => void;
}

export function useStaffAccounts(callbacks: UseStaffAccountsCallbacks) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: merchant } = useQuery({
    queryKey: ['merchant', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('merchants')
        .select('id, business_name')
        .eq('user_id', user.id)
        .single();
      if (error) throw new Error(`Merchant lookup failed: ${error.message}`);
      if (!data) throw new Error('Merchant lookup failed: merchant not found');
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: accounts,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useQuery({
    queryKey: ['staff-accounts', merchant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('virtual_terminals')
        .select(
          'id, code, name, account_number, account_name, bank, payment_link, active, branch_id, staff_id'
        )
        .eq('merchant_id', merchant?.id)
        .order('created_at', { ascending: false });
      if (error)
        throw new Error(`Failed to load staff accounts: ${error.message}`);
      return (data || []) as StaffAccount[];
    },
    enabled: !!merchant?.id,
  });

  const {
    data: branches,
    isLoading: branchesLoading,
    isError: branchesError,
  } = useQuery({
    queryKey: ['branches', merchant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name, address, city, is_default, active')
        .eq('merchant_id', merchant?.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw new Error(`Failed to load branches: ${error.message}`);
      return (data || []) as Branch[];
    },
    enabled: !!merchant?.id,
  });

  const createAccountMutation = useMutation({
    mutationFn: async ({
      name,
      staffId,
      branchId,
    }: {
      name: string;
      staffId?: string | null;
      branchId?: string | null;
    }) => {
      const schema = z.object({
        name: z.string().min(3, 'Account name must be at least 3 characters'),
      });
      const validation = schema.safeParse({ name });
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Authentication required to create a staff account');
      }

      const response = await fetch(
        `${BASE_URL}/api/paystack/virtual-terminal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name,
            staffId: staffId || undefined,
            branchId: branchId || undefined,
            destinations: [],
          }),
        }
      );
      if (!response.ok) {
        let errorMessage = 'Failed to create account';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          // Response wasn't JSON, use default message
        }
        throw new Error(errorMessage);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-accounts'] });
      callbacks.onAccountCreated();
      Alert.alert('Success', 'Staff account created successfully!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async ({ name, city }: { name: string; city: string }) => {
      const schema = z.object({
        name: z.string().min(3, 'Branch name must be at least 3 characters'),
        city: z.string().optional(),
      });
      const validation = schema.safeParse({ name, city });
      if (!validation.success) {
        throw new Error(validation.error.issues[0].message);
      }

      if (!merchant?.id) {
        throw new Error('Merchant not found');
      }

      const { data, error } = await supabase
        .from('branches')
        .insert({ merchant_id: merchant.id, name, city: city || null })
        .select('id, name, city, address, is_default, active')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      callbacks.onBranchCreated();
      Alert.alert('Success', 'Branch created successfully!');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const copyToClipboard = async (text: string) => {
    try {
      const clipboard = await loadClipboardModule();
      if (!clipboard?.setStringAsync) {
        throw new Error('Clipboard is not available');
      }
      await clipboard.setStringAsync(text);
      Alert.alert('Copied!', 'Account number copied to clipboard.');
    } catch (_error) {
      Alert.alert('Error', 'Failed to copy to clipboard');
    }
  };

  const retryAll = () => {
    queryClient.invalidateQueries({ queryKey: ['staff-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['branches'] });
  };

  return {
    accounts,
    branches,
    isLoading: accountsLoading || branchesLoading,
    hasError: accountsError || branchesError,
    createAccountMutation,
    createBranchMutation,
    copyToClipboard,
    retryAll,
  };
}
