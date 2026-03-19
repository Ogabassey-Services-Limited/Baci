import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import { getMerchantForApiRequest } from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

/**
 * Platform Settings API
 *
 * GET - Retrieve platform settings (admin only)
 * PUT - Update platform settings (admin only)
 */

export interface PlatformSettings {
  id: string;
  // Analytics
  google_analytics_id: string | null;
  ga4_api_secret: string | null;
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  snapchat_pixel_id: string | null;
  snapchat_capi_token: string | null;
  twitter_pixel_id: string | null;
  // Fees
  platform_fee_percentage: number;
  platform_fee_flat: number;
  payment_processor_fee_percentage: number;
  payment_processor_fee_flat: number;
  // Branding
  platform_name: string;
  platform_logo_url: string | null;
  support_email: string | null;
  support_phone: string | null;
  // Feature Flags
  enable_merchant_signups: boolean;
  enable_custom_domains: boolean;
  enable_analytics_export: boolean;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

async function checkPlatformAdmin(supabase: ReturnType<typeof createClient>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, error: 'Unauthorized' };
  }

  const merchantContext = await getMerchantForApiRequest(supabase, user.id);
  if (!merchantContext) {
    return {
      isAdmin: false,
      error: 'Forbidden - Platform admin access required',
    };
  }

  // Admin routes require being the merchant owner, not staff
  if (merchantContext.staffAccess.isStaff) {
    return { isAdmin: false, error: 'Permission denied' };
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('is_platform_admin')
    .eq('id', merchantContext.merchantId)
    .maybeSingle();

  if (!merchant?.is_platform_admin) {
    return {
      isAdmin: false,
      error: 'Forbidden - Platform admin access required',
    };
  }

  return { isAdmin: true, error: null };
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check admin access
    const { isAdmin, error } = await checkPlatformAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json(
        { error },
        { status: error === 'Unauthorized' ? 401 : 403 }
      );
    }

    // Get platform settings (singleton row)
    const { data: settings, error: settingsError } = await supabase
      .from('platform_settings')
      .select('*')
      .single();

    if (settingsError) {
      console.error('Failed to fetch platform settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Platform settings GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Check admin access
    const { isAdmin, error } = await checkPlatformAdmin(supabase);
    if (!isAdmin) {
      return NextResponse.json(
        { error },
        { status: error === 'Unauthorized' ? 401 : 403 }
      );
    }

    const body = await request.json();

    // Validate and sanitize input
    const allowedFields = [
      'google_analytics_id',
      'ga4_api_secret',
      'facebook_pixel_id',
      'facebook_capi_token',
      'tiktok_pixel_id',
      'tiktok_access_token',
      'snapchat_pixel_id',
      'snapchat_capi_token',
      'twitter_pixel_id',
      'platform_fee_percentage',
      'platform_fee_flat',
      'payment_processor_fee_percentage',
      'payment_processor_fee_flat',
      'platform_name',
      'platform_logo_url',
      'support_email',
      'support_phone',
      'enable_merchant_signups',
      'enable_custom_domains',
      'enable_analytics_export',
      'maintenance_mode',
      'maintenance_message',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    // Validate numeric fields
    const numericFields = [
      'platform_fee_percentage',
      'platform_fee_flat',
      'payment_processor_fee_percentage',
      'payment_processor_fee_flat',
    ];
    for (const field of numericFields) {
      if (field in updateData) {
        const value = Number(updateData[field]);
        if (Number.isNaN(value) || value < 0) {
          return NextResponse.json(
            { error: `${field} must be a non-negative number` },
            { status: 400 }
          );
        }
        updateData[field] = value;
      }
    }

    // Validate boolean fields
    const booleanFields = [
      'enable_merchant_signups',
      'enable_custom_domains',
      'enable_analytics_export',
      'maintenance_mode',
    ];
    for (const field of booleanFields) {
      if (field in updateData && typeof updateData[field] !== 'boolean') {
        return NextResponse.json(
          { error: `${field} must be a boolean` },
          { status: 400 }
        );
      }
    }

    // Validate email format
    if (
      'support_email' in updateData &&
      updateData.support_email &&
      typeof updateData.support_email === 'string'
    ) {
      // Email validation with length limit to prevent ReDoS
      const email = updateData.support_email;
      const isValidEmail =
        email.length <= 254 &&
        email.includes('@') &&
        email.indexOf('@') > 0 &&
        email.lastIndexOf('.') > email.indexOf('@') + 1 &&
        !/\s/.test(email);
      if (!isValidEmail) {
        return NextResponse.json(
          { error: 'support_email must be a valid email address' },
          { status: 400 }
        );
      }
    }

    // Update platform settings
    const { data: settings, error: updateError } = await supabase
      .from('platform_settings')
      .update(updateData)
      .eq('singleton_key', true)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update platform settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Platform settings PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
