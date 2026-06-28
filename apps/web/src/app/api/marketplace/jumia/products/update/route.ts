import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkCsrfProtection } from '@/lib/csrf';
import { JumiaClient } from '@/lib/jumia/client';
import { updatePrice, updateStatus } from '@/lib/jumia/feeds';
import { JumiaApiError } from '@/lib/jumia/helpers';
import { logger } from '@/lib/logger';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { createClient } from '@/lib/supabase/server';

/** Strict ISO 8601 date or datetime: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS with optional offset/Z */
const isoDateRegex =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)?)?$/;

/** Verify the date portion represents a real calendar date (rejects e.g. Feb 31). */
function isValidCalendarDate(v: string): boolean {
  const datePart = v.split('T')[0];
  const [yearStr, monthStr, dayStr] = datePart.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() + 1 === month &&
    d.getUTCDate() === day
  );
}

interface SalePriceResult {
  value: number;
  startAt: string | null;
  endAt: string | null;
}

/** Resolve the sale-price payload for a Jumia price feed. */
function resolveSalePrice(
  overrides: {
    jumia_sale_price?: number | null;
    jumia_sale_start?: string | null;
    jumia_sale_end?: string | null;
  },
  mapping: {
    jumia_sale_price: number | null;
    jumia_sale_start: string | null;
    jumia_sale_end: string | null;
  }
): SalePriceResult | undefined {
  // Explicit sale price in overrides
  if (
    Object.hasOwn(overrides, 'jumia_sale_price') &&
    overrides.jumia_sale_price != null
  ) {
    return {
      value: overrides.jumia_sale_price,
      startAt: Object.hasOwn(overrides, 'jumia_sale_start')
        ? (overrides.jumia_sale_start ?? null)
        : (mapping.jumia_sale_start ?? null),
      endAt: Object.hasOwn(overrides, 'jumia_sale_end')
        ? (overrides.jumia_sale_end ?? null)
        : (mapping.jumia_sale_end ?? null),
    };
  }
  // Sale price cleared explicitly
  if (
    Object.hasOwn(overrides, 'jumia_sale_price') &&
    overrides.jumia_sale_price == null
  ) {
    return undefined;
  }
  // Only dates changed — use existing sale price if available
  if (
    (Object.hasOwn(overrides, 'jumia_sale_start') ||
      Object.hasOwn(overrides, 'jumia_sale_end')) &&
    mapping.jumia_sale_price != null
  ) {
    return {
      value: mapping.jumia_sale_price,
      startAt: Object.hasOwn(overrides, 'jumia_sale_start')
        ? (overrides.jumia_sale_start ?? null)
        : (mapping.jumia_sale_start ?? null),
      endAt: Object.hasOwn(overrides, 'jumia_sale_end')
        ? (overrides.jumia_sale_end ?? null)
        : (mapping.jumia_sale_end ?? null),
    };
  }
  return undefined;
}

const UpdateSchema = z.object({
  productId: z.uuid(),
  integrationId: z.uuid(),
  overrides: z
    .object({
      jumia_price: z.number().positive().optional(),
      jumia_sale_price: z.number().positive().nullable().optional(),
      jumia_sale_start: z
        .string()
        .regex(isoDateRegex, 'Must be YYYY-MM-DD or ISO 8601 datetime')
        .refine(isValidCalendarDate, {
          error: 'Calendar-invalid date (e.g. Feb 31)',
        })
        .nullable()
        .optional(),
      jumia_sale_end: z
        .string()
        .regex(isoDateRegex, 'Must be YYYY-MM-DD or ISO 8601 datetime')
        .refine(isValidCalendarDate, {
          error: 'Calendar-invalid date (e.g. Feb 31)',
        })
        .nullable()
        .optional(),
      is_active: z.boolean().optional(),
    })
    .refine(
      (o) => {
        const hasStart = Object.hasOwn(o, 'jumia_sale_start');
        const hasEnd = Object.hasOwn(o, 'jumia_sale_end');
        // If one is provided, the other must be too
        if (hasStart !== hasEnd) return false;
        return true;
      },
      {
        error:
          'Both jumia_sale_start and jumia_sale_end must be provided together',
      }
    )
    .refine(
      (o) => {
        if (o.jumia_sale_start && o.jumia_sale_end) {
          return new Date(o.jumia_sale_start) < new Date(o.jumia_sale_end);
        }
        return true;
      },
      {
        error: 'jumia_sale_start must be before jumia_sale_end',
      }
    ),
});

