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

async function checkImages() {
    // Get a few products with images
    const { data, error } = await supabase
        .from('products')
        .select('id, name, images')
        .eq('category', 'Video Games')
        .not('images', 'is', null)
        .limit(5);

    if (error) {
        console.error('❌ Query failed:', error.message);
        process.exit(1);
    }

    if (!data) {
        console.error('❌ No data returned');
        process.exit(1);
    }

    console.log('Sample Products with Images:');
    data.forEach(p => {
        console.log(`\n${p.name}:`);
        console.log(`  ID: ${p.id}`);
        console.log(`  Images: ${JSON.stringify(p.images)}`);
    });
}

checkImages().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
