'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getAppUrl } from '@/env';
import { ensurePermission } from '@/lib/merchant-server';
import { buildStaffInviteEmail } from '@/lib/staff-invite-email';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/zeptomail';
import type { StaffRole } from '@/types/staff';
import { type InviteStaffData, InviteStaffSchema } from './schema';

// Valid staff statuses
type StaffStatus = 'pending' | 'active' | 'suspended' | 'removed';

const VALID_STATUSES: StaffStatus[] = [
  'pending',
  'active',
  'suspended',
  'removed',
];

// Valid staff roles for runtime validation
const VALID_ROLES: StaffRole[] = [
  'admin',
  'manager',
  'sales_rep',
  'inventory',
  'accountant',
  'customer_service',
  'marketing',
  'fulfillment',
];

// InviteStaffSchema imported from ./schema.ts

// Helper to escape HTML for emails
function escapeHtmlForEmail(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function getStaffMembers() {
  // Check permission: 'staff.view'
  const { merchant } = await ensurePermission('staff', 'view');
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Get staff members
  const { data: staff, error: staffError } = await supabase
    .from('staff_members')
    .select(
      'id, email, name, role, status, created_at, invited_at, accepted_at'
    )
    .eq('merchant_id', merchant.id)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  if (staffError) {
    console.error('Failed to fetch staff:', staffError);
    throw new Error('Failed to fetch staff');
  }

  return staff || [];
}

export async function inviteStaffMember(rawData: InviteStaffData) {
  // Check permission: 'staff.invite'
  const { merchant } = await ensurePermission('staff', 'invite');

  const validated = InviteStaffSchema.safeParse(rawData);
  if (!validated.success) {
    throw new Error(validated.error.issues[0].message);
  }

  const data = validated.data;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { email, name, role, autoCreateAccount } = data;

  if (!email || !role) {
    throw new Error('Email and role are required');
  }

  // Validate role at runtime
  if (!VALID_ROLES.includes(role)) {
    throw new Error('Invalid role value');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Check if staff member already exists
  const { data: existing } = await supabase
    .from('staff_members')
    .select('id, status')
    .eq('merchant_id', merchant.id)
    .eq('email', email.toLowerCase())
    .single();

  if (existing) {
    if (existing.status === 'removed') {
      // Reactivate removed staff member
      const invitationToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { error: reactivateError } = await supabase
        .from('staff_members')
        .update({
          // Only update name if explicitly provided, preserving existing name otherwise
          ...(name !== undefined && { name }),
          role,
          status: 'pending',
          invitation_token: invitationToken,
          invitation_expires_at: expiresAt.toISOString(),
          invited_at: new Date().toISOString(),
          accepted_at: null,
          user_id: null,
        })
        .eq('id', existing.id);

      if (reactivateError) {
        throw new Error('Failed to reactivate staff member');
      }

      await sendInviteEmail(
        email,
        name || '',
        role,
        merchant.business_name,
        invitationToken
      );

      revalidatePath('/dashboard/staff');
      return { success: true, message: 'Staff member re-invited successfully' };
    }

    throw new Error(
      'Unable to invite staff member. Please check the email address and try again.'
    );
  }

  // Generate invitation token
  const invitationToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

  // Create staff member
  const { error: createError } = await supabase.from('staff_members').insert({
    merchant_id: merchant.id,
    email: email.toLowerCase(),
    name,
    role,
    invitation_token: invitationToken,
    invitation_expires_at: expiresAt.toISOString(),
  });

  if (createError) {
    throw new Error('Failed to invite staff member');
  }

  await sendInviteEmail(
    email,
    name || '',
    role,
    merchant.business_name,
    invitationToken
  );

  revalidatePath('/dashboard/staff');

  // Multi-terminal: Auto-create Staff Account if requested
  if (autoCreateAccount) {
    try {
      // Get the newly created staff member ID
      const { data: newStaff } = await supabase
        .from('staff_members')
        .select('id')
        .eq('merchant_id', merchant.id)
        .eq('email', email.toLowerCase())
        .single();

      if (newStaff) {
        const { createVirtualTerminal } = await import('@/lib/paystack');

        const accountName = name
          ? `${name}'s Account`
          : `${email.split('@')[0]}'s Account`;

        const vtResult = await createVirtualTerminal(accountName, []);

        if (vtResult.success) {
          const nubanMethod = vtResult.data.paymentMethods?.find(
            (m) => m.type === 'dedicated_nuban'
          );

          await supabase.from('virtual_terminals').insert({
            merchant_id: merchant.id,
            staff_id: newStaff.id,
            code: vtResult.data.code,
            name: accountName,
            account_number: nubanMethod?.account_number || null,
            account_name: nubanMethod?.account_name || null,
            bank: nubanMethod?.bank || null,
            payment_link: `https://paystack.com/vt/${vtResult.data.code}`,
            active: true,
          });

          // Also update legacy column for backwards compatibility if needed
          await supabase
            .from('merchants')
            .update({ virtual_terminal_code: vtResult.data.code })
            .eq('id', merchant.id)
            .is('virtual_terminal_code', null);
        }
      }
    } catch (err) {
      console.error('Failed to auto-create staff account:', err);
      // Don't fail the whole invitation if account creation fails
    }
  }

  return { success: true, message: 'Staff member invited successfully' };
}

export async function resendInvitation(id: string) {
  // Check permission: 'staff.invite' (using invite permission for resend)
  const { merchant } = await ensurePermission('staff', 'invite');

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Get staff member - only select fields needed for resending invitation
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, email, name, role, status')
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .single();

  if (!staff) {
    throw new Error('Staff member not found');
  }

  if (staff.status !== 'pending') {
    throw new Error('Can only resend invitation to pending staff members');
  }

  // Generate new invitation token
  const invitationToken = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Update staff member
  const { error: updateError } = await supabase
    .from('staff_members')
    .update({
      invitation_token: invitationToken,
      invitation_expires_at: expiresAt.toISOString(),
      invited_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    throw new Error('Failed to resend invitation');
  }

  await sendInviteEmail(
    staff.email,
    staff.name || '',
    staff.role,
    merchant.business_name,
    invitationToken
  );

  revalidatePath('/dashboard/staff');
  return { success: true };
}

export async function updateStaffMember(
  id: string,
  data: { role?: StaffRole; status?: StaffStatus }
) {
  // Check permission: 'staff.edit'
  const { merchant } = await ensurePermission('staff', 'edit');

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Validate status if provided
  if (data.status && !VALID_STATUSES.includes(data.status)) {
    throw new Error('Invalid status value');
  }

  // Validate role if provided
  if (data.role && !VALID_ROLES.includes(data.role)) {
    throw new Error('Invalid role value');
  }

  // Explicitly construct update object with only allowed fields
  const updateData: { role?: StaffRole; status?: StaffStatus } = {};
  if (data.role) updateData.role = data.role;
  if (data.status) updateData.status = data.status;

  if (Object.keys(updateData).length === 0) {
    throw new Error('No valid fields to update');
  }

  const { data: updated, error } = await supabase
    .from('staff_members')
    .update(updateData)
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Staff member not found');
    }
    throw new Error('Failed to update staff member');
  }

  if (!updated) {
    throw new Error('Staff member not found');
  }

  revalidatePath('/dashboard/staff');
  return { success: true };
}

export async function removeStaffMember(id: string) {
  // Check permission: 'staff.remove'
  const { merchant } = await ensurePermission('staff', 'remove');

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Soft delete - verify a row was actually updated
  const { data: removed, error } = await supabase
    .from('staff_members')
    .update({ status: 'removed' })
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .select('id')
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error('Staff member not found');
    }
    throw new Error('Failed to remove staff member');
  }

  if (!removed) {
    throw new Error('Staff member not found');
  }

  revalidatePath('/dashboard/staff');
  return { success: true };
}

