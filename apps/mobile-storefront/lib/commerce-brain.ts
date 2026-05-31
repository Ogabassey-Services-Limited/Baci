import NetInfo from '@react-native-community/netinfo';
import {
  calculateOrderTotals,
  canFallbackToLocalOrderTotals,
  normalizeRemoteOrderTotals,
} from './commerce';
import { createLogger } from './logger';
import { supabase } from './supabase';
import type {
  CalculateOrderInputType,
  CalculateOrderOutputType,
  CalculateVTUInputType,
  CalculateVTUOutputType,
  RedeemLoyaltyInputType,
  RedeemLoyaltyOutputType,
} from './validation';

const log = createLogger('Supabase');

/** Default timeout for edge function calls (30 seconds) */
const EDGE_FUNCTION_TIMEOUT = 30000;

/**
 * Check network connectivity before edge function calls
 * 2026 Best Practice: Always verify network before critical operations
 */
async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Custom error class for commerce operations
 * 2026 Best Practice: Typed errors for better error handling
 */
export class CommerceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'CommerceError';
    this.code = code;
  }
}

async function invokeCommerceBrain(
  action: 'calculate_vtu' | 'calculate_order' | 'redeem_loyalty',
  data: CalculateOrderInputType | CalculateVTUInputType | RedeemLoyaltyInputType
): Promise<{ error: unknown; result: unknown }> {
  try {
    const invokePromise = supabase.functions.invoke('calculate-commerce', {
      body: { action, data },
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(
          new CommerceError(
            'Request timed out. Please check your connection and try again.',
            'TIMEOUT_ERROR'
          )
        );
      }, EDGE_FUNCTION_TIMEOUT);
    });

    try {
      const response = await Promise.race([invokePromise, timeoutPromise]);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      return { error: response.error, result: response.data };
    } catch (error) {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      return { error, result: undefined };
    }
  } catch (error) {
    return { error, result: undefined };
  }
}

async function trackCommerceFallback(
  action: 'calculate_vtu' | 'calculate_order' | 'redeem_loyalty',
  startTime: number,
  error: unknown
) {
  try {
    const { trackEvent } = await import('@/services/analytics');
    trackEvent('commerce_brain_fallback', {
      action,
      duration_ms: Date.now() - startTime,
      reason:
        (error as { message?: string })?.message || 'Edge function unavailable',
    });
  } catch (trackErr) {
    log.warn('Failed to track fallback event:', trackErr);
  }
}

async function trackCommerceError(
  action: 'calculate_vtu' | 'calculate_order' | 'redeem_loyalty',
  startTime: number,
  error: unknown
) {
  try {
    const { trackError } = await import('@/services/analytics');
    const errorMessage =
      error instanceof Error
        ? error.message
        : (error as { message?: string })?.message || 'Unknown error';
    trackError('commerce_brain_error', errorMessage, {
      action,
      duration_ms: Date.now() - startTime,
    });
  } catch (trackErr) {
    log.warn('Failed to track error:', trackErr);
  }
}

async function trackCommerceSuccess(
  action: 'calculate_vtu' | 'calculate_order' | 'redeem_loyalty',
  startTime: number
) {
  try {
    const { trackEvent } = await import('@/services/analytics');
    trackEvent('commerce_brain_called', {
      action,
      success: true,
      duration_ms: Date.now() - startTime,
    });
  } catch (trackErr) {
    log.warn('Failed to track event:', trackErr);
  }
}

/**
 * Call the central commerce brain (Supabase Edge Function)
 * Centralizes math for Parity between Web & App
 * Includes analytics instrumentation for tracking
 *
 * 2026 Best Practices:
 * - Function overloads for type-safe API calls
 * - Network connectivity check before edge function calls
 * - Typed error handling
 */
export async function calculateCommerce(
  action: 'calculate_order',
  data: CalculateOrderInputType
): Promise<CalculateOrderOutputType>;
export async function calculateCommerce(
  action: 'calculate_vtu',
  data: CalculateVTUInputType
): Promise<CalculateVTUOutputType>;
export async function calculateCommerce(
  action: 'redeem_loyalty',
  data: RedeemLoyaltyInputType
): Promise<RedeemLoyaltyOutputType>;
export async function calculateCommerce(
  action: 'calculate_vtu' | 'calculate_order' | 'redeem_loyalty',
  data: CalculateOrderInputType | CalculateVTUInputType | RedeemLoyaltyInputType
): Promise<
  CalculateOrderOutputType | CalculateVTUOutputType | RedeemLoyaltyOutputType
> {
  const startTime = Date.now();

  // 2026 Best Practice: Check network before edge function calls
  const isOnline = await checkNetwork();
  if (!isOnline) {
    throw new CommerceError(
      'No internet connection. Please check your network and try again.',
      'NETWORK_ERROR'
    );
  }

  try {
    const { error, result } = await invokeCommerceBrain(action, data);

    if (error) {
      if (
        action === 'calculate_order' &&
        canFallbackToLocalOrderTotals(error)
      ) {
        const fallbackResult = calculateOrderTotals(
          data as CalculateOrderInputType
        );

        log.warn(
          `Commerce Brain unavailable [${action}], using local totals fallback.`,
          error
        );

        await trackCommerceFallback(action, startTime, error);
        return fallbackResult;
      }

      log.error(`Commerce Brain Error [${action}]:`, error);
      await trackCommerceError(action, startTime, error);

      if (error instanceof Error) throw error;
      throw new CommerceError(
        (error as { message?: string })?.message ||
          'Commerce calculation failed',
        'COMMERCE_BRAIN_ERROR'
      );
    }

    const normalizedResult =
      action === 'calculate_order'
        ? normalizeRemoteOrderTotals(
            data as CalculateOrderInputType,
            result as Partial<CalculateOrderOutputType> | null | undefined
          )
        : result;

    await trackCommerceSuccess(action, startTime);

    // Type assertion needed: Supabase edge function returns untyped JSON.
    // The function overloads above guarantee the correct return type per action.
    return normalizedResult as
      | CalculateOrderOutputType
      | CalculateVTUOutputType
      | RedeemLoyaltyOutputType;
  } catch (error) {
    if (error instanceof CommerceError) throw error;

    // Track external failures (network, etc)
    await trackCommerceError(action, startTime, error);

    if (error instanceof Error) throw error;
    throw new CommerceError('Unknown commerce error', 'UNKNOWN_ERROR');
  }
}
