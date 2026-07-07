/**
 * Shared utility for triggering purchase conversion events to ad platforms
 * 2026 Best Practice: Centralized, properly typed, and awaitable
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchAnalyticsPlatformConfig,
  hasConfiguredAnalyticsPlatform,
} from '@/lib/analytics/analytics-platform-config';
import { logger } from '@/lib/logger';
import {
  logConversionResults,
  type MerchantAnalyticsConfig,
  type OrderConversionData,
  sendPurchaseConversion,
} from '@/lib/offline-conversions';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';

/**
 * Strongly typed interface for order data needed for conversions
 * Avoids `any` and provides clear contract
 */
export interface OrderForConversion {
  id: string;
  order_number?: string | null;
  total: string | number;
  currency?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_name?: string | null;
  customer_id?: string | null;
  ad_tracking?: Record<string, unknown> | null;
  order_items?: Array<{
    id?: string | null;
    product_id?: string | null;
    name?: string | null;
    price?: number | string | null;
    quantity?: number | null;
  }> | null;
  shipping_address?: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zip?: string | null;
    postal_code?: string | null;
  } | null;
}

export interface TriggerPurchaseConversionOptions {
  failOnInvalidItem?: boolean;
}

function toRequiredString(value: unknown) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toConversionItem({
  item,
  itemIndex,
  orderId,
  options,
}: {
  item: NonNullable<OrderForConversion['order_items']>[number];
  itemIndex: number;
  orderId: string;
  options: TriggerPurchaseConversionOptions;
}): OrderConversionData['items'][number] | null {
  const id = toRequiredString(item.product_id) ?? toRequiredString(item.id);
  const name = toRequiredString(item.name);
  const price = toFiniteNumber(item.price);
  const quantity = toFiniteNumber(item.quantity);
  const invalidFields = [
    id ? null : 'product_id',
    name ? null : 'name',
    price !== null && price >= 0 ? null : 'price',
    quantity !== null && quantity > 0 ? null : 'quantity',
  ].filter((field): field is string => field !== null);

  if (
    !id ||
    !name ||
    price === null ||
    price < 0 ||
    quantity === null ||
    quantity <= 0
  ) {
    const logPayload = {
      invalidFields,
      itemIndex,
      message: 'Skipping invalid order item for conversion tracking',
      orderId,
    };
    if (options.failOnInvalidItem) {
      logger.error({
        ...logPayload,
        message: 'Invalid order item for conversion tracking',
      });
      throw new Error(
        `Invalid order item for conversion tracking: order=${orderId}, item=${itemIndex}, fields=${invalidFields.join(',')}`
      );
    }
    logger.warn(logPayload);
    return null;
  }

  return { id, name, price, quantity };
}

function toConversionItems(
  order: OrderForConversion,
  options: TriggerPurchaseConversionOptions
) {
  return (order.order_items ?? [])
    .map((item, itemIndex) =>
      toConversionItem({ item, itemIndex, options, orderId: order.id })
    )
    .filter(
      (item): item is OrderConversionData['items'][number] => item !== null
    );
}

/**
 * Resolve the currency code for a conversion event. The order's own
 * `currency` column is authoritative when present (set at checkout from the
 * merchant's resolved currency); only when it's missing do we fall back to
 * looking up the merchant's `payout_currency`/`country` via the shared
 * resolver (which itself falls back to the platform default, NGN).
 */
