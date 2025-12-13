import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function enableBlog() {
    const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', 'ogabassey')
        .single();

    if (merchantError) {
        console.error('Failed to fetch merchant:', merchantError.message);
        return;
    }

    if (!merchant) {
        console.log('Merchant not found');
        return;
    }

    console.log('Merchant ID:', merchant.id);

    const { data: settings, error: settingsError } = await supabase
        .from('merchant_feature_settings')
        .select('*')
        .eq('merchant_id', merchant.id)
        .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
        // PGRST116 = "JSON object requested, multiple (or no) rows returned"
        console.error('Failed to fetch settings:', settingsError.message);
        return;
    }

    console.log('Current settings:', settings);

    if (!settings) {
        const { error } = await supabase
            .from('merchant_feature_settings')
            .insert({ merchant_id: merchant.id, blog_enabled: true });

        if (error) console.error('Insert error:', error.message);
        else console.log('Created settings with blog enabled');
    } else {
        const { error } = await supabase
            .from('merchant_feature_settings')
            .update({ blog_enabled: true })
            .eq('merchant_id', merchant.id);

        if (error) console.error('Update error:', error.message);
        else console.log('Updated: blog_enabled = true');
    }
}

enableBlog();
