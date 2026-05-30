/**
 * Order Service - Mobile Storefront
 *
 * 2026 Best Practices:
 * - Type-safe API calls with Zod validation
 * - Network state awareness before mutations
 * - AbortController timeout for fetch calls (prevents hanging)
 * - Atomic operations (cart only clears after confirmation)
 * - Proper error handling with user-friendly messages
 * - Offline queue support for critical operations
 *
 * @see https://dev.to/nadim_ch0wdhury/building-a-production-ready-e-commerce-app-with-react-native-expo-2kao
 */

import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { z } from 'zod';
import {
  ApiError,
  DEFAULT_TIMEOUT,
  fetchWithRetry,
  NetworkError,
  RetryExhaustedError,
  TimeoutError,
} from '@/lib/api';
import { resolveApiBaseUrl } from '@/lib/api-url';
import { createLogger } from '@/lib/logger';
import { offlineQueue } from '@/lib/offline-queue';
import { supabase } from '@/lib/supabase';

const log = createLogger('Order');

import { trackError, trackEvent } from '@/services/analytics';

// Get API URL from config
const API_URL = resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl
);

const MERCHANT_ID =
  Constants.expoConfig?.extra?.merchantId ||
  '6b5cb8a4-5575-456c-b936-8cdfae30db74';
// Mobile savings credit is expressed in naira; backend order validation still
// recomputes the allowed redemption amount against the selected savings goal.
const MAX_SAVINGS_CREDIT_AMOUNT = 10_000_000;

// Order item schema for validation
const OrderItemSchema = z.object({
  id: z.string(),
  condition: z.string().optional(),
  product_id: z.string().optional(),
  name: z.string(),
  quantity: z.number().min(1),
  price: z.number().min(0),
  image_url: z.string().optional(),
  variant: z.string().optional(),
  variant_id: z.string().optional(),
  variant_attributes: z.record(z.string(), z.string()).optional(),
  has_assurance: z.boolean().optional(),
  assurance_fee: z.number().min(0).optional(),
  voucher_token: z
    .string()
    .trim()
    .min(1, 'Voucher token cannot be blank')
    .max(128, 'Voucher token must be 128 characters or less')
    .optional(),
  voucher_award_id: z
    .string()
    .trim()
    .min(1, 'Voucher award ID cannot be blank')
    .max(128, 'Voucher award ID must be 128 characters or less')
    .optional(),
});

// Order creation request schema
const CreateOrderRequestSchema = z.object({
  customer_email: z.string().email('Invalid email address'),
  customer_name: z.string().min(1, 'Name is required'),
  customer_phone: z.string().min(10, 'Valid phone number required'),
  idempotency_key: z.string().trim().min(1).max(128).optional(),
  items: z.array(OrderItemSchema).min(1, 'At least one item required'),
  subtotal: z.number().min(0),
  shipping_fee: z.number().min(0),
  tax_amount: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  payment_method: z.string().min(1),
  shipping_address: z.object({
    firstName: z.string(),
    lastName: z.string(),
    address: z.string(),
    city: z.string(),
    state: z.string(),
    notes: z.string().optional(),
  }),
  selected_quote_id: z.string().uuid().optional(),
  shipping_provider: z.string().optional(),
  source: z.string().default('mobile_app'),
  // Wallet payment selection. Both fields are optional so existing
  // non-wallet flows are unaffected. The payload-construction guard
  // below requires BOTH fields to be present-and-valid before they
  // reach the API — a malformed `{ use_wallet_credit: true,
  // wallet_amount: undefined }` is dropped, not forwarded.
  use_wallet_credit: z.boolean().optional(),
  wallet_amount: z.number().nonnegative().optional(),
  use_savings_credit: z.boolean().optional(),
  savings_goal_id: z.string().trim().uuid().optional(),
  savings_amount: z
    .number()
    .positive()
    .max(MAX_SAVINGS_CREDIT_AMOUNT, 'Savings amount exceeds maximum')
    .optional(),
});

