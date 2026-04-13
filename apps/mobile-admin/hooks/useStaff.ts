/**
 * useStaff Hook
 * Fetches and manages staff members for the merchant
 * Following the useCustomers pattern with React Query
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/lib/supabase';
import type { StaffMember, StaffRole, StaffStatus } from '@/lib/types/staff';
import { useMerchant } from './useMerchant';

// ============================================================
// Fetch Staff Members
// ============================================================

async function fetchStaffMembers(merchantId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_members')
    .select(
      'id, merchant_id, user_id, email, name, role, status, created_at, invited_at, accepted_at'
    )
    .eq('merchant_id', merchantId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export function useStaff() {
  const { merchant } = useMerchant();
  const merchantId = merchant?.id;

  return useQuery({
    queryKey: ['staff', merchantId],
    queryFn: () => {
      if (!merchantId) {
        throw new Error('Merchant not found');
      }
      return fetchStaffMembers(merchantId);
    },
    enabled: !!merchantId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// ============================================================
// Staff Stats
// ============================================================

export function useStaffStats() {
  const { data: staff, isLoading } = useStaff();

  const stats = {
    total: staff?.length ?? 0,
    active: staff?.filter((s) => s.status === 'active').length ?? 0,
    pending: staff?.filter((s) => s.status === 'pending').length ?? 0,
    suspended: staff?.filter((s) => s.status === 'suspended').length ?? 0,
  };

  return { stats, isLoading };
}

// ============================================================
// Invite Staff Member
// ============================================================

interface InviteStaffParams {
  email: string;
  name?: string;
  role: StaffRole;
  autoCreateAccount?: boolean;
}

interface InviteStaffResponse {
  inviteUrl?: string;
  invitationToken?: string;
  message?: string;
  staff?: {
    id: string;
  };
}

interface ResendInvitationResponse {
  inviteUrl?: string;
  invitationToken?: string;
  message?: string;
  success: boolean;
}

export function useInviteStaff() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: InviteStaffParams) => {
      if (!merchant?.id) throw new Error('Merchant not found');

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const normalizedEmail = params.email.trim().toLowerCase();
      if (!emailRegex.test(normalizedEmail)) {
        throw new Error('Invalid email format');
      }
      const normalizedName = params.name?.trim() || undefined;

      const response = await apiClient<InviteStaffResponse>('/api/staff', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          name: normalizedName,
          role: params.role,
        }),
      });

      // Multi-terminal: Auto-create Staff Account if requested
      if (params.autoCreateAccount && response.staff?.id) {
        try {
          const accountName = normalizedName
            ? `${normalizedName}'s Account`
            : `${normalizedEmail.split('@')[0]}'s Account`;

          const apiUrl = (
            process.env.EXPO_PUBLIC_API_URL || 'https://usebaci.com'
          )
            .trim()
            .replace(/\/+$/, '');

          const {
            data: { session },
          } = await supabase.auth.getSession();

          const accountResponse = await fetch(
            `${apiUrl}/api/paystack/virtual-terminal`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token && {
                  Authorization: `Bearer ${session.access_token}`,
                }),
              },
              body: JSON.stringify({
                name: accountName,
                staffId: response.staff.id,
              }),
            }
          );

          if (!accountResponse.ok) {
            console.warn(
              '[InviteStaff] Failed to auto-create account number via API',
              {
                status: accountResponse.status,
                statusText: accountResponse.statusText,
              }
            );
          }
        } catch (err) {
          console.error('[InviteStaff] Error auto-creating account:', err);
        }
      }

      return {
        success: true,
        inviteUrl: response.inviteUrl,
        invitationToken: response.invitationToken,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

// ============================================================
// Update Staff Member
// ============================================================

interface UpdateStaffParams {
  id: string;
  role?: StaffRole;
  status?: StaffStatus;
}

export function useUpdateStaff() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateStaffParams) => {
      if (!merchant?.id) throw new Error('Merchant not found');

      const updateData: Partial<{ role: StaffRole; status: StaffStatus }> = {};
      if (params.role) updateData.role = params.role;
      if (params.status) updateData.status = params.status;

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      const { error } = await supabase
        .from('staff_members')
        .update(updateData)
        .eq('id', params.id)
        .eq('merchant_id', merchant.id);

      if (error) throw new Error('Failed to update staff member');
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

// ============================================================
// Resend Invitation
// ============================================================

export function useResendInvitation() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staffId: string) => {
      if (__DEV__) {
        console.log('[ResendInvite] Starting for staffId:', staffId);
      }
      if (!merchant?.id) throw new Error('Merchant not found');

      const response = await apiClient<ResendInvitationResponse>(
        `/api/staff/${staffId}`,
        {
          method: 'POST',
        }
      );

      return {
        success: true,
        inviteUrl: response.inviteUrl,
        invitationToken: response.invitationToken,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}

// ============================================================
// Remove Staff Member (Soft Delete)
// ============================================================

export function useRemoveStaff() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staffId: string) => {
      if (!merchant?.id) throw new Error('Merchant not found');

      const { error } = await supabase
        .from('staff_members')
        .update({ status: 'removed' })
        .eq('id', staffId)
        .eq('merchant_id', merchant.id);

      if (error) throw new Error('Failed to remove staff member');
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
  });
}
