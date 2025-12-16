
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
    const { data: products } = await supabase
        .from('products')
        .select('id, name, slug, condition')
        .ilike('brand', 'Samsung')
        .or('images.is.null,images.eq.[]')
        .neq('status', 'archived');

    if (!products) return;

    console.log(`Found ${products.length} missing Samsung images.`);

    // Categorize
    const current = [];
    const future = [];

    const futureKeywords = ['Fold 7', 'Flip 7', 'Watch 8', 'S25', 'Tab S10', 'A16', 'A26', 'A36', 'A56']; // Guesses

    for (const p of products) {
        const isFuture = futureKeywords.some(k => p.name.includes(k));
        if (isFuture) {
            future.push(p.name);
        } else {
            current.push(p.name);
        }
    }

    console.log('\n🔮 Future/Unreleased Products:', future.length);
    future.forEach(n => console.log(`   - ${n}`));

    console.log('\n📦 Current Products:', current.length);
    current.forEach(n => console.log(`   - ${n}`));
}

run().catch(console.error);
