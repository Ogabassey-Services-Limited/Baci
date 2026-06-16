/**
 * Push Token Registration API
 * Registers Expo push notification tokens for merchant mobile app
 *
 * POST /api/push-tokens/register
 * Body: { token: string, platform: 'ios' | 'android', device_name?: string, merchant_id?: string }
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

const RegisterTokenSchema = z.object({
  token: z.string().min(1, 'Push token is required'),
  platform: z.enum(['ios', 'android']),
  device_name: z.string().optional(),
  app_type: z.enum(['admin', 'storefront']).default('admin'),
  merchant_id: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = RegisterTokenSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'INVALID_REQUEST_BODY' },
        { status: 400 }
      );
    }

    const { token, platform, device_name, app_type, merchant_id } = parsed.data;

    const merchantContext = await getMerchantForApiRequest(supabase, user.id, {
      requestedMerchantId: merchant_id,
    });
    const resolvedMerchantId = merchantContext?.merchantId;

    if (!resolvedMerchantId) {
      return NextResponse.json(
        { error: 'No merchant found for this user' },
        { status: 404 }
      );
    }

    const { data: registeredTokenId, error: registerError } =
      await supabase.rpc('register_push_token', {
        p_app_type: app_type,
        p_device_name: device_name || null,
        p_merchant_id: resolvedMerchantId,
        p_platform: platform,
        p_token: token,
      });

    if (registerError || typeof registeredTokenId !== 'string') {
      console.error('Error registering push token:', registerError);
      return NextResponse.json(
        { error: 'Failed to register push token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Push token registered',
      token_id: registeredTokenId,
    });
  } catch (error) {
    console.error('Push token registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/push-tokens/register
 * Deactivate a push token (e.g., on logout)
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Token parameter required' },
        { status: 400 }
      );
    }

    // Deactivate the token (soft delete)
    const { error: updateError } = await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('token', token)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Error deactivating push token:', updateError);
      return NextResponse.json(
        { error: 'Failed to deactivate push token' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Push token deactivated',
    });
  } catch (error) {
    console.error('Push token deactivation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
