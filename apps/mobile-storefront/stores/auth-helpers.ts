/**
 * Auth store helper utilities — extracted from auth-store.ts to keep the
 * main store file focused on state management and action definitions.
 */

import type { User } from '@supabase/supabase-js';
import { splitFullName } from '../lib/auth-helpers';
import { createLogger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { CustomerRowSchema } from '../lib/validation';
import type { Customer } from './auth-store';
import { profileRpcErrorMessages } from './auth-store-error-messages';

const log = createLogger('AuthHelpers');

export function getUsernamePolicyError(error: {
  details?: string;
  message: string;
}) {
  if (error.message === 'username_change_active_attempt')
    return 'Finish your active quiz before changing your username.';
  if (error.message !== 'username_change_cooldown')
    return profileRpcErrorMessages.username(error.message);
  const timestamp = Date.parse(error.details ?? '');
  return Number.isFinite(timestamp)
    ? `You can change your username again on ${new Intl.DateTimeFormat(
        undefined,
        { dateStyle: 'medium' }
      ).format(timestamp)}.`
    : 'You can change your username once every 30 days.';
}

export function getUsernameCooldownNextEligibleAt(error: {
  details?: string;
  message: string;
}) {
  if (error.message !== 'username_change_cooldown') return null;
  return Number.isFinite(Date.parse(error.details ?? ''))
    ? (error.details ?? null)
    : null;
}

export function parseUsernameWriteResult(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (typeof value.username !== 'string') return null;
  return {
    username: value.username,
    usernameChangedAt:
      typeof value.usernameChangedAt === 'string'
        ? value.usernameChangedAt
        : null,
    nextEligibleAt:
      typeof value.nextEligibleAt === 'string' ? value.nextEligibleAt : null,
  };
}

export const CUSTOMER_SELECT_COLUMNS =
  'id, user_id, email, first_name, last_name, phone, loyalty_points, username, username_changed_at, date_of_birth';

/** Timeout (ms) for each Supabase query during initialization.
 *  Android on poor cellular can stall indefinitely without a client-side limit. */
export const INIT_QUERY_TIMEOUT_MS = 10_000;

/** Race a promise/thenable against a timeout. Rejects with a descriptive error
 *  if the timeout fires first. Accepts Supabase query builders (thenables). */
export function initTimeout<T>(
  promiseOrThenable: PromiseLike<T>,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return Promise.race([
    Promise.resolve(promiseOrThenable),
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new Error(
            `Timeout: ${label} took longer than ${INIT_QUERY_TIMEOUT_MS}ms`
          )
        );
      }, INIT_QUERY_TIMEOUT_MS);
    }),
  ]).finally(() => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  });
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isInitTimeoutError(error: unknown, label?: string): boolean {
  if (!(error instanceof Error)) return false;

  const expectedPrefix = label
    ? `Timeout: ${label} took longer than `
    : 'Timeout: ';

  return (
    error.message.startsWith(expectedPrefix) &&
    error.message.endsWith('ms') &&
    error.message.includes('took longer than ')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

export function shouldInvalidateSessionOnGetUserError(error: unknown): boolean {
  if (!isRecord(error)) return false;

  const status =
    typeof error.status === 'number' ? (error.status as number) : null;
  const code = typeof error.code === 'string' ? error.code.toLowerCase() : '';
  const message =
    typeof error.message === 'string' ? error.message.toLowerCase() : '';

  // Retryable/network auth errors should not force sign-out on mobile startup.
  if (status !== null) {
    if (status >= 500) return false;
    if (status === 400 || status === 401 || status === 403) return true;
  }

  if (
    code === 'bad_jwt' ||
    code === 'invalid_jwt' ||
    code === 'jwt_expired' ||
    code === 'session_not_found'
  ) {
    return true;
  }

  return (
    message.includes('jwt') ||
    message.includes('session missing') ||
    message.includes('invalid token') ||
    message.includes('token expired')
  );
}

// ---------------------------------------------------------------------------
// Customer hydration — shared between initialize() and SIGNED_IN listener
// ---------------------------------------------------------------------------

/**
 * Fetches (or creates via RPC) the customer record for a given user+merchant
 * combination. Handles:
 * 1. Direct lookup by user_id
 * 2. upsert_customer_on_auth RPC fallback when no record exists
 * 3. Re-fetch after RPC
 * 4. OAuth profile backfill (first_name, last_name)
 *
 * @param useTimeout  When true, wraps queries in `initTimeout` with `.catch()`
 *                    for graceful degradation during app initialization.
 * @returns Validated `Customer` or `null`.
 */
export async function hydrateCustomer({
  merchantId,
  user,
  useTimeout,
  initGen,
  getInitGen,
}: {
  merchantId: string;
  user: User;
  useTimeout: boolean;
  /** Generation counter for cancellation guard (optional). */
  initGen?: number;
  /** Getter for current generation — returns early if stale. */
  getInitGen?: () => number;
}): Promise<Customer | null> {
  const cancelled = () =>
    initGen !== undefined && getInitGen && getInitGen() !== initGen;

  // 1. Fetch customer data by user_id (RLS-safe for linked accounts)
  const { data: customerData, error: selectError } = await wrapQuery(
    supabase
      .from('customers')
      .select(CUSTOMER_SELECT_COLUMNS)
      .eq('merchant_id', merchantId)
      .eq('user_id', user.id)
      .maybeSingle(),
    'customer fetch',
    useTimeout
  );

  if (cancelled()) return null;

  if (selectError) {
    log.error('Customer fetch failed:', selectError.message);
  }

  // 2. If no linked customer record found, use atomic SECURITY DEFINER RPC
  let resolvedCustomer = customerData;
  if (!resolvedCustomer && user.email) {
    const { error: rpcError } = await wrapQuery(
      supabase.rpc('upsert_customer_on_auth', {
        p_merchant_id: merchantId,
        p_user_id: user.id,
        p_email: user.email,
        p_full_name: user.user_metadata?.full_name || null,
        p_phone: null,
      }),
      'customer upsert RPC',
      useTimeout
    );

    if (cancelled()) return null;

    if (rpcError) {
      log.error('Customer upsert RPC failed:', rpcError.message);
    }

    // Re-SELECT by user_id (now set by RPC, RLS passes)
    const { data: newCustomer, error: reSelectError } = await wrapQuery(
      supabase
        .from('customers')
        .select(CUSTOMER_SELECT_COLUMNS)
        .eq('merchant_id', merchantId)
        .eq('user_id', user.id)
        .maybeSingle(),
      'customer re-fetch',
      useTimeout
    );

    if (cancelled()) return null;

    if (reSelectError) {
      log.error('Customer re-fetch failed:', reSelectError.message);
    }

    resolvedCustomer = newCustomer;
  }

  // 3. Backfill missing profile fields from OAuth provider
  if (resolvedCustomer && user.user_metadata) {
    const meta = user.user_metadata;
    const { firstName, lastName } = splitFullName(meta.full_name);
    const updates: Record<string, string> = {};

    if (!resolvedCustomer.first_name && firstName)
      updates.first_name = firstName;
    if (!resolvedCustomer.last_name && lastName) updates.last_name = lastName;

    if (Object.keys(updates).length > 0) {
      const { data: updated, error: updateError } = await wrapQuery(
        supabase
          .from('customers')
          .update(updates)
          .eq('id', resolvedCustomer.id)
          .eq('merchant_id', merchantId)
          .select(CUSTOMER_SELECT_COLUMNS)
          .single(),
        'customer profile backfill',
        useTimeout
      );

      if (cancelled()) return null;

      if (updateError) {
        log.error('Customer backfill update failed:', updateError.message);
      } else if (updated) {
        resolvedCustomer = updated;
      }
    }
  }

  // 4. Validate with Zod
  const validation = CustomerRowSchema.safeParse(resolvedCustomer);
  if (!validation.success) return null;

  const customerWithUsernamePolicy: Customer = {
    id: validation.data.id,
    user_id: validation.data.user_id,
    email: validation.data.email,
    first_name: validation.data.first_name ?? undefined,
    last_name: validation.data.last_name ?? undefined,
    phone: validation.data.phone ?? undefined,
    loyalty_points: validation.data.loyalty_points ?? undefined,
    username: validation.data.username ?? undefined,
    username_changed_at: validation.data.username_changed_at ?? undefined,
    date_of_birth: validation.data.date_of_birth ?? undefined,
  };
  return customerWithUsernamePolicy;
}

function wrapQuery<T>(
  query: PromiseLike<T>,
  label: string,
  useTimeout: boolean
): Promise<T> {
  if (!useTimeout) return Promise.resolve(query);

  return initTimeout(query, label).catch((error) => ({
    data: null,
    error: { message: getErrorMessage(error) },
  })) as Promise<T>;
}