// Helper to send email
async function sendInviteEmail(
  email: string,
  name: string,
  role: string,
  businessName: string,
  token: string
) {
  const { email: inviteEmail } = buildStaffInviteEmail({
    businessName,
    role,
    to: email,
    toName: name,
    token,
  });

  try {
    await sendEmail(inviteEmail);
  } catch {
    console.error('Failed to send invite email');
    // Silent fail on email shouldn't break the action
    // The action caller handles "success" so we probably shouldn't throw here if the DB part worked.
  }
}

export async function resetStaffPassword(id: string) {
  const { merchant } = await ensurePermission('staff', 'edit');

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, email, name, status, user_id')
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .single();

  if (!staff) {
    throw new Error('Staff member not found');
  }

  if (staff.status !== 'active') {
    throw new Error('Can only reset password for active staff members');
  }

  if (!staff.user_id) {
    throw new Error('Staff member has not accepted their invitation yet');
  }

  const adminClient = createAdminClient();
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: staff.email,
      options: {
        redirectTo: `${getAppUrl()}/reset-password`,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    throw new Error('Failed to generate password reset link');
  }

  await sendPasswordResetEmail(
    staff.email,
    staff.name || '',
    merchant.business_name,
    linkData.properties.action_link
  );

  revalidatePath('/dashboard/staff');
  return { success: true };
}

async function sendPasswordResetEmail(
  email: string,
  name: string,
  businessName: string,
  resetLink: string
) {
  const safeName = escapeHtmlForEmail(name) || 'there';
  const safeBusinessName = escapeHtmlForEmail(businessName);

  try {
    await sendEmail({
      to: email,
      toName: name,
      subject: `Password Reset for ${businessName}`,
      htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #6366f1; margin: 0;">Password Reset</h1>
            </div>
            <p>Hi ${safeName},</p>
            <p>Your administrator at <strong>${safeBusinessName}</strong> has requested a password reset for your account.</p>
            <p>Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 500;">Reset Password</a>
            </div>
            <p style="font-size: 12px; color: #666;">
              If you didn't expect this, please contact your store administrator.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="font-size: 12px; color: #666; text-align: center;">
              This email was sent by ${safeBusinessName} via Baci.
            </p>
          </body>
          </html>
        `,
      textContent: `Hi ${name || 'there'},\n\nYour administrator at ${businessName} has requested a password reset for your account.\n\nClick the link below to set a new password:\n${resetLink}\n\nIf you didn't expect this, please contact your store administrator.`,
      emailType: 'team',
    });
  } catch {
    console.error('Failed to send password reset email');
  }
}
