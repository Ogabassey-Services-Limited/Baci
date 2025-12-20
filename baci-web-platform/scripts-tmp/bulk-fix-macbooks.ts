import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GENERIC_PRO_URL = 'https://cdn.ogabassey.com/products/laptops/macbook-pro-m4-max-36gb-1tb-16-inch.avif';
const GENERIC_AIR_URL = 'https://cdn.ogabassey.com/products/laptops/macbook-air-generic.avif';

async function fixMissingMacBooks() {
    console.log('🚀 Fixing Missing MacBook Images...');

    const { data: products } = await supabase
        .from('products')
        .select('id, name, images')
        .ilike('name', '%macbook%');

    if (!products) return;

    for (const p of products) {
        const url = p.images?.[0];

        // Check if broken
        let isBroken = true;
        if (url) {
            try {
                const res = await fetch(url, { method: 'HEAD' });
                if (res.status === 200) isBroken = false;
            } catch (e) { }
        }

        if (isBroken) {
            console.log(`🔧 Fixing ${p.name}...`);

            const isAir = p.name.toLowerCase().includes('air');
            const newImage = isAir ? GENERIC_AIR_URL : GENERIC_PRO_URL;

            const { error } = await supabase
                .from('products')
                .update({ images: [newImage], image_hint: 'placeholder' })
                .eq('id', p.id);

            if (error) {
                console.error(`Failed to update ${p.name}: ${error.message}`);
            } else {
                console.log(`✅ Updated ${p.name} -> ${isAir ? 'Air Image' : 'Pro Image'}`);
            }
        }
    }
}

fixMissingMacBooks();
