import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testImageFilter() {
    console.log('Use .not("images->0", "is", null) filter:');

    // Try to find products that PASS this filter (should have images)
    const { data: withImages, error: err1 } = await supabase
        .from('products')
        .select('id, name, images')
        .eq('merchant_id', '6b5cb8a4-5575-456c-b936-8cdfae30db74')
        .not('images->0', 'is', null)
        .limit(5);

    if (err1) {
        console.error('Filter failed:', err1);
    } else {
        console.log(`Found ${withImages?.length} products with images.`);
        withImages?.forEach(p => console.log(`  ${p.name}: images length ${(p.images as any[]).length}`));
    }

    console.log('\nUse .is("images->0", null) filter (should be empty):');
    const { data: noImages, error: err2 } = await supabase
        .from('products')
        .select('id, name, images')
        .eq('merchant_id', '6b5cb8a4-5575-456c-b936-8cdfae30db74')
        .is('images->0', null)
        .limit(5);

    if (err2) {
        console.error('Filter failed:', err2);
    } else {
        console.log(`Found ${noImages?.length} products seemingly WITHOUT images.`);
        noImages?.forEach(p => console.log(`  ${p.name}: images val ${JSON.stringify(p.images)}`));
    }
}

testImageFilter().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
