/**
 * API Route Authentication Helper
 * Supports both Bearer token auth (mobile apps) and cookie-based auth (web).
 * 2025 Best Practice: Verify token, then use admin client for queries.
 */

import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export interface AuthResult {
  user: User | null;
  error: string | null;
}

/**
 * Authenticate an API request from either mobile (Bearer token) or web (cookies).
 * Returns the authenticated user on success, or an error message on failure.
 *
 * @param request - The NextRequest object
 * @returns AuthResult with user or error
 */
export async function authenticateApiRequest(
  request: Request | NextRequest
): Promise<AuthResult> {
  // Check for Bearer token first (mobile app)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const adminClient = createAdminClient();

    // Verify the token using admin client
    const {
      data: { user },
      error,
    } = await adminClient.auth.getUser(token);

    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' };
    }

    return { user, error: null };
  }

  // Fallback to cookie-based auth (web)
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return { user: null, error: 'Not authenticated' };
    }

    return { user, error: null };
  } catch {
    return { user: null, error: 'Authentication failed' };
  }
}

/**
 * Get the admin Supabase client for server-side queries.
 * Use this after authenticating the user to bypass RLS.
 */
export function getAdminClient() {
  return createAdminClient();
}

/**
 * Get the merchant ID for an authenticated API user.
 * Supports both merchant owners and staff members.
 *
 * @param userId - The authenticated user's ID
 * @returns The merchant ID if found, null otherwise
 */
export async function getMerchantIdForApiUser(
  userId: string
): Promise<string | null> {
  const supabase = createAdminClient();

  // 1. Check if user is the merchant owner
  const { data: ownedMerchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (ownedMerchant) {
    return ownedMerchant.id;
  }

  // 2. Fallback: check if user is an active staff member
  const { data: staffMember } = await supabase
    .from('staff_members')
    .select('merchant_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (staffMember) {
    return staffMember.merchant_id;
  }

  return null;
}

/**
 * User access information for API authorization.
 * 2026 Best Practice: Use unified access pattern instead of separate owner/staff checks.
 */
export interface UserAccess {
  merchantId: string;
  role: 'owner' | 'admin' | 'manager' | 'staff';
  isOwner: boolean;
  isStaff: boolean;
  permissions: Record<string, Record<string, boolean>>;
}

/**
 * Get full access information for an authenticated API user.
 * Returns role, permissions, and flags for authorization decisions.
 *
 * @param userId - The authenticated user's ID
 * @returns UserAccess object if authorized, null otherwise
 */
export async function getUserAccess(
  userId: string
): Promise<UserAccess | null> {
  const supabase = createAdminClient();

  // 1. Check if user is the merchant owner
  const { data: ownedMerchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (ownedMerchant) {
    return {
      merchantId: ownedMerchant.id,
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: { '*': { '*': true } }, // Owners have full access
    };
  }

  // 2. Fallback: check if user is an active staff member
  const { data: staffMember } = await supabase
    .from('staff_members')
    .select('merchant_id, role, permissions')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (staffMember) {
    // Get default permissions for this role
    const { data: rolePerms } = await supabase
      .from('role_permissions')
      .select('permissions')
      .eq('role', staffMember.role)
      .single();

    // Merge role defaults with custom overrides
    const defaultPerms = (rolePerms?.permissions || {}) as Record<
      string,
      Record<string, boolean>
    >;
    const customPerms = (staffMember.permissions || {}) as Record<
      string,
      Record<string, boolean>
    >;
    const mergedPermissions: Record<string, Record<string, boolean>> = {
      ...defaultPerms,
    };

    for (const [resource, actions] of Object.entries(customPerms)) {
      mergedPermissions[resource] = {
        ...mergedPermissions[resource],
        ...actions,
      };
    }

    return {
      merchantId: staffMember.merchant_id,
      role: staffMember.role as 'admin' | 'manager' | 'staff',
      isOwner: false,
      isStaff: true,
      permissions: mergedPermissions,
    };
  }

  return null;
}

/**
 * Check if a user has a specific permission.
 *
 * @param access - UserAccess object
 * @param resource - Resource name (e.g., 'orders', 'products')
 * @param action - Action name (e.g., 'read', 'write', 'delete')
 * @returns true if user has permission
 */
export function hasPermission(
  access: UserAccess,
  resource: string,
  action: string
): boolean {
  // Owners have full access
  if (access.isOwner) return true;

  // Check wildcard permissions first
  if (access.permissions['*']?.['*']) return true;
  if (access.permissions['*']?.[action]) return true;
  if (access.permissions[resource]?.['*']) return true;

  // Check specific permission
  return access.permissions[resource]?.[action] === true;
}
