import { z } from 'zod';
import type { StepExecutor } from '@/lib/payments/apply-paid-order-side-effects';
import type {
  PaidOrderSideEffectTransaction,
  ServiceRoleClient,
} from '@/lib/payments/paid-order-side-effect-types';
import { toNumber } from '@/lib/payments/paid-order-side-effect-utils';
import { extractVerifiedGatewayFeeNgn } from '@/lib/payments/verified-gateway-fee';
import { calculatePlatformFee } from '@/lib/paystack';
import { moneyInputSchema } from '@/schemas/paid-order-side-effects';

const KOBO_PER_NAIRA = 100;

const settlementGrossAmountSchema = z.union([
  z.number().finite().nonnegative(),
  z
    .string()
    .regex(/^\+?\d+(?:\.\d+)?$/, {
      error: 'must be a valid non-negative settlement amount',
    })
    .transform(Number)
    .pipe(z.number().finite().nonnegative()),
]);

const settlementArgsSchema = z.object({
  allocatedGatewayFeeNgn: z.number().finite().min(0).optional(),
  externalGatewayReference: z.string().trim().min(1),
  settlementGateway: z.enum(['juicyway', 'korapay', 'paystack']),
  supabase: z.custom<ServiceRoleClient>(
    (value) =>
      value !== null &&
      typeof value === 'object' &&
      typeof (value as { rpc?: unknown }).rpc === 'function'
  ),
  transaction: z.looseObject({
    amount: settlementGrossAmountSchema,
    gateway_reference: z.string().nullable().optional(),
    merchant_id: z.string().trim().min(1),
    order_id: z.string().trim().min(1),
    platform_fee: moneyInputSchema.nullish(),
  }),
});

function throwSettlementRpcError(error: unknown): never {
  if (error instanceof Error) {
    throw error;
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    const wrapped = new Error((error as { message: string }).message);
    Object.assign(wrapped, { cause: error });
    throw wrapped;
  }
  throw new Error(String(error));
}

export function buildSettlementExecutor(args: {
  allocatedGatewayFeeNgn?: number;
  externalGatewayReference: string;
  settlementGateway: 'juicyway' | 'korapay' | 'paystack';
  supabase: ServiceRoleClient;
  transaction: PaidOrderSideEffectTransaction;
}): StepExecutor {
  const parsedArgs = settlementArgsSchema.safeParse(args);
  if (!parsedArgs.success) {
    throw new Error(
      `invalid_settlement_executor_args: ${JSON.stringify(z.flattenError(parsedArgs.error))}`
    );
  }
  const validatedArgs = parsedArgs.data;

  return async (ctx) => {
    const grossAmount = toNumber(
      validatedArgs.transaction.amount,
      'transaction amount'
    );
    if (grossAmount <= 0) {
      throw new Error('Settlement amount must be positive');
    }
    const gatewayFee =
      validatedArgs.settlementGateway === 'juicyway'
        ? 0
        : (validatedArgs.allocatedGatewayFeeNgn ??
          extractVerifiedGatewayFeeNgn(
            validatedArgs.settlementGateway,
            ctx.gatewayResponse
          ));
    if (!Number.isFinite(gatewayFee) || gatewayFee < 0) {
      throw new Error('Invalid gateway fee');
    }

    const unroundedGrossAmountKobo = grossAmount * KOBO_PER_NAIRA;
    const grossAmountKobo = Math.round(unroundedGrossAmountKobo);
    const gatewayFeeKobo = Math.round(gatewayFee * KOBO_PER_NAIRA);
    const platformFeeKobo =
      validatedArgs.transaction.platform_fee == null
        ? validatedArgs.settlementGateway === 'juicyway'
          ? 0
          : Math.round(
              calculatePlatformFee(unroundedGrossAmountKobo).platformFee
            )
        : Math.round(
            toNumber(
              validatedArgs.transaction.platform_fee,
              'transaction platform fee'
            ) * KOBO_PER_NAIRA
          );
    if (!Number.isFinite(platformFeeKobo) || platformFeeKobo < 0) {
      throw new Error('Invalid platform fee');
    }
    if (gatewayFeeKobo + platformFeeKobo > grossAmountKobo) {
      throw new Error(
        `Settlement fees exceed gross amount: gatewayFee=${gatewayFeeKobo / KOBO_PER_NAIRA}, platformFee=${platformFeeKobo / KOBO_PER_NAIRA}, grossAmount=${grossAmountKobo / KOBO_PER_NAIRA}`
      );
    }

    const normalizedGrossAmount = grossAmountKobo / KOBO_PER_NAIRA;
    const normalizedGatewayFee = gatewayFeeKobo / KOBO_PER_NAIRA;
    const platformFee = platformFeeKobo / KOBO_PER_NAIRA;

    const { error } = await validatedArgs.supabase.rpc(
      'record_merchant_settlement',
      {
        p_description: `Order payment via ${validatedArgs.settlementGateway}`,
        p_gateway: validatedArgs.settlementGateway,
        p_gateway_fee: normalizedGatewayFee,
        p_gateway_reference: validatedArgs.externalGatewayReference,
        p_gross_amount: normalizedGrossAmount,
        p_merchant_id: validatedArgs.transaction.merchant_id,
        p_metadata: {
          [`${validatedArgs.settlementGateway}_reference`]:
            validatedArgs.externalGatewayReference,
          verified_gateway_fee: normalizedGatewayFee,
        },
        p_platform_fee: platformFee,
        p_source_id: validatedArgs.transaction.order_id,
        p_source_type: 'order',
      }
    );
    if (error) throwSettlementRpcError(error);
    return {
      gateway_fee: normalizedGatewayFee,
      gross_amount: normalizedGrossAmount,
      platform_fee: platformFee,
    };
  };
}
