import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findTestProduct() {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, has_condition_offers')
        .eq('has_condition_offers', true)
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Test Product Found:');
        console.log(`Name: ${data[0].name}`);
        console.log(`Slug: ${data[0].slug}`);
        console.log(`URL: http://localhost:3000/products/${data[0].slug}`); // Approx URL structure
    } else {
        console.log('No product found with has_condition_offers = true');
    }
}

findTestProduct().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