// Order response schema
const OrderResponseSchema = z.object({
  order: z.object({
    id: z.string(),
    order_number: z.string().nullable(),
    total: z.number(),
    payment_status: z.string(),
    shipping_status: z.string(),
    created_at: z.string().optional(),
    tracking_token: z.string().nullable().optional(),
  }),
  wallet: z
    .object({
      amountUsed: z.number(),
      newBalance: z.number(),
      transactionId: z.string().nullable(),
    })
    .nullable(),
  savings: z
    .object({
      amountUsed: z.number(),
      goalId: z.string(),
      redemptionId: z.string().nullable(),
    })
    .nullable()
    .optional(),
  amountDueToGateway: z.number(),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type OrderResponse = z.infer<typeof OrderResponseSchema> & {
  order: z.infer<typeof OrderResponseSchema>['order'] & { created_at: string };
};
export type OrderItem = z.infer<typeof OrderItemSchema>;

// Error types for better handling
export class OrderError extends Error {
  code: string;
  details?: unknown;

  constructor(message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'OrderError';
    this.code = code;
    this.details = details;
  }
}

const ORDER_VALIDATION_ERROR_MESSAGES: Record<string, string> = {
  insufficient_stock:
    'This item is no longer available in the selected quantity. Please update your cart and try again.',
  insufficient_variant_stock:
    'This item is no longer available in the selected option. Please update your cart and try again.',
  invalid_items: 'One or more cart items are no longer available.',
  order_total_mismatch:
    'Your cart total changed. Please review your order and try again.',
  shipping_quote_required:
    'Delivery pricing changed. Please return to delivery and select a shipping option again.',
  tax_amount_mismatch:
    'Your order total changed. Please review your order and try again.',
};

function readResponseString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeConflictCode(value: unknown): string {
  const rawCode = readResponseString(value);
  if (!rawCode) return 'ORDER_CONFLICT';

  const normalizedCode = rawCode
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toUpperCase();

  if (normalizedCode === 'ORDER_NOT_REUSABLE') {
    return 'CHECKOUT_ORDER_NOT_REUSABLE';
  }

  if (
    normalizedCode === 'CHECKOUT_ORDER_NOT_REUSABLE' ||
    normalizedCode === 'CHECKOUT_IDEMPOTENCY_CONFLICT'
  ) {
    return normalizedCode;
  }

  return normalizedCode;
}

function getValidationErrorMessage(error: string, details: unknown): string {
  const detailCode = readResponseString(details);
  if (detailCode && ORDER_VALIDATION_ERROR_MESSAGES[detailCode]) {
    return ORDER_VALIDATION_ERROR_MESSAGES[detailCode];
  }

  return ORDER_VALIDATION_ERROR_MESSAGES[error] ?? error;
}

/**
 * Check network connectivity before making API calls
 * 2026 Best Practice: Always verify network before mutations
 */
async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Create a new order
 *
 * 2026 Best Practices:
 * - Validates input before API call
 * - Checks network connectivity
 * - Returns typed response
 * - Tracks analytics events
 * - Does NOT clear cart (caller responsibility after confirmation)
 */
export async function createOrder(
  request: CreateOrderRequest
): Promise<OrderResponse> {
  const startTime = Date.now();

  // 1. Validate request data
  const validationResult = CreateOrderRequestSchema.safeParse(request);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e: { message: string }) => e.message)
      .join(', ');
    throw new OrderError(
      errorMessage,
      'VALIDATION_ERROR',
      validationResult.error
    );
  }
  const validatedRequest = validationResult.data;

  // 2. Check network connectivity
  const isOnline = await checkNetwork();
  if (!isOnline) {
    throw new OrderError(
      'No internet connection. Please check your network and try again.',
      'NETWORK_ERROR'
    );
  }

  // 3. Auth is optional because the storefront supports guest checkout.
  // When a valid session exists, forward it so the server can link the order.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const {
    data: { user },
    error: authError,
  } = session?.access_token
    ? await supabase.auth.getUser()
    : { data: { user: null }, error: null };

  // 4. Prepare order payload matching web API expectations
  const orderPayload = {
    merchant_id: MERCHANT_ID,
    customer_email: validatedRequest.customer_email,
    customer_name: validatedRequest.customer_name,
    customer_phone: validatedRequest.customer_phone,
    items: validatedRequest.items.map((item) => ({
      id: item.id,
      condition: item.condition,
      product_id: item.product_id || item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      image_url: item.image_url,
      value: Math.round(item.price * item.quantity),
      variant_id: item.variant_id,
      variant_attributes: item.variant_attributes || {},
      has_assurance: item.has_assurance ?? false,
      assurance_fee: item.assurance_fee ?? 0,
      voucher_award_id: item.voucher_award_id,
      voucher_token: item.voucher_token,
    })),
    subtotal: validatedRequest.subtotal,
    shipping_fee: validatedRequest.shipping_fee,
    tax_amount: validatedRequest.tax_amount ?? 0,
    discount_amount: validatedRequest.discount_amount ?? 0,
    payment_method: validatedRequest.payment_method,
    selected_quote_id: validatedRequest.selected_quote_id ?? null,
    shipping_provider: validatedRequest.shipping_provider ?? null,
    payment_status:
      validatedRequest.payment_method === 'pay_on_delivery'
        ? 'pending'
        : 'unpaid',
    shipping_status: 'pending',
    shipping_address: {
      firstName: validatedRequest.shipping_address.firstName,
      lastName: validatedRequest.shipping_address.lastName,
      address: validatedRequest.shipping_address.address,
      city: validatedRequest.shipping_address.city,
      state: validatedRequest.shipping_address.state,
      notes: validatedRequest.shipping_address.notes || '',
    },
    source: 'mobile_app',
    // Include user_id if authenticated for customer profile linking
    ...(!authError && user?.id && { user_id: user.id }),
    // Wallet payment selection. Forward only when the intent is fully
    // formed: opt-in true AND a positive numeric amount. A malformed
    // `{ use_wallet_credit: true, wallet_amount: undefined }` (or 0 /
    // negative) gets dropped here so the server never sees a partial
    // wallet intent.
    ...(validatedRequest.use_wallet_credit === true &&
      typeof validatedRequest.wallet_amount === 'number' &&
      validatedRequest.wallet_amount > 0 && {
        use_wallet_credit: validatedRequest.use_wallet_credit,
        wallet_amount: validatedRequest.wallet_amount,
      }),
    // Savings credit follows the same fully formed intent rule: explicit opt-in,
    // a concrete savings goal, and a positive amount must travel together.
    ...(validatedRequest.use_savings_credit === true &&
      typeof validatedRequest.savings_goal_id === 'string' &&
      typeof validatedRequest.savings_amount === 'number' &&
      validatedRequest.savings_amount > 0 && {
        savings_amount: validatedRequest.savings_amount,
        savings_goal_id: validatedRequest.savings_goal_id,
        use_savings_credit: validatedRequest.use_savings_credit,
      }),
  };

  try {
    const idempotencyKey = validatedRequest.idempotency_key ?? Crypto.randomUUID();

    // 5. Make API call to create order with retry and timeout
    // 2026 Best Practice: Automatic retry with exponential backoff for resilience
    const response = await fetchWithRetry(
      `${API_URL}/api/orders`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
          ...(session?.access_token && {
            Authorization: `Bearer ${session.access_token}`,
          }),
        },
        body: JSON.stringify(orderPayload),
      },
      {
        // 2026 Best Practice: Order creation is non-idempotent on the server side
        // (no Idempotency-Key handling). Retrying creates duplicate orders, so
        // make a single attempt and let the user retry from the UI on failure.
        maxRetries: 0,
        timeout: DEFAULT_TIMEOUT,
      }
    );

    // 6. Handle HTTP errors (4xx errors are not retried, handle them here)
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        code?: unknown;
        details?: unknown;
        error?: unknown;
      };
      const errorMessage =
        readResponseString(errorData.error) ||
        `Order creation failed (${response.status})`;

      trackError('order_creation_failed', errorMessage, {
        status: response.status,
        duration_ms: Date.now() - startTime,
      });

      if (response.status === 400) {
        const details = errorData.details ?? errorData.code;
        throw new OrderError(
          getValidationErrorMessage(errorMessage, details),
          'VALIDATION_ERROR',
          details
        );
      } else if (response.status === 401) {
        throw new OrderError(
          'Session expired. Please sign in again.',
          'AUTH_ERROR'
        );
      } else if (response.status === 404) {
        const notFoundMessage = /merchant not found/i.test(errorMessage)
          ? 'Checkout is temporarily unavailable for this store. Please try again later.'
          : errorMessage;
        throw new OrderError(notFoundMessage, 'NOT_FOUND');
      } else if (response.status === 409) {
        const conflictCode = normalizeConflictCode(errorData.code);
        const conflictDetails =
          errorData.details ??
          (typeof errorData === 'object' && errorData !== null
            ? { ...errorData, code: conflictCode }
            : conflictCode);
        throw new OrderError(errorMessage, conflictCode, conflictDetails);
      } else if (response.status >= 500) {
        throw new OrderError(
          'Server error. Please try again in a few moments.',
          'SERVER_ERROR'
        );
      } else {
        throw new OrderError(errorMessage, 'UNKNOWN_ERROR');
      }
    }

    // 7. Parse and validate response
    // BUG-3-002 FIX: Throw error on schema validation failure instead of returning unvalidated data
    const data = await response.json();
    const orderResponse = OrderResponseSchema.safeParse(data);

    if (!orderResponse.success) {
      // Response doesn't match expected schema - this is a server contract violation
      log.error('Response schema validation failed', orderResponse.error);
      trackError(
        'order_response_validation_failed',
        'Invalid response schema',
        {
          orderId: data?.order?.id,
          validationErrors: orderResponse.error.flatten(),
        }
      );

      throw new OrderError(
        'Order may have been created but response format is invalid. Please check your order history.',
        'RESPONSE_VALIDATION_ERROR',
        orderResponse.error
      );
    }

    const normalizedOrderResponse: OrderResponse = {
      ...orderResponse.data,
      order: {
        ...orderResponse.data.order,
        created_at:
          orderResponse.data.order.created_at ?? new Date().toISOString(),
      },
    };

    // 8. Track successful order creation
    trackEvent('order_created', {
      orderId: normalizedOrderResponse.order.id,
      orderNumber: normalizedOrderResponse.order.order_number ?? 'N/A',
      total: normalizedOrderResponse.order.total,
      itemCount: request.items.length,
      paymentMethod: request.payment_method,
      duration_ms: Date.now() - startTime,
      source: 'mobile_app',
    });

    return normalizedOrderResponse;
  } catch (error) {
    // Re-throw OrderError as-is
    if (error instanceof OrderError) {
      throw error;
    }

    // 2026 Best Practice: Handle retry exhaustion errors
    if (error instanceof RetryExhaustedError) {
      trackError('order_creation_retry_exhausted', error.message, {
        attempts: error.attempts,
        lastError: error.lastError.message,
        duration_ms: Date.now() - startTime,
      });
      throw new OrderError(
        'Unable to complete order after multiple attempts. Please try again later.',
        'RETRY_EXHAUSTED'
      );
    }

    // Handle timeout errors specifically
    if (error instanceof TimeoutError) {
      trackError('order_creation_timeout', error.message, {
        duration_ms: Date.now() - startTime,
      });
      throw new OrderError(
        'Request timed out. Please check your connection and try again.',
        'TIMEOUT_ERROR'
      );
    }

    // Handle network errors
    if (error instanceof NetworkError) {
      throw new OrderError(
        'Network error. Please check your connection and try again.',
        'NETWORK_ERROR'
      );
    }

    // Handle API errors (5xx that exhausted retries)
    if (error instanceof ApiError) {
      trackError('order_creation_api_error', error.message, {
        status: error.status,
        duration_ms: Date.now() - startTime,
      });
      throw new OrderError(
        'Server error. Please try again in a few moments.',
        'SERVER_ERROR'
      );
    }

    // Handle network/fetch errors (legacy check)
    if (error instanceof TypeError && error.message.includes('Network')) {
      throw new OrderError(
        'Network error. Please check your connection and try again.',
        'NETWORK_ERROR'
      );
    }

    // Unknown error
    trackError(
      'order_creation_exception',
      error instanceof Error ? error.message : 'Unknown error',
      { duration_ms: Date.now() - startTime }
    );

    throw new OrderError(
      'Something went wrong. Please try again.',
      'UNKNOWN_ERROR',
      error
    );
  }
}

