// Verification script to show HP/Dell laptop specs
// Run with: npx tsx scripts/verify-hp-dell-specs.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySpecs() {
    console.log('🔍 Verifying HP/Dell Laptop Specs\n');
    console.log('=' .repeat(80) + '\n');

    // Get HP/Dell laptops with their specs
    const { data: products, error: pError } = await supabase
        .from('products')
        .select('id, name, brand, category')
        .ilike('category', '%laptop%')
        .or('brand.ilike.%hp%,brand.ilike.%dell%')
        .order('brand', { ascending: true })
        .order('name', { ascending: true });

    if (pError || !products) {
        console.error('❌ Error fetching products:', pError);
        return;
    }

    console.log(`Found ${products.length} HP/Dell laptops\n`);

    let withSpecs = 0;
    let withoutSpecs = 0;

    for (const product of products) {
        const { data: specs } = await supabase
            .from('product_key_specs')
            .select('*')
            .eq('product_id', product.id)
            .single();

        if (specs) {
            withSpecs++;
            console.log(`✅ ${product.brand} - ${product.name}`);
            console.log(`   Screen: ${specs.screen_size_inches}" ${specs.display_type} ${specs.display_resolution} @ ${specs.refresh_rate_hz}Hz`);
            console.log(`   Processor: ${specs.chipset}`);
            console.log(`   GPU: ${specs.gpu}`);
            console.log(`   Memory: ${specs.ram_gb}GB RAM, ${specs.storage_gb}GB Storage`);
            console.log(`   Battery: ${specs.battery_mah}mAh (${Math.round(specs.battery_mah * 11.4 / 1000)}Wh)`);
            console.log(`   Weight: ${specs.weight_g}g`);
            if (specs.fingerprint_type) {
                console.log(`   Fingerprint: ${specs.fingerprint_type}`);
            }
            console.log('');
        } else {
            withoutSpecs++;
            console.log(`❌ ${product.brand} - ${product.name} (NO SPECS)`);
            console.log('');
        }
    }

    console.log('=' .repeat(80));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ With specs: ${withSpecs}`);
    console.log(`   ❌ Without specs: ${withoutSpecs}`);
    console.log(`   📝 Total: ${products.length}`);
    console.log(`   📈 Coverage: ${((withSpecs / products.length) * 100).toFixed(1)}%\n`);
}

verifySpecs().catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
