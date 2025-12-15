import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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

fixNames();
