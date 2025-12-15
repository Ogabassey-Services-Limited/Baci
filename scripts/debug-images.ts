import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkImages() {
    // Get a few products with images
    const { data } = await supabase
        .from('products')
        .select('id, name, images')
        .eq('category', 'Video Games')
        .not('images', 'is', null)
        .limit(5);

    console.log('Sample Products with Images:');
    data?.forEach(p => {
        console.log(`\n${p.name}:`);
        console.log(`  ID: ${p.id}`);
        console.log(`  Images: ${JSON.stringify(p.images)}`);
    });
}

checkImages();
