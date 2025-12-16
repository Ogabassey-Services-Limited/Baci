
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
    console.log('Checking products columns...');
    // We can't query information_schema directly with supabase-js easily unless we use rpc or just try to select
    // Trying to insert a dummy row into products to see what fails or just select * limit 1
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error selecting:', error);
    } else if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('No data found, but select succeeded. Columns unknown.');
    }
}

checkSchema();
