import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { createClient } from '@/lib/supabase/server';

const timeStringSchema = z
  .string()
  .regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)')
  .nullable();

const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, 'Invalid IANA time zone');

const preferencesSchema = z
  .strictObject({
    in_app_enabled: z.boolean().optional(),
    banner_enabled: z.boolean().optional(),
    quiet_hours_start: timeStringSchema.optional(),
    quiet_hours_end: timeStringSchema.optional(),
    quiet_hours_time_zone: timeZoneSchema.optional(),
  })
  .refine(
    (data) => {
      const hasStart =
        data.quiet_hours_start !== null && data.quiet_hours_start !== undefined;
      const hasEnd =
        data.quiet_hours_end !== null && data.quiet_hours_end !== undefined;
      return hasStart === hasEnd; // Both set or both unset
    },
    {
      message: 'Both quiet hours start and end must be set together',
      path: ['quiet_hours_start'],
    }
  )
  .refine(
    (data) =>
      data.in_app_enabled !== undefined ||
      data.banner_enabled !== undefined ||
      data.quiet_hours_start !== undefined ||
      data.quiet_hours_end !== undefined ||
      data.quiet_hours_time_zone !== undefined,
    { message: 'At least one preference must be updated' }
  );

/**
 * GET /api/notifications/preferences
 * Get the current merchant's notification preferences
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authentication check
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;
    const access = toUserAccess(merchantContext);
    if (!hasPermission(access, 'dashboard', 'view')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Fetch preferences
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select(
        'id, merchant_id, in_app_enabled, banner_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_time_zone, updated_at'
      )
      .eq('merchant_id', merchantId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found
      console.error('Error fetching preferences:', error);
      return NextResponse.json(
        { error: 'Failed to fetch preferences' },
        { status: 500 }
      );
    }

    // Return default preferences if none exist
    if (!preferences) {
      return NextResponse.json({
        merchant_id: merchantId,
        in_app_enabled: true,
        banner_enabled: true,
        quiet_hours_start: null,
        quiet_hours_end: null,
        quiet_hours_time_zone: 'Africa/Lagos',
        updated_at: null,
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Preferences GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update the current merchant's notification preferences
 */
export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authenticate before evaluating CSRF so an unauthenticated request cannot
    // distinguish CSRF policy details from a protected endpoint.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant (supports both owners and staff)
    const merchantContext = await getMerchantForApiRequest(supabase, user.id);
    if (!merchantContext) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }
    const merchantId = merchantContext.merchantId;
    const patchAccess = toUserAccess(merchantContext);
    if (!hasPermission(patchAccess, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { valid: csrfValid, response: csrfResponse } =
      await checkCsrfProtection(request);
    if (!csrfValid) {
      return (
        csrfResponse ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    // Parse request body
    const json = await request.json();
    const validation = preferencesSchema.safeParse(json);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: z.flattenError(validation.error),
        },
        { status: 400 }
      );
    }

    const body = validation.data;

    // Build update object
    const updates: Record<string, unknown> = {
      merchant_id: merchantId, // For upsert
    };

    if (body.in_app_enabled !== undefined)
      updates.in_app_enabled = body.in_app_enabled;
    if (body.banner_enabled !== undefined)
      updates.banner_enabled = body.banner_enabled;
    if (body.quiet_hours_start !== undefined)
      updates.quiet_hours_start = body.quiet_hours_start;
    if (body.quiet_hours_end !== undefined)
      updates.quiet_hours_end = body.quiet_hours_end;
    if (body.quiet_hours_time_zone !== undefined)
      updates.quiet_hours_time_zone = body.quiet_hours_time_zone;

    // Upsert preferences (create if not exists, update if exists)
    const { data: updated, error: updateError } = await supabase
      .from('notification_preferences')
      .upsert(updates, { onConflict: 'merchant_id' })
      .select(
        'id, merchant_id, in_app_enabled, banner_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_time_zone, updated_at'
      )
      .single();

    if (updateError) {
      console.error('Error updating preferences:', updateError);
      return NextResponse.json(
        { error: 'Failed to update preferences' },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Preferences PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
