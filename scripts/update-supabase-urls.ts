import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const matches = JSON.parse(fs.readFileSync('migration_map.json', 'utf-8'));
const CDN_BASE = 'https://cdn.ogabassey.com/products';

async function updateDb() {
    console.log(`🚀 Updating DB for ${matches.length} products...`);

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
            console.log(`✅ Updated ${match.supabaseSlug} -> ${newUrl}`);
        }
    }
}

updateDb();
