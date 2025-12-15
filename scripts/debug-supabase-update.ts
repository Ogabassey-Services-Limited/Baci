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

async function debugUpdate() {
    const id = '28c7d364-aa21-4b3b-8624-d210fd83c965'; // Example failure ID
    const image = 'https://cdn.ogabassey.com/products/28c7d364-aa21-4b3b-8624-d210fd83c965.png';

    console.log(`Attempting to update ${id}...`);

    // Check if exists
    const { data: exists, error: fetchError } = await supabase.from('products').select('id, name').eq('id', id).single();
    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        return;
    }
    console.log('Product Found:', exists);

    // Update
    const { data, error } = await supabase
        .from('products')
        .update({ image: image, images: [image] })
        .eq('id', id)
        .select();

    if (error) {
        console.error('Update Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Update Success:', data);
    }
}

debugUpdate().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
