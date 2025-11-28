import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { UpdatePreferencesInput } from '@/types/notifications';

/**
 * GET /api/notifications/preferences
 * Get the current merchant's notification preferences
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Authentication check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Fetch preferences
    const { data: preferences, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('merchant_id', merchant.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching preferences:', error);
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }

    // Return default preferences if none exist
    if (!preferences) {
      return NextResponse.json({
        merchant_id: merchant.id,
        in_app_enabled: true,
        banner_enabled: true,
        quiet_hours_start: null,
        quiet_hours_end: null,
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

    // Authentication check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    // Parse request body
    const body: UpdatePreferencesInput = await request.json();

    // Build update object
    const updates: Record<string, unknown> = {
      merchant_id: merchant.id, // For upsert
    };

    if (body.in_app_enabled !== undefined) updates.in_app_enabled = body.in_app_enabled;
    if (body.banner_enabled !== undefined) updates.banner_enabled = body.banner_enabled;
    if (body.quiet_hours_start !== undefined) updates.quiet_hours_start = body.quiet_hours_start;
    if (body.quiet_hours_end !== undefined) updates.quiet_hours_end = body.quiet_hours_end;

    // Upsert preferences (create if not exists, update if exists)
    const { data: updated, error: updateError } = await supabase
      .from('notification_preferences')
      .upsert(updates, { onConflict: 'merchant_id' })
      .select()
      .single();

    if (updateError) {
      console.error('Error updating preferences:', updateError);
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
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
