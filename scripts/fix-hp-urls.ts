import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const matches = JSON.parse(fs.readFileSync('hp_matched_images.json', 'utf-8'));

async function fixUrls() {
    console.log(`🔧 Fixing URLs for ${matches.length} products...`);

    for (const match of matches) {
        const id = match.supabaseId;
        const correctUrl = `https://cdn.ogabassey.com/products/${id}.png`;

        const { error } = await supabase
            .from('products')
            .update({
                images: [correctUrl],
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        if (error) {
            console.error(`❌ ${match.ourProductName}: ${error.message}`);
        } else {
            console.log(`✅ ${match.ourProductName}`);
        }
    }

    console.log('\n🎉 URL Fix Complete!');
}

fixUrls();
