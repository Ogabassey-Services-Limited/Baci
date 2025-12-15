import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const CDN_BASE_URL = 'https://cdn.ogabassey.com/products';

async function deployDbUpdate() {
    console.log('🚀 Starting DB Update (No Upload)...');

    const appleDir = path.join(process.cwd(), 'apple_downloaded_images');

    // Fetch products
    const { data: appleProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .or('brand.ilike.Apple,name.ilike.%Apple%,name.ilike.%iPhone%,name.ilike.%MacBook%,name.ilike.%iPad%,name.ilike.%Watch%');

    if (productsError) {
        console.error('❌ Query failed:', productsError.message);
        process.exit(1);
    }

    if (!appleProducts) {
        console.error('❌ No products returned');
        process.exit(1);
    }

    console.log(`Found ${appleProducts.length} Apple products in DB.`);

    const appleFiles = fs.readdirSync(appleDir).filter(f => f.startsWith('branded_') && f.endsWith('.png'));

    for (const file of appleFiles) {
        const cleanName = file.replace('branded_', '').toLowerCase();

        let bestMatch = null;
        let maxScore = 0;

        // Exact same matching logic as deploy script
        const candidates = appleProducts.filter(p => {
            const lowerName = p.name.toLowerCase();
            if (cleanName.includes('iphone') && !lowerName.includes('iphone')) return false;
            if (cleanName.includes('macbook') && !lowerName.includes('macbook')) return false;
            if (cleanName.includes('ipad') && !lowerName.includes('ipad')) return false;
            if (cleanName.includes('watch') && !lowerName.includes('watch')) return false;
            return true;
        });

        for (const p of candidates) {
            let score = 0;
            const pName = p.name.toLowerCase();

            if (cleanName.includes('iphone-17') && pName.includes('17')) score += 20;
            if (cleanName.includes('iphone-16') && pName.includes('16')) score += 20;
            if (cleanName.includes('iphone-16e') && pName.includes('16e')) score += 25;
            if (cleanName.includes('iphone-air') && pName.includes('iphone air')) score += 25;

            if (cleanName.includes('pro max') && pName.includes('pro max')) score += 10;
            else if (cleanName.includes('pro') && !cleanName.includes('max') && pName.includes('pro') && !pName.includes('max')) score += 10;

            if (cleanName.includes('ipad') && pName.includes('ipad')) {
                if (cleanName.includes('air') && pName.includes('air')) score += 15;
                if (cleanName.includes('pro') && pName.includes('pro')) score += 15;
                if (cleanName.includes('mini') && pName.includes('mini')) score += 15;
                if (cleanName.includes('10th') && (pName.includes('10th') || pName.includes('10.9'))) score += 15;
            }

            if (cleanName.includes('watch') && pName.includes('watch')) score += 10;
            if (cleanName.includes('s11') && (pName.includes('series 11') || pName.includes('series 10'))) score += 5;

            if (cleanName.includes('macbook-air') && pName.includes('air')) score += 15;
            if (cleanName.includes('m4') && pName.includes('m4')) score += 5;

            const colors = ['silver', 'titanium', 'orange', 'blue', 'white', 'black', 'gold', 'gray', 'midnight', 'starlight', 'space gray', 'cloud white', 'light gold', 'sky blue'];
            for (const color of colors) {
                const cleanColor = color.replace(' ', '');
                if ((cleanName.includes(cleanColor) || cleanName.includes(color)) && pName.includes(color)) score += 5;
            }

            if (score > maxScore) { maxScore = score; bestMatch = p; }
        }

        if (bestMatch && maxScore >= 15) {
            console.log(`✅ MATCH: ${file} -> ${bestMatch.name}`);
            const publicUrl = `${CDN_BASE_URL}/${bestMatch.id}.png`;

            // Only update 'images', NOT 'image'
            const { error } = await supabase
                .from('products')
                .update({ images: [publicUrl] })
                .eq('id', bestMatch.id);

            if (error) console.error(`Failed ${bestMatch.id}:`, error.message);
            else console.log(`   Updated: ${publicUrl}`);
        }
    }
    console.log('Done.');
}

deployDbUpdate();
