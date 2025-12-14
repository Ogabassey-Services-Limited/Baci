import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verify() {
    console.log('🔍 Verifying Google Pixel Import...\n');

    const { data: products, error } = await supabase
        .from('products')
        .select('name, price, metadata')
        .ilike('name', '%Google Pixel%')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ database error:', error.message);
        return;
    }

    if (!products || products.length === 0) {
        console.log('⚠️  No pixel products found!');
        return;
    }

    console.log(`✅ Found ${products.length} recent entries:\n`);
    products.forEach(p => {
        console.log(`📱 ${p.name}`);
        console.log(`   💰 ${p.price}`);
        console.log(`   ⚙️  ${JSON.stringify(p.metadata)}`);
        console.log('   -------------------');
    });
}
verify();
