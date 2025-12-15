import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const matches = JSON.parse(fs.readFileSync('migration_map.json', 'utf-8'));
const CDN_BASE = 'https://cdn.ogabassey.com/products';

async function updateDb() {
    console.log('🚀 Updating DB for', matches.length, 'products...');

    for (const match of matches) {
        const ext = match.oldFile.split('.').pop();
        const newUrl = `${CDN_BASE}/${match.supabaseSlug}.${ext}`;

        const { error } = await supabase
            .from('products')
            .update({
                images: [newUrl],
                updated_at: new Date().toISOString()
            })
            .eq('slug', match.supabaseSlug);

        if (error) {
            console.error(`❌ Failed to update ${match.supabaseSlug}:`, error);
        } else {
            console.log('✅ Updated', match.supabaseSlug, '->', newUrl);
        }
    }
}

updateDb().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
