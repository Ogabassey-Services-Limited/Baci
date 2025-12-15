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

async function listApple() {
    const { data } = await supabase
        .from('products')
        .select('name')
        .or('brand.ilike.Apple,name.ilike.%Apple%,name.ilike.%iPhone%,name.ilike.%MacBook%,name.ilike.%iPad%')
        .limit(50);

    console.log(JSON.stringify(data, null, 2));
}

listApple().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
