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

async function checkSchema() {
    const id = '28c7d364-aa21-4b3b-8624-d210fd83c965';
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) console.error(error);
    else console.log(Object.keys(data));
}

checkSchema().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
