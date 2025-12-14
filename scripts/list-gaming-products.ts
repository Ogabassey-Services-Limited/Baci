import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function listGaming() {
    console.log("Fetching categories...");
    const { data: categories, error: catError } = await supabase.from('products').select('category');
    if (catError) { console.error(catError); return; }

    const uniqueCats = [...new Set(categories?.map(p => p.category))];
    console.log("Found Categories:", uniqueCats);

    console.log("\nFetching Gaming Products...");
    // Try keywords: gaming, game, console, playstation, xbox, nintendo
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, category, brand')
        .or('category.ilike.%gaming%,category.ilike.%console%,name.ilike.%PS5%,name.ilike.%PlayStation%,name.ilike.%Xbox%');

    if (error) { console.error(error); return; }

    console.log(`Found ${products?.length} items:`);
    products?.forEach(p => console.log(`- [${p.id}] ${p.name} (${p.category})`));
}

listGaming();
