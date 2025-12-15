import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNames() {
    console.log('Fixing iPhone Air names...');

    // Find iPhone 17 Air products
    const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', '%iPhone 17 Air%');

    console.log(`Found ${products?.length || 0} products to rename.`);

    for (const p of products || []) {
        const newName = p.name.replace('iPhone 17 Air', 'iPhone Air');
        console.log(`Renaming: "${p.name}" -> "${newName}"`);

        await supabase
            .from('products')
            .update({ name: newName })
            .eq('id', p.id);
    }

    console.log('Done.');
}

fixNames().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