async function resolveConversionCurrency(
  supabase: SupabaseClient,
  merchantId: string,
  order: OrderForConversion
): Promise<string> {
  const orderCurrency = order.currency?.trim();
  if (orderCurrency) {
    return orderCurrency;
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('country, payout_currency')
    .eq('id', merchantId)
    .maybeSingle();

  return resolveMerchantCurrencyConfig(merchant ?? {}).code;
}

/**
 * Triggers a Purchase conversion event to all configured ad platforms
 * (Facebook CAPI, TikTok Events API, Google Analytics 4, Snapchat CAPI)
 *
 * @param supabase - Supabase client (admin or authenticated)
 * @param merchantId - The merchant's UUID
 * @param order - Order data for the conversion
 * @returns Promise that resolves when conversion tracking completes
 *
 * @example
 * // In an API route with `after()` for background processing:
 * import { after } from 'next/server';
 * after(() => triggerPurchaseConversion(supabase, merchantId, order));
 */
export async function triggerPurchaseConversion(
  supabase: SupabaseClient,
  merchantId: string,
  order: OrderForConversion,
  options: TriggerPurchaseConversionOptions = {}
): Promise<void> {
  const orderNumber = order.order_number || order.id.slice(0, 8).toUpperCase();

  try {
    // Fetch merchant's analytics configuration and feature toggle.
    const merchantAnalytics = await fetchAnalyticsPlatformConfig(
      supabase,
      merchantId
    );

    if (!merchantAnalytics) {
      logger.warn({
        message: 'Failed to fetch analytics config for conversion tracking',
        merchantId,
      });
      return;
    }

    // Check if merchant has explicitly disabled offline conversions
    if (merchantAnalytics?.offline_conversions_enabled === false) {
      logger.info({
        message: 'Offline conversions disabled by merchant',
        merchantId,
        orderId: order.id,
      });
      return;
    }

    const analyticsConfig: MerchantAnalyticsConfig = {
      facebook_pixel_id: merchantAnalytics.facebook_pixel_id,
      facebook_capi_token: merchantAnalytics.facebook_capi_token,
      tiktok_pixel_id: merchantAnalytics.tiktok_pixel_id,
      tiktok_access_token: merchantAnalytics.tiktok_access_token,
      google_analytics_id: merchantAnalytics.google_analytics_id,
      ga4_api_secret: merchantAnalytics.ga4_api_secret,
      snapchat_pixel_id: merchantAnalytics.snapchat_pixel_id,
      snapchat_capi_token: merchantAnalytics.snapchat_capi_token,
    };

    // Check if any platform is configured
    if (!hasConfiguredAnalyticsPlatform(merchantAnalytics)) {
      logger.info({
        message: 'No analytics platforms configured for merchant',
        merchantId,
        orderId: order.id,
      });
      return;
    }

    // Extract ad tracking data (cookies captured at checkout)
    const adTracking = order.ad_tracking;

    // Build conversion data with proper type handling
    const orderTotal =
      typeof order.total === 'string'
        ? Number.parseFloat(order.total)
        : order.total;

    const currency = await resolveConversionCurrency(
      supabase,
      merchantId,
      order
    );

    const orderConversionData: OrderConversionData = {
      orderId: order.id,
      orderNumber,
      total: orderTotal || 0,
      currency,
      customerEmail: order.customer_email ?? undefined,
      customerPhone: order.customer_phone ?? undefined,
      customerName: order.customer_name ?? undefined,
      customerId: order.customer_id ?? undefined,
      customerCity: order.shipping_address?.city,
      customerState: order.shipping_address?.state,
      customerZip:
        order.shipping_address?.zip || order.shipping_address?.postal_code,
      customerCountry: order.shipping_address?.country,
      items: toConversionItems(order, options),
      // Ad tracking IDs for attribution
      fbclid: (adTracking?.fbclid as string) ?? undefined,
      fbp: (adTracking?.fbp as string) ?? undefined,
      ttp: (adTracking?.ttp as string) ?? undefined,
      gclid: (adTracking?.gclid as string) ?? undefined,
      sccid: (adTracking?.sccid as string) ?? undefined,
      gaClientId: (adTracking?.gaClientId as string) ?? undefined,
      // Enhanced matching for better Event Match Quality (EMQ)
      userIp: (adTracking?.userIp as string) ?? undefined,
      userAgent: (adTracking?.userAgent as string) ?? undefined,
      // Event deduplication ID
      eventId: (adTracking?.eventId as string) ?? undefined,
      // Privacy compliance (CCPA/GDPR)
      limitedDataUse: (adTracking?.limitedDataUse as boolean) ?? undefined,
    };

    // Send conversion and log results
    const results = await sendPurchaseConversion(
      analyticsConfig,
      orderConversionData
    );
    logConversionResults(orderNumber, results);

    logger.info({
      message: 'Offline conversion tracking completed',
      orderId: order.id,
      orderNumber,
      platforms: results.filter((r) => r.success).map((r) => r.platform),
    });
  } catch (error) {
    logger.error({
      message: 'Offline conversion tracking failed',
      orderId: order.id,
      orderNumber,
      error,
    });
    // Re-throw for callers that want to handle errors
    throw error;
  }
}
