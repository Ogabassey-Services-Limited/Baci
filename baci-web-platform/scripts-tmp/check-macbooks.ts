import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMacBooks() {
    console.log('🚀 Checking MacBook Images...');

    const { data: products } = await supabase
        .from('products')
        .select('name, images')
        .ilike('name', '%macbook%');

    if (!products) return;

    for (const p of products) {
        const url = p.images?.[0];
        if (!url) {
            console.log(`❌ [MISSING] ${p.name}`);
            continue;
        }

        try {
            const res = await fetch(url, { method: 'HEAD' });
            if (res.status !== 200) {
                console.log(`❌ [${res.status}] ${p.name} - ${url}`);
            } else {
                console.log(`✅ [200] ${p.name}`);
            }
        } catch (e) {
            console.log(`❌ [ERROR] ${p.name} - ${e.message}`);
        }
    }
}

checkMacBooks();
