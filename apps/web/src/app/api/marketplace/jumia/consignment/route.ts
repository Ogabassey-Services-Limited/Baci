/**
 * Jumia Consignment (Express) API Route
 *
 * GET  — Retrieve consignment stock for a SKU
 * POST — Create a consignment order (send stock to Jumia warehouse)
 * PATCH — Update a consignment order (mark shipped, add tracking)
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import {
  JumiaApiError,
  JumiaClient,
  jumiaErrorResponse,
} from '@/lib/jumia/client';
import {
  createConsignmentOrder,
  getConsignmentStock,
  updateConsignmentOrder,
} from '@/lib/jumia/consignment';
import { logger } from '@/lib/logger';
import { requireMerchantFeatureAccess } from '@/lib/merchant-feature-gates';
import { sanitizeText } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';

/* ------------------------------------------------------------------ */
/*  Schemas                                                           */
/* ------------------------------------------------------------------ */

const GetQuerySchema = z.object({
  integrationId: z.uuid('integrationId must be a valid UUID'),
  sku: z.string().trim().min(1, 'sku is required'),
  businessClientCode: z
    .string()
    .trim()
    .min(1, 'businessClientCode is required'),
});

const ConsignmentProductSchema = z.object({
  sku: z.string().trim().min(1, 'sku is required'),
  quantity: z.int().positive('quantity must be a positive integer'),
  labelCode: z.string().trim().min(1, 'labelCode must not be empty').optional(),
});

/** Validates that a YYYY-MM-DD string is a real calendar date (rejects 2024-02-31, etc.) */
const strictDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
  .refine(
    (val) => {
      const d = new Date(`${val}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(val);
    },
    {
      error: 'Invalid calendar date',
    }
  );

const CreateConsignmentSchema = z.object({
  integrationId: z.uuid('integrationId must be a valid UUID'),
  businessClientCode: z
    .string()
    .trim()
    .min(1, 'businessClientCode is required'),
  shippingDate: strictDateString,
  products: z
    .array(ConsignmentProductSchema)
    .min(1, 'At least one product is required'),
  comment: z.string().optional(),
});

const UpdateConsignmentSchema = z.object({
  integrationId: z.uuid('integrationId must be a valid UUID'),
  purchaseOrderNumber: z
    .string()
    .trim()
    .min(1, 'purchaseOrderNumber is required'),
  isShipped: z.boolean().optional(),
  trackingNumber: z.string().optional(),
  actualDepartureDate: strictDateString.optional(),
  estimatedArrivalDate: strictDateString.optional(),
  deliveryAgentPhoneNumber: z.string().optional(),
  thirdPartyLogisticsName: z.string().optional(),
});

/* ------------------------------------------------------------------ */
/*  GET — Retrieve consignment stock for a SKU                        */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = GetQuerySchema.safeParse({
      integrationId: searchParams.get('integrationId'),
      sku: searchParams.get('sku'),
      businessClientCode: searchParams.get('businessClientCode'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: z.flattenError(parsed.error),
        },
        { status: 400 }
      );
    }

    const { integrationId, sku, businessClientCode } = parsed.data;
    const merchantId = merchantContext.merchantId;

    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    const jumiaClient = await JumiaClient.forIntegration(
      supabase,
      merchantId,
      integrationId
    );

    const stock = await getConsignmentStock(
      jumiaClient,
      businessClientCode,
      sku
    );

    return NextResponse.json(stock);
  } catch (error: unknown) {
    if (error instanceof JumiaApiError) {
      return jumiaErrorResponse(error);
    }
    logger.error({ message: 'Jumia Consignment GET Error', error });
    return NextResponse.json(
      { error: 'Failed to fetch consignment stock' },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST — Create a consignment order                                 */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = CreateConsignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const {
      integrationId,
      businessClientCode,
      shippingDate,
      products,
      comment,
    } = parsed.data;
    const merchantId = merchantContext.merchantId;

    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    const jumiaClient = await JumiaClient.forIntegration(
      supabase,
      merchantId,
      integrationId
    );

    const result = await createConsignmentOrder(jumiaClient, {
      shopId: jumiaClient.shopId,
      businessClientCode,
      shippingDate,
      products,
      comment: comment ? sanitizeText(comment, 500) : undefined,
    });

    return NextResponse.json({
      purchaseOrderNumber: result.purchaseOrderNumber,
    });
  } catch (error: unknown) {
    if (error instanceof JumiaApiError) {
      return jumiaErrorResponse(error);
    }
    logger.error({ message: 'Jumia Consignment POST Error', error });
    return NextResponse.json(
      { error: 'Failed to create consignment order' },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH — Update a consignment order                                */
/* ------------------------------------------------------------------ */

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'integrations', 'manage')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = UpdateConsignmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: z.flattenError(parsed.error) },
        { status: 400 }
      );
    }

    const { integrationId, purchaseOrderNumber, ...updates } = parsed.data;
    const merchantId = merchantContext.merchantId;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No update fields provided' },
        { status: 400 }
      );
    }

    const featureGateResponse = await requireMerchantFeatureAccess(
      supabase,
      merchantId,
      'marketplace_sync'
    );
    if (featureGateResponse) {
      return featureGateResponse;
    }

    const jumiaClient = await JumiaClient.forIntegration(
      supabase,
      merchantId,
      integrationId
    );

    // Sanitize user-supplied string fields before sending to Jumia
    const sanitizedUpdates = {
      ...updates,
      ...(typeof updates.trackingNumber === 'string' && {
        trackingNumber: sanitizeText(updates.trackingNumber, 200),
      }),
      ...(typeof updates.deliveryAgentPhoneNumber === 'string' && {
        deliveryAgentPhoneNumber: sanitizeText(
          updates.deliveryAgentPhoneNumber,
          50
        ),
      }),
      ...(typeof updates.thirdPartyLogisticsName === 'string' && {
        thirdPartyLogisticsName: sanitizeText(
          updates.thirdPartyLogisticsName,
          200
        ),
      }),
    };

    await updateConsignmentOrder(
      jumiaClient,
      purchaseOrderNumber,
      sanitizedUpdates
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof JumiaApiError) {
      return jumiaErrorResponse(error);
    }
    logger.error({ message: 'Jumia Consignment PATCH Error', error });
    return NextResponse.json(
      { error: 'Failed to update consignment order' },
      { status: 500 }
    );
  }
}
