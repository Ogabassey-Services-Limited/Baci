import * as fs from 'node:fs';
import * as path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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
verify().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