export async function POST(request: NextRequest) {
  try {
    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { productId, integrationId, overrides } = parsed.data;

    // Get merchant ID from user context
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError) {
      if (merchantError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Merchant not found' },
          { status: 404 }
        );
      }
      logger.error({
        message: 'Failed to query merchant',
        error: merchantError,
      });
      return NextResponse.json(
        { error: 'Failed to look up merchant' },
        { status: 500 }
      );
    }

    const merchantId = merchant.id;

    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    // Verify product mapping exists and belongs to this merchant
    const { data: mapping, error: mappingError } = await supabase
      .from('jumia_product_mappings')
      .select(
        'id, product_id, jumia_sku, jumia_product_id, jumia_price, jumia_sale_price, jumia_sale_start, jumia_sale_end, is_active'
      )
      .eq('product_id', productId)
      .eq('merchant_id', merchantId)
      .single();

    if (mappingError || !mapping) {
      return NextResponse.json(
        { error: 'Jumia mapping not found' },
        { status: 404 }
      );
    }

    // Initialize Jumia client BEFORE any DB mutations.
    // forIntegration enforces merchant ownership by querying with both merchant_id and id.
    let client: JumiaClient;
    try {
      client = await JumiaClient.forIntegration(
        supabase,
        merchantId,
        integrationId
      );
    } catch (err: unknown) {
      if (err instanceof JumiaApiError && err.status === 404) {
        return NextResponse.json(
          { error: `Jumia integration not found: ${integrationId}` },
          { status: 404 }
        );
      }
      throw err;
    }

    // Update local mapping (include sale fields if provided)
    const mappingUpdate: Record<string, unknown> = {
      jumia_price: overrides.jumia_price ?? mapping.jumia_price,
      is_active: overrides.is_active ?? mapping.is_active,
      updated_at: new Date().toISOString(),
    };
    if (Object.hasOwn(overrides, 'jumia_sale_price')) {
      mappingUpdate.jumia_sale_price = overrides.jumia_sale_price;
    }
    if (Object.hasOwn(overrides, 'jumia_sale_start')) {
      mappingUpdate.jumia_sale_start = overrides.jumia_sale_start;
    }
    if (Object.hasOwn(overrides, 'jumia_sale_end')) {
      mappingUpdate.jumia_sale_end = overrides.jumia_sale_end;
    }

    const { error: updateError } = await supabase
      .from('jumia_product_mappings')
      .update(mappingUpdate)
      .eq('id', mapping.id)
      .eq('merchant_id', merchantId);

    if (updateError) {
      logger.error({
        message: 'Local mapping update failed',
        error: updateError,
      });
      return NextResponse.json(
        { error: 'Failed to update local mapping' },
        { status: 500 }
      );
    }

    const feedIds: string[] = [];
    const feedErrors: string[] = [];

    // Push status update if changed
    if (Object.hasOwn(overrides, 'is_active')) {
      if (!mapping.jumia_product_id) {
        feedErrors.push(
          'Status update skipped: product has not been assigned a Jumia product ID yet (feed may still be processing)'
        );
      } else {
        try {
          const statusFeedId = await updateStatus(client, [
            {
              id: mapping.jumia_product_id,
              sellerSku: mapping.jumia_sku,
              status: overrides.is_active ? 'active' : 'inactive',
            },
          ]);
          feedIds.push(statusFeedId);
        } catch (err) {
          logger.error({ message: 'Jumia status feed failed', error: err });
          feedErrors.push(
            `Status update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          );
        }
      }
    }

    // Push price update if provided (use `in` check so null values still trigger the block)
    if (
      Object.hasOwn(overrides, 'jumia_price') ||
      Object.hasOwn(overrides, 'jumia_sale_price') ||
      Object.hasOwn(overrides, 'jumia_sale_start') ||
      Object.hasOwn(overrides, 'jumia_sale_end')
    ) {
      if (!mapping.jumia_product_id) {
        feedErrors.push(
          'Price update skipped: product has not been assigned a Jumia product ID yet (feed may still be processing)'
        );
      } else {
        const resolvedPrice = overrides.jumia_price ?? mapping.jumia_price;
        if (resolvedPrice == null) {
          feedErrors.push(
            'Price update skipped: no price available (override or existing)'
          );
        } else {
          try {
            const priceFeedId = await updatePrice(client, [
              {
                id: mapping.jumia_product_id,
                sellerSku: mapping.jumia_sku,
                price: {
                  value: resolvedPrice,
                  // TODO: Nigeria-pilot only — parameterise when expanding to other countries
                  currency: 'NGN',
                  salePrice: resolveSalePrice(overrides, mapping),
                },
              },
            ]);
            feedIds.push(priceFeedId);
          } catch (err) {
            logger.error({ message: 'Jumia price feed failed', error: err });
            feedErrors.push(
              `Price update failed: ${err instanceof Error ? err.message : 'Unknown error'}`
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: feedErrors.length === 0,
      feedIds,
      ...(feedErrors.length > 0 && { errors: feedErrors }),
    });
  } catch (error) {
    logger.error({ message: 'Update Jumia Product Error', error });
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update Jumia product',
      },
      { status: 500 }
    );
  }
}
