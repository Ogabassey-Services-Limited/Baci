import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function enableBlog() {
    const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', 'ogabassey')
        .single();

    if (!merchant) {
        console.log('Merchant not found');
        return;
    }

    console.log('Merchant ID:', merchant.id);

    const { data: settings } = await supabase
        .from('merchant_feature_settings')
        .select('*')
        .eq('merchant_id', merchant.id)
        .single();

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
