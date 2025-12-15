import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.from('products').select('name').order('name');
    if (error) throw error;

    const names = data.map(p => p.name).join('\n');
    fs.writeFileSync('baci_product_names.txt', names);
    console.log(`✅ Dumped ${data.length} names to baci_product_names.txt`);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
