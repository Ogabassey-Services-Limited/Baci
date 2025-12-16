
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) console.error(error);
    else console.log('Buckets:', data?.map(b => b.name));
}

main();