/**
 * Get order by ID
 * For order confirmation and tracking screens
 */
export async function getOrder(
  orderId: string,
  customerId: string
): Promise<OrderResponse['order'] | null> {
  const isOnline = await checkNetwork();
  if (!isOnline) {
    throw new OrderError(
      'No internet connection. Please check your network.',
      'NETWORK_ERROR'
    );
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, total, payment_status, shipping_status, created_at'
    )
    .eq('id', orderId)
    .eq('customer_id', customerId)
    .single();

  if (error) {
    log.error('Error fetching order', error);
    return null;
  }

  return data;
}

/**
 * Get customer orders
 * For order history screen
 */
export async function getCustomerOrders(customerId: string) {
  const isOnline = await checkNetwork();
  if (!isOnline) {
    throw new OrderError(
      'No internet connection. Please check your network.',
      'NETWORK_ERROR'
    );
  }

  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, total, payment_status, shipping_status, created_at, order_items(id, product_id, condition, image_url, name, quantity, price, has_assurance)'
    )
    .eq('customer_id', customerId)
    .eq('merchant_id', MERCHANT_ID)
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Error fetching customer orders', error);
    throw new OrderError('Failed to load orders', 'FETCH_ERROR', error);
  }

  return data || [];
}

/**
 * Create order with offline queue fallback
 *
 * 2026 Best Practice: Critical mutations should be queued when offline
 * - Attempts to create order online first
 * - If offline, queues the order for later processing
 * - Returns a pending order response for UI feedback
 *
 * @example
 * ```ts
 * const result = await createOrderWithOfflineSupport(orderData);
 * if (result.queued) {
 *   // Show "Order will be submitted when online" message
 * } else {
 *   // Order created successfully
 * }
 * ```
 */
