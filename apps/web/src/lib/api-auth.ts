/**
 * API Route Authentication Helper
 * Supports both Bearer token auth (mobile apps) and cookie-based auth (web).
 * - Bearer tokens: Verified with an anon-scoped client (no service role).
 * - Cookies: Verified via the server factory (cookie forwarding).
 * After verification, use the returned supabase client for RLS-safe queries.
 */

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { createClient } from '@/lib/supabase/server';

/**
 * Cached stateless anon client for Bearer token verification.
 * Reused across requests since it has no session state.
 */
let _anonClient: SupabaseClient | null = null;
function _getAnonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _anonClient;
}

function _createScopedClient(token: string): SupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export interface AuthResult {
  user: User | null;
  error: string | null;
  supabase: SupabaseClient | null;
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
    const anonClient = _getAnonClient();

    // Verify the token using an anon-scoped client (no service role)
    const {
      data: { user },
      error,
    } = await anonClient.auth.getUser(token);

    if (error || !user) {
      return { user: null, error: 'Invalid or expired token', supabase: null };
    }

    return { user, error: null, supabase: _createScopedClient(token) };
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
      return { user: null, error: 'Not authenticated', supabase: null };
    }

    return { user, error: null, supabase };
  } catch {
    return { user: null, error: 'Authentication failed', supabase: null };
  }
}

/**
 * Get the merchant ID for an authenticated API user.
 * Supports both merchant owners and staff members.
 *
 * @param supabase - Scoped Supabase client (RLS enforced)
 * @returns The merchant ID if found, null otherwise
 */
export async function getMerchantIdForApiUser(
  supabase: SupabaseClient
): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_user_access');
  if (error || !data) return null;

  const access = Array.isArray(data) ? data[0] : data;
  return access?.merchant_id || null;
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
  supabase: SupabaseClient
): Promise<UserAccess | null> {
  const { data, error } = await supabase.rpc('get_user_access');
  if (error || !data) return null;

  const access = Array.isArray(data) ? data[0] : data;
  if (!access?.merchant_id) return null;

  return {
    merchantId: access.merchant_id,
    role:
      access.role === 'owner'
        ? 'owner'
        : (access.role as 'admin' | 'manager' | 'staff'),
    isOwner: Boolean(access.is_owner),
    isStaff: Boolean(access.is_staff),
    permissions:
      (access.permissions as Record<string, Record<string, boolean>>) || {},
  };
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
