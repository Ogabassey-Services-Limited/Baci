
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectProblematicProducts() {
    console.log('Inspecting HP products...');

    // Search for the products seen in screenshot
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, images, merchant_id')
        .ilike('name', '%HP Color LaserJet%')
        .limit(5);

    if (error) {
        console.error('Error fetching products:', error);
        return;
    }

    console.log(`Found ${products.length} products.`);
    products.forEach(p => {
        console.log(`\nProduct: ${p.name}`);
        console.log('  images (value):', JSON.stringify(p.images, null, 2));
        // Check if it passes our filter
        const notNull = p.images !== null;
        const notEmpty = Array.isArray(p.images) && p.images.length > 0;
        console.log(`  Passes simple filter? ${notNull && notEmpty}`);
    });
}

inspectProblematicProducts();
