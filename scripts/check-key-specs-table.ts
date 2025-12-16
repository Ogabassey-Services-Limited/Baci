
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkKeySpecsTable() {
    const { data, error } = await supabase
        .from('product_key_specs')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Found product_key_specs table rows:', data.length);
        if (data.length > 0) console.log(data[0]);
    }
}

checkKeySpecsTable();