export async function createOrderWithOfflineSupport(
  request: CreateOrderRequest
): Promise<{ order: OrderResponse | null; queued: boolean; queueId?: string }> {
  // 1. Validate request data first (works offline)
  const validationResult = CreateOrderRequestSchema.safeParse(request);
  if (!validationResult.success) {
    const errorMessage = validationResult.error.issues
      .map((e: { message: string }) => e.message)
      .join(', ');
    throw new OrderError(
      errorMessage,
      'VALIDATION_ERROR',
      validationResult.error
    );
  }

  // 2. Check network connectivity
  const isOnline = await checkNetwork();

  if (isOnline) {
    // Online - try to create order directly
    try {
      const order = await createOrder(request);
      return { order, queued: false };
    } catch (error) {
      // Only queue errors where the server definitely did NOT receive the request.
      // TIMEOUT_ERROR has unknown outcome — the order may have been created server-side,
      // so queuing it for replay risks creating a duplicate order.
      if (error instanceof OrderError && error.code === 'NETWORK_ERROR') {
        const queueId = await offlineQueue.enqueue('create_order', request);
        trackEvent('order_queued_after_failure', {
          queueId,
          errorCode: error.code,
        });
        return { order: null, queued: true, queueId };
      }
      throw error;
    }
  } else {
    // Offline - queue the order for later
    const queueId = await offlineQueue.enqueue('create_order', request);

    trackEvent('order_queued_offline', {
      queueId,
      itemCount: request.items.length,
    });

    return { order: null, queued: true, queueId };
  }
}
