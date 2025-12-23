import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function setOgabasseyFavicon() {
    console.log('🎯 Setting ogabassey favicon URL...');

    const { data, error } = await supabase
        .from('merchants')
        .update({
            favicon_svg_url: 'https://usebaci.com/uploads/favicons/ogabassey.svg'
        })
        .eq('slug', 'ogabassey')
        .select('slug, favicon_svg_url');

    if (error) {
        console.error('❌ Failed to update:', error.message);
        process.exit(1);
    }

    console.log('✅ Updated successfully:', data);
}

setOgabasseyFavicon();
