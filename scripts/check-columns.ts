import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkSchema() {
    const id = '28c7d364-aa21-4b3b-8624-d210fd83c965';
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
    if (error) console.error(error);
    else console.log(Object.keys(data));
}

checkSchema();
