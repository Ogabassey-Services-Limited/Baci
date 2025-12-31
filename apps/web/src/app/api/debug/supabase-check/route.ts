import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/debug/supabase-check
 * 
 * Temporary debug endpoint to verify Supabase connection and Credit Direct status
 * DELETE THIS AFTER DEBUGGING
 */
export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET';

        const supabase = createAdminClient();

        // Get merchant
        const { data: merchant, error: merchantError } = await supabase
            .from('merchants')
            .select('id, slug')
            .eq('slug', 'ogabassey')
            .single();

        if (merchantError || !merchant) {
            return NextResponse.json({
                supabase_url: supabaseUrl,
                error: 'Merchant not found',
                merchantError,
            });
        }

        // Get feature settings
        const { data: settings, error: settingsError } = await supabase
            .from('merchant_feature_settings')
            .select('credit_direct_enabled, credit_direct_public_key, credit_direct_min_amount, credit_direct_max_amount')
            .eq('merchant_id', merchant.id)
            .maybeSingle();

        return NextResponse.json({
            supabase_url: supabaseUrl,
            merchant_id: merchant.id,
            merchant_slug: merchant.slug,
            credit_direct_enabled: settings?.credit_direct_enabled ?? false,
            credit_direct_public_key: settings?.credit_direct_public_key ? 'SET' : 'NOT SET',
            settings_found: !!settings,
            settingsError,
        });
    } catch (error) {
        return NextResponse.json({
            error: 'Debug check failed',
            message: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}
