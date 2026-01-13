/**
 * useStaff Hook
 * Fetches and manages staff members for the merchant
 * Following the useCustomers pattern with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';
import type { StaffMember, StaffRole, StaffStatus } from '@/lib/types/staff';
import { generateUUID } from '@/utils/uuid';

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
    queryFn: () => fetchStaffMembers(merchantId!),
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
}

export function useInviteStaff() {
  const { merchant } = useMerchant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: InviteStaffParams) => {
      if (!merchant?.id) throw new Error('Merchant not found');

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(params.email)) {
        throw new Error('Invalid email format');
      }

      // Check for existing staff member
      const { data: existing } = await supabase
        .from('staff_members')
        .select('id, status')
        .eq('merchant_id', merchant.id)
        .eq('email', params.email.toLowerCase())
        .single();

      if (existing && existing.status !== 'removed') {
        throw new Error('This email is already on your team');
      }

      // Generate invitation token (simplified for mobile - web handles email sending)
      const invitationToken = generateUUID();

      if (existing?.status === 'removed') {
        // Reactivate removed staff member
        const { error } = await supabase
          .from('staff_members')
          .update({
            name: params.name,
            role: params.role,
            status: 'pending',
            invitation_token: invitationToken,
            // Expiry and invited_at handled by DB trigger
            accepted_at: null,
            user_id: null,
          })
          .eq('id', existing.id);

        if (error) throw new Error('Failed to invite staff member');
      } else {
        // Create new staff member
        const { error } = await supabase.from('staff_members').insert({
          merchant_id: merchant.id,
          email: params.email.toLowerCase(),
          name: params.name,
          role: params.role,
          invitation_token: invitationToken,
          // Expiry handled by DB trigger
        });

        if (error) {
          console.error(
            '[InviteStaff] Supabase insert failed:',
            error.message,
            error.details,
            error.hint
          );
          throw new Error(error.message || 'Failed to invite staff member');
        }
      }

      const inviteUrl = `https://usebaci.com/invite/${invitationToken}`;
      return { success: true, inviteUrl, invitationToken };
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
      console.log('[ResendInvite] Starting for staffId:', staffId);
      if (!merchant?.id) throw new Error('Merchant not found');

      // Verify staff member exists and is pending
      const { data: staff, error: fetchError } = await supabase
        .from('staff_members')
        .select('id, status, merchant_id')
        .eq('id', staffId)
        .single();

      console.log(
        '[ResendInvite] DB Lookup result:',
        staff,
        'Error:',
        fetchError
      );

      if (fetchError || !staff) {
        console.error(
          '[ResendInvite] Error: Staff not found or fetch error.',
          fetchError
        );
        throw new Error('Staff member not found');
      }

      if (staff.merchant_id !== merchant.id) {
        console.error(
          '[ResendInvite] Merchant ID mismatch. Staff Merchant:',
          staff.merchant_id,
          'My Merchant:',
          merchant.id
        );
        throw new Error('Staff member not associated with this merchant');
      }

      if (staff.status !== 'pending') {
        console.warn(
          '[ResendInvite] Status is not pending. Status:',
          staff.status
        );
        throw new Error('Can only resend invitation to pending members');
      }

      // Generate new invitation token
      const invitationToken = generateUUID();

      const { error } = await supabase
        .from('staff_members')
        .update({
          invitation_token: invitationToken,
          // Expiry and invited_at handled by DB trigger
        })
        .eq('id', staffId);

      if (error) throw new Error('Failed to resend invitation');
      const inviteUrl = `https://usebaci.com/invite/${invitationToken}`;
      return { success: true, inviteUrl, invitationToken };
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
