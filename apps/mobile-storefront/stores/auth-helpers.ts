/**
 * Auth store helper utilities — extracted from auth-store.ts to keep the
 * main store file focused on state management and action definitions.
 */

import type { User } from '@supabase/supabase-js';
import { splitFullName } from '../lib/auth-helpers';
import { createLogger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { CustomerRowSchema } from '../lib/validation';
import {
  CUSTOMER_SELECT_COLUMNS,
  isMissingUsernameChangedAtColumn,
  LEGACY_CUSTOMER_SELECT_COLUMNS,
} from './auth-customer-schema-compat';
import type { Customer } from './auth-store';

const log = createLogger('AuthHelpers');

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

type CustomerQueryError = {
  code?: string;
  message: string;
};

type CustomerQueryResult = {
  data: unknown;
  error: CustomerQueryError | null;
};

async function selectCustomer(
  merchantId: string,
  userId: string,
  columns: string,
  label: string,
  useTimeout: boolean
): Promise<CustomerQueryResult> {
  return (await wrapQuery(
    supabase
      .from('customers')
      .select(columns)
      .eq('merchant_id', merchantId)
      .eq('user_id', userId)
      .maybeSingle(),
    label,
    useTimeout
  )) as CustomerQueryResult;
}

async function selectCustomerWithSchemaFallback(
  merchantId: string,
  userId: string,
  label: string,
  useTimeout: boolean,
  preferredColumns = CUSTOMER_SELECT_COLUMNS
): Promise<CustomerQueryResult & { columns: string }> {
  let result = await selectCustomer(
    merchantId,
    userId,
    preferredColumns,
    label,
    useTimeout
  );
  if (
    preferredColumns === CUSTOMER_SELECT_COLUMNS &&
    isMissingUsernameChangedAtColumn(result.error)
  ) {
    result = await selectCustomer(
      merchantId,
      userId,
      LEGACY_CUSTOMER_SELECT_COLUMNS,
      `${label} (legacy schema)`,
      useTimeout
    );
    return { ...result, columns: LEGACY_CUSTOMER_SELECT_COLUMNS };
  }
  return { ...result, columns: preferredColumns };
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
  let customerQuery = await selectCustomerWithSchemaFallback(
    merchantId,
    user.id,
    'customer fetch',
    useTimeout
  );

  if (cancelled()) return null;

  if (customerQuery.error) {
    log.error('Customer fetch failed:', customerQuery.error.message);
  }

  // 2. If no linked customer record found, use atomic SECURITY DEFINER RPC
  let resolvedCustomer = customerQuery.data;
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
    customerQuery = await selectCustomerWithSchemaFallback(
      merchantId,
      user.id,
      'customer re-fetch',
      useTimeout,
      customerQuery.columns
    );

    if (cancelled()) return null;

    if (customerQuery.error) {
      log.error('Customer re-fetch failed:', customerQuery.error.message);
    }

    resolvedCustomer = customerQuery.data;
  }

  // 3. Backfill missing profile fields from OAuth provider
  let validatedCustomer = CustomerRowSchema.safeParse(resolvedCustomer);
  if (!validatedCustomer.success) return null;

  if (user.user_metadata) {
    const meta = user.user_metadata;
    const { firstName, lastName } = splitFullName(meta.full_name);
    const updates: Record<string, string> = {};

    if (!validatedCustomer.data.first_name && firstName)
      updates.first_name = firstName;
    if (!validatedCustomer.data.last_name && lastName)
      updates.last_name = lastName;

    if (Object.keys(updates).length > 0) {
      const { data: updated, error: updateError } = await wrapQuery(
        supabase
          .from('customers')
          .update(updates)
          .eq('id', validatedCustomer.data.id)
          .eq('merchant_id', merchantId)
          .select(customerQuery.columns)
          .single(),
        'customer profile backfill',
        useTimeout
      );

      if (cancelled()) return null;

      if (updateError) {
        log.error('Customer backfill update failed:', updateError.message);
      } else if (updated) {
        const updatedCustomer = CustomerRowSchema.safeParse(updated);
        if (updatedCustomer.success) validatedCustomer = updatedCustomer;
      }
    }
  }

  const customerWithUsernamePolicy: Customer = {
    id: validatedCustomer.data.id,
    user_id: validatedCustomer.data.user_id,
    email: validatedCustomer.data.email,
    first_name: validatedCustomer.data.first_name ?? undefined,
    last_name: validatedCustomer.data.last_name ?? undefined,
    phone: validatedCustomer.data.phone ?? undefined,
    loyalty_points: validatedCustomer.data.loyalty_points ?? undefined,
    username: validatedCustomer.data.username ?? undefined,
    username_changed_at:
      validatedCustomer.data.username_changed_at ?? undefined,
    date_of_birth: validatedCustomer.data.date_of_birth ?? undefined,
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
