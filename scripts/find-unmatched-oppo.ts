import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
async function run() {
    const { data: all, error } = await supabase.from('products').select('name, images').ilike('name', '%oppo%');

    if (error) {
        console.error('❌ Query failed:', error.message);
        process.exit(1);
    }

    if (!all) {
        console.error('❌ No data returned');
        process.exit(1);
    }

    const unmatched = all.filter(p => !p.images || p.images.length === 0 || p.images[0] === null);
    console.log('📉 Unmatched Oppo Products:', unmatched.length);
    unmatched.forEach(p => console.log('   -', p.name));
}
run().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
