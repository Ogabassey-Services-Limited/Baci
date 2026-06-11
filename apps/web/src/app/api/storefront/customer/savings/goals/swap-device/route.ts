import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getCustomerSavingsFeatureSettings,
  resolveCustomerSavingsContext,
} from '@/app/api/storefront/customer/savings/shared';
import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { customerSavingsGoalDeviceSwapSchema } from '@/schemas/customer-savings';
import {
  mapSavingsRpcErrorStatus,
  toSavingsRouteNumber,
  toSavingsRpcError,
} from '../route-helpers';

const SAVINGS_DEVICE_PRODUCT_SELECT =
  'id, name, price, images, condition, variants:product_variants!product_variants_product_id_fkey(id, condition, sku, price_override, primary_image, images, attributes)';

const SavingsDeviceVariantSchema = z.object({
  attributes: z.record(z.string(), z.string()).nullable().optional(),
  condition: z.string().nullable().optional(),
  id: z.string(),
  images: z.array(z.string()).nullable().optional(),
  price_override: z.union([z.number(), z.string()]).nullable().optional(),
  primary_image: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
});

const SavingsDeviceProductSchema = z.object({
  condition: z.string().nullable().optional(),
  id: z.string(),
  images: z.array(z.string()).nullable().optional(),
  name: z.string(),
  price: z.union([z.number(), z.string()]),
  variants: z.array(SavingsDeviceVariantSchema).nullable().optional(),
});

type SavingsDeviceProduct = z.infer<typeof SavingsDeviceProductSchema>;
type SavingsDeviceVariant = z.infer<typeof SavingsDeviceVariantSchema>;

function formatVariantAxisLabel(axis: string) {
  const normalized = axis
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const labels: Record<string, string> = {
    ram: 'RAM',
    rom: 'ROM',
    sim_type: 'SIM Type',
    storage: 'Storage',
  };

  return (
    labels[normalized] ??
    normalized
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function getVariantLabel(variant: SavingsDeviceVariant | null) {
  if (!variant) {
    return null;
  }

  const parts = Object.entries(variant.attributes ?? {})
    .filter(([axis, value]) => axis !== 'color' && axis !== 'colour' && value)
    .map(([axis, value]) => `${formatVariantAxisLabel(axis)}: ${value}`);

  return parts.length > 0 ? parts.join(' · ') : variant.sku?.trim() || null;
}

function toPositiveAmount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getProductImage(
  product: SavingsDeviceProduct,
  variant: SavingsDeviceVariant | null
) {
  const variantImage =
    variant?.primary_image?.trim() || variant?.images?.[0]?.trim();
  return variantImage || product.images?.[0]?.trim() || null;
}

function buildProductSnapshot({
  product,
  targetAmount,
  variant,
}: {
  product: SavingsDeviceProduct;
  targetAmount: number;
  variant: SavingsDeviceVariant | null;
}) {
  return {
    condition: variant?.condition ?? product.condition ?? null,
    image: getProductImage(product, variant),
    name: product.name,
    price: targetAmount,
    variantLabel: getVariantLabel(variant),
  };
}

function readDeviceSwapRpcRow(data: unknown) {
  const row = Array.isArray(data) ? data[0] : null;
  if (typeof row !== 'object' || row === null) {
    return null;
  }

  const record = row as Record<string, unknown>;
  return typeof record.goal_id === 'string' &&
    typeof record.goal_status === 'string' &&
    typeof record.success === 'boolean'
    ? record
    : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { code: 'MALFORMED_JSON', error: 'Malformed JSON' },
        { status: 400 }
      );
    }

    const parsed = customerSavingsGoalDeviceSwapSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const resolved = await resolveCustomerSavingsContext({
      identifiers: parsed.data,
      supabase: auth.supabase,
      user: auth.user,
    });
    if ('response' in resolved) {
      return resolved.response;
    }

    const featureSettings = await getCustomerSavingsFeatureSettings({
      customerId: resolved.customer.id,
      merchantId: resolved.merchant.id,
      supabase: resolved.supabase,
    });
    if (!featureSettings.savingsEnabled) {
      return NextResponse.json(
        {
          code: 'CUSTOMER_SAVINGS_DISABLED',
          error: 'Customer savings is not enabled for this merchant',
        },
        { status: 403 }
      );
    }

    const productResult = await resolved.supabase
      .from('products')
      .select(SAVINGS_DEVICE_PRODUCT_SELECT)
      .eq('merchant_id', resolved.merchant.id)
      .eq('id', parsed.data.productId)
      .eq('status', 'active')
      .maybeSingle();
    if (productResult.error) {
      throw productResult.error;
    }

    const productValidation = SavingsDeviceProductSchema.safeParse(
      productResult.data
    );
    if (!productValidation.success) {
      return NextResponse.json(
        {
          code: 'SAVINGS_DEVICE_PRODUCT_NOT_FOUND',
          error: 'Savings device is not available',
        },
        { status: 404 }
      );
    }

    const product = productValidation.data;
    const variant = parsed.data.variantId
      ? ((product.variants ?? []).find(
          (candidate) => candidate.id === parsed.data.variantId
        ) ?? null)
      : null;
    if (parsed.data.variantId && !variant) {
      return NextResponse.json(
        {
          code: 'SAVINGS_DEVICE_VARIANT_NOT_FOUND',
          error: 'Savings device variant is not available',
        },
        { status: 404 }
      );
    }

    const targetAmount = toPositiveAmount(
      variant?.price_override ?? product.price
    );
    if (targetAmount === null) {
      return NextResponse.json(
        {
          code: 'SAVINGS_DEVICE_PRICE_INVALID',
          error: 'Savings device price is not available',
        },
        { status: 409 }
      );
    }

    const { data, error } = await resolved.supabase.rpc(
      'swap_customer_savings_goal_device',
      {
        p_actor_id: auth.user.id,
        p_customer_id: resolved.customer.id,
        p_goal_id: parsed.data.goalId,
        p_merchant_id: resolved.merchant.id,
        p_product_id: product.id,
        p_product_snapshot: buildProductSnapshot({
          product,
          targetAmount,
          variant,
        }),
        p_target_amount: targetAmount,
        p_title: product.name,
        p_variant_id: variant?.id ?? null,
      }
    );

    if (error) {
      const rpcError = toSavingsRpcError(error);
      const status = mapSavingsRpcErrorStatus(
        rpcError?.message ?? '',
        rpcError?.code
      );
      if (status === 500) {
        console.error('Failed to swap savings device', error);
      }
      return NextResponse.json(
        {
          code: rpcError?.code ?? 'SAVINGS_DEVICE_SWAP_FAILED',
          error:
            status === 500
              ? 'Failed to swap savings device'
              : (rpcError?.message ?? 'Failed to swap savings device'),
        },
        { status }
      );
    }

    const row = readDeviceSwapRpcRow(data);
    if (!row) {
      return NextResponse.json(
        { error: 'Failed to swap savings device' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      currentAmount: toSavingsRouteNumber(row.current_amount),
      goalId: row.goal_id,
      goalStatus: row.goal_status,
      success: row.success,
      targetAmount: toSavingsRouteNumber(row.target_amount),
    });
  } catch (error) {
    console.error('Failed to swap savings device', error);
    return NextResponse.json(
      { error: 'Failed to swap savings device' },
      { status: 500 }
    );
  }
}
