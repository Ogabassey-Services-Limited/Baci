import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  getPaypalClientId,
  readPaypalFeatureConfig,
} from '@/lib/payments/paypal-checkout-credentials';
import { createAdminClient } from '@/lib/supabase/admin';
import { paypalClientTokenSchema } from '@/schemas/paypal-checkout';

const NOT_CONFIGURED_MESSAGE =
  'PayPal is not configured or enabled for this merchant';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedBody = paypalClientTokenSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'merchant_id is required' },
        { status: 400 }
      );
    }

    const merchantId = parsedBody.data.merchant_id;
    const supabase = createAdminClient();

    const { data: featureSettings, error: featuresError } = await supabase
      .from('merchant_feature_settings')
      .select('custom_settings')
      .eq('merchant_id', merchantId)
      .single();

    if (featuresError || !featureSettings) {
      return NextResponse.json(
        { error: 'Merchant settings not found' },
        { status: 404 }
      );
    }

    const { enabled, mode, environment } = readPaypalFeatureConfig(
      featureSettings.custom_settings as Record<string, unknown> | null
    );

    if (!enabled) {
      return NextResponse.json(
        { error: NOT_CONFIGURED_MESSAGE, code: 'PAYPAL_NOT_CONFIGURED' },
        { status: 400 }
      );
    }

    // The client_id is browser-safe but still lives only in the vault now
    // (Phase 2.2) — never in custom_settings. Fail closed on a vault miss.
    const clientId = await getPaypalClientId(merchantId, environment);
    if (!clientId) {
      return NextResponse.json(
        { error: NOT_CONFIGURED_MESSAGE, code: 'PAYPAL_NOT_CONFIGURED' },
        { status: 400 }
      );
    }

    return NextResponse.json({ clientId, mode });
  } catch (error) {
    logger.error({
      message: 'PayPal client token API error',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
